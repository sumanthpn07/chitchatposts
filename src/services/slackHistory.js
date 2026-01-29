/**
 * Slack History Service
 * 
 * Fetches historical messages from Slack API for analysis.
 * Used by /chitchatposts history and /chitchatposts sync commands.
 */

import { shouldStoreMessage } from './conversationBuffer.js';

/**
 * Parse time string into milliseconds
 * @param {string} timeStr - e.g., "1h", "4h", "1d"
 * @returns {number} - milliseconds
 */
export function parseTimeString(timeStr) {
    const match = timeStr.match(/^(\d+)([hd])$/i);
    if (!match) {
        throw new Error('Invalid time format. Use: 1h, 4h, 1d');
    }

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
        case 'h':
            return value * 60 * 60 * 1000;
        case 'd':
            return value * 24 * 60 * 60 * 1000;
        default:
            throw new Error('Invalid time unit. Use h (hours) or d (days)');
    }
}

/**
 * Fetch messages from Slack history API
 * @param {Object} client - Slack WebClient
 * @param {string} channelId - Channel to fetch from
 * @param {number} oldest - Unix timestamp (seconds) for oldest message
 * @param {number} latest - Unix timestamp (seconds) for latest message (optional)
 * @returns {Promise<Array>} - Array of filtered messages
 */
export async function fetchSlackHistory(client, channelId, oldest, latest = null) {
    const messages = [];
    let cursor = undefined;
    let hasMore = true;

    console.log(`[SlackHistory] Fetching messages from ${channelId} since ${new Date(oldest * 1000).toISOString()}`);

    try {
        while (hasMore) {
            const params = {
                channel: channelId,
                oldest: oldest.toString(),
                limit: 200, // Max per request
                cursor,
            };

            if (latest) {
                params.latest = latest.toString();
            }

            const response = await client.conversations.history(params);

            if (!response.ok) {
                throw new Error(`Slack API error: ${response.error}`);
            }

            // Filter messages using the same logic as real-time buffer
            for (const msg of response.messages || []) {
                if (shouldStoreMessage(msg)) {
                    messages.push({
                        user: msg.user,
                        text: msg.text,
                        timestamp: msg.ts,
                        addedAt: parseFloat(msg.ts) * 1000,
                    });
                }
            }

            // Check for pagination
            hasMore = response.has_more && response.response_metadata?.next_cursor;
            cursor = response.response_metadata?.next_cursor;
        }

        // Sort by timestamp (oldest first)
        messages.sort((a, b) => parseFloat(a.timestamp) - parseFloat(b.timestamp));

        console.log(`[SlackHistory] Fetched ${messages.length} messages from ${channelId}`);
        return messages;

    } catch (error) {
        if (error.data?.error === 'channel_not_found') {
            throw new Error('Channel not found. Make sure the bot is added to this channel.');
        }
        if (error.data?.error === 'not_in_channel') {
            throw new Error('Bot is not in this channel. Invite the bot first with /invite @ChitChatPosts');
        }
        throw error;
    }
}

/**
 * Fetch messages from the last N hours
 * @param {Object} client - Slack WebClient
 * @param {string} channelId - Channel ID
 * @param {string} timeStr - Time string like "1h", "4h", "1d"
 * @returns {Promise<Array>} - Array of messages
 */
export async function fetchHistoryByTime(client, channelId, timeStr) {
    const durationMs = parseTimeString(timeStr);
    const nowMs = Date.now();
    const oldestMs = nowMs - durationMs;
    const oldestUnix = Math.floor(oldestMs / 1000);

    return fetchSlackHistory(client, channelId, oldestUnix);
}

/**
 * Fetch messages since a specific timestamp
 * @param {Object} client - Slack WebClient
 * @param {string} channelId - Channel ID
 * @param {string} sinceTs - Slack timestamp to start from
 * @returns {Promise<Array>} - Array of messages
 */
export async function fetchMessagesSince(client, channelId, sinceTs) {
    const oldestUnix = parseFloat(sinceTs);
    return fetchSlackHistory(client, channelId, oldestUnix);
}
