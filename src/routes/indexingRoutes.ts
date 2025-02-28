import { Router } from 'express';
import * as indexingController from '../controllers/indexingController';

const router = Router();

// Document indexing routes
router.post('/documents/run', indexingController.runDocumentIndexing);
router.post('/documents/schedule', indexingController.scheduleDocumentIndexing);

// URL indexing routes
router.post('/urls/run', indexingController.runUrlIndexing);
router.post('/urls/schedule', indexingController.scheduleUrlIndexing);

// Cancel jobs
router.post('/cancel', indexingController.cancelAllJobs);

export default router;