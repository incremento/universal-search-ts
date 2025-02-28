import { createClient } from 'redis';
import { SchemaFieldTypes } from '@redis/search';

export class RedisService {
  private client: any;
  
  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL
    });
    
    this.client.on('error', (err: any) => console.error('Redis Client Error', err));
  }
  
  // Add a getter for the Redis client
  public getClient(): any {
    return this.client;
  }
  
  async connect(): Promise<void> {
    await this.client.connect();
  }
  
  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
  
  async createDocumentIndex(indexName: string = 'idx:docs', dim: number = 1536): Promise<void> {
    try {
      // Try to drop the index if it exists
      await this.client.ft.dropIndex(indexName).catch(() => {});
      
      // Create the index
      await this.client.ft.create(indexName, {
        title: { type: SchemaFieldTypes.TEXT },
        content: { type: SchemaFieldTypes.TEXT },
        signalUrl: { type: SchemaFieldTypes.TEXT },
        classification: { type: SchemaFieldTypes.TEXT },
        doc_id: { type: SchemaFieldTypes.TEXT },
        publishedDate: { type: SchemaFieldTypes.NUMERIC },
        title_embedding: {
          type: SchemaFieldTypes.VECTOR,
          ALGORITHM: 'HNSW',
          TYPE: 'FLOAT32',
          DIM: dim,
          DISTANCE_METRIC: 'COSINE',
          INITIAL_CAP: 1000,
          M: 16,
          EF_CONSTRUCTION: 200
        }
      }, {
        ON: 'HASH',
        PREFIX: 'doc:'
      });
      
      console.log(`Created document index '${indexName}'`);
    } catch (error) {
      console.error(`Error creating document index '${indexName}':`, error);
      throw error;
    }
  }
  
  async createChunkIndex(indexName: string = 'idx:chunks', dim: number = 1536): Promise<void> {
    try {
      // Try to drop the index if it exists
      await this.client.ft.dropIndex(indexName).catch(() => {});
      
      // Create the index
      await this.client.ft.create(indexName, {
        parent_id: { type: SchemaFieldTypes.TEXT },
        chunk_text: { type: SchemaFieldTypes.TEXT },
        chunk_embedding: {
          type: SchemaFieldTypes.VECTOR,
          ALGORITHM: 'HNSW',
          TYPE: 'FLOAT32',
          DIM: dim,
          DISTANCE_METRIC: 'COSINE',
          INITIAL_CAP: 1000,
          M: 16,
          EF_CONSTRUCTION: 200
        }
      }, {
        ON: 'HASH',
        PREFIX: 'chunk:'
      });
      
      console.log(`Created chunk index '${indexName}'`);
    } catch (error) {
      console.error(`Error creating chunk index '${indexName}':`, error);
      throw error;
    }
  }
  
  async createUrlIndex(indexName: string = 'idx:urls', dim: number = 1536): Promise<void> {
    try {
      // Try to drop the index if it exists
      await this.client.ft.dropIndex(indexName).catch(() => {});
      
      // Create the index
      await this.client.ft.create(indexName, {
        url: { type: SchemaFieldTypes.TEXT },
        page_title: { type: SchemaFieldTypes.TEXT },
        url_id: { type: SchemaFieldTypes.TEXT },
        url_embedding: {
          type: SchemaFieldTypes.VECTOR,
          ALGORITHM: 'HNSW',
          TYPE: 'FLOAT32',
          DIM: dim,
          DISTANCE_METRIC: 'COSINE',
          INITIAL_CAP: 1000,
          M: 16,
          EF_CONSTRUCTION: 200
        },
        title_embedding: {
          type: SchemaFieldTypes.VECTOR,
          ALGORITHM: 'HNSW',
          TYPE: 'FLOAT32',
          DIM: dim,
          DISTANCE_METRIC: 'COSINE',
          INITIAL_CAP: 1000,
          M: 16,
          EF_CONSTRUCTION: 200
        }
      }, {
        ON: 'HASH',
        PREFIX: 'url:'
      });
      
      console.log(`Created URL index '${indexName}'`);
    } catch (error) {
      console.error(`Error creating URL index '${indexName}':`, error);
      throw error;
    }
  }
  
  async insertDocument(doc: any): Promise<void> {
    const key = `doc:${doc._id}`;
    
    try {
      await this.client.hSet(key, {
        title: doc.title,
        content: doc.content,
        signalUrl: doc.signalUrl,
        publishedDate: doc.publishedDate instanceof Date ? doc.publishedDate.getTime() : 0,
        classification: doc.classification || '',
        doc_id: doc._id.toString(),
        title_embedding: Buffer.from(new Float32Array(doc.title_embedding).buffer)
      });
      
      console.log(`Inserted document '${doc._id}'`);
    } catch (error) {
      console.error(`Error inserting document '${doc._id}':`, error);
      throw error;
    }
  }
  
  async insertChunk(docId: string, chunkIndex: number, chunkText: string, embedding: number[]): Promise<void> {
    const key = `chunk:${docId}:${chunkIndex}`;
    
    try {
      await this.client.hSet(key, {
        parent_id: docId,
        chunk_text: chunkText,
        chunk_embedding: Buffer.from(new Float32Array(embedding).buffer)
      });
      
      console.log(`Inserted chunk '${key}'`);
    } catch (error) {
      console.error(`Error inserting chunk '${key}':`, error);
      throw error;
    }
  }
  
  async insertUrlDocument(doc: any): Promise<void> {
    const key = `url:${doc._id}`;
    
    try {
      await this.client.hSet(key, {
        url: doc.url,
        page_title: doc.pageTitle,
        url_id: doc._id.toString(),
        url_embedding: Buffer.from(new Float32Array(doc.url_embedding).buffer),
        title_embedding: Buffer.from(new Float32Array(doc.title_embedding).buffer)
      });
      
      console.log(`Inserted URL document '${doc._id}'`);
    } catch (error) {
      console.error(`Error inserting URL document '${doc._id}':`, error);
      throw error;
    }
  }
}