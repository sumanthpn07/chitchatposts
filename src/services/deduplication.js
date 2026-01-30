/**
 * Deduplication Service
 * 
 * Detects similar suggestions to avoid posting duplicate content.
 * Uses simple text similarity comparison.
 */

import { getStoredSuggestions, generateFingerprint } from './suggestionStore.js';

// Similarity threshold (0-1). Suggestions above this are considered duplicates.
const SIMILARITY_THRESHOLD = 0.8;

/**
 * Calculate Jaccard similarity between two texts
 * @param {string} text1 
 * @param {string} text2 
 * @returns {number} - Similarity score (0-1)
 */
function calculateJaccardSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    if (words1.size === 0 && words2.size === 0) return 1;
    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
}

/**
 * Calculate similarity using multiple methods and return the max
 * @param {string} text1 
 * @param {string} text2 
 * @returns {number} - Similarity score (0-1)
 */
function calculateSimilarity(text1, text2) {
    const fp1 = generateFingerprint(text1);
    const fp2 = generateFingerprint(text2);

    // Exact match
    if (fp1 === fp2) return 1;

    // Jaccard similarity
    return calculateJaccardSimilarity(fp1, fp2);
}

/**
 * Check if a suggestion is a duplicate of any stored suggestion
 * @param {Object} suggestion - New suggestion to check
 * @returns {Object} - { isDuplicate: boolean, similarity: number, matchedWith: Object|null }
 */
export function checkDuplicate(suggestion) {
    const storedSuggestions = getStoredSuggestions();

    if (storedSuggestions.length === 0) {
        return { isDuplicate: false, similarity: 0, matchedWith: null };
    }

    const newContent = suggestion.linkedInDraft || suggestion.xDraft || '';
    if (!newContent) {
        return { isDuplicate: false, similarity: 0, matchedWith: null };
    }

    let maxSimilarity = 0;
    let bestMatch = null;

    for (const stored of storedSuggestions) {
        const storedContent = stored.linkedInDraft || stored.xDraft || '';
        if (!storedContent) continue;

        const similarity = calculateSimilarity(newContent, storedContent);

        if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            bestMatch = stored;
        }

        // Early exit if we find an exact match
        if (similarity >= 0.99) break;
    }

    const isDuplicate = maxSimilarity >= SIMILARITY_THRESHOLD;

    if (isDuplicate) {
        console.log(`[Deduplication] Duplicate found (${(maxSimilarity * 100).toFixed(1)}% similarity)`);
    }

    return {
        isDuplicate,
        similarity: maxSimilarity,
        matchedWith: bestMatch,
    };
}

/**
 * Filter out duplicate suggestions from an array
 * @param {Array} suggestions - Array of suggestions
 * @returns {Array} - Filtered array with duplicates removed
 */
export function filterDuplicates(suggestions) {
    return suggestions.filter(suggestion => {
        const { isDuplicate } = checkDuplicate(suggestion);
        return !isDuplicate;
    });
}

/**
 * Get the similarity threshold
 * @returns {number}
 */
export function getSimilarityThreshold() {
    return SIMILARITY_THRESHOLD;
}
