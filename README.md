# Chitchatposts

A minimal, production-ready Node.js Express API boilerplate using ES modules.

## Requirements

- Node.js 18+ (LTS)

## Install dependencies

```bash
npm install
```

## Environment variables

1. Copy the example env file:

```bash
cp .env.example .env
```

2. Edit `.env` and set your values. Defaults:

| Variable   | Description        | Default     |
| ---------- | ------------------ | ----------- |
| `PORT`     | Server port        | `3000`      |
| `NODE_ENV` | Environment        | `development` |

## Run the server

**Production:**

```bash
npm start
```

**Development (with auto-reload):**

```bash
npm run dev
```

Server runs at `http://localhost:3000` (or the port in `.env`).

## API

| Method | Path    | Description        |
| ------ | ------- | ------------------ |
| GET    | `/health` | Health check (status, uptime) |

## Project structure

```
src/
  index.js          # Entry point, starts server
  app.js            # Express app setup and middleware
  routes/           # Route definitions
  controllers/      # Request handlers
  services/         # Business logic, external APIs
  utils/            # Helpers
  middleware/       # Express middleware (e.g. error handling)
```

## License

ISC
