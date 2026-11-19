import { createQueryRecord, getQueryById, getDocumentById, listChatHistory, clearChatHistory } from '../services/dbService.js';
import { publishQueryJob } from '../services/kafkaService.js';

export async function submitDocumentQuery(req, res) {
  const { query, documentId, conversationId } = req.body;
  const targetDocId = req.params.documentId ? parseInt(req.params.documentId, 10) : documentId;
  const userId = req.user.id;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'Query prompt cannot be empty.' });
  }

  try {
    let docIdToStore = null;
    if (targetDocId) {
      const doc = await getDocumentById(targetDocId, userId);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found or access denied.' });
      }
      docIdToStore = doc.id;
    }

    const convId = conversationId || `conv_${userId}_${Date.now()}`;

    const queryRecord = await createQueryRecord(userId, docIdToStore, convId, query.trim());

    await publishQueryJob({
      queryId: queryRecord.id,
      userId: userId,
      documentId: docIdToStore,
      conversationId: convId,
    });

    res.status(202).json({
      queryId: queryRecord.id,
      conversationId: convId,
      status: 'QUEUED',
      message: 'Query enqueued for processing.'
    });
  } catch (error) {
    console.error('Submit Query Error:', error);
    res.status(500).json({ error: `Failed to enqueue query: ${error.message}` });
  }
}

export async function getQueryStatus(req, res) {
  const { queryId } = req.params;
  const userId = req.user.id;

  try {
    const queryRecord = await getQueryById(parseInt(queryId, 10), userId);
    if (!queryRecord) {
      return res.status(404).json({ error: 'Query not found or access denied.' });
    }

    res.json({
      queryId: queryRecord.id,
      documentId: queryRecord.document_id,
      conversationId: queryRecord.conversation_id,
      query: queryRecord.query,
      status: queryRecord.status,
      answer: queryRecord.answer,
      error: queryRecord.error,
      createdAt: queryRecord.created_at,
      completedAt: queryRecord.completed_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function getChatHistory(req, res) {
  try {
    const history = await listChatHistory(req.user.id);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function wipeChatHistory(req, res) {
  try {
    await clearChatHistory(req.user.id);
    res.json({ message: 'Chat history cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
