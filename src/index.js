/**
 * ChitChatPosts - Slack Bot Entry Point
 * 
 * Observes Slack conversations and suggests post-worthy ideas
 * for LinkedIn and X (Twitter). Human-in-the-loop only.
 */

import 'dotenv/config';
import { App } from '@slack/bolt';
import { registerSlackHandlers } from './handlers/slackHandlers.js';
import { isConfigured, LLM_PROVIDER } from './services/llm.js';

// Validate required environment variables
const requiredEnvVars = ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'SLACK_APP_TOKEN'];
const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please copy .env.example to .env and fill in your credentials.');
  process.exit(1);
}

// Initialize Slack Bolt app with Socket Mode
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// Register message and command handlers
registerSlackHandlers(app);

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await app.start(PORT);
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   ⚡️ ChitChatPosts is running!                           ║
║                                                          ║
║   Mode: Socket Mode (real-time events)                   ║
║   Port: ${PORT}                                            ║
║   LLM Provider: ${LLM_PROVIDER.padEnd(40)}║
║   LLM Configured: ${isConfigured() ? '✅ Yes' : '⚠️  No (set API key)'} ${' '.repeat(32 - (isConfigured() ? 6 : 21))}║
║                                                          ║
║   Commands:                                              ║
║   /chitchatposts analyze - Analyze recent conversation   ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    `);
  } catch (error) {
    console.error('❌ Failed to start ChitChatPosts:', error);
    process.exit(1);
  }
})();
