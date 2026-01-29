/**
 * Conversation Buffer Service
 * 
 * In-memory storage for Slack messages with:
 * - Rolling time window (default 4 hours)
 * - Channel-grouped storage
 * - Auto-cleanup on add
 */

// Default buffer window in milliseconds (4 hours)
const BUFFER_WINDOW_MS = (parseInt(process.env.BUFFER_WINDOW_HOURS, 10) || 4) * 60 * 60 * 1000;
const MIN_MESSAGE_LENGTH = 5;

// In-memory storage: { channelId: [{ user, text, timestamp, addedAt }] }
const channelBuffers = new Map();

/**
 * Check if a message should be stored
 * @param {Object} event - Slack message event
 * @returns {boolean}
 */
function shouldStoreMessage(event) {
  // Ignore bot messages
  if (event.bot_id || event.subtype === 'bot_message') {
    return false;
  }

  // Ignore message edits
  if (event.subtype === 'message_changed' || event.subtype === 'message_deleted') {
    return false;
  }

  // Ignore short messages
  if (!event.text || event.text.trim().length < MIN_MESSAGE_LENGTH) {
    return false;
  }

  return true;
}

/**
 * Clean up old messages from a channel buffer
 * @param {string} channelId 
 */
function cleanupOldMessages(channelId) {
  const buffer = channelBuffers.get(channelId);
  if (!buffer) return;

  const cutoffTime = Date.now() - BUFFER_WINDOW_MS;
  const filtered = buffer.filter(msg => msg.addedAt > cutoffTime);
  
  if (filtered.length === 0) {
    channelBuffers.delete(channelId);
  } else {
    channelBuffers.set(channelId, filtered);
  }
}

/**
 * Add a message to the buffer
 * @param {string} channelId - Slack channel ID
 * @param {string} user - User ID who sent the message
 * @param {string} text - Message text
 * @param {string} timestamp - Slack message timestamp
 * @returns {boolean} - Whether the message was stored
 */
export function addMessage(channelId, user, text, timestamp) {
  // Clean up old messages first
  cleanupOldMessages(channelId);

  const message = {
    user,
    text,
    timestamp,
    addedAt: Date.now(),
  };

  if (!channelBuffers.has(channelId)) {
    channelBuffers.set(channelId, []);
  }

  channelBuffers.get(channelId).push(message);
  
  console.log(`[Buffer] Added message from ${user} in ${channelId}: "${text.substring(0, 50)}..."`);
  return true;
}

/**
 * Get all messages from a channel (within the rolling window)
 * @param {string} channelId 
 * @returns {Array} - Array of messages
 */
export function getMessages(channelId) {
  cleanupOldMessages(channelId);
  return channelBuffers.get(channelId) || [];
}

/**
 * Clear all messages from a channel
 * @param {string} channelId 
 */
export function clearChannel(channelId) {
  channelBuffers.delete(channelId);
  console.log(`[Buffer] Cleared channel ${channelId}`);
}

/**
 * Get buffer statistics for debugging
 * @returns {Object}
 */
export function getStats() {
  const stats = {
    totalChannels: channelBuffers.size,
    channels: {},
  };

  for (const [channelId, messages] of channelBuffers) {
    stats.channels[channelId] = {
      messageCount: messages.length,
      oldestMessage: messages[0]?.addedAt,
      newestMessage: messages[messages.length - 1]?.addedAt,
    };
  }

  return stats;
}

/**
 * Check if a message event should be stored
 */
export { shouldStoreMessage };
