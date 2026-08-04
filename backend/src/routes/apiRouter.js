import express from 'express';
import { updateDbConfig } from '../controllers/configController.js';
import { getDocuments, destroyDocument } from '../controllers/documentController.js';
import { uploadPdf } from '../controllers/uploadPdfController.js';
import { getChatHistory, wipeChatHistory, queryRag } from '../controllers/chatController.js';
import { getModels } from '../controllers/modelController.js';
import { login, signup } from '../controllers/authController.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { authenticate } from '../middleware/authMiddleware.js';

const apiRouter = express.Router();

// 1. Public Authentication Routes (unprotected)
apiRouter.post('/auth/signup', signup);
apiRouter.post('/auth/login', login);

// 2. Register authentication middleware to protect all routes below
apiRouter.use(authenticate);

// Database Configuration Endpoint
apiRouter.post('/config/db', updateDbConfig);

// Document Endpoints
apiRouter.get('/documents', getDocuments);
apiRouter.delete('/documents/:id', destroyDocument);
//upload a pdf
apiRouter.post('/upload', upload.single('file'), uploadPdf);

// OpenRouter LLM Endpoint
apiRouter.get('/models', getModels);

// Chat & Query History Endpoints
apiRouter.get('/chat-history', getChatHistory);
apiRouter.delete('/chat-history', wipeChatHistory);
apiRouter.post('/query', queryRag);

export default apiRouter;
