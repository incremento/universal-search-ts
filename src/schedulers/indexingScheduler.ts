import schedule from 'node-schedule';
import { DocumentIndexer } from '../services/indexing/DocumentIndexer';
import { UrlIndexer } from '../services/indexing/UrlIndexer';

export class IndexingScheduler {
  private documentIndexer: DocumentIndexer;
  private urlIndexer: UrlIndexer;
  private documentJob: schedule.Job | null = null;
  private urlJob: schedule.Job | null = null;
  
  constructor() {
    this.documentIndexer = new DocumentIndexer();
    this.urlIndexer = new UrlIndexer();
  }
  
  async scheduleDocumentIndexing(cronExpression: string = '0 0 * * *'): Promise<void> {
    console.log(`Scheduling document indexing with cron: ${cronExpression}`);
    
    this.documentJob = schedule.scheduleJob(cronExpression, async () => {
      console.log('Running scheduled document indexing...');
      
      try {
        await this.documentIndexer.initialize();
        const count = await this.documentIndexer.indexDocuments();
        console.log(`Scheduled document indexing completed. Indexed ${count} documents.`);
      } catch (error) {
        console.error('Error in scheduled document indexing:', error);
      } finally {
        await this.documentIndexer.cleanup();
      }
    });
  }
  
  async scheduleUrlIndexing(cronExpression: string = '0 0 * * *'): Promise<void> {
    console.log(`Scheduling URL indexing with cron: ${cronExpression}`);
    
    this.urlJob = schedule.scheduleJob(cronExpression, async () => {
      console.log('Running scheduled URL indexing...');
      
      try {
        await this.urlIndexer.initialize();
        const count = await this.urlIndexer.indexUrls();
        console.log(`Scheduled URL indexing completed. Indexed ${count} URLs.`);
      } catch (error) {
        console.error('Error in scheduled URL indexing:', error);
      } finally {
        await this.urlIndexer.cleanup();
      }
    });
  }
  
  async runDocumentIndexingNow(): Promise<number> {
    console.log('Running document indexing now...');
    
    try {
      await this.documentIndexer.initialize();
      const count = await this.documentIndexer.indexDocuments();
      console.log(`Document indexing completed. Indexed ${count} documents.`);
      return count;
    } catch (error) {
      console.error('Error in document indexing:', error);
      throw error;
    } finally {
      await this.documentIndexer.cleanup();
    }
  }
  
  async runUrlIndexingNow(): Promise<number> {
    console.log('Running URL indexing now...');
    
    try {
      await this.urlIndexer.initialize();
      const count = await this.urlIndexer.indexUrls();
      console.log(`URL indexing completed. Indexed ${count} URLs.`);
      return count;
    } catch (error) {
      console.error('Error in URL indexing:', error);
      throw error;
    } finally {
      await this.urlIndexer.cleanup();
    }
  }
  
  cancelDocumentIndexing(): void {
    if (this.documentJob) {
      this.documentJob.cancel();
      this.documentJob = null;
      console.log('Document indexing job canceled.');
    }
  }
  
  cancelUrlIndexing(): void {
    if (this.urlJob) {
      this.urlJob.cancel();
      this.urlJob = null;
      console.log('URL indexing job canceled.');
    }
  }
  
  cancelAllJobs(): void {
    this.cancelDocumentIndexing();
    this.cancelUrlIndexing();
    console.log('All indexing jobs canceled.');
  }
}