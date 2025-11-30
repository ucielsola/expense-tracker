import { getLangfuseClient } from './langfuse-client';

/**
 * Manages prompts - can retrieve from Langfuse or use fallback defaults
 */
export class PromptManager {
  private langfuse = getLangfuseClient();
  private promptCache: Map<string, { prompt: string; config?: any; timestamp: number }> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes cache

  /**
   * Get a prompt by name. Must be configured in Langfuse.
   */
  async getPrompt(
    name: string,
    version?: number
  ): Promise<string> {
    const promptData = await this.getPromptWithConfig(name, undefined, version);
    return promptData.prompt;
  }

  /**
   * Get prompt with configuration. Must be configured in Langfuse.
   */
  async getPromptWithConfig(
    name: string,
    fallbackConfig?: any, // Fallback for config only
    version?: number
  ): Promise<{ prompt: string; config?: any }> {
    // Check cache first
    const cached = this.promptCache.get(name);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return { prompt: cached.prompt, config: cached.config };
    }

    // Try to fetch from Langfuse
    if (this.langfuse.isEnabled()) {
      const result = await this.langfuse.getPrompt(name, version);
      if (result && result.prompt) { // Ensure prompt text is present
        const finalConfig = result.config || fallbackConfig; // Use Langfuse config, or fallback
        
        const dataToCache = {
            prompt: result.prompt,
            config: finalConfig,
            timestamp: Date.now(),
        };

        this.promptCache.set(name, dataToCache);
        return dataToCache;
      }
    }
    
    // If Langfuse is not enabled, or prompt not found, or prompt text is missing
    // then it's an error, as prompt text must come from Langfuse.
    throw new Error(`Prompt '${name}' not found or invalid in Langfuse. Please configure it correctly.`);
  }

  /**
   * Clear the prompt cache
   */
  clearCache() {
    this.promptCache.clear();
  }

  /**
   * Clear a specific prompt from cache
   */
  clearPromptCache(name: string) {
    this.promptCache.delete(name);
  }

  /**
   * Compile a prompt template with variables
   */
  compilePrompt(template: string, variables: Record<string, string>): string {
    let compiled = template;
    for (const [key, value] of Object.entries(variables)) {
      // Replace {{key}} with value
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      compiled = compiled.replace(regex, value);
    }
    return compiled;
  }
}

// Singleton instance
let managerInstance: PromptManager | null = null;

export function getPromptManager(): PromptManager {
  if (!managerInstance) {
    managerInstance = new PromptManager();
  }
  return managerInstance;
}

