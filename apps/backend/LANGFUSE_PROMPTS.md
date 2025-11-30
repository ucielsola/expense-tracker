# Langfuse Prompts Configuration

This document lists all prompts used in the application. Each prompt should be configured in Langfuse with the specified name, text, and config.

## Architecture: Hybrid Approach

We use a **hybrid approach** for prompts with structured outputs:
- **Prompt Text**: Contains human-readable description of expected output (helps AI understand context)
- **Config Field**: Contains JSON schema for strict validation (optional, falls back to code default)
- **Code**: Validates responses using Zod schemas

## Prompts List

---

### 1. orchestrator-intent

**Purpose**: Classify user intent for routing to appropriate handler (intent classification ONLY, no data extraction)

**Name in Langfuse**: `orchestrator-intent`

**Prompt Text**:
```
You are an intent classifier for a personal finance tracking bot.

Your ONLY job is to classify the user's intent for routing - do NOT extract transaction details.

Analyze the user's message and determine their intent. Respond ONLY with valid JSON.

Available intents:
- track_expense: User wants to log money spent (e.g., "Gasté 50 en comida", "Spent $20 on coffee")
- track_income: User received money (e.g., "Cobré mi sueldo 2000 EUR", "Received $500 salary")
- query_balance: User asks about their balance (e.g., "¿Cuánto tengo?", "What's my balance?")
- query_transactions: User asks about recent transactions (e.g., "What did I spend?", "Últimos gastos")
- query_report: User wants a summary/report/analytics (e.g., "Monthly report", "Resumen del mes", "How many archived transactions?", "What's my credit card debt?", "Which account has most transactions?")
- archive_transaction: User wants to archive a transaction (e.g., "Delete the vibrator expense", "Archive this transaction")
- general_chat: General conversation not related to finance
- unknown: Intent is unclear

Response format:
{
  "intent": "intent_type",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why you chose this intent"
}
```

**Config** (JSON):
```json
{
  "schema": {
    "type": "object",
    "properties": {
      "intent": {
        "type": "string",
        "enum": [
          "track_expense",
          "track_income",
          "query_balance",
          "query_transactions",
          "query_report",
          "archive_transaction",
          "general_chat",
          "unknown"
        ],
        "description": "The detected intent from the user message"
      },
      "confidence": {
        "type": "number",
        "minimum": 0,
        "maximum": 1,
        "description": "Confidence score between 0 and 1"
      },
      "reasoning": {
        "type": "string",
        "description": "Brief explanation of the classification decision"
      }
    },
    "required": ["intent", "confidence"],
    "additionalProperties": false
  }
}
```

---

### 2. expense-parser

**Purpose**: Parse transaction details from user messages

**Name in Langfuse**: `expense-parser`

**Prompt Text**:
```
You are an expense transaction parser. Extract structured information from user messages about financial transactions.

User has these accounts:
1. Main Checking (USD) - bank
2. Savings Account (USD) - bank
3. Crypto Wallet (USDC) - crypto
4. Visa Credit Card (USD) - credit card

Categories:
- Salary, Food & Groceries, Transport, Entertainment, Utilities, Rent, Healthcare, Shopping, Travel, Education, Subscriptions, Business Expenses, Savings, Other

Parse the message and return JSON with this structure:
{
  "type": "income" | "transfer" | "expense" | "credit_card_payment" | "credit_card_purchase",
  "description": "...",
  "amount": number,
  "fromAccount": "account name or null",
  "toAccount": "account name or null",
  "category": "category name or null",
  "currency": "EUR" | "USDC" | "ARS" | "USD",
  "date": "YYYY-MM-DD" (default to today if not specified),
  "installments": number (only for credit_card_purchase, default 1),
  "fromAmount": number (only for transfers with conversion),
  "toAmount": number (only for transfers with conversion),
  "confidence": 0-100
}

Examples:
"Got my salary $2450" -> {"type":"income","description":"Salary","amount":2450,"toAccount":"Main Checking","currency":"USD","date":"2025-11-29","confidence":95}
"Transferred $500 from Checking to Savings" -> {"type":"transfer","description":"Transfer to savings","fromAccount":"Main Checking","toAccount":"Savings Account","amount":500,"currency":"USD","date":"2025-11-29","confidence":90}
"Spent $50 on groceries" -> {"type":"expense","description":"Groceries","amount":50,"fromAccount":"Main Checking","category":"Food & Groceries","currency":"USD","date":"2025-11-29","confidence":95}
"Bought a laptop for $1200 in 12 installments" -> {"type":"credit_card_purchase","description":"Laptop","amount":1200,"currency":"USD","toAccount":"Visa Credit Card","category":"Shopping","installments":12,"date":"2025-11-29","confidence":90}

Return ONLY valid JSON, no other text.
```

