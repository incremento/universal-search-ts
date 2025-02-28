import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { IndexingScheduler } from './schedulers/indexingScheduler';
import indexingRoutes from './routes/indexingRoutes';
import searchRoutes from './routes/searchRoutes';

// Load environment variables
dotenv.config();

// Create Express app
const app: Express = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/indexing', indexingRoutes);
app.use('/api/search', searchRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Initialize scheduler
const scheduler = new IndexingScheduler();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI as string)
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Schedule indexing jobs
    scheduler.scheduleDocumentIndexing();
    scheduler.scheduleUrlIndexing();
    
    // Start server
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  
  // Cancel scheduled jobs
  scheduler.cancelAllJobs();
  
  // Close MongoDB connection
  await mongoose.disconnect();
  console.log('MongoDB disconnected');
  
  process.exit(0);
});