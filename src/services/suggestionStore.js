/**
 * Suggestion Store Service
 * 
 * In-memory storage for:
 * - Past suggestions (for deduplication)
 * - Sync timestamps per channel
 */

// Store for past suggestions: { fingerprintHash: { suggestion, timestamp } }
const suggestionHistory = new Map();

// Store for sync timestamps: { channelId: lastSyncTimestamp }
const syncTimestamps = new Map();

// Store for last analyzed message timestamp: { channelId: lastAnalyzedTs }
// Used to skip analysis if no new messages have arrived
const lastAnalyzedTimestamps = new Map();

// Per-channel cooldown: last time we posted content from this monitored channel (ms)
const lastPostedByChannel = new Map();

// Maximum suggestions to keep in history
const MAX_HISTORY_SIZE = 100;

/**
 * Generate a simple fingerprint from suggestion text
 * @param {string} text - Suggestion text
 * @returns {string} - Normalized fingerprint
 */
export function generateFingerprint(text) {
    if (!text) return '';

    // Normalize: lowercase, remove punctuation, collapse whitespace
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Store a suggestion in history
 * @param {Object} suggestion - The suggestion object
 */
export function storeSuggestion(suggestion) {
    const fingerprint = generateFingerprint(suggestion.linkedInDraft || suggestion.xDraft || '');

    if (!fingerprint) return;

    // Prune old suggestions if over limit
    if (suggestionHistory.size >= MAX_HISTORY_SIZE) {
        // Remove oldest entry
        const oldestKey = suggestionHistory.keys().next().value;
        suggestionHistory.delete(oldestKey);
    }

    suggestionHistory.set(fingerprint, {
        suggestion,
        timestamp: Date.now(),
    });

    console.log(`[SuggestionStore] Stored suggestion (${suggestionHistory.size} in history)`);
}

/**
 * Get all stored suggestions
 * @returns {Array} - Array of past suggestions
 */
export function getStoredSuggestions() {
    return Array.from(suggestionHistory.values()).map(entry => entry.suggestion);
}

/**
 * Clear all stored suggestions
 */
export function clearSuggestions() {
    suggestionHistory.clear();
    console.log('[SuggestionStore] Cleared all suggestions');
}

/**
 * Get the last sync timestamp for a channel
 * @param {string} channelId - Channel ID
 * @returns {string|null} - Last sync timestamp or null
 */
export function getLastSyncTimestamp(channelId) {
    return syncTimestamps.get(channelId) || null;
}

/**
 * Update the sync timestamp for a channel
 * @param {string} channelId - Channel ID
 * @param {string} timestamp - Slack timestamp
 */
export function updateSyncTimestamp(channelId, timestamp) {
    syncTimestamps.set(channelId, timestamp);
    console.log(`[SuggestionStore] Updated sync timestamp for ${channelId}: ${timestamp}`);
}

/**
 * Get all sync timestamps
 * @returns {Object} - Map of channelId to timestamp
 */
export function getAllSyncTimestamps() {
    return Object.fromEntries(syncTimestamps);
}

/**
 * Get statistics about the store
 * @returns {Object}
 */
export function getStoreStats() {
    return {
        suggestionsCount: suggestionHistory.size,
        syncChannelsCount: syncTimestamps.size,
        channels: Object.fromEntries(syncTimestamps),
    };
}

/**
 * Get the timestamp of the last message analyzed for a channel
 * @param {string} channelId 
 * @returns {string|null} - Slack timestamp or null
 */
export function getLastAnalyzedTs(channelId) {
    return lastAnalyzedTimestamps.get(channelId) || null;
}

/**
 * Update the timestamp of the last message analyzed for a channel
 * @param {string} channelId 
 * @param {string} ts - Slack timestamp
 */
export function setLastAnalyzedTs(channelId, ts) {
    lastAnalyzedTimestamps.set(channelId, ts);
}
