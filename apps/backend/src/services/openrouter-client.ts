import OpenAI from 'openai';
import { AIMessage, AIResponse, ModelType } from '../types/ai';
import { stripMarkdownCodeFences } from '../utils/ai';

export class OpenRouterClient {
  private client: OpenAI;
  private models: Record<ModelType, string>;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not set');
    }

    // OpenAI SDK works with OpenRouter by changing the base URL
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/ucielsola/tracker-v2',
        'X-Title': 'Tracker v2 Bot',
      },
    });

    // Model configuration from environment
    this.models = {
      'text': process.env.AI_MODEL_TEXT || 'anthropic/claude-haiku-4.5',
      'text-fast': process.env.AI_MODEL_TEXT_FAST || 'openai/gpt-4o-mini',
      'vision': process.env.AI_MODEL_VISION || 'anthropic/claude-sonnet-4.5',
      'vision-fast': process.env.AI_MODEL_VISION_FAST || 'openai/gpt-4o-mini',
      'audio': process.env.AI_MODEL_AUDIO || 'openai/whisper-1',
    };
  }

  /**
   * Get the configured model for a specific type
   */
  public getModel(type: ModelType): string {
    return this.models[type];
  }

  /**
   * Send a chat completion request
   */
  public async chat(
    messages: AIMessage[],
    model?: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: {
        type: 'json_object' | 'json_schema';
        json_schema?: {
          name: string;
          strict?: boolean;
          schema: any;
        };
      };
    } = {}
  ): Promise<AIResponse> {
    try {
      const requestParams: any = {
        model: model || this.models['text'],
        messages: messages as any,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
      };

      // Add response format if provided (for structured outputs)
      if (options.responseFormat) {
        if (options.responseFormat.type === 'json_schema' && options.responseFormat.json_schema) {
          requestParams.response_format = {
            type: 'json_schema',
            json_schema: options.responseFormat.json_schema
          };
        } else {
          // Fallback to json_object mode
          requestParams.response_format = { type: 'json_object' };
        }
      }

      const response = await this.client.chat.completions.create(requestParams);

      const choice = response.choices[0];
      if (!choice || !choice.message) {
        throw new Error('No response from AI model');
      }

      let content = choice.message.content || '';
      // If the response format was JSON, attempt to strip markdown code fences
      if (options.responseFormat?.type === 'json_object' || options.responseFormat?.type === 'json_schema') {
        content = stripMarkdownCodeFences(content);
      }

      return {
        content: content,
        model: response.model,
        usage: response.usage ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      console.error('OpenRouter chat error:', error);
      throw new Error(`AI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transcribe audio using Whisper (or compatible model)
   */
  public async transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
    try {
      // Create a File-like object from the buffer
      const file = new File([audioBuffer], filename, {
        type: this.getMimeType(filename)
      });

      const response = await this.client.audio.transcriptions.create({
        file: file,
        model: this.models['audio'],
      });

      return response.text;
    } catch (error) {
      console.error('Audio transcription error:', error);
      throw new Error(`Audio transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Helper to get MIME type from filename
   */
  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'mp4': 'audio/mp4',
      'm4a': 'audio/mp4',
      'wav': 'audio/wav',
      'webm': 'audio/webm',
      'ogg': 'audio/ogg',
    };
    return mimeTypes[ext || ''] || 'audio/mpeg';
  }
}

// Singleton instance
let clientInstance: OpenRouterClient | null = null;

export function getOpenRouterClient(): OpenRouterClient {
  if (!clientInstance) {
    clientInstance = new OpenRouterClient();
  }
  return clientInstance;
}
