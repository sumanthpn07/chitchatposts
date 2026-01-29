# ChitChatPosts - Features

> A Slack bot that observes conversations and suggests post-worthy content for LinkedIn and X (Twitter).

---

## Core Philosophy

- ✅ **Human-in-the-loop** — Never auto-posts to social media
- ✅ **Real insights only** — No clickbait, no invented facts
- ✅ **Clean & calm** — Doesn't spam your channels

---

## Slash Commands

### `/chitchatposts analyze`
Analyze the real-time buffer of messages captured since bot started.

```
/chitchatposts analyze
```
**Response:** Post suggestions if content is post-worthy, or "Not enough messages" if < 5 captured.

---

### `/chitchatposts history [time]`
Fetch and analyze messages from the past N hours/days using Slack API.

```
/chitchatposts history 1h    → Last 1 hour
/chitchatposts history 4h    → Last 4 hours  
/chitchatposts history 1d    → Last 1 day
```
**Use case:** Analyze conversations that happened while bot was offline.

---

### `/chitchatposts sync`
Fetch all messages since the last sync checkpoint.

```
/chitchatposts sync
```
**Use case:** Never miss a message — picks up exactly where you left off.

---

## Automated Analysis (Cron Jobs)

### Every 6 Hours
- Automatically fetches messages from the last 6 hours
- Analyzes for post-worthy content
- Posts suggestions to `#chitchatposts-suggestions` channel
- Skips if nothing post-worthy

### Daily Summary (Midnight)
- Analyzes the entire day's conversations
- Generates comprehensive post suggestions
- De-duplicates against 6-hour suggestions
- Only posts if content is new/different

---

## Smart Features

### Message Filtering
| Ignored | Reason |
|---------|--------|
| Bot messages | Not human content |
| Message edits | Avoid duplicates |
| Short messages (< 5 chars) | Not meaningful |
| Logistics & scheduling | Not post-worthy |

### De-duplication
- Stores fingerprints of past suggestions
- Compares new suggestions against history
- Skips posting if similarity > 80%
- Prevents repetitive content

### Multi-Channel Support
- Monitors multiple channels simultaneously
- Separate buffers per channel
- Configurable channel list

---

## LLM Integration

### Supported Providers
- **OpenAI** (GPT-4o-mini)
- **Claude** (Claude 3 Sonnet)

### Prompt Focus
The AI is trained to identify:
- ✅ Real insights and learnings
- ✅ Product decisions and reasoning
- ✅ Founder reflections
- ✅ Growth/engineering tradeoffs
- ✅ Technical discoveries

### Explicitly Avoided
- ❌ Clickbait headlines
- ❌ Invented or exaggerated facts
- ❌ Inside jokes
- ❌ Mundane logistics

---

## Output Format

When post-worthy content is found:

```
💡 Post-worthy idea spotted

Why this works:
[Explanation of why this resonates]

📝 LinkedIn Draft:
[Full LinkedIn post ready to copy]

𝕏 Twitter/X Draft:
[Tweet under 280 chars]
```

---

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `SLACK_BOT_TOKEN` | Bot OAuth token | Required |
| `SLACK_SIGNING_SECRET` | Signing secret | Required |
| `SLACK_APP_TOKEN` | Socket Mode token | Required |
| `LLM_PROVIDER` | `openai` or `claude` | `openai` |
| `OPENAI_API_KEY` | OpenAI API key | — |
| `CLAUDE_API_KEY` | Claude API key | — |
| `BUFFER_WINDOW_HOURS` | Real-time buffer window | `4` |
| `MIN_MESSAGES_FOR_ANALYSIS` | Minimum messages needed | `5` |
| `SUGGESTIONS_CHANNEL_ID` | Where cron posts suggestions | — |
| `CRON_ENABLED` | Enable automated analysis | `false` |
| `MONITORED_CHANNELS` | Comma-separated channel IDs | All |

---

## Architecture

```
src/
├── index.js                    # Entry point
├── handlers/
│   └── slackHandlers.js        # Commands & events
├── services/
│   ├── conversationBuffer.js   # Real-time buffer
│   ├── slackHistory.js         # Fetch past messages
│   ├── llm.js                  # OpenAI/Claude
│   ├── suggestionStore.js      # Store past suggestions
│   └── deduplication.js        # Similarity detection
├── jobs/
│   └── scheduler.js            # Cron jobs
└── utils/
    └── index.js
```

---

## What This Bot Does NOT Do

- ❌ Auto-post to LinkedIn or Twitter
- ❌ Store messages in a database
- ❌ Provide analytics or dashboards
- ❌ Schedule posts
- ❌ Require a UI

---

## Future Roadmap

- [ ] Multiple workspace support
- [ ] Custom prompt templates
- [ ] Webhook integrations
- [ ] Export suggestions to Notion/Airtable
