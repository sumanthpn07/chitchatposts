/**
 * Slack Handlers
 * 
 * Event handlers for Slack messages and slash commands.
 * Integrates conversation buffer and LLM analysis.
 */

import { addMessage, getMessages, shouldStoreMessage } from '../services/conversationBuffer.js';
import { analyzeConversation, isConfigured, LLM_PROVIDER } from '../services/llm.js';

const MIN_MESSAGES_FOR_ANALYSIS = parseInt(process.env.MIN_MESSAGES_FOR_ANALYSIS, 10) || 5;

/**
 * Handle incoming message events
 * Stores valid messages to the conversation buffer
 */
function handleMessage({ event, message }) {
    // Use event or message depending on what's available
    const msg = message || event;

    if (!shouldStoreMessage(msg)) {
        return;
    }

    const { channel, user, text, ts } = msg;
    addMessage(channel, user, text, ts);
}

/**
 * Format the analysis result as Slack blocks
 * @param {Object} analysis - LLM analysis result
 * @returns {Array} - Slack blocks
 */
function formatAnalysisBlocks(analysis) {
    if (!analysis.isPostWorthy) {
        return [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*No post-worthy content found*\n\n${analysis.reasoning}`,
                },
            },
        ];
    }

    const blocks = [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: '💡 Post-worthy idea spotted',
                emoji: true,
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*Why this works:*\n${analysis.reasoning}`,
            },
        },
        {
            type: 'divider',
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*📝 LinkedIn Draft:*\n\n${analysis.linkedInDraft}`,
            },
        },
        {
            type: 'divider',
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*𝕏 Twitter/X Draft:*\n\n${analysis.xDraft}`,
            },
        },
        {
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: `_Analyzed with ${LLM_PROVIDER} • Human review required before posting_`,
                },
            ],
        },
    ];

    return blocks;
}

/**
 * Handle /chitchatposts slash command
 */
async function handleSlashCommand({ command, ack, respond }) {
    // Acknowledge immediately
    await ack();

    const { channel_id: channelId, text } = command;

    // Only handle 'analyze' subcommand
    if (text.trim().toLowerCase() !== 'analyze') {
        await respond({
            text: 'Usage: `/chitchatposts analyze` - Analyze recent conversation for post-worthy ideas',
            response_type: 'ephemeral',
        });
        return;
    }

    // Check if LLM is configured
    if (!isConfigured()) {
        await respond({
            text: `⚠️ LLM not configured. Please set ${LLM_PROVIDER === 'claude' ? 'CLAUDE_API_KEY' : 'OPENAI_API_KEY'} in your environment.`,
            response_type: 'ephemeral',
        });
        return;
    }

    // Get messages from buffer
    const messages = getMessages(channelId);

    if (messages.length < MIN_MESSAGES_FOR_ANALYSIS) {
        await respond({
            text: `Not enough meaningful conversation yet. Need at least ${MIN_MESSAGES_FOR_ANALYSIS} messages (currently have ${messages.length}).`,
            response_type: 'ephemeral',
        });
        return;
    }

    // Notify user that analysis is in progress
    await respond({
        text: '🔍 Analyzing conversation...',
        response_type: 'ephemeral',
    });

    try {
        // Analyze conversation
        const analysis = await analyzeConversation(messages);

        if (analysis.error) {
            await respond({
                text: `⚠️ Analysis failed: ${analysis.reasoning}\n\nPlease try again later.`,
                response_type: 'ephemeral',
                replace_original: true,
            });
            return;
        }

        // Send formatted response
        await respond({
            blocks: formatAnalysisBlocks(analysis),
            response_type: 'ephemeral',
            replace_original: true,
        });
    } catch (error) {
        console.error('[SlashCommand] Error during analysis:', error);
        await respond({
            text: '⚠️ Something went wrong during analysis. Please try again later.',
            response_type: 'ephemeral',
            replace_original: true,
        });
    }
}

/**
 * Register all Slack handlers with the Bolt app
 * @param {App} app - Slack Bolt app instance
 */
export function registerSlackHandlers(app) {
    // Listen to all message events
    app.message(handleMessage);

    // Listen to slash command
    app.command('/chitchatposts', handleSlashCommand);

    console.log('[Handlers] Slack handlers registered');
}
