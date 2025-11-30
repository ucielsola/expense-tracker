import { z } from 'zod';

/**
 * Schema for generating structured queries from natural language
 */
export const QueryGeneratorSchema = z.object({
  query_type: z.enum([
    'rank_accounts_by_expense',
    'total_spending_by_category',
    'count_archived_transactions',
    'count_remaining_installments',
    'total_credit_card_debt',
    'rank_accounts_by_transaction_count'
  ]).describe('The type of query to perform'),

  sort_order: z.enum(['asc', 'desc']).optional().describe('The sort order for the results'),

  limit: z.number().int().positive().optional().describe('The maximum number of results to return'),

  time_period: z.enum([
    'today',
    'this_week',
    'this_month',
    'this_year',
    'all_time'
  ]).optional().default('all_time').describe('The time period to filter the query by'),

  filters: z.record(z.string(), z.any()).optional().describe('Key-value filters to apply to the query (e.g., category)'),
  include_archived: z.boolean().optional().default(false).describe('Whether to include archived transactions. Defaults to false.'),

  credit_card_account_id: z.number().int().positive().optional().describe('Filter by specific credit card account ID')
});

export type GeneratedQuery = z.infer<typeof QueryGeneratorSchema>;

/**
 * Convert Zod schema to JSON Schema for AI models
 */
export function getQueryGeneratorJSONSchema() {
  return {
    type: 'object',
    properties: {
      query_type: {
        type: 'string',
        enum: [
          'rank_accounts_by_expense',
          'total_spending_by_category',
          'count_archived_transactions',
          'count_remaining_installments',
          'total_credit_card_debt',
          'rank_accounts_by_transaction_count'
        ],
        description: 'The type of query to perform'
      },
      sort_order: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'The sort order for the results. Defaults to `desc` for rankings.'
      },
      limit: {
        type: 'number',
        description: 'The maximum number of results to return (e.g., for top 3, use 3).'
      },
      time_period: {
        type: 'string',
        enum: ['today', 'this_week', 'this_month', 'this_year', 'all_time'],
        description: 'The time period to filter the query by. Defaults to `all_time`.'
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
    required: ['query_type'],
    additionalProperties: false
  };
}
