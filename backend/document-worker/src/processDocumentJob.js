import { getS3ObjectBuffer } from './services/s3Service.js';
import { parsePdf, chunkText } from './services/parserService.js';
import { getEmbedding } from './services/embedderService.js';
import { getChatCompletion } from './services/geminiService.js';
import { getDocumentById, updateDocumentStatus, saveDocumentChunksAndSummary } from './services/dbService.js';

export async function processDocumentJob(payload, heartbeat = null) {
  const { documentId, s3Key, userId } = payload;
  console.log(`[Document Worker] Starting processing for Document ID ${documentId} (User ID ${userId})`);

  const doc = await getDocumentById(documentId);
  if (!doc) {
    console.error(`[Document Worker] Document ID ${documentId} not found in database.`);
    return;
  }

  if (doc.status === 'READY') {
    console.log(`[Document Worker] Document ID ${documentId} is already READY. Skipping.`);
    return;
  }

  try {
    await updateDocumentStatus(documentId, 'PROCESSING');

    console.log(`[Document Worker] Downloading PDF from S3: ${s3Key}`);
    const pdfBuffer = await getS3ObjectBuffer(s3Key);

    const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
    if (!pdfHeader.startsWith('%PDF-')) {
      throw new Error('Downloaded file from S3 is not a valid PDF document (missing %PDF- header).');
    }

    console.log(`[Document Worker] Parsing PDF text for Document ID ${documentId}...`);
    const textContent = await parsePdf(pdfBuffer);
    if (!textContent || textContent.trim().length === 0) {
      throw new Error('The uploaded PDF appears to have no indexable text.');
    }

    const chunks = chunkText(textContent);
    console.log(`[Document Worker] Generated ${chunks.length} chunks for Document ID ${documentId}`);
    if (chunks.length === 0) {
      throw new Error('No chunks could be extracted from this PDF.');
    }

    console.log(`[Document Worker] Generating embeddings for ${chunks.length} chunks...`);
    const chunksWithEmbeddings = [];
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await getEmbedding(chunks[i]);
      chunksWithEmbeddings.push({
        content: chunks[i],
        embedding: embedding,
      });

      if (heartbeat && i % 10 === 0) {
        await heartbeat();
      }
    }

    console.log(`[Document Worker] Generating master summary for Document ID ${documentId}...`);
    let masterSummary = null;
    try {
      const summaryMessages = [
        {
          role: 'system',
          content: 'You are an expert AI research analyst. Provide a clear, comprehensive 3-paragraph master summary of the provided document text, highlighting its core topic, key findings, main sections, and overall conclusions. Return only plain text paragraphs.'
        },
        {
          role: 'user',
          content: `DOCUMENT FILENAME: ${doc.filename}\n\nDOCUMENT TEXT:\n${textContent.slice(0, 12000)}`
        }
      ];
      masterSummary = await getChatCompletion(summaryMessages);
    } catch (summaryErr) {
      console.warn(`[Document Worker] Master summary generation warning for Doc ID ${documentId}:`, summaryErr.message);
      masterSummary = `Summary generation pending for ${doc.filename}.`;
    }

    if (heartbeat) {
      await heartbeat();
    }

    console.log(`[Document Worker] Executing DB transaction to store chunks & mark READY...`);
    await saveDocumentChunksAndSummary(documentId, masterSummary, chunksWithEmbeddings);

    console.log(`[Document Worker] Successfully processed Document ID ${documentId} -> READY`);
  } catch (error) {
    console.error(`[Document Worker] Error processing Document ID ${documentId}:`, error);
    await updateDocumentStatus(documentId, 'FAILED');
  }
}
