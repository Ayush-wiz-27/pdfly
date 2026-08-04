import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRouter from './routes/apiRouter.js';
import { testAndSetupDB } from './services/dbService.js';

const app = express();
const port = process.env.PORT || 5000;

// Setup Middleware
app.use(cors());
app.use(express.json());

// Database connection retry helper
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
  console.error('Failed to connect to the database after maximum retries. App will run but DB endpoints will fail.');
}

// Establish DB connection
connectWithRetry();

// Root endpoint for Render health check & browser testing
app.get('/', (req, res) => {
  res.json({ status: 'online', service: 'PDFly Backend API', version: '1.0.0' });
});

// Mount Modular Router
app.use('/api', apiRouter);

// Start Express Listener
app.listen(port, () => {
  console.log(`PDF Vector Analyser Server running on http://localhost:${port}`);
});
