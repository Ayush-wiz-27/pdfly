import { listDocuments, deleteDocument } from '../services/dbService.js';

/**
 * Returns a list of indexed documents belonging to the authenticated user.
 */
export async function getDocuments(req, res) {
  try {
    const docs = await listDocuments(req.user.id);
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Deletes a document owned by the user.
 */
export async function destroyDocument(req, res) {
  const { id } = req.params;
  try {
    // Scope deletion strictly to the requesting user's id
    const deleted = await deleteDocument(parseInt(id, 10), req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Document not found or access denied.' });
    }
    res.json({ message: 'Document deleted successfully', deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


