/**
 * Utility functions for search scoring and ranking
 */

/**
 * Calculate a fuzzy match score between text and query
 * Returns a score between 0 and 1, with higher scores indicating better matches
 */
export function calculateFuzzyScore(text: string, query: string): number {
    if (!text || !query) return 0;
    
    text = text.toLowerCase();
    query = query.toLowerCase();
    
    // Exact match (whole string)
    if (query === text) {
        return 1.0;
    }
    
    // Exact substring match
    if (text.includes(query)) {
        // Give higher weight to exact substring matches
        // The shorter the text compared to query, the higher the score
        const lengthRatio = query.length / text.length;
        return Math.min(1.0, 0.8 + (lengthRatio * 0.2));
    }
    
    // Calculate word-level matches
    const textWords = new Set(text.split(/\s+/).filter(Boolean));
    const queryWords = new Set(query.split(/\s+/).filter(Boolean));
    
    if (queryWords.size === 0) {
        return 0.0;
    }
    
    // Find matching words
    const matchingWords: string[] = [];
    queryWords.forEach(word => {
        if (textWords.has(word)) {
            matchingWords.push(word);
        }
    });
    
    // Score based on proportion of matching words
    const wordScore = matchingWords.length / queryWords.size;
    
    // Boost score if query words appear close together in text
    let boost = 0.0;
    if (matchingWords.length > 1) {
        const textWordList = text.split(/\s+/).filter(Boolean);
        const positions: number[] = [];
        
        matchingWords.forEach(word => {
            const index = textWordList.indexOf(word);
            if (index !== -1) {
                positions.push(index);
            }
        });
        
        if (positions.length > 1) {
            // Sort positions
            positions.sort((a, b) => a - b);
            
            // Calculate average distance between matches
            const gaps: number[] = [];
            for (let i = 0; i < positions.length - 1; i++) {
                gaps.push(positions[i + 1] - positions[i]);
            }
            
            if (gaps.length > 0) {
                const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
                // Boost score for words that appear closer together
                boost = Math.max(0.0, 0.2 * (1.0 - Math.min(avgGap / 10.0, 1.0)));
            }
        }
    }
    
    // Cap fuzzy matches at 0.7 to ensure they're always lower than exact matches
    return Math.min(0.7, wordScore + boost);
}

/**
 * Calculate a recency score based on the published date and recency bias
 * 
 * @param publishedDate - The published date of the document
 * @param recencyBias - A value between 0.0 and 1.0 indicating how important recency is
 * @returns A recency score between 0.0 and 1.0, where 1.0 is most recent
 */
export function calculateRecencyScore(publishedDate: Date | string | number | null, recencyBias: number): number {
    if (!publishedDate) {
        return 0.5; // Default middle value if no date is available
    }
    
    try {
        // Parse the published date
        const pubDate = new Date(publishedDate);
        
        // Calculate days since publication
        const daysSincePub = Math.floor((Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // If recency doesn't matter, return 1.0 (no time penalty)
        if (recencyBias === 0) {
            return 1.0;
        }
        
        // Max age in days that we care about (1 year)
        const maxAge = 365;
        
        // Normalize age to 0-1 scale
        const normalizedAge = Math.min(daysSincePub / maxAge, 1.0);
        
        // Apply exponential decay based on recency_bias
        // recency_score = e^(-k * normalized_age) where k is derived from recency_bias
        const k = 5 * recencyBias; // Scale factor for the decay rate
        const recencyScore = Math.exp(-k * normalizedAge);
        
        return recencyScore;
    } catch (error) {
        return 0.5; // Default middle value if date parsing fails
    }
}

/**
 * Calculates a weighted overall score from individual component scores
 * 
 * @param scores - Object containing individual scores
 * @param weights - Object containing weights for each score component
 * @returns Weighted overall score
 */
export function calculateWeightedScore(
    scores: {
        titleVectorScore?: number,
        avgChunkScore?: number,
        fuzzyScore?: number,
        recencyScore?: number,
        urlVectorScore?: number,
        [key: string]: number | undefined
    },
    weights: {
        titleWeight?: number,
        chunkWeight?: number,
        fuzzyWeight?: number,
        recencyWeight?: number,
        urlWeight?: number,
        [key: string]: number | undefined
    }
): number {
    let totalScore = 0;
    let totalWeight = 0;
    
    // Process title vector score
    if (scores.titleVectorScore !== undefined && weights.titleWeight !== undefined) {
        totalScore += scores.titleVectorScore * weights.titleWeight;
        totalWeight += weights.titleWeight;
    }
    
    // Process chunk score
    if (scores.avgChunkScore !== undefined && weights.chunkWeight !== undefined) {
        totalScore += scores.avgChunkScore * weights.chunkWeight;
        totalWeight += weights.chunkWeight;
    }
    
    // Process fuzzy score
    if (scores.fuzzyScore !== undefined && weights.fuzzyWeight !== undefined) {
        totalScore += scores.fuzzyScore * weights.fuzzyWeight;
        totalWeight += weights.fuzzyWeight;
    }
    
    // Process recency score
    if (scores.recencyScore !== undefined && weights.recencyWeight !== undefined) {
        totalScore += scores.recencyScore * weights.recencyWeight;
        totalWeight += weights.recencyWeight;
    }
    
    // Process URL vector score (for URL search)
    if (scores.urlVectorScore !== undefined && weights.urlWeight !== undefined) {
        totalScore += scores.urlVectorScore * weights.urlWeight;
        totalWeight += weights.urlWeight;
    }
    
    // Avoid division by zero
    if (totalWeight === 0) {
        return 0;
    }
    
    return totalScore / totalWeight;
}

/**
 * Helper function to clean and parse JSON from LLM responses
 */
export function cleanAndParseJson(jsonString: string): any {
    try {
        // Step 1: Remove markdown code block markers if present
        // Pattern matches ```json, ```, or any variation with whitespace
        const pattern = /```(?:json)?\s*|\s*```/g;
        let cleanedString = jsonString.trim().replace(pattern, '');
        
        // Step 2: Ensure we have valid JSON by handling edge cases
        // Try to extract just the JSON object (anything between { and })
        const jsonPattern = /({[\s\S]*})/;
        const match = jsonPattern.exec(cleanedString);
        if (match) {
            cleanedString = match[1];
        }
        
        // Step 3: Parse the cleaned string as JSON
        try {
            return JSON.parse(cleanedString);
        } catch (error) {
            // Try some additional cleaning in case of common issues
            // Remove any trailing commas in lists or objects (common JSON syntax error)
            cleanedString = cleanedString.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
            
            // Try again with the extra cleaning
            return JSON.parse(cleanedString);
        }
    } catch (error) {
        console.error('Error parsing JSON:', error);
        throw error;
    }
}