import { createPendingDocument, updateDocumentS3Key, confirmDocumentQueued, listDocuments, deleteDocument, getDocumentById } from '../services/dbService.js';
import { buildS3Key, getPresignedUploadUrl, checkS3ObjectExists } from '../services/s3Service.js';
import { publishDocumentJob } from '../services/kafkaService.js';

// Initiate presigned S3 upload
export async function initiateUpload(req, res) {
  const { filename } = req.body;
  if (!filename || typeof filename !== 'string' || !filename.trim()) {
    return res.status(400).json({ error: 'Filename string is required.' });
  }

  const cleanFilename = filename.replace(/[^\w\s\.\-\(\)]/gi, '_').trim();

  try {
    const userId = req.user.id;
    const doc = await createPendingDocument(userId, cleanFilename, 'temp');
    const s3Key = buildS3Key(userId, doc.id);
    await updateDocumentS3Key(doc.id, s3Key);

    const uploadUrl = await getPresignedUploadUrl(s3Key);

    res.status(201).json({
      documentId: doc.id,
      s3Key: s3Key,
      uploadUrl: uploadUrl,
      status: 'AWAITING_UPLOAD'
    });
  } catch (error) {
    console.error('Initiate Upload Error:', error);
    res.status(500).json({ error: `Initiate upload failed: ${error.message}` });
  }
}

// Complete upload and queue document for background processing
export async function completeUpload(req, res) {
  const { id } = req.params;
  const documentId = parseInt(id, 10);
  if (isNaN(documentId)) {
    return res.status(400).json({ error: 'Invalid document ID.' });
  }
  const userId = req.user.id;

  try {
    const doc = await getDocumentById(documentId, userId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found or access denied.' });
    }

    // Make sure document is waiting for upload
    if (doc.status !== 'AWAITING_UPLOAD') {
      return res.status(400).json({
        error: `Document status is '${doc.status}'. /complete can only be called for documents in AWAITING_UPLOAD state.`
      });
    }

    const exists = await checkS3ObjectExists(doc.s3_key);
    if (!exists) {
      return res.status(400).json({ error: `Expected PDF file was not found in S3 storage at key ${doc.s3_key}. Upload to presigned URL first.` });
    }

    // Publish processing job to Kafka
    await publishDocumentJob({
      documentId: doc.id,
      userId: userId,
      s3Key: doc.s3_key,
      filename: doc.filename,
    });

    // Update status in DB
    await confirmDocumentQueued(documentId, userId);

    res.json({
      documentId: doc.id,
      status: 'QUEUED',
      message: 'Upload complete; processing started.'
    });
  } catch (error) {
    console.error('Complete Upload Error:', error);
    res.status(500).json({ error: `Confirm upload failed: ${error.message}` });
  }
}

// Retry processing for failed document
export async function retryDocumentProcessing(req, res) {
  const { id } = req.params;
  const documentId = parseInt(id, 10);
  if (isNaN(documentId)) {
    return res.status(400).json({ error: 'Invalid document ID.' });
  }
  const userId = req.user.id;

  try {
    const doc = await getDocumentById(documentId, userId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found or access denied.' });
    }

    if (doc.status !== 'FAILED') {
      return res.status(400).json({
        error: `Document status is '${doc.status}'. Only FAILED documents can be retried.`
      });
    }

    const exists = await checkS3ObjectExists(doc.s3_key);
    if (!exists) {
      return res.status(400).json({ error: `PDF file not found in S3 storage at key ${doc.s3_key}. Re-upload required.` });
    }

    // Publish processing job to Kafka
    await publishDocumentJob({
      documentId: doc.id,
      userId: userId,
      s3Key: doc.s3_key,
      filename: doc.filename,
    });

    // Update status in DB
    await confirmDocumentQueued(documentId, userId);

    res.json({
      documentId: doc.id,
      status: 'QUEUED',
      message: 'Processing retry initiated successfully.'
    });
  } catch (error) {
    console.error('Retry Document Error:', error);
    res.status(500).json({ error: `Retry failed: ${error.message}` });
  }
}

// List all documents for current user
export async function getDocuments(req, res) {
  try {
    const docs = await listDocuments(req.user.id);
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Get single document by ID
export async function getSingleDocument(req, res) {
  const { id } = req.params;
  const documentId = parseInt(id, 10);
  if (isNaN(documentId)) {
    return res.status(400).json({ error: 'Invalid document ID.' });
  }

  try {
    const doc = await getDocumentById(documentId, req.user.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found or access denied.' });
    }
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Delete document
export async function destroyDocument(req, res) {
  const { id } = req.params;
  const documentId = parseInt(id, 10);
  if (isNaN(documentId)) {
    return res.status(400).json({ error: 'Invalid document ID.' });
  }

  try {
    const deleted = await deleteDocument(documentId, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Document not found or access denied.' });
    }
    res.json({ message: 'Document deleted successfully', deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
