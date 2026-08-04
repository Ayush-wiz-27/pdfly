import { createDocument, insertChunk } from '../services/dbService.js';
import { parsePdf, chunkText } from '../services/parserService.js';
import { getEmbedding } from '../services/embedderService.js';
import { getChatCompletion } from '../services/openrouterService.js';

/**
 * Process a PDF upload: associates the document with the authenticated user and generates a master summary.
 */
export async function uploadPdf(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    const filename = req.file.originalname;
    console.log(`Processing file upload for User ID ${req.user.id}: ${filename}`);

    const textContent = await parsePdf(req.file.buffer);
    if (!textContent || textContent.trim().length === 0) {
      return res.status(400).json({ error: 'The uploaded PDF appears to have no indexable text.' });
    }

    const chunks = chunkText(textContent);
    console.log(`Generated ${chunks.length} chunks for ${filename}`);

    if (chunks.length === 0) {
      return res.status(400).json({ error: 'No chunks could be extracted from this PDF.' });
    }

    // Generate pre-computed Master Document Summary using LLM
    console.log(`Generating Master Summary for ${filename}...`);
    let masterSummary = null;
    try {
      const summaryMessages = [
        {
          role: 'system',
          content: 'You are an expert AI research analyst. Provide a clear, comprehensive 3-paragraph master summary of the provided document text, highlighting its core topic, key findings, main sections, and overall conclusions. Return only plain text paragraphs.'
        },
        {
          role: 'user',
          content: `DOCUMENT FILENAME: ${filename}\n\nDOCUMENT TEXT:\n${textContent.slice(0, 12000)}`
        }
      ];
      masterSummary = await getChatCompletion(summaryMessages);
      console.log(`Master Summary generated successfully for ${filename}.`);
    } catch (summaryErr) {
      console.warn('Warning: Failed to generate master summary at upload time:', summaryErr.message);
    }

    // Register document metadata mapped to the active userId along with Master Summary
    const document = await createDocument(filename, textContent.length, chunks.length, req.user.id, masterSummary);

    console.log('Generating embeddings and saving chunks to DB...');
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await getEmbedding(chunks[i]);
      await insertChunk(document.id, i, chunks[i], embedding);
    }

    console.log(`Successfully indexed ${filename} for User ID ${req.user.id}.`);
    res.json({
      message: 'PDF uploaded and vectorized successfully',
      document: {
        id: document.id,
        filename: document.filename,
        char_count: textContent.length,
        chunk_count: chunks.length,
        summary: masterSummary
      }
    });
  } catch (error) {
    console.error('File Upload Error:', error);
    res.status(500).json({ error: `Upload failed: ${error.message}` });
  }
}
