import { getOpenRouterClient } from './openrouter-client';
import { ImageProcessingOptions, AIResponse, MessageContent } from '../types/ai';
import axios from 'axios';

export class ImageProcessor {
  private client = getOpenRouterClient();

  /**
   * Analyze an image with a vision model
   */
  async analyzeImage(
    imageUrl: string,
    options: ImageProcessingOptions
  ): Promise<AIResponse> {
    const content: MessageContent[] = [
      {
        type: 'text',
        text: options.prompt,
      },
      {
        type: 'image_url',
        image_url: {
          url: imageUrl,
        },
      },
    ];

    const messages = [
      {
        role: 'user' as const,
        content: content,
      },
    ];

    const model = options.model || this.client.getModel('vision');

    return await this.client.chat(messages, model, {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });
  }

  /**
   * Download image from Telegram and convert to base64 data URL
   */
  async downloadAndEncodeImage(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
      });

      const base64 = Buffer.from(response.data).toString('base64');
      const mimeType = response.headers['content-type'] || 'image/jpeg';

      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error('Error downloading image:', error);
      throw new Error('Failed to download image');
    }
  }

  /**
   * Describe an image (general description)
   */
  async describeImage(imageUrl: string, useFastModel: boolean = false): Promise<string> {
    const response = await this.analyzeImage(imageUrl, {
      prompt: 'Describe this image in detail. What do you see?',
      model: useFastModel ? this.client.getModel('vision-fast') : this.client.getModel('vision'),
      maxTokens: 500,
    });

    return response.content;
  }

  /**
   * Extract text from image (OCR)
   */
  async extractTextFromImage(imageUrl: string): Promise<string> {
    const response = await this.analyzeImage(imageUrl, {
      prompt: 'Extract all text from this image. If there is no text, say "No text found."',
      model: this.client.getModel('vision'),
      temperature: 0.1,
      maxTokens: 2000,
    });

    return response.content;
  }

  /**
   * Answer a specific question about an image
   */
  async askAboutImage(imageUrl: string, question: string): Promise<string> {
    const response = await this.analyzeImage(imageUrl, {
      prompt: question,
      model: this.client.getModel('vision'),
      maxTokens: 1000,
    });

    return response.content;
  }

  /**
   * Analyze multiple images together
   */
  async analyzeMultipleImages(
    imageUrls: string[],
    prompt: string
  ): Promise<AIResponse> {
    const content: MessageContent[] = [
      {
        type: 'text',
        text: prompt,
      },
    ];

    // Add all images
    for (const url of imageUrls) {
      content.push({
        type: 'image_url',
        image_url: {
          url: url,
        },
      });
    }

    const messages = [
      {
        role: 'user' as const,
        content: content,
      },
    ];

    return await this.client.chat(messages, this.client.getModel('vision'), {
      maxTokens: 2000,
    });
  }
}

// Singleton instance
let processorInstance: ImageProcessor | null = null;

export function getImageProcessor(): ImageProcessor {
  if (!processorInstance) {
    processorInstance = new ImageProcessor();
  }
  return processorInstance;
}
