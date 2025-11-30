import { z } from 'zod';

/**
 * Schema for orchestrator intent classification
 * Orchestrator only classifies intent for routing - no data extraction
 */
export const OrchestratorDecisionSchema = z.object({
  intent: z.enum([
    'track_expense',
    'track_income',
    'query_balance',
    'query_transactions',
    'query_report',
    'archive_transaction',
    'general_chat',
    'unknown'
  ]).describe('The detected intent from the user message'),

  confidence: z.number()
    .min(0)
    .max(1)
    .describe('Confidence score between 0 and 1'),

  reasoning: z.string().optional().describe('Brief explanation of the classification decision')
});

export type OrchestratorDecision = z.infer<typeof OrchestratorDecisionSchema>;

/**
 * Convert Zod schema to JSON Schema for AI models
 */
export function getOrchestratorJSONSchema() {
  return {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: [
          'track_expense',
          'track_income',
          'query_balance',
          'query_transactions',
          'query_report',
          'archive_transaction',
          'general_chat',
          'unknown'
        ],
        description: 'The detected intent from the user message'
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence score between 0 and 1'
      },
      reasoning: {
        type: 'string',
        description: 'Brief explanation of the classification decision'
      }
    },
    required: ['intent', 'confidence'],
    additionalProperties: false
  };
}