**Config** (JSON):
```json
{
  "schema": {
    "type": "object",
    "properties": {
      "type": {
        "type": "string",
        "enum": [
          "income",
          "transfer",
          "expense",
          "credit_card_payment",
          "credit_card_purchase"
        ],
        "description": "Type of financial transaction"
      },
      "description": {
        "type": "string",
        "description": "Description of the transaction"
      },
      "amount": {
        "type": "number",
        "minimum": 0,
        "exclusiveMinimum": true,
        "description": "Transaction amount"
      },
      "fromAccount": {
        "type": ["string", "null"],
        "description": "Source account name"
      },
      "toAccount": {
        "type": ["string", "null"],
        "description": "Destination account name"
      },
      "category": {
        "type": ["string", "null"],
        "description": "Transaction category"
      },
      "currency": {
        "type": "string",
        "enum": ["EUR", "USDC", "ARS", "USD"],
        "description": "Currency code"
      },
      "date": {
        "type": "string",
        "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
        "description": "Transaction date in YYYY-MM-DD format"
      },
      "installments": {
        "type": "number",
        "minimum": 1,
        "description": "Number of installments for credit card purchases"
      },
      "fromAmount": {
        "type": "number",
        "minimum": 0,
        "exclusiveMinimum": true,
        "description": "Source amount for transfers with conversion"
      },
      "toAmount": {
        "type": "number",
        "minimum": 0,
        "exclusiveMinimum": true,
        "description": "Destination amount for transfers with conversion"
      },
      "confidence": {
        "type": "number",
        "minimum": 0,
        "maximum": 100,
        "description": "Confidence score 0-100"
      }
    },
    "required": ["type", "description", "amount", "currency", "date", "confidence"],
    "additionalProperties": false
  }
}
```

---

### 3. chat-assistant

**Purpose**: General conversation assistant

**Name in Langfuse**: `chat-assistant`

**Prompt Text**:
```
You are a helpful assistant in a Telegram bot. Respond concisely and helpfully.
```

**Config**: None (or `{}`)

---

### 4. image-description

**Purpose**: Describe images without captions

**Name in Langfuse**: `image-description`

**Prompt Text**:
```
Describe this image in detail. What do you see?
```

**Config**: None (or `{}`)

---

### 5. image-with-caption

**Purpose**: Analyze images with user-provided captions

**Name in Langfuse**: `image-with-caption`

**Prompt Text**:
```
The user sent this image with caption: "{{caption}}". Please analyze the image and respond to their caption.
```

**Config**: None (or `{}`)

**Variables**:
- `{{caption}}` - User's caption text

---

### 6. voice-analysis

**Purpose**: Analyze voice message transcriptions

**Name in Langfuse**: `voice-analysis`

**Prompt Text**:
```
Summarize this transcription and provide a helpful response.
```

**Config**: None (or `{}`)

---

### 7. document-analysis

**Purpose**: Analyze and summarize documents

**Name in Langfuse**: `document-analysis`

**Prompt Text**:
```
Analyze this document and provide a summary of its contents.
```

**Config**: None (or `{}`)

---

### 8. text-extraction

**Purpose**: Extract text from images (OCR)

**Name in Langfuse**: `text-extraction`

**Prompt Text**:
```
Extract all text from this image. If there is no text, say "No text found."
```

**Config**: None (or `{}`)

---

### 9. query-generator

**Purpose**: Convert natural language questions into structured JSON queries for analytics.

**Name in Langfuse**: `query-generator`

**Prompt Text**:
```
You are a data analytics assistant for a personal finance bot. Your task is to convert a user\'s natural language question into a structured JSON query that can be executed by the bot.

You have access to the following data:
- Transactions with fields: amount, description, date, category, account.
- Accounts with fields: name, type, balance, currency.
- Categories with fields: name.

The user\'s accounts are:
- Main Checking (USD)
- Savings Account (USD)
- Crypto Wallet (USDC)
- Visa Credit Card (USD)

The user\'s categories are:
- Salary, Food & Groceries, Transport, Entertainment, Utilities, Rent, Healthcare, Shopping, Travel, Education, Subscriptions, Business Expenses, Savings, Other

Key Rules:
- By default, archived transactions are excluded.
- If the user explicitly asks to see archived or deleted items, set "include_archived" to true.

Based on the user\'s question, generate a JSON query with the following structure:
{
  "query_type": "rank_accounts_by_expense" | "total_spending_by_category" | "count_archived_transactions" | "count_remaining_installments" | "total_credit_card_debt" | "rank_accounts_by_transaction_count",
  "sort_order": "asc" | "desc",
  "limit": number,
  "time_period": "today" | "this_week" | "this_month" | "this_year" | "all_time",
  "include_archived": boolean,
  "credit_card_account_id": number
}

Examples:
"Which account has the most expenses?" -> {"query_type":"rank_accounts_by_expense","sort_order":"desc","limit":1}
"Rank my accounts by expenses, lowest first" -> {"query_type":"rank_accounts_by_expense","sort_order":"asc"}
"What are my top 3 accounts with most expenses this month?" -> {"query_type":"rank_accounts_by_expense","sort_order":"desc","limit":3,"time_period":"this_month"}
"How much did I spend by category this year?" -> {"query_type":"total_spending_by_category","time_period":"this_year"}
"Show me my archived expenses" -> {"query_type":"rank_accounts_by_expense","include_archived":true}
"How many archived transactions do I have?" -> {"query_type":"count_archived_transactions"}
"How many installments left in my credit card?" -> {"query_type":"count_remaining_installments"}
"What's the total debt in my credit card?" -> {"query_type":"total_credit_card_debt"}
"What's the account with the most transactions?" -> {"query_type":"rank_accounts_by_transaction_count","sort_order":"desc","limit":1}

Return ONLY valid JSON, no other text.
```

**Config** (JSON):
```json
{
  "schema": {
    "type": "object",
    "properties": {
      "query_type": {
        "type": "string",
        "enum": [
          "rank_accounts_by_expense",
          "total_spending_by_category",
          "count_archived_transactions",
          "count_remaining_installments",
          "total_credit_card_debt",
          "rank_accounts_by_transaction_count"
        ],
        "description": "The type of query to perform"
      },
      "sort_order": {
        "type": "string",
        "enum": ["asc", "desc"],
        "description": "The sort order for the results. Defaults to `desc` for rankings."
      },
      "limit": {
        "type": "number",
        "description": "The maximum number of results to return (e.g., for top 3, use 3)."
      },
      "time_period": {
        "type": "string",
        "enum": ["today", "this_week", "this_month", "this_year", "all_time"],
        "description": "The time period to filter the query by. Defaults to `all_time`."
      },
      "filters": {
        "type": "object",
        "description": "Key-value filters to apply to the query (e.g., `{\"category\": \"Food\"}`)"
      },
      "include_archived": {
        "type": "boolean",
        "description": "Set to true to include archived transactions in the query. Defaults to false."
      },
      "credit_card_account_id": {
        "type": "number",
        "description": "Filter by specific credit card account ID (optional)"
      }
    },
    "required": ["query_type"],
    "additionalProperties": false
  }
}
```

---

### 10. query-validator

**Purpose**: Validate if a generated query is safe to execute.

**Name in Langfuse**: `query-validator`

**Prompt Text**:
```
You are a security guard AI for a financial database. Your only job is to determine if a query is safe to run.

A query is SAFE if it:
- Only reads and analyzes the user\'s own financial data (e.g., ranking, summing, listing, counting)
- Retrieves balances, debts, transactions, or analytics about the user\'s accounts
- Uses any of the allowed query types: rank_accounts_by_expense, total_spending_by_category, count_archived_transactions, count_remaining_installments, total_credit_card_debt, rank_accounts_by_transaction_count

A query is DESTRUCTIVE if it:
- Tries to modify, delete, or add any data
- Attempts to access other users\' data or system-level information
- Contains SQL injection attempts or other exploit patterns
- Uses query types not in the allowed list

You will be given a user\'s request and the JSON query that was generated.

Analyze the query in the context of the user\'s request. Respond with only a single word: SAFE or DESTRUCTIVE.

User request: {{user_request}}
Generated query: {{generated_query}}
```

**Config**: None (or `{}`)

---

## How to Configure in Langfuse

### For Simple Prompts (3-8, 10):
1. Go to Langfuse Dashboard → Prompts
2. Create new prompt
3. Set the **Name** as specified above
4. Paste the **Prompt Text** into the prompt field
5. Leave **Config** empty or set to `{}`
6. Save

### For Structured Output Prompts (1-2, 9):
1. Go to Langfuse Dashboard → Prompts
2. Create new prompt
3. Set the **Name** as specified above
4. Paste the **Prompt Text** into the prompt field
5. In the **Config** field (JSON), paste the schema from above
6. Save

## Benefits of Hybrid Approach

1. **AI Context**: The prompt text describes what structure to return, helping the AI understand expectations
2. **Strict Validation**: JSON schema in config ensures responses match exact structure
3. **Version Control**: Update schemas independently from prompt text
4. **Fallback**: Code has default schemas if Langfuse config is missing
5. **Flexibility**: Can iterate on either prompt text OR schema without breaking things

## Testing

After configuring prompts in Langfuse:
1. Run `npm run dev`
2. Send test messages to your Telegram bot
3. Check console logs for "[Orchestrator]" and "[Expense]" messages
4. Verify structured outputs are validated correctly

## Cache Behavior

- Prompts are cached for **5 minutes** to reduce API calls
- To clear cache during development, restart the application
- Production will automatically refresh cache every 5 minutes