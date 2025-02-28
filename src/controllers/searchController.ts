import { Request, Response } from 'express';
import { DocumentSearchService } from '../services/search/DocumentSearchService';
import { UrlSearchService } from '../services/search/UrlSearchService';

const documentSearchService = new DocumentSearchService();
const urlSearchService = new UrlSearchService();

export const searchDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      query, 
      fuzzyValue, 
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
    } = req.body;
    
    if (!query) {
      res.status(400).json({
        success: false,
        message: 'Query is required'
      });
      return;
    }
    
    // If fuzzyValue is not provided, use the query as the default
    const effectiveFuzzyValue = fuzzyValue || query;
    
    await documentSearchService.initialize();
    const results = await documentSearchService.search(query, effectiveFuzzyValue, {
      k: parseInt(k as string, 10),
      filters,
      aiEnhanced: Boolean(aiEnhanced),
      useLlmReranking: Boolean(useLlmReranking),
      weights
    });
    
    // Add execution metadata
    const executionMetadata = {
      aiEnhanced: Boolean(aiEnhanced),
      useLlmReranking: Boolean(useLlmReranking),
      timestamp: new Date().toISOString(),
      resultCount: results.length
    };
    
    res.status(200).json({
      success: true,
      count: results.length,
      results,
      metadata: executionMetadata
    });
  } catch (error) {
    console.error('Error in document search controller:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching documents',
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await documentSearchService.cleanup();
  }
};

export const searchUrls = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      query, 
      fuzzyValue, 
      k = 10,
      weights = {
        titleWeight: 1.0,
        urlWeight: 1.0,
        fuzzyWeight: 1.5
      }
    } = req.body;
    
    if (!query) {
      res.status(400).json({
        success: false,
        message: 'Query is required'
      });
      return;
    }
    
    // If fuzzyValue is not provided, use the query as the default
    const effectiveFuzzyValue = fuzzyValue || query;
    
    await urlSearchService.initialize();
    const results = await urlSearchService.search(query, effectiveFuzzyValue, {
      k: parseInt(k as string, 10),
      weights
    });
    
    // Add execution metadata
    const executionMetadata = {
      timestamp: new Date().toISOString(),
      resultCount: results.length
    };
    
    res.status(200).json({
      success: true,
      count: results.length,
      results,
      metadata: executionMetadata
    });
  } catch (error) {
    console.error('Error in URL search controller:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching URLs',
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await urlSearchService.cleanup();
  }
};