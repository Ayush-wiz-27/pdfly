import express from 'express';
import { 
  getDocuments, 
  getSingleDocument, 
  destroyDocument, 
  initiateUpload, 
  completeUpload,
  retryDocumentProcessing
} from '../controllers/documentController.js';
import { submitDocumentQuery, getQueryStatus, getChatHistory, wipeChatHistory } from '../controllers/chatController.js';
import { getModels } from '../controllers/modelController.js';
import { login, signup } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const apiRouter = express.Router();

// Public auth routes
apiRouter.post('/auth/signup', signup);
apiRouter.post('/auth/login', login);

// Protected routes (JWT required)
apiRouter.use(authenticate);

// Documents
apiRouter.get('/documents', getDocuments);
apiRouter.get('/documents/:id', getSingleDocument);
apiRouter.post('/documents', initiateUpload);
apiRouter.post('/documents/:id/complete', completeUpload);
apiRouter.post('/documents/:id/retry', retryDocumentProcessing);
apiRouter.delete('/documents/:id', destroyDocument);

// Queries
apiRouter.post('/documents/:documentId/query', submitDocumentQuery);
apiRouter.post('/query', submitDocumentQuery);
apiRouter.get('/queries/:queryId', getQueryStatus);

// Models and chat history
apiRouter.get('/models', getModels);
apiRouter.get('/chat-history', getChatHistory);
apiRouter.delete('/chat-history', wipeChatHistory);

export default apiRouter;
