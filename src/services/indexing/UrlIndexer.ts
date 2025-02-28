import mongoose from 'mongoose';
import { OpenAIEmbedding } from '../embedding/OpenAIEmbedding';
import { RedisService } from './RedisService';
import UrlDocument, { IUrlDocument } from '../../models/UrlDocument';

export class UrlIndexer {
  private embedder: OpenAIEmbedding;
  private redisService: RedisService;
  
  constructor() {
    this.embedder = new OpenAIEmbedding();
    this.redisService = new RedisService();
  }
  
  async initialize(): Promise<void> {
    await this.redisService.connect();
    await mongoose.connect(process.env.MONGODB_URI as string);
    
    // Create URL index
    await this.redisService.createUrlIndex();
  }
  
  async indexUrls(limit: number = 500): Promise<number> {
    console.log(`Starting URL indexing (limit: ${limit})...`);
    
    try {
      // Get URL documents from MongoDB
      const urlDocuments = await UrlDocument.find().limit(limit);
      console.log(`Found ${urlDocuments.length} URLs to index`);
      
      let indexedCount = 0;
      
      for (const doc of urlDocuments) {
        try {
          // Generate embeddings
          const urlEmbedding = await this.embedder.embedText(doc.url);
          const titleEmbedding = await this.embedder.embedText(doc.pageTitle);
          
          // Insert URL document
          await this.redisService.insertUrlDocument({
            _id: (doc._id as any).toString(),
            url: doc.url,
            pageTitle: doc.pageTitle,
            url_embedding: urlEmbedding,
            title_embedding: titleEmbedding
          });
          
          indexedCount++;
        } catch (error) {
          console.error(`Error processing URL document ${doc._id}:`, error);
          continue;
        }
      }
      
      console.log(`Indexed ${indexedCount} URLs successfully`);
      return indexedCount;
    } catch (error) {
      console.error('Error during URL indexing:', error);
      throw error;
    }
  }
  
  async cleanup(): Promise<void> {
    await this.redisService.disconnect();
    await mongoose.disconnect();
  }
}