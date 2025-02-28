import { RedisService } from '../indexing/RedisService';
import { OpenAIEmbedding } from '../embedding/OpenAIEmbedding';
import { calculateFuzzyScore, calculateRecencyScore, calculateWeightedScore } from '../../utils/searchUtils';
import { SearchOptimizer } from '../llm/SearchOptimizer';
import { Reranker, RerankableDocument } from '../llm/Reranker';

export interface SearchOptions {
  docsIndex?: string;
  chunksIndex?: string;
  vectorField?: string;
  k?: number;
  filters?: any;
  aiEnhanced?: boolean;
  useLlmReranking?: boolean;
  weights?: {
    titleWeight?: number;
    chunkWeight?: number;
    fuzzyWeight?: number;
    recencyWeight?: number;
    rerankWeight?: number;
  };
}

export interface SearchResult {
  docId: string;
  title: string;
  content: string;
  signalUrl: string;
  publishedDate: Date;
  classification: string;
  titleVectorScore: number;
  avgChunkScore: number;
  fuzzyScore: number;
  recencyScore?: number;
  rerankScore?: number;
  overallScore: number;
  weightedScore?: number;
}

export class DocumentSearchService {
  private redisService: RedisService;
  private embedder: OpenAIEmbedding;
  private searchOptimizer: SearchOptimizer;
  private reranker: Reranker;
  
  constructor() {
    this.redisService = new RedisService();
    this.embedder = new OpenAIEmbedding();
    this.searchOptimizer = new SearchOptimizer();
    this.reranker = new Reranker();
  }
  
  async initialize(): Promise<void> {
    await this.redisService.connect();
  }
  
  async search(query: string, fuzzyValue: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const {
      docsIndex = 'idx:docs',
      chunksIndex = 'idx:chunks',
      vectorField = 'title_embedding',
      k = 10,
      filters = {},
      aiEnhanced = false,
      useLlmReranking = false,
      weights = {
        titleWeight: 1.0,
        chunkWeight: 1.0,
        fuzzyWeight: 1.5,
        recencyWeight: 1.0
      }
    } = options;
    
    try {
      let vectorQuery = query;
      let exactQuery = fuzzyValue;
      let recencyBias = 0.5; // Default middle value
      
      // Use AI to enhance the search if requested
      if (aiEnhanced) {
        try {
          const optimizedParams = await this.searchOptimizer.optimizeQuery(query);
          exactQuery = optimizedParams.exactSearch;
          vectorQuery = optimizedParams.vectorSearch;
          recencyBias = optimizedParams.recencyBias;
          console.log('Search optimized:', { exactQuery, vectorQuery, recencyBias });
        } catch (error) {
          console.error('Error optimizing search query:', error);
          // Continue with original query if optimization fails
        }
      }
      
      // Generate query embedding
      const queryEmbedding = await this.embedder.embedText(vectorQuery);
      const queryVecBuffer = Buffer.from(new Float32Array(queryEmbedding).buffer);
      
      // Build filter string if filters are provided
      let filterStr = '';
      if (filters) {
        const filterParts = [];
        
        if (filters.dateRange) {
          const { start, end } = filters.dateRange;
          if (start) filterParts.push(`@publishedDate:[${new Date(start).getTime()} +inf]`);
          if (end) filterParts.push(`@publishedDate:[-inf ${new Date(end).getTime()}]`);
        }
        
        if (filters.classification && filters.classification.length > 0) {
          const classFilters = filters.classification.map((c: string) => `@classification:${c}`);
          filterParts.push(`(${classFilters.join('|')})`);
        }
        
        if (filters.excludeTerms && filters.excludeTerms.length > 0) {
          filters.excludeTerms.forEach((term: string) => {
            filterParts.push(`-@title:${term}`);
            filterParts.push(`-@content:${term}`);
          });
        }
        
        if (filterParts.length > 0) {
          filterStr = filterParts.join(' ');
        }
      }
      
      // Build document query
      const docsQueryStr = `(@title:${exactQuery}~2|@content:${exactQuery}~2)${filterStr ? ' ' + filterStr : ''}=>[KNN ${k} @${vectorField} $vector AS title_vector_score]`;
      
      // Execute document query
      const docsResults = await this.redisService.getClient().ft.search(
        docsIndex,
        docsQueryStr,
        {
          PARAMS: { vector: queryVecBuffer },
          RETURN: ['doc_id', 'title', 'content', 'signalUrl', 'publishedDate', 'classification', 'title_vector_score'],
          SORTBY: { BY: 'title_vector_score', DIRECTION: 'ASC' },
          DIALECT: 2
        }
      );
      
      // Build chunks query
      const chunksQueryStr = `*=>[KNN ${k*3} @chunk_embedding $vector AS chunk_vector_score]`;
      
      // Execute chunks query
      const chunksResults = await this.redisService.getClient().ft.search(
        chunksIndex,
        chunksQueryStr,
        {
          PARAMS: { vector: queryVecBuffer },
          RETURN: ['parent_id', 'chunk_vector_score'],
          SORTBY: { BY: 'chunk_vector_score', DIRECTION: 'ASC' },
          DIALECT: 2
        }
      );
      
      // Process chunk scores
      const chunkScores: Record<string, number[]> = {};
      for (const doc of chunksResults.documents) {
        const parentId = doc.value.parent_id;
        const score = parseFloat(doc.value.chunk_vector_score);
        
        if (!chunkScores[parentId]) {
          chunkScores[parentId] = [];
        }
        chunkScores[parentId].push(score);
      }
      
      // Calculate average chunk scores
      const avgChunkScores: Record<string, number> = {};
      for (const [parentId, scores] of Object.entries(chunkScores)) {
        avgChunkScores[parentId] = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
      
      // Process and combine results
      const output: SearchResult[] = [];
      for (const doc of docsResults.documents) {
        const docId = doc.value.doc_id;
        const title = doc.value.title;
        const content = doc.value.content;
        const signalUrl = doc.value.signalUrl;
        const publishedDate = new Date(parseInt(doc.value.publishedDate));
        const classification = doc.value.classification;
        
        // Get scores
        const titleVectorScore = parseFloat(doc.value.title_vector_score);
        const avgChunkScore = avgChunkScores[docId] || 0;
        
        // Calculate fuzzy match score using the improved function
        const titleFuzzyScore = calculateFuzzyScore(title, exactQuery);
        const contentFuzzyScore = calculateFuzzyScore(content, exactQuery);
        const fuzzyScore = Math.max(titleFuzzyScore, contentFuzzyScore);
        
        // Calculate recency score
        const recencyScore = calculateRecencyScore(publishedDate, recencyBias);
        
        // Calculate overall score (without weighting)
        const overallScore = (titleVectorScore + avgChunkScore + (fuzzyScore * 1.5) + recencyScore) / 4;
        
        output.push({
          docId,
          title,
          content,
          signalUrl,
          publishedDate,
          classification,
          titleVectorScore,
          avgChunkScore,
          fuzzyScore,
          recencyScore,
          overallScore
        });
      }
      
      // Apply LLM reranking if enabled
      if (useLlmReranking && output.length > 0) {
        try {
          const rerankScores = await this.reranker.rerankResults(
            query,
            output as RerankableDocument[]
          );
          
          // Add rerank scores to the output
          for (const doc of output) {
            doc.rerankScore = rerankScores.get(doc.docId) || 0.5;
          }
        } catch (error) {
          console.error('Error reranking search results:', error);
          // Continue without reranking if it fails
        }
      }
      
      // Calculate weighted scores
      for (const doc of output) {
        // Prepare scores object with explicit typing to include rerankScore
        const scores: {
          titleVectorScore: number,
          avgChunkScore: number,
          fuzzyScore: number,
          recencyScore?: number,
          rerankScore?: number,
          [key: string]: number | undefined
        } = {
          titleVectorScore: doc.titleVectorScore,
          avgChunkScore: doc.avgChunkScore,
          fuzzyScore: doc.fuzzyScore,
          recencyScore: doc.recencyScore
        };
        
        // Create a copy of weights with explicit typing to include rerankWeight
        const weightsCopy: {
          titleWeight?: number,
          chunkWeight?: number,
          fuzzyWeight?: number,
          recencyWeight?: number,
          rerankWeight?: number,
          [key: string]: number | undefined
        } = { ...weights };
        
        // Include rerank score if available
        if (doc.rerankScore !== undefined) {
          scores.rerankScore = doc.rerankScore;
          weightsCopy.rerankWeight = 2.0; // Give high weight to LLM reranking
        }
        
        // Calculate weighted score
        doc.weightedScore = calculateWeightedScore(scores, weightsCopy);
      }
      
      // Sort by weighted score (higher is better)
      output.sort((a, b) => (b.weightedScore || b.overallScore) - (a.weightedScore || a.overallScore));
      
      return output;
    } catch (error) {
      console.error('Error during document search:', error);
      throw error;
    }
  }
  
  async cleanup(): Promise<void> {
    await this.redisService.disconnect();
  }
}