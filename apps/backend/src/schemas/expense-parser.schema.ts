import { z } from 'zod';

/**
 * Schema for expense transaction parsing
 */
export const ExpenseParserSchema = z.object({
  type: z.enum([
    'income',
    'transfer',
    'expense',
    'credit_card_payment',
    'credit_card_purchase'
  ]).describe('Type of financial transaction'),

  description: z.string().describe('Description of the transaction'),

  amount: z.number().positive().describe('Transaction amount'),

  fromAccount: z.string().nullable().optional().describe('Source account name'),

  toAccount: z.string().nullable().optional().describe('Destination account name'),

  category: z.string().nullable().optional().describe('Transaction category'),

  currency: z.enum(['EUR', 'USDC', 'ARS', 'USD']).describe('Currency code'),

  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('Transaction date in YYYY-MM-DD format'),

  installments: z.number()
    .int()
    .positive()
    .optional()
    .default(1)
    .describe('Number of installments for credit card purchases'),

  fromAmount: z.number()
    .positive()
    .optional()
    .describe('Source amount for transfers with conversion'),

  toAmount: z.number()
    .positive()
    .optional()
    .describe('Destination amount for transfers with conversion'),

  confidence: z.number()
    .min(0)
    .max(100)
    .describe('Confidence score 0-100')
});

export type ExpenseParserResult = z.infer<typeof ExpenseParserSchema>;

/**
 * Convert Zod schema to JSON Schema for AI models
 */
export function getExpenseParserJSONSchema() {
  return {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: [
          'income',
          'transfer',
          'expense',
          'credit_card_payment',
          'credit_card_purchase'
        ],
        description: 'Type of financial transaction'
      },
      description: {
        type: 'string',
        description: 'Description of the transaction'
      },
      amount: {
        type: 'number',
        minimum: 0,
        exclusiveMinimum: true,
        description: 'Transaction amount'
      },
      fromAccount: {
        type: ['string', 'null'],
        description: 'Source account name'
      },
      toAccount: {
        type: ['string', 'null'],
        description: 'Destination account name'
      },
      category: {
        type: ['string', 'null'],
        description: 'Transaction category'
      },
      currency: {
        type: 'string',
        enum: ['EUR', 'USDC', 'ARS', 'USD'],
        description: 'Currency code'
      },
      date: {
        type: 'string',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
        description: 'Transaction date in YYYY-MM-DD format'
      },
      installments: {
        type: 'number',
        minimum: 1,
        description: 'Number of installments for credit card purchases'
      },
      fromAmount: {
        type: 'number',
        minimum: 0,
        exclusiveMinimum: true,
        description: 'Source amount for transfers with conversion'
      },
      toAmount: {
        type: 'number',
        minimum: 0,
        exclusiveMinimum: true,
        description: 'Destination amount for transfers with conversion'
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        description: 'Confidence score 0-100'
      }
    },
    required: ['type', 'description', 'amount', 'currency', 'date', 'confidence'],
    additionalProperties: false
  };
}
