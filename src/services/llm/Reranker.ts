import { OpenAI } from 'openai';
import { cleanAndParseJson } from '../../utils/searchUtils';

/**
 * Interface for document to be reranked
 */
export interface RerankableDocument {
    docId: string;
    title: string;
    content: string;
    [key: string]: any;
}

/**
 * Service for reranking search results using LLM
 */
export class Reranker {
    private client: OpenAI;
    private model: string;

    constructor(model: string = 'gpt-4o-mini') {
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.model = model;
    }

    /**
     * Rerank search results based on relevance to the query
     * 
     * @param query - The search query
     * @param documents - The documents to rerank
     * @returns Map of document IDs to relevance scores
     */
    async rerankResults(query: string, documents: RerankableDocument[]): Promise<Map<string, number>> {
        try {
            // Extract document information for the prompt
            const docInfos = documents.map((doc, index) => {
                return {
                    id: doc.docId,
                    title: doc.title,
                    content: this.truncateContent(doc.content, 200) // Limit content length
                };
            });

            // Create the reranking prompt
            const prompt = this.getRerankerPrompt(query, docInfos);
            
            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            });

            const responseContent = completion.choices[0].message.content;
            if (!responseContent) {
                throw new Error('Empty response from LLM');
            }

            // Parse the response
            const rerankScores = cleanAndParseJson(responseContent);
            
            // Convert to Map for easier access
            const scoreMap = new Map<string, number>();
            
            // Validate and process the scores
            if (rerankScores && typeof rerankScores === 'object') {
                Object.entries(rerankScores).forEach(([docId, score]) => {
                    // Ensure score is a number between 0 and 1
                    const numScore = Number(score);
                    if (!isNaN(numScore)) {
                        scoreMap.set(docId, Math.min(Math.max(numScore, 0), 1));
                    }
                });
            }
            
            return scoreMap;
        } catch (error) {
            console.error('Error reranking search results:', error);
            
            // Fallback to default scores if reranking fails
            const defaultScores = new Map<string, number>();
            documents.forEach(doc => {
                defaultScores.set(doc.docId, 0.5); // Default middle value
            });
            
            return defaultScores;
        }
    }

    /**
     * Truncate content to a specified length
     */
    private truncateContent(content: string, maxLength: number): string {
        if (content.length <= maxLength) {
            return content;
        }
        
        return content.substring(0, maxLength) + '...';
    }

    /**
     * Generate the prompt for reranking
     */
    private getRerankerPrompt(query: string, docInfos: Array<{id: string, title: string, content: string}>): string {
        const docsJson = JSON.stringify(docInfos, null, 2);
        
        return `# Search Result Reranker

You are a specialized search result reranker. Your task is to evaluate the relevance of each document to the user's query and assign a relevance score.

## Query
"${query}"

## Documents
${docsJson}

## Instructions
For each document, evaluate its relevance to the query on a scale from 0.0 to 1.0, where:
- 1.0: Perfectly relevant, directly answers the query
- 0.8-0.9: Highly relevant, contains most of the information needed
- 0.5-0.7: Moderately relevant, contains some useful information
- 0.2-0.4: Slightly relevant, tangentially related
- 0.0-0.1: Not relevant at all

Consider these factors:
1. How directly the document addresses the query
2. The amount of relevant information provided
3. The specificity and depth of the content
4. The credibility and authority of the source (if apparent)

## Output Format
Provide a JSON object with document IDs as keys and relevance scores as values:

{
  "doc_id_1": 0.95,
  "doc_id_2": 0.7,
  ...
}

Return only the JSON object without any additional text.`;
    }
}