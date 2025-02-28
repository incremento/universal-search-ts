import { OpenAI } from 'openai';
import { cleanAndParseJson } from '../../utils/searchUtils';

/**
 * Interface for optimized search parameters
 */
export interface OptimizedSearchParams {
    exactSearch: string;
    vectorSearch: string;
    recencyBias: number;
}

/**
 * Service for optimizing search queries using LLM
 */
export class SearchOptimizer {
    private client: OpenAI;
    private model: string;

    constructor(model: string = 'gpt-4o-mini') {
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.model = model;
    }

    /**
     * Optimize a search query using LLM
     * 
     * @param searchQuery - The original search query
     * @returns Optimized search parameters
     */
    async optimizeQuery(searchQuery: string): Promise<OptimizedSearchParams> {
        try {
            const prompt = this.getSearchOptimizerPrompt(searchQuery);
            
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

            const optimizedParams = cleanAndParseJson(responseContent);
            
            // Validate the response
            if (!optimizedParams.exact_search || !optimizedParams.vector_search || optimizedParams.recency_bias === undefined) {
                throw new Error('Invalid response format from LLM');
            }

            return {
                exactSearch: optimizedParams.exact_search,
                vectorSearch: optimizedParams.vector_search,
                recencyBias: optimizedParams.recency_bias
            };
        } catch (error) {
            console.error('Error optimizing search query:', error);
            
            // Fallback to original query if optimization fails
            return {
                exactSearch: searchQuery,
                vectorSearch: searchQuery,
                recencyBias: 0.5 // Default middle value
            };
        }
    }

    /**
     * Generate the prompt for search query optimization
     */
    private getSearchOptimizerPrompt(searchQuery: string): string {
        return `# Search Query Optimizer

You are a specialized search query optimizer for a content research system. Your task is to transform user search queries into optimized search parameters for multiple search mechanisms: exact match search, semantic vector search, and a recency bias indicator.

## Input Format
The input will be a natural language search query that a content researcher might use when looking for sources for business and technology articles.

## Output Format
For each query, provide a JSON object with three fields:
- \`exact_search\`: A concise phrase for exact/fuzzy matching, with unnecessary words removed.
- \`vector_search\`: A complete phrase optimized for semantic vector search that captures the full context and meaning.
- \`recency_bias\`: A numeric value from 0.0 to 1.0 (rounded to nearest 0.05) indicating how important recent information is for this query.

Your output should be just the JSON object without any markdown formatting:

{
"exact_search": "",
"vector_search": "",
"recency_bias": 0.0
}

## Recency Bias Guidelines
- 0.0: Historical/timeless information where recency doesn't matter at all
- 0.1-0.3: Information that changes slowly or rarely
- 0.4-0.6: Information that has moderate updates or developments
- 0.7-0.9: Information that changes frequently or is reasonably time-sensitive
- 1.0: Highly time-sensitive information where only the very latest sources are relevant

## Examples

### Example 1:
**Input**: "What is the biggest dinosaur?"

**Output**:
{
"exact_search": "biggest dinosaur",
"vector_search": "What is the biggest dinosaur by size or weight",
"recency_bias": 0.1
}
**Reasoning**: The exact search focuses on the key terms. The vector search maintains the question context but adds potential disambiguation (size vs weight). The recency bias is low (0.1) because dinosaur facts are relatively stable, though occasional new discoveries might occur.

### Example 2:
**Input**: "Recent Series A's in Canada"

**Output**:
{
"exact_search": "Series A Canada",
"vector_search": "Recent companies that raised Series A funding in Canada",
"recency_bias": 1.0
}
**Reasoning**: The exact search extracts the key terms. The vector search expands with context about companies and funding. The recency bias is maximal (1.0) since the query explicitly asks for recent information.

### Example 3:
**Input**: "Best practices for remote team management"

**Output**:
{
"exact_search": "remote team management best practices",
"vector_search": "Effective strategies and best practices for managing remote or distributed teams",
"recency_bias": 0.6
}
**Reasoning**: The exact search rearranges key terms for better matching. The vector search expands with synonyms and related concepts. The recency bias is moderate (0.6) because while remote work practices evolve, core management principles remain somewhat stable.

Always analyze each query to determine the core search intent, essential keywords, and time sensitivity before generating your response.

### Current input
**Input**: "${searchQuery}"`;
    }
}