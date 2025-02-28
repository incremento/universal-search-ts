import mongoose from 'mongoose';
import { OpenAIEmbedding } from '../embedding/OpenAIEmbedding';
import { TextChunker } from '../../utils/textChunker';
import { RedisService } from './RedisService';
import Document, { IDocument } from '../../models/Document';

export class DocumentIndexer {
  private embedder: OpenAIEmbedding;
  private chunker: TextChunker;
  private redisService: RedisService;
  
  constructor() {
    this.embedder = new OpenAIEmbedding();
    this.chunker = new TextChunker();
    this.redisService = new RedisService();
  }
  
  async initialize(): Promise<void> {
    await this.redisService.connect();
    await mongoose.connect(process.env.MONGODB_URI as string);
    
    // Create indexes
    await this.redisService.createDocumentIndex();
    await this.redisService.createChunkIndex();
  }
  
  async indexDocuments(limit: number = 500): Promise<number> {
    console.log(`Starting document indexing (limit: ${limit})...`);
    
    try {
      // Get documents from MongoDB
      const documents = await Document.find().limit(limit);
      console.log(`Found ${documents.length} documents to index`);
      
      let indexedCount = 0;
      
      for (const doc of documents) {
        try {
          // Generate title embedding
          const titleEmbedding = await this.embedder.embedText(doc.title);
          
          // Insert document
          await this.redisService.insertDocument({
            _id: (doc._id as any).toString(),
            title: doc.title,
            content: doc.content,
            signalUrl: doc.signalUrl,
            publishedDate: doc.publishedDate,
            classification: doc.classification,
            title_embedding: titleEmbedding
          });
          
          // Process content chunks
          const chunks = this.chunker.chunkText(doc.content);
          console.log(`Document ${doc._id}: Content split into ${chunks.length} chunks`);
          
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chunkEmbedding = await this.embedder.embedText(chunk);
            
            await this.redisService.insertChunk(
              (doc._id as any).toString(),
              i,
              chunk,
              chunkEmbedding
            );
          }
          
          indexedCount++;
        } catch (error) {
          console.error(`Error processing document ${doc._id}:`, error);
          continue;
        }
      }
      
      console.log(`Indexed ${indexedCount} documents successfully`);
      return indexedCount;
    } catch (error) {
      console.error('Error during document indexing:', error);
      throw error;
    }
  }
  
  async cleanup(): Promise<void> {
    await this.redisService.disconnect();
    await mongoose.disconnect();
  }
}