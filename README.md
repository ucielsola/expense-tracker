# Tracker v2 - Personal Finance Tracker

A monorepo containing a Telegram bot backend and web frontend for tracking personal finances with AI-powered processing.

## Project Structure

```
tracker-v2/
├── apps/
│   ├── backend/     # Telegram bot with AI & PostgreSQL
│   └── frontend/    # Web frontend (WIP)
├── pnpm-workspace.yaml
└── package.json
```

## Features

### Backend (Telegram Bot)
- **Telegram bot integration** using grammY
- **AI-powered processing** via OpenRouter (supports multiple AI providers)
  - Text message processing with Claude/GPT models
  - Image analysis with vision models
  - Voice message transcription and analysis
  - Document processing and summarization
- **PostgreSQL database** connection
- **TypeScript** for type safety
- **Modular architecture** for easy extension
- Environment-based configuration

### Frontend
- Coming soon! See `apps/frontend/WIP.md`

## Prerequisites

- Node.js (v18 or higher recommended)
- pnpm (recommended package manager)
- PostgreSQL database
- Telegram Bot Token (get it from [@BotFather](https://t.me/botfather))
- OpenRouter API key (get it from [OpenRouter](https://openrouter.ai/))

## Installation

1. Install pnpm (if not already installed):
```bash
npm install -g pnpm
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cd apps/backend
cp .env.example .env
```

4. Edit `apps/backend/.env` file with your credentials:
   - Add your Telegram bot token from BotFather
   - Add your OpenRouter API key
   - Configure PostgreSQL connection details
   - (Optional) Customize AI model selections

## Configuration

Create a `.env` file with the following variables:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Optional: Restrict to specific user ID (leave empty for public access)
USER_ID=123456789

# GIF URL for unauthorized access (e.g., "You shall not pass!")
YOU_SHALL_NOT_PASS=https://media.giphy.com/media/WIg8P0dPmbGXS/giphy.gif

# OpenRouter AI
OPENROUTER_API_KEY=your_openrouter_api_key_here

# AI Models (optional - defaults are set)
AI_MODEL_TEXT=anthropic/claude-sonnet-4.5
AI_MODEL_TEXT_FAST=anthropic/claude-haiku-4.5
AI_MODEL_VISION=anthropic/claude-sonnet-4.5
AI_MODEL_VISION_FAST=anthropic/claude-haiku-4.5
AI_MODEL_AUDIO=openai/whisper-1

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tracker_v2
DB_USER=postgres
DB_PASSWORD=your_password_here

# Optional: Database connection pool settings
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
```

## Database Setup (using Docker Compose)

The database setup is managed using Docker Compose. The `docker-compose.yml` file defines a PostgreSQL service that automatically creates the `tracker_v2` database and runs initial migrations.

1.  **Start the PostgreSQL container:**
    ```bash
    npm run db:up
    ```
    This will start the PostgreSQL container in the background. The `tracker_v2` database will be created, and any SQL files placed in the `migrations/` directory will be executed on the first startup of the container to set up the initial schema.

2.  **Run Migrations (if needed manually):**
    While initial schema setup from `migrations/` occurs automatically on first container start, you can manually run specific migrations or seeding:
    ```bash
    # Run initial schema migration (001_initial_schema.sql)
    npm run migrate

    # Run seed data migration (002_seed_initial_data.sql)
    npm run seed

    # Run both schema and seed migrations
    npm run migrate:all
    ```
    To stop the database container:
    ```bash
    npm run db:down
    ```
    To reset the database entirely (stop, remove volumes, start, and run all migrations):
    ```bash
    npm run db:reset
    ```

## Running the Bot

Development mode (with auto-reload):
```bash
pnpm dev
```

Production mode:
```bash
pnpm build
pnpm start
```

## Backend Project Structure

```
apps/backend/
├── src/
│   ├── bot/           # Telegram bot logic and handlers
│   │   ├── bot.ts     # Bot initialization
│   │   └── handlers/  # Message handlers (e.g., expense, query)
│   ├── database/      # Database connection and repositories
│   │   ├── connection.ts
│   │   └── repositories/ # Data access for various entities (accounts, categories, etc.)
│   ├── schemas/       # Zod schemas for validation and data parsing
│   ├── services/      # Business logic and AI integrations
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Utility functions (e.g., AI related)
│   └── index.ts       # Application entry point
├── migrations/        # SQL migration files for database schema
├── scripts/           # Utility scripts (seeding, etc.)
├── .env.example       # Example environment variables
├── docker-compose.yml # Docker Compose configuration for local development
├── env.docker         # Environment variables for Docker (development)
├── env.docker.example # Example environment variables for Docker
├── package.json
└── tsconfig.json
```

## How to Get a Telegram Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` command
3. Follow the instructions to create your bot
4. Copy the token provided by BotFather
5. Add it to your `.env` file

## User Access Control

The bot can be restricted to a specific Telegram user:

1. **Find your User ID:**
   - Send a message to [@userinfobot](https://t.me/userinfobot) on Telegram
   - Copy your user ID

2. **Set in `.env`:**
   ```env
   USER_ID=123456789
   ```

3. **How it works:**
   - If `USER_ID` is set, only that user can interact with the bot
   - Unauthorized users will receive a GIF response (You shall not pass!)
   - If `USER_ID` is empty or not set, the bot is open to everyone

## AI Services

The bot includes comprehensive AI processing capabilities:

### Text Processing (`src/services/text-processor.ts`)
- Process text messages with customizable prompts
- Quick analysis with fast models
- Extract structured information
- Multi-turn conversations

### Image Processing (`src/services/image-processor.ts`)
- Analyze images with vision models
- Extract text (OCR)
- Answer questions about images
- Process multiple images together

### Audio Processing (`src/services/audio-processor.ts`)
- Transcribe voice messages and audio files
- Analyze transcriptions
- Summarize audio content
- Extract information from audio

### Document Processing (`src/services/document-processor.ts`)
- Process text and image-based documents
- Extract and analyze document content
- Summarize documents
- Answer questions about documents

## Bot Capabilities

The bot currently handles:
- **Text messages**: AI-powered responses
- **Photos**: Image analysis and description
- **Voice messages**: Transcription + AI response
- **Audio files**: Transcription
- **Documents**: Text extraction and analysis

Commands:
- `/start` - Welcome message
- `/help` - List available commands

## Extending the Bot

### Adding New Handlers
Add new message handlers in `src/bot/bot.ts`:
```typescript
this.bot.on('message:video', async (ctx) => {
  // Your video processing logic
});
```

### Using AI Services
Import and use the AI processors:
```typescript
import { getTextProcessor } from '../services/text-processor';

const processor = getTextProcessor();
const response = await processor.processText('Your text here');
```

### Customizing Models
Change models in `.env` file or pass them as options:
```typescript
const response = await processor.processText(text, {
  model: 'openai/gpt-4-turbo',
  temperature: 0.7,
});
```

## Langfuse Integration

This bot integrates with [Langfuse](https://langfuse.com/) for prompt management and observability.

### Setup

1. Create a Langfuse account at [https://cloud.langfuse.com](https://cloud.langfuse.com)
2. Get your API keys from the Langfuse dashboard
3. Add them to your `.env` file:
   ```env
   LANGFUSE_SECRET_KEY=sk-lf-...
   LANGFUSE_PUBLIC_KEY=pk-lf-...
   LANGFUSE_HOST=https://cloud.langfuse.com

# Environment
NODE_ENV=development
   ```

### Managing Prompts

Langfuse allows you to manage prompts centrally:

1. Create prompts in your Langfuse dashboard
2. Name them according to the conventions used in the code:
   - `chat_assistant` - Main chatbot system prompt
   - `image_description` - Image analysis prompt
   - `voice_analysis` - Voice message analysis prompt
   - `document_analysis` - Document processing prompt

3. Use prompts in your code:
```typescript
const response = await processor.processWithPrompt(
  userMessage,
  'chat_assistant', // Langfuse prompt name
  { variable: 'value' }, // Optional: variables for template
  { systemPrompt: 'Fallback prompt if Langfuse is unavailable' }
);
```

### Prompt Variables

Use `{{variable}}` syntax in Langfuse prompts:
```
You are analyzing an image with caption: {{caption}}
Please provide a detailed analysis.
```

Then compile it:
```typescript
const prompt = await promptManager.getPrompt('image_with_caption');
const compiled = promptManager.compilePrompt(prompt, { caption: userCaption });
```

### Observability

Langfuse automatically tracks:
- All AI model calls
- Prompt versions used
- Response times
- Token usage
- Errors and failures

View all metrics and traces in your Langfuse dashboard.

### Optional Usage

Langfuse is **optional**. If credentials are not provided:
- The bot will use fallback prompts defined in code
- All features work normally
- No observability data is sent

## Development

Create database schemas and migrations in `src/database/`
Add business logic in `src/services/`
Extend bot handlers in `src/bot/bot.ts`
Manage prompts via Langfuse dashboard for easy updates without code changes

## License

ISC
