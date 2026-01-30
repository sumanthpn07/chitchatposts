/**
 * Slack Handlers
 * 
 * Event handlers for Slack messages and slash commands.
 * Integrates conversation buffer, LLM analysis, history fetching, and deduplication.
 */

import { addMessage, getMessages, shouldStoreMessage } from '../services/conversationBuffer.js';
import { analyzeConversation, isConfigured, LLM_PROVIDER } from '../services/llm.js';
import { fetchHistoryByTime, fetchMessagesSince } from '../services/slackHistory.js';
import { storeSuggestion, getLastSyncTimestamp, updateSyncTimestamp } from '../services/suggestionStore.js';
import { checkDuplicate } from '../services/deduplication.js';

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
 * @param {Object} options - Additional options (source, isDuplicate)
 * @returns {Array} - Slack blocks
 */
function formatAnalysisBlocks(analysis, options = {}) {
    const { source = 'analyze', duplicateInfo = null } = options;

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
    ];

    // Add source context if not default analyze
    if (source !== 'analyze') {
        blocks.push({
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: `Source: ${source}`,
                },
            ],
        });
    }

    blocks.push(
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
        }
    );

    // Add duplicate warning if similar content exists
    if (duplicateInfo && duplicateInfo.similarity > 0.5) {
        blocks.push({
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: `⚠️ _${(duplicateInfo.similarity * 100).toFixed(0)}% similar to a previous suggestion_`,
                },
            ],
        });
    }

    blocks.push({
        type: 'context',
        elements: [
            {
                type: 'mrkdwn',
                text: `_Analyzed with ${LLM_PROVIDER} • Human review required before posting_`,
            },
        ],
    });

    return blocks;
}

/**
 * Perform analysis and respond
 * @param {Array} messages - Messages to analyze
 * @param {Function} respond - Slack respond function
 * @param {Object} options - Options (source for display)
 */
async function performAnalysis(messages, respond, options = {}) {
    const { source = 'Real-time buffer' } = options;

    if (messages.length < MIN_MESSAGES_FOR_ANALYSIS) {
        await respond({
            text: `Not enough meaningful conversation. Need at least ${MIN_MESSAGES_FOR_ANALYSIS} messages (found ${messages.length}).`,
            response_type: 'ephemeral',
            replace_original: true,
        });
        return;
    }

    try {
        const analysis = await analyzeConversation(messages);

        if (analysis.error) {
            await respond({
                text: `⚠️ Analysis failed: ${analysis.reasoning}\n\nPlease try again later.`,
                response_type: 'ephemeral',
                replace_original: true,
            });
            return;
        }

        // Check for duplicates
        const duplicateInfo = analysis.isPostWorthy ? checkDuplicate(analysis) : null;

        // Store if post-worthy
        if (analysis.isPostWorthy) {
            storeSuggestion(analysis);
        }

        // Send formatted response
        await respond({
            blocks: formatAnalysisBlocks(analysis, { source, duplicateInfo }),
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
 * Handle /chitchatposts slash command
 */
async function handleSlashCommand({ command, ack, respond, client }) {
    // Acknowledge immediately
    await ack();

    const { channel_id: channelId, text } = command;
    const args = text.trim().toLowerCase().split(/\s+/);
    const subcommand = args[0] || 'help';

    // Check if LLM is configured
    if (!isConfigured()) {
        await respond({
            text: `⚠️ LLM not configured. Please set ${LLM_PROVIDER === 'claude' ? 'CLAUDE_API_KEY' : 'OPENAI_API_KEY'} in your environment.`,
            response_type: 'ephemeral',
        });
        return;
    }

    switch (subcommand) {
        case 'analyze': {
            // Analyze real-time buffer
            const messages = getMessages(channelId);

            if (messages.length < MIN_MESSAGES_FOR_ANALYSIS) {
                await respond({
                    text: `Not enough meaningful conversation yet. Need at least ${MIN_MESSAGES_FOR_ANALYSIS} messages (currently have ${messages.length}).`,
                    response_type: 'ephemeral',
                });
                return;
            }

            await respond({
                text: '🔍 Analyzing conversation...',
                response_type: 'ephemeral',
            });

            await performAnalysis(messages, respond, { source: 'Real-time buffer' });
            break;
        }

        case 'history': {
            // Analyze historical messages
            const timeArg = args[1];

            if (!timeArg) {
                await respond({
                    text: 'Usage: `/chitchatposts history [time]`\n\nExamples:\n• `/chitchatposts history 1h` - Last 1 hour\n• `/chitchatposts history 4h` - Last 4 hours\n• `/chitchatposts history 1d` - Last 1 day',
                    response_type: 'ephemeral',
                });
                return;
            }

            // Validate time format
            if (!/^\d+[hd]$/i.test(timeArg)) {
                await respond({
                    text: `Invalid time format: \`${timeArg}\`\n\nUse format like \`1h\`, \`4h\`, or \`1d\``,
                    response_type: 'ephemeral',
                });
                return;
            }

            await respond({
                text: `🔍 Fetching messages from the last ${timeArg}...`,
                response_type: 'ephemeral',
            });

            try {
                const messages = await fetchHistoryByTime(client, channelId, timeArg);
                await performAnalysis(messages, respond, { source: `Last ${timeArg}` });
            } catch (error) {
                console.error('[SlashCommand] History fetch error:', error);
                await respond({
                    text: `⚠️ ${error.message}`,
                    response_type: 'ephemeral',
                    replace_original: true,
                });
            }
            break;
        }

        case 'sync': {
            // Fetch messages since last sync
            const lastSync = getLastSyncTimestamp(channelId);

            if (!lastSync) {
                await respond({
                    text: '🔄 No previous sync found. Fetching last 4 hours instead...',
                    response_type: 'ephemeral',
                });

                try {
                    const messages = await fetchHistoryByTime(client, channelId, '4h');

                    // Update sync timestamp to now
                    if (messages.length > 0) {
                        const latestTs = messages[messages.length - 1].timestamp;
                        updateSyncTimestamp(channelId, latestTs);
                    }

                    await performAnalysis(messages, respond, { source: 'Initial sync (4h)' });
                } catch (error) {
                    console.error('[SlashCommand] Sync error:', error);
                    await respond({
                        text: `⚠️ ${error.message}`,
                        response_type: 'ephemeral',
                        replace_original: true,
                    });
                }
                return;
            }

            await respond({
                text: `🔄 Syncing messages since last checkpoint...`,
                response_type: 'ephemeral',
            });

            try {
                const messages = await fetchMessagesSince(client, channelId, lastSync);

                // Update sync timestamp
                if (messages.length > 0) {
                    const latestTs = messages[messages.length - 1].timestamp;
                    updateSyncTimestamp(channelId, latestTs);
                }

                await performAnalysis(messages, respond, { source: 'Sync update' });
            } catch (error) {
                console.error('[SlashCommand] Sync error:', error);
                await respond({
                    text: `⚠️ ${error.message}`,
                    response_type: 'ephemeral',
                    replace_original: true,
                });
            }
            break;
        }

        default: {
            // Show help
            await respond({
                text: `*ChitChatPosts Commands*\n\n` +
                    `• \`/chitchatposts analyze\` - Analyze real-time conversation buffer\n` +
                    `• \`/chitchatposts history 1h\` - Analyze last 1 hour (also: 4h, 1d)\n` +
                    `• \`/chitchatposts sync\` - Sync and analyze since last checkpoint\n\n` +
                    `_All suggestions require human review before posting._`,
                response_type: 'ephemeral',
            });
        }
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
