import dotenv from 'dotenv';
import { UrlIndexer } from '../services/indexing/UrlIndexer';

// Load environment variables
dotenv.config();

async function main() {
  console.log('Starting URL indexing script...');
  
  const indexer = new UrlIndexer();
  
  try {
    await indexer.initialize();
    const count = await indexer.indexUrls();
    console.log(`URL indexing completed. Indexed ${count} URLs.`);
  } catch (error) {
    console.error('Error in URL indexing script:', error);
    process.exit(1);
  } finally {
    await indexer.cleanup();
  }
}

main();