/**
 * LLM Service
 * 
 * Configurable LLM integration supporting OpenAI and Claude.
 * Analyzes conversation context to identify post-worthy moments.
 */

import OpenAI from 'openai';

const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai';

// Initialize OpenAI client (used for both OpenAI and Claude-compatible APIs)
let openaiClient = null;

function getOpenAIClient() {
    if (!openaiClient) {
        if (LLM_PROVIDER === 'claude') {
            // Anthropic API via OpenAI-compatible endpoint
            openaiClient = new OpenAI({
                apiKey: process.env.CLAUDE_API_KEY,
                baseURL: 'https://api.anthropic.com/v1/',
                defaultHeaders: {
                    'anthropic-version': '2023-06-01',
                },
            });
        } else {
            openaiClient = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            });
        }
    }
    return openaiClient;
}

/**
 * System prompt for analyzing conversations
 */
const SYSTEM_PROMPT = `You are an expert content strategist helping founders and product teams identify post-worthy moments from their Slack conversations.

Your job is to analyze the conversation and identify moments that would make compelling LinkedIn or X (Twitter) posts.

FOCUS ON:
- Real insights and learnings
- Product decisions and the reasoning behind them
- Founder learnings and reflections
- Growth or engineering tradeoffs
- Interesting technical discoveries
- Team culture moments that show authenticity

EXPLICITLY AVOID:
- Clickbait or sensationalized content
- Inventing or exaggerating facts
- Inside jokes that won't translate
- Logistics, scheduling, or mundane updates
- Generic advice without specific context

RESPONSE FORMAT:
Respond in valid JSON with this structure:
{
  "isPostWorthy": boolean,
  "reasoning": "Brief explanation of why this is (or isn't) post-worthy",
  "linkedInDraft": "Full LinkedIn post draft (or null if not post-worthy)",
  "xDraft": "Full X/Twitter post draft, max 280 chars (or null if not post-worthy)"
}

If the conversation doesn't contain anything post-worthy, set isPostWorthy to false and explain why in reasoning.`;

/**
 * Format messages into a conversation context string
 * @param {Array} messages - Array of message objects
 * @returns {string}
 */
function formatConversation(messages) {
    return messages
        .map((msg, idx) => `[${idx + 1}] User ${msg.user}: ${msg.text}`)
        .join('\n\n');
}

/**
 * Analyze a conversation to identify post-worthy moments
 * @param {Array} messages - Array of message objects { user, text, timestamp }
 * @returns {Promise<Object>} - Analysis result
 */
export async function analyzeConversation(messages) {
    if (!messages || messages.length === 0) {
        return {
            isPostWorthy: false,
            reasoning: 'No messages to analyze.',
            linkedInDraft: null,
            xDraft: null,
        };
    }

    const conversationContext = formatConversation(messages);

    console.log(`[LLM] Analyzing ${messages.length} messages with ${LLM_PROVIDER}...`);

    try {
        const client = getOpenAIClient();
        const model = LLM_PROVIDER === 'claude' ? 'claude-3-sonnet-20240229' : 'gpt-4o-mini';

        const response = await client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `Analyze this Slack conversation and identify any post-worthy moments:\n\n${conversationContext}`
                },
            ],
            temperature: 0.7,
            max_tokens: 1024,
        });

        const content = response.choices[0]?.message?.content;

        if (!content) {
            throw new Error('Empty response from LLM');
        }

        // Parse JSON response (handle potential markdown code blocks)
        let jsonContent = content;
        if (content.includes('```json')) {
            jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (content.includes('```')) {
            jsonContent = content.replace(/```\n?/g, '');
        }

        const result = JSON.parse(jsonContent.trim());

        console.log(`[LLM] Analysis complete. Post-worthy: ${result.isPostWorthy}`);

        return {
            isPostWorthy: result.isPostWorthy || false,
            reasoning: result.reasoning || 'No reasoning provided.',
            linkedInDraft: result.linkedInDraft || null,
            xDraft: result.xDraft || null,
        };
    } catch (error) {
        console.error('[LLM] Error analyzing conversation:', error.message);

        // Return a graceful error response
        return {
            isPostWorthy: false,
            reasoning: `Analysis failed: ${error.message}`,
            linkedInDraft: null,
            xDraft: null,
            error: true,
        };
    }
}

/**
 * Check if the LLM service is properly configured
 * @returns {boolean}
 */
export function isConfigured() {
    if (LLM_PROVIDER === 'claude') {
        return !!process.env.CLAUDE_API_KEY;
    }
    return !!process.env.OPENAI_API_KEY;
}

export { LLM_PROVIDER };
