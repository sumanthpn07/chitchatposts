# ChitChatPosts

A Slack bot that observes conversations and suggests post-worthy ideas for LinkedIn and X (Twitter). Human-in-the-loop only — no auto-posting.

## Features

- **Conversation Buffering**: Stores messages in-memory with a rolling 4-hour window
- **Smart Filtering**: Ignores bot messages, edits, and short messages
- **LLM Analysis**: Uses OpenAI or Claude to identify post-worthy moments
- **Slack Integration**: `/chitchatposts analyze` command for on-demand analysis
- **Clean Output**: Formatted Slack blocks with LinkedIn and X drafts

## Requirements

- Node.js 18+
- Slack App with Socket Mode enabled
- OpenAI or Claude API key

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

| Variable | Description | Required |
| -------- | ----------- | -------- |
| `SLACK_BOT_TOKEN` | Bot User OAuth Token (xoxb-...) | ✅ |
| `SLACK_SIGNING_SECRET` | Signing Secret from Basic Information | ✅ |
| `SLACK_APP_TOKEN` | App-Level Token (xapp-...) for Socket Mode | ✅ |
| `LLM_PROVIDER` | `openai` or `claude` | Default: openai |
| `OPENAI_API_KEY` | OpenAI API key | If using OpenAI |
| `CLAUDE_API_KEY` | Claude API key | If using Claude |
| `BUFFER_WINDOW_HOURS` | Hours to keep messages | Default: 4 |
| `MIN_MESSAGES_FOR_ANALYSIS` | Minimum messages needed | Default: 5 |

### 3. Configure Slack App

1. Create a new Slack App at [api.slack.com/apps](https://api.slack.com/apps)
2. Enable **Socket Mode** under Settings
3. Generate an **App-Level Token** with `connections:write` scope
4. Add **Bot Token Scopes**:
   - `channels:history`
   - `groups:history`
   - `chat:write`
   - `commands`
5. Enable **Event Subscriptions** and subscribe to:
   - `message.channels`
   - `message.groups`
6. Create **Slash Command**: `/chitchatposts`
7. Install the app to your workspace

### 4. Run the bot

```bash
npm run dev
```

## Usage

1. **Let conversations happen** — The bot silently buffers messages
2. **When ready, analyze** — Type `/chitchatposts analyze` in any channel
3. **Review and post** — Copy the suggested drafts to LinkedIn or X

## Project Structure

```
src/
├── index.js                    # Entry point (Slack Bolt)
├── handlers/
│   └── slackHandlers.js        # Message + command handlers
├── services/
│   ├── conversationBuffer.js   # In-memory message buffer
│   ├── llm.js                  # OpenAI/Claude integration
│   └── index.js                # Service exports
├── app.js                      # Express app (health routes)
├── controllers/
├── routes/
├── middleware/
└── utils/
```

## How It Works

```
┌─────────────┐    message    ┌──────────────────┐
│    Slack    │──────────────▶│ Conversation     │
│   Channel   │               │ Buffer (memory)  │
└─────────────┘               └──────────────────┘
       │                              │
       │ /chitchatposts analyze       │ get messages
       ▼                              ▼
┌─────────────┐               ┌──────────────────┐
│   Slash     │──────────────▶│   LLM Service    │
│  Command    │   analyze     │ (OpenAI/Claude)  │
└─────────────┘               └──────────────────┘
       │                              │
       │ formatted response           │ analysis
       ▼                              ▼
┌─────────────────────────────────────────────────┐
│           Slack Response (ephemeral)            │
│  💡 Post-worthy idea spotted                    │
│  • Why this works                               │
│  • LinkedIn draft                               │
│  • X draft                                      │
└─────────────────────────────────────────────────┘
```

## License

ISC
