import { Langfuse } from 'langfuse';

export class LangfuseClient {
  private client: Langfuse;
  private enabled: boolean;

  constructor() {
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const host = process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com';

    // Langfuse is optional - if keys are not set, it will be disabled
    this.enabled = !!(secretKey && publicKey);

    if (this.enabled) {
      this.client = new Langfuse({
        secretKey,
        publicKey,
        baseUrl: host,
      });
      console.log('Langfuse client initialized');
    } else {
      console.log('Langfuse is disabled - no credentials provided');
      // Create a dummy client that won't throw errors
      this.client = null as any;
    }
  }

  /**
   * Check if Langfuse is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get a prompt from Langfuse by name
   */
  async getPrompt(name: string, version?: number): Promise<{
    prompt: string;
    config?: any;
  } | null> {
    if (!this.enabled) {
      console.warn(`Langfuse is disabled. Cannot fetch prompt: ${name}`);
      return null;
    }

    try {
      const promptData = version
        ? await this.client.getPrompt(name, version)
        : await this.client.getPrompt(name);

      if (!promptData) {
        console.warn(`Prompt not found: ${name}`);
        return null;
      }

      return {
        prompt: promptData.prompt,
        config: promptData.config,
      };
    } catch (error) {
      console.error(`Error fetching prompt ${name}:`, error);
      return null;
    }
  }

  /**
   * Create a new trace for observability
   */
  createTrace(name: string, userId?: string, metadata?: any) {
    if (!this.enabled) return null;

    return this.client.trace({
      name,
      userId,
      metadata,
    });
  }

  /**
   * Create a generation within a trace
   */
  createGeneration(params: {
    name: string;
    traceId?: string;
    input?: any;
    model?: string;
    metadata?: any;
  }) {
    if (!this.enabled) return null;

    return this.client.generation({
      name: params.name,
      traceId: params.traceId,
      input: params.input,
      model: params.model,
      metadata: params.metadata,
    });
  }

  /**
   * Update a generation with output and usage
   */
  async updateGeneration(
    generationId: string,
    output: any,
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    }
  ) {
    if (!this.enabled) return;

    try {
      await this.client.generation({
        id: generationId,
        output,
        usage: usage ? {
          input: usage.promptTokens,
          output: usage.completionTokens,
          total: usage.totalTokens,
        } : undefined,
      });
    } catch (error) {
      console.error('Error updating generation:', error);
    }
  }

  /**
   * Flush pending events (call before shutdown)
   */
  async flush() {
    if (!this.enabled) return;

    try {
      await this.client.flushAsync();
    } catch (error) {
      console.error('Error flushing Langfuse:', error);
    }
  }

  /**
   * Shutdown the client
   */
  async shutdown() {
    if (!this.enabled) return;

    try {
      await this.client.shutdownAsync();
      console.log('Langfuse client shut down');
    } catch (error) {
      console.error('Error shutting down Langfuse:', error);
    }
  }

  /**
   * Get the underlying Langfuse client
   */
  getClient(): Langfuse | null {
    return this.enabled ? this.client : null;
  }
}

// Singleton instance
let clientInstance: LangfuseClient | null = null;

export function getLangfuseClient(): LangfuseClient {
  if (!clientInstance) {
    clientInstance = new LangfuseClient();
  }
  return clientInstance;
}
