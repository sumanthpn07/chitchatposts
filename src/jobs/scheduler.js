/**
 * Scheduler Service
 * 
 * Cron jobs for automated analysis:
 * - Every 6 hours: Analyze recent messages
 * - Daily at midnight: Comprehensive summary
 */

import cron from 'node-cron';
import { fetchSlackHistory } from '../services/slackHistory.js';
import { analyzeConversation, isConfigured } from '../services/llm.js';
import { checkDuplicate } from '../services/deduplication.js';
import { storeSuggestion, getLastAnalyzedTs, setLastAnalyzedTs } from '../services/suggestionStore.js';

// Configuration
const SUGGESTIONS_CHANNEL_ID = process.env.SUGGESTIONS_CHANNEL_ID;
const MONITORED_CHANNELS = process.env.MONITORED_CHANNELS?.split(',').map(c => c.trim()).filter(Boolean) || [];
const CRON_ENABLED = process.env.CRON_ENABLED === 'true';
const MIN_MESSAGES_FOR_ANALYSIS = parseInt(process.env.MIN_MESSAGES_FOR_ANALYSIS, 10) || 5;

// Store reference to Slack client
let slackClient = null;

/**
 * Format suggestion as Slack blocks for posting
 * @param {Object} analysis - LLM analysis result
 * @param {string} source - Source description (e.g., "6-hour analysis")
 * @returns {Array} - Slack blocks
 */
function formatSuggestionBlocks(analysis, source) {
    return [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: '💡 New Post Suggestion',
                emoji: true,
            },
        },
        {
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: `Source: ${source} • Generated automatically`,
                },
            ],
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
                    text: '_Please review and edit before posting. Human approval required._',
                },
            ],
        },
    ];
}

/**
 * Post suggestion to the suggestions channel
 * @param {Object} analysis - LLM analysis result
 * @param {string} source - Source description
 */
async function postSuggestion(analysis, source) {
    if (!SUGGESTIONS_CHANNEL_ID) {
        console.warn('[Scheduler] SUGGESTIONS_CHANNEL_ID not configured, skipping post');
        return;
    }

    if (!slackClient) {
        console.warn('[Scheduler] Slack client not initialized');
        return;
    }

    try {
        await slackClient.chat.postMessage({
            channel: SUGGESTIONS_CHANNEL_ID,
            blocks: formatSuggestionBlocks(analysis, source),
            text: '💡 New post suggestion available',
        });
        console.log(`[Scheduler] Posted suggestion to ${SUGGESTIONS_CHANNEL_ID}`);
    } catch (error) {
        console.error('[Scheduler] Failed to post suggestion:', error.message);
    }
}

/**
 * Analyze messages from a specific time range
 * @param {number} hoursBack - How many hours to look back
 * @param {string} source - Source description for logging
 */
async function runAnalysis(hoursBack, source) {
    if (!slackClient) {
        console.warn('[Scheduler] Slack client not initialized, skipping analysis');
        return;
    }

    if (!isConfigured()) {
        console.warn('[Scheduler] LLM not configured, skipping analysis');
        return;
    }

    const channels = MONITORED_CHANNELS.length > 0
        ? MONITORED_CHANNELS
        : [SUGGESTIONS_CHANNEL_ID]; // Fallback to suggestions channel

    console.log(`[Scheduler] Running ${source} for ${channels.length} channel(s)`);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const oldestSeconds = nowSeconds - (hoursBack * 60 * 60);

    for (const channelId of channels) {
        if (!channelId) continue;

        try {
            // Fetch messages
            const messages = await fetchSlackHistory(slackClient, channelId, oldestSeconds);

            if (messages.length < MIN_MESSAGES_FOR_ANALYSIS) {
                console.log(`[Scheduler] Not enough messages in ${channelId} (${messages.length}/${MIN_MESSAGES_FOR_ANALYSIS})`);
                continue;
            }

            // Check if we already analyzed up to the latest message
            const latestMessage = messages[messages.length - 1];
            const lastAnalyzedTs = getLastAnalyzedTs(channelId);

            if (lastAnalyzedTs && parseFloat(latestMessage.timestamp) <= parseFloat(lastAnalyzedTs)) {
                console.log(`[Scheduler] Skipping ${channelId} - No new messages since last analysis`);
                continue;
            }

            // Analyze
            const analysis = await analyzeConversation(messages);

            // Update checkpoint immediately to avoid re-analysis
            setLastAnalyzedTs(channelId, latestMessage.timestamp);


            if (!analysis.isPostWorthy || analysis.error) {
                console.log(`[Scheduler] No post-worthy content in ${channelId}`);
                continue;
            }

            // Check for duplicates
            const { isDuplicate, similarity } = checkDuplicate(analysis);
            if (isDuplicate) {
                console.log(`[Scheduler] Skipping duplicate (${(similarity * 100).toFixed(1)}% similar)`);
                continue;
            }

            // Store and post
            storeSuggestion(analysis);
            await postSuggestion(analysis, source);

        } catch (error) {
            console.error(`[Scheduler] Error analyzing ${channelId}:`, error.message);
        }
    }
}

/**
 * 6-hour analysis job
 */
async function sixHourJob() {
    console.log('\n[Scheduler] ⏰ Running 6-hour analysis...');
    await runAnalysis(6, '6-hour analysis');
}

/**
 * Daily analysis job (runs at midnight)
 */
async function dailyJob() {
    console.log('\n[Scheduler] ⏰ Running daily analysis...');
    await runAnalysis(24, 'Daily summary');
}

/**
 * Initialize the scheduler
 * @param {Object} client - Slack WebClient
 */
export function initScheduler(client) {
    slackClient = client;

    if (!CRON_ENABLED) {
        console.log('[Scheduler] Cron jobs disabled (CRON_ENABLED=false)');
        return;
    }

    if (!SUGGESTIONS_CHANNEL_ID) {
        console.warn('[Scheduler] SUGGESTIONS_CHANNEL_ID not set, automated suggestions disabled');
        return;
    }

    // // Every 6 hours: at 0:00, 6:00, 12:00, 18:00
    // cron.schedule('0 0,6,12,18 * * *', sixHourJob, {
    //     timezone: 'UTC',
    // });

    // // Daily at midnight UTC
    // cron.schedule('0 0 * * *', dailyJob, {
    //     timezone: 'UTC',
    // });

    cron.schedule('*/2 * * * *', sixHourJob, { timezone: 'UTC' });
    cron.schedule('*/8 * * * *', dailyJob, { timezone: 'UTC' });

    console.log('[Scheduler] ✅ Cron jobs initialized');
    console.log('[Scheduler] - 6-hour analysis: Every 6 hours (0:00, 6:00, 12:00, 18:00 UTC)');
    console.log('[Scheduler] - Daily summary: Midnight UTC');
    console.log(`[Scheduler] - Suggestions channel: ${SUGGESTIONS_CHANNEL_ID}`);
    console.log(`[Scheduler] - Monitored channels: ${MONITORED_CHANNELS.length > 0 ? MONITORED_CHANNELS.join(', ') : 'All'}`);
}

/**
 * Manually trigger analysis (for testing)
 * @param {number} hoursBack - Hours to look back
 */
export async function triggerManualAnalysis(hoursBack = 6) {
    console.log(`[Scheduler] Manual analysis triggered (${hoursBack}h)`);
    await runAnalysis(hoursBack, `Manual analysis (${hoursBack}h)`);
}
