import { Router } from 'express';
import * as searchController from '../controllers/searchController';

const router = Router();

// Document search route
router.post('/documents', searchController.searchDocuments);

// URL search route
router.post('/urls', searchController.searchUrls);

export default router;