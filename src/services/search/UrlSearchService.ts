import { RedisService } from '../indexing/RedisService';
import { OpenAIEmbedding } from '../embedding/OpenAIEmbedding';
import { calculateFuzzyScore, calculateWeightedScore } from '../../utils/searchUtils';

export interface UrlSearchOptions {
  indexName?: string;
  k?: number;
  weights?: {
    titleWeight?: number;
    urlWeight?: number;
    fuzzyWeight?: number;
  };
}

export interface UrlSearchResult {
  urlId: string;
  url: string;
  pageTitle: string;
  titleVectorScore: number;
  urlVectorScore: number;
  fuzzyScore: number;
  overallScore: number;
  weightedScore?: number;
}

export class UrlSearchService {
  private redisService: RedisService;
  private embedder: OpenAIEmbedding;
  
  constructor() {
    this.redisService = new RedisService();
    this.embedder = new OpenAIEmbedding();
  }
  
  async initialize(): Promise<void> {
    await this.redisService.connect();
  }
  
  async search(query: string, fuzzyValue: string, options: UrlSearchOptions = {}): Promise<UrlSearchResult[]> {
    const {
      indexName = 'idx:urls',
      k = 10,
      weights = {
        titleWeight: 1.0,
        urlWeight: 1.0,
        fuzzyWeight: 1.5
      }
    } = options;
    
    try {
      // Generate query embedding
      const queryEmbedding = await this.embedder.embedText(query);
      const queryVecBuffer = Buffer.from(new Float32Array(queryEmbedding).buffer);
      
      // Build title query
      const titleQueryStr = `(@url:${fuzzyValue}~2|@page_title:${fuzzyValue}~2)=>[KNN ${k} @title_embedding $vector AS title_vector_score]`;
      
      // Execute title query
      const titleResults = await this.redisService.getClient().ft.search(
        indexName,
        titleQueryStr,
        {
          PARAMS: { vector: queryVecBuffer },
          RETURN: ['url_id', 'url', 'page_title', 'title_vector_score'],
          SORTBY: { BY: 'title_vector_score', DIRECTION: 'ASC' },
          DIALECT: 2
        }
      );
      
      // Build URL query
      const urlQueryStr = `*=>[KNN ${k} @url_embedding $vector AS url_vector_score]`;
      
      // Execute URL query
      const urlResults = await this.redisService.getClient().ft.search(
        indexName,
        urlQueryStr,
        {
          PARAMS: { vector: queryVecBuffer },
          RETURN: ['url_id', 'url_vector_score'],
          SORTBY: { BY: 'url_vector_score', DIRECTION: 'ASC' },
          DIALECT: 2
        }
      );
      
      // Process URL scores
      const urlScores: Record<string, number> = {};
      for (const doc of urlResults.documents) {
        const urlId = doc.value.url_id;
        const score = parseFloat(doc.value.url_vector_score);
        urlScores[urlId] = score;
      }
      
      // Process and combine results
      const output: UrlSearchResult[] = [];
      for (const doc of titleResults.documents) {
        const urlId = doc.value.url_id;
        const url = doc.value.url;
        const pageTitle = doc.value.page_title;
        
        // Get scores
        const titleVectorScore = parseFloat(doc.value.title_vector_score);
        const urlVectorScore = urlScores[urlId] || 0;
        
        // Calculate fuzzy match scores using the improved function
        const urlFuzzyScore = calculateFuzzyScore(url, fuzzyValue);
        const titleFuzzyScore = calculateFuzzyScore(pageTitle, fuzzyValue);
        const fuzzyScore = Math.max(urlFuzzyScore, titleFuzzyScore);
        
        // Calculate overall score (without weighting)
        const overallScore = (titleVectorScore + urlVectorScore + (fuzzyScore * 1.5)) / 3.5;
        
        // Calculate weighted score
        const weightedScore = calculateWeightedScore(
          {
            titleVectorScore,
            urlVectorScore,
            fuzzyScore
          },
          weights
        );
        
        output.push({
          urlId,
          url,
          pageTitle,
          titleVectorScore,
          urlVectorScore,
          fuzzyScore,
          overallScore,
          weightedScore
        });
      }
      
      // Sort by weighted score (higher is better)
      output.sort((a, b) => (b.weightedScore || b.overallScore) - (a.weightedScore || a.overallScore));
      
      return output;
    } catch (error) {
      console.error('Error during URL search:', error);
      throw error;
    }
  }
  
  async cleanup(): Promise<void> {
    await this.redisService.disconnect();
  }
}