import { getOpenRouterClient } from './openrouter-client';
import { getPromptManager } from './prompt-manager';
import {
  OrchestratorDecisionSchema,
  getOrchestratorJSONSchema,
  type OrchestratorDecision
} from '../schemas';

/**
 * Strip markdown code fences from JSON response
 */
function stripMarkdownCodeFences(text: string): string {
  // Remove ```json and ``` from the response
  return text.replace(/```json\s*\n?/g, '').replace(/```\s*$/g, '').trim();
}

/**
 * Orchestrator service that analyzes user intent and routes to appropriate handler
 */
export class Orchestrator {
  private client = getOpenRouterClient();
  private promptManager = getPromptManager();

  /**
   * Analyze user message and determine intent using structured output
   */
  async analyzeIntent(userMessage: string): Promise<OrchestratorDecision> {
    try {
      // Fetch prompt with config from Langfuse
      const promptData = await this.promptManager.getPromptWithConfig(
        'orchestrator-intent',
        {
          config: {
            schema: getOrchestratorJSONSchema()
          }
        }
      );

      // Use schema from Langfuse config if available, otherwise use default
      const schema = promptData.config?.schema || getOrchestratorJSONSchema();

      const response = await this.client.chat(
        [
          { role: 'system', content: promptData.prompt },
          { role: 'user', content: userMessage }
        ],
        this.client.getModel('text-fast'), // Use fast model for orchestration
        {
          temperature: 0.1, // Low temperature for consistent classification
          maxTokens: 500,
          responseFormat: {
            type: 'json_schema',
            json_schema: {
              name: 'orchestrator_decision',
              strict: true,
              schema: schema
            }
          }
        }
      );

      console.log(`[Orchestrator] Response: ${response.content}`);

      // Parse and validate with Zod
      const cleanedContent = stripMarkdownCodeFences(response.content);
      const parsed = JSON.parse(cleanedContent);
      const decision = OrchestratorDecisionSchema.parse(parsed);

      console.log(`[Orchestrator] Intent: ${decision.intent}, Confidence: ${decision.confidence}`);

      return decision;
    } catch (error) {
      console.error('[Orchestrator] Error analyzing intent:', error);

      // Fallback to unknown intent
      return {
        intent: 'unknown',
        confidence: 0,
        reasoning: 'Failed to analyze intent'
      };
    }
  }
}

// Singleton instance
let orchestratorInstance: Orchestrator | null = null;

export function getOrchestrator(): Orchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator();
  }
  return orchestratorInstance;
}
