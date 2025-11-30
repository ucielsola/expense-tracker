import { getOpenRouterClient } from './openrouter-client';
import { getTextProcessor } from './text-processor';
import { AudioProcessingOptions } from '../types/ai';
import axios from 'axios';

export class AudioProcessor {
  private client = getOpenRouterClient();
  private textProcessor = getTextProcessor();

  /**
   * Download audio file from URL
   */
  async downloadAudio(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading audio:', error);
      throw new Error('Failed to download audio file');
    }
  }

  /**
   * Transcribe audio to text
   */
  async transcribe(audioBuffer: Buffer, filename: string = 'audio.mp3'): Promise<string> {
    try {
      return await this.client.transcribeAudio(audioBuffer, filename);
    } catch (error) {
      console.error('Transcription error:', error);
      throw new Error('Failed to transcribe audio');
    }
  }

  /**
   * Transcribe audio from URL
   */
  async transcribeFromUrl(audioUrl: string, filename: string = 'audio.mp3'): Promise<string> {
    const audioBuffer = await this.downloadAudio(audioUrl);
    return await this.transcribe(audioBuffer, filename);
  }

  /**
   * Transcribe and analyze audio content
   */
  async processAudio(
    audioBuffer: Buffer,
    filename: string = 'audio.mp3',
    options: AudioProcessingOptions = {}
  ): Promise<{
    transcription: string;
    analysis?: string;
  }> {
    // First, transcribe the audio
    const transcription = await this.transcribe(audioBuffer, filename);

    // If analysis prompt is provided, analyze the transcription
    let analysis: string | undefined;
    if (options.analysisPrompt) {
      const model = options.analysisModel || this.client.getModel('text-fast');
      const response = await this.textProcessor.processText(transcription, {
        systemPrompt: options.analysisPrompt,
        model: model,
      });
      analysis = response.content;
    }

    return {
      transcription,
      analysis,
    };
  }

  /**
   * Transcribe and analyze audio from URL
   */
  async processAudioFromUrl(
    audioUrl: string,
    filename: string = 'audio.mp3',
    options: AudioProcessingOptions = {}
  ): Promise<{
    transcription: string;
    analysis?: string;
  }> {
    const audioBuffer = await this.downloadAudio(audioUrl);
    return await this.processAudio(audioBuffer, filename, options);
  }

  /**
   * Summarize audio content
   */
  async summarizeAudio(audioBuffer: Buffer, filename: string = 'audio.mp3'): Promise<string> {
    const result = await this.processAudio(audioBuffer, filename, {
      analysisPrompt: 'Provide a concise summary of this transcription, highlighting the main points.',
    });

    return result.analysis || result.transcription;
  }

  /**
   * Extract specific information from audio
   */
  async extractFromAudio(
    audioBuffer: Buffer,
    extractionPrompt: string,
    filename: string = 'audio.mp3'
  ): Promise<string> {
    const result = await this.processAudio(audioBuffer, filename, {
      analysisPrompt: extractionPrompt,
    });

    return result.analysis || result.transcription;
  }
}

// Singleton instance
let processorInstance: AudioProcessor | null = null;

export function getAudioProcessor(): AudioProcessor {
  if (!processorInstance) {
    processorInstance = new AudioProcessor();
  }
  return processorInstance;
}
