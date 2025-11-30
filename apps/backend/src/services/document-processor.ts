import { getTextProcessor } from './text-processor';
import { getImageProcessor } from './image-processor';
import { DocumentProcessingOptions } from '../types/ai';
import axios from 'axios';

export class DocumentProcessor {
  private textProcessor = getTextProcessor();
  private imageProcessor = getImageProcessor();

  /**
   * Download document from URL
   */
  async downloadDocument(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading document:', error);
      throw new Error('Failed to download document');
    }
  }

  /**
   * Extract text from PDF using vision model (OCR approach)
   * Note: For production, you might want to use a dedicated PDF parser
   */
  async extractTextFromPDF(pdfUrl: string): Promise<string> {
    // This is a simplified approach - in production you'd convert PDF pages to images
    // and use vision models to extract text from each page
    throw new Error('PDF text extraction not yet implemented. Consider using pdf-parse library.');
  }

  /**
   * Process image-based documents (screenshots, scanned docs, etc.)
   */
  async processImageDocument(
    imageUrl: string,
    options: DocumentProcessingOptions = {}
  ): Promise<{
    extractedText?: string;
    analysis?: string;
  }> {
    let extractedText: string | undefined;
    let analysis: string | undefined;

    // Extract text if requested
    if (options.extractText !== false) {
      extractedText = await this.imageProcessor.extractTextFromImage(imageUrl);
    }

    // Analyze if prompt is provided
    if (options.analysisPrompt) {
      const prompt = options.extractText !== false && extractedText
        ? `${options.analysisPrompt}\n\nExtracted text: ${extractedText}`
        : options.analysisPrompt;

      const response = await this.imageProcessor.analyzeImage(imageUrl, {
        prompt: prompt,
        model: options.model,
      });

      analysis = response.content;
    }

    return {
      extractedText,
      analysis,
    };
  }

  /**
   * Analyze a text document
   */
  async analyzeTextDocument(
    text: string,
    analysisPrompt: string,
    options: DocumentProcessingOptions = {}
  ): Promise<string> {
    const response = await this.textProcessor.processText(text, {
      systemPrompt: analysisPrompt,
      model: options.model,
    });

    return response.content;
  }

  /**
   * Extract structured data from document
   */
  async extractStructuredData(
    documentContent: string,
    schema: string,
    options: DocumentProcessingOptions = {}
  ): Promise<string> {
    const prompt = `Extract the following information from the document in a structured format:\n\n${schema}\n\nProvide the result as JSON or a structured list.`;

    const response = await this.textProcessor.processText(documentContent, {
      systemPrompt: prompt,
      model: options.model,
      temperature: 0.2,
    });

    return response.content;
  }

  /**
   * Summarize a document
   */
  async summarizeDocument(
    documentContent: string,
    options: DocumentProcessingOptions = {}
  ): Promise<string> {
    const response = await this.textProcessor.processText(documentContent, {
      systemPrompt: 'Provide a concise summary of this document, highlighting the key points and main ideas.',
      model: options.model,
      maxTokens: 1000,
    });

    return response.content;
  }

  /**
   * Answer questions about a document
   */
  async queryDocument(
    documentContent: string,
    question: string,
    options: DocumentProcessingOptions = {}
  ): Promise<string> {
    const messages = [
      {
        role: 'system' as const,
        content: 'You are analyzing a document. Answer the user\'s question based on the document content.',
      },
      {
        role: 'user' as const,
        content: `Document:\n\n${documentContent}\n\n---\n\nQuestion: ${question}`,
      },
    ];

    const response = await this.textProcessor.chat(messages, {
      model: options.model,
    });

    return response.content;
  }

  /**
   * Process document based on file type
   */
  async processDocument(
    fileUrl: string,
    fileType: string,
    options: DocumentProcessingOptions = {}
  ): Promise<{
    extractedText?: string;
    analysis?: string;
  }> {
    // Determine processing method based on file type
    if (fileType.startsWith('image/')) {
      return await this.processImageDocument(fileUrl, options);
    } else if (fileType === 'application/pdf') {
      throw new Error('PDF processing requires additional setup. Use a PDF parser library.');
    } else if (fileType.startsWith('text/')) {
      // For text files, download and analyze
      const buffer = await this.downloadDocument(fileUrl);
      const text = buffer.toString('utf-8');

      let analysis: string | undefined;
      if (options.analysisPrompt) {
        analysis = await this.analyzeTextDocument(text, options.analysisPrompt, options);
      }

      return {
        extractedText: text,
        analysis,
      };
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  }
}

// Singleton instance
let processorInstance: DocumentProcessor | null = null;

export function getDocumentProcessor(): DocumentProcessor {
  if (!processorInstance) {
    processorInstance = new DocumentProcessor();
  }
  return processorInstance;
}
