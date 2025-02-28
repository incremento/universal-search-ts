export class TextChunker {
    private chunkSize: number;
    private overlap: number;
  
    constructor(chunkSize: number = 512, overlap: number = 50) {
      this.chunkSize = chunkSize;
      this.overlap = overlap;
    }
  
    chunkText(text: string): string[] {
      if (!text) return [];
      
      // Split on whitespace to approximate tokens
      const words = text.split(/\s+/);
      const chunks: string[] = [];
      
      let i = 0;
      while (i < words.length) {
        // Calculate end index for current chunk
        const end = Math.min(i + this.chunkSize, words.length);
        chunks.push(words.slice(i, end).join(' '));
        
        // Move to next chunk with overlap
        i += this.chunkSize - this.overlap;
        if (i >= words.length) break;
        if (i < 0) i = 0; // Safety check
      }
      
      return chunks;
    }
  }