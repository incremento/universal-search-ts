import { Request, Response } from 'express';
import { IndexingScheduler } from '../schedulers/indexingScheduler';

const scheduler = new IndexingScheduler();

export const runDocumentIndexing = async (req: Request, res: Response): Promise<void> => {
  try {
    const count = await scheduler.runDocumentIndexingNow();
    res.status(200).json({
      success: true,
      message: `Document indexing completed successfully`,
      count
    });
  } catch (error) {
    console.error('Error in document indexing controller:', error);
    res.status(500).json({
      success: false,
      message: 'Error running document indexing',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const runUrlIndexing = async (req: Request, res: Response): Promise<void> => {
  try {
    const count = await scheduler.runUrlIndexingNow();
    res.status(200).json({
      success: true,
      message: `URL indexing completed successfully`,
      count
    });
  } catch (error) {
    console.error('Error in URL indexing controller:', error);
    res.status(500).json({
      success: false,
      message: 'Error running URL indexing',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const scheduleDocumentIndexing = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cronExpression } = req.body;
    await scheduler.scheduleDocumentIndexing(cronExpression);
    res.status(200).json({
      success: true,
      message: `Document indexing scheduled with cron: ${cronExpression || '0 0 * * *'}`
    });
  } catch (error) {
    console.error('Error scheduling document indexing:', error);
    res.status(500).json({
      success: false,
      message: 'Error scheduling document indexing',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const scheduleUrlIndexing = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cronExpression } = req.body;
    await scheduler.scheduleUrlIndexing(cronExpression);
    res.status(200).json({
      success: true,
      message: `URL indexing scheduled with cron: ${cronExpression || '0 0 * * *'}`
    });
  } catch (error) {
    console.error('Error scheduling URL indexing:', error);
    res.status(500).json({
      success: false,
      message: 'Error scheduling URL indexing',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const cancelAllJobs = (req: Request, res: Response): void => {
  try {
    scheduler.cancelAllJobs();
    res.status(200).json({
      success: true,
      message: 'All indexing jobs canceled'
    });
  } catch (error) {
    console.error('Error canceling indexing jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Error canceling indexing jobs',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};