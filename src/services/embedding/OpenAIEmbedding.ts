import { OpenAI } from 'openai';
import { cleanText } from '../../utils/textCleaner';

export class OpenAIEmbedding {
  private client: OpenAI;
  private model: string;

  constructor(model: string = 'text-embedding-3-small') {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.model = model;
  }

  async embedText(text: string): Promise<number[]> {
    const cleanedText = cleanText(text);
    
    try {
      const response = await this.client.embeddings.create({
        input: cleanedText,
        model: this.model
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }
}