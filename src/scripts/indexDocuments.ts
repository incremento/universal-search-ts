import dotenv from 'dotenv';
import { DocumentIndexer } from '../services/indexing/DocumentIndexer';

// Load environment variables
dotenv.config();

async function main() {
  console.log('Starting document indexing script...');
  
  const indexer = new DocumentIndexer();
  
  try {
    await indexer.initialize();
    const count = await indexer.indexDocuments();
    console.log(`Document indexing completed. Indexed ${count} documents.`);
  } catch (error) {
    console.error('Error in document indexing script:', error);
    process.exit(1);
  } finally {
    await indexer.cleanup();
  }
}

main();