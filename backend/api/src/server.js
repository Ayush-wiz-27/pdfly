import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRouter from './routes/apiRouter.js';
import { testAndSetupDB, purgeExpiredRecords } from './services/dbService.js';

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Retry DB connection until ready
async function connectWithRetry(retries = 5, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      await testAndSetupDB();
      return;
    } catch (err) {
      console.warn(`Database connection attempt ${i + 1} failed. Retrying in ${delay / 1000}s...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  console.error('Failed to connect to the database after maximum retries.');
}

// Initial DB connection
connectWithRetry();

// Purge old records daily
setInterval(() => {
  purgeExpiredRecords().catch(err => console.error('Retention purge error:', err));
}, 24 * 60 * 60 * 1000);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'online', service: 'PDFly API Microservice', version: '1.0.0' });
});

// API routes
app.use('/api', apiRouter);

// Start server
app.listen(port, () => {
  console.log(`PDFly API Microservice running on http://localhost:${port}`);
});
