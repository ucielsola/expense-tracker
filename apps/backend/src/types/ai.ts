export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | MessageContent[];
}

export interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface TextProcessingOptions {
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ImageProcessingOptions {
  model?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AudioProcessingOptions {
  transcriptionModel?: string;
  analysisModel?: string;
  analysisPrompt?: string;
}

export interface DocumentProcessingOptions {
  model?: string;
  analysisPrompt?: string;
  extractText?: boolean;
}

export type ModelType = 'text' | 'text-fast' | 'vision' | 'vision-fast' | 'audio';
