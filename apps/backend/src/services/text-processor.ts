import { getOpenRouterClient } from './openrouter-client';
import { getPromptManager } from './prompt-manager';
import { TextProcessingOptions, AIResponse } from '../types/ai';

/**
 * Strip markdown code fences from JSON response
 */
function stripMarkdownCodeFences(text: string): string {
  // Remove ```json and ``` from the response
  return text.replace(/```json\s*\n?/g, '').replace(/```\s*$/g, '').trim();
}

export class TextProcessor {
  private client = getOpenRouterClient();
  private promptManager = getPromptManager();

  /**
   * Process a text message with AI
   */
  async processText(
    userMessage: string,
    options: TextProcessingOptions = {}
  ): Promise<AIResponse> {
    const messages = [];

    // Add system prompt if provided
    if (options.systemPrompt) {
      messages.push({
        role: 'system' as const,
        content: options.systemPrompt,
      });
    }

    // Add user message
    messages.push({
      role: 'user' as const,
      content: userMessage,
    });

    // Determine which model to use
    const model = options.model || this.client.getModel('text');

    return await this.client.chat(messages, model, {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });
  }

  /**
   * Have a conversation with context
   */
  async chat(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options: TextProcessingOptions = {}
  ): Promise<AIResponse> {
    const model = options.model || this.client.getModel('text');

    return await this.client.chat(messages, model, {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });
  }

  /**
   * Quick text analysis with a fast model
   */
  async quickAnalysis(
    text: string,
    prompt: string = 'Analyze this text and provide a brief summary:'
  ): Promise<string> {
    const response = await this.processText(text, {
      systemPrompt: prompt,
      model: this.client.getModel('text-fast'),
      temperature: 0.3,
      maxTokens: 500,
    });

    return response.content;
  }

  /**
   * Extract structured information from text
   */
  async extractInfo(
    text: string,
    extractionPrompt: string
  ): Promise<string> {
    const response = await this.processText(text, {
      systemPrompt: `Extract the following information from the user's text: ${extractionPrompt}\n\nProvide the response in a clear, structured format.`,
      temperature: 0.2,
      maxTokens: 1000,
    });

    return response.content;
  }

  /**
   * Process text with a prompt from Langfuse
   */
  async processWithPrompt(
    userMessage: string,
    promptName: string,
    variables?: Record<string, string>,
    options: TextProcessingOptions = {}
  ): Promise<AIResponse> {
    // Get prompt from Langfuse (with fallback)
    const promptTemplate = await this.promptManager.getPrompt(
      promptName
    );

    // Compile prompt with variables if provided
    const systemPrompt = variables
      ? this.promptManager.compilePrompt(promptTemplate, variables)
      : promptTemplate;

    return await this.processText(userMessage, {
      ...options,
      systemPrompt,
    });
  }

  /**
   * Extract structured information using a JSON schema
   */
  async extractStructured<T>(
    text: string,
    systemPrompt: string,
    jsonSchema: {
      name: string;
      schema: any;
    },
    zodSchema: any
  ): Promise<T> {
    const response = await this.client.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      this.client.getModel('text-fast'),
      {
        temperature: 0.2,
        maxTokens: 1000,
        responseFormat: {
          type: 'json_schema',
          json_schema: {
            name: jsonSchema.name,
            strict: true,
            schema: jsonSchema.schema
          }
        }
      }
    );

    // Parse and validate with Zod
    const cleanedContent = stripMarkdownCodeFences(response.content);
    const parsed = JSON.parse(cleanedContent);
    return zodSchema.parse(parsed) as T;
  }
}

// Singleton instance
let processorInstance: TextProcessor | null = null;

export function getTextProcessor(): TextProcessor {
  if (!processorInstance) {
    processorInstance = new TextProcessor();
  }
  return processorInstance;
}
