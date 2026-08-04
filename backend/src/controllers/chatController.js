import { searchChunks, listChatHistory, createChatLog, clearChatHistory, getDocumentSummaries } from '../services/dbService.js';
import { getEmbedding } from '../services/embedderService.js';
import { getChatCompletion } from '../services/openrouterService.js';

/**
 * Checks if a user prompt is asking for a global overview or summary.
 */
function isSummaryQuery(queryText) {
  const lower = queryText.toLowerCase();
  const summaryKeywords = [
    'summarize', 'summary', 'overview', 'main points', 'key takeaways',
    'what is this document about', 'what is this pdf about', 'gist', 'brief me',
    'executive summary', 'abstract', 'main topics'
  ];
  return summaryKeywords.some(keyword => lower.includes(keyword));
}

/**
 * Returns previous conversation entries belonging to the authenticated user.
 */
export async function getChatHistory(req, res) {
  try {
    const history = await listChatHistory(req.user.id);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Clears the authenticated user's logs.
 */
export async function wipeChatHistory(req, res) {
  try {
    await clearChatHistory(req.user.id);
    res.json({ message: 'Chat history cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Executes a user-scoped semantic similarity search (RAG) query with Master Summary integration.
 */
export async function queryRag(req, res) {
  const { query, model, documentIds } = req.body;
  const limit = 10;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: 'Query prompt cannot be empty.' });
  }

  try {
    console.log(`Query from User ID ${req.user.id}: "${query}"`);

    // Fetch pre-computed master document summaries (Macro Context)
    const docSummaries = await getDocumentSummaries(documentIds, req.user.id);
    const isSummaryReq = isSummaryQuery(query);

    // If the user explicitly requested a summary and we have pre-computed master summaries
    if (isSummaryReq && docSummaries.length > 0) {
      console.log('Detected Summary/Overview intent. Routing to pre-computed Master Summary...');
      
      const summariesText = docSummaries
        .map(doc => `--- DOCUMENT: ${doc.filename} ---\n${doc.summary}`)
        .join('\n\n');

      const systemPrompt = `You are an expert AI research assistant.
The user is asking for a summary or high-level overview of their document(s).
Use the pre-computed Master Summaries below to answer their request clearly and thoroughly.

PRE-COMPUTED MASTER DOCUMENT SUMMARIES:
${summariesText}
`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ];

      const responseText = await getChatCompletion(messages, model);
      const savedLog = await createChatLog(query, responseText, model, req.user.id, documentIds || []);

      return res.json({
        response: responseText,
        retrievedChunks: docSummaries.map(d => ({
          filename: d.filename,
          chunk_index: 0,
          content: `[Master Document Summary]\n${d.summary}`,
          similarity: 1.0
        })),
        chatLogId: savedLog.id
      });
    }

    // Specific Fact Query Strategy: Retrieve Micro Vector Chunks + Attach Macro Master Summary
    const queryEmbedding = await getEmbedding(query);
    const matchedChunks = await searchChunks(queryEmbedding, limit, documentIds, req.user.id);
    console.log(`Vector DB retrieved ${matchedChunks.length} matching chunks.`);

    if (matchedChunks.length === 0 && docSummaries.length === 0) {
      return res.json({
        response: "No matching documents were found in the database. Please upload a PDF first.",
        retrievedChunks: []
      });
    }

    const contextText = matchedChunks
      .map(chunk => chunk.content)
      .join('\n\n');

    const macroOverview = docSummaries.length > 0 
      ? `HIGH-LEVEL MASTER DOCUMENT OVERVIEW:\n${docSummaries.map(d => `${d.filename}: ${d.summary}`).join('\n\n')}\n\n`
      : '';

    const systemPrompt = `You are an expert AI research assistant analyzing PDF documents.
Answer the user's question accurately using the provided macro overview and detailed text chunks.
Be factual, thorough, and precise.
Do NOT include any source citations, indices, or brackets in your response text.

${macroOverview}RELEVANT DETAILED TEXT CHUNKS:
${contextText}
`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query }
    ];

    console.log('Sending context-augmented query (Macro + Micro Context) to OpenRouter LLM...');
    const responseText = await getChatCompletion(messages, model);

    // Store history log under req.user.id
    const savedLog = await createChatLog(query, responseText, model, req.user.id, documentIds || []);

    res.json({
      response: responseText,
      retrievedChunks: matchedChunks.map(chunk => ({
        filename: chunk.filename,
        chunk_index: chunk.chunk_index,
        content: chunk.content,
        similarity: chunk.similarity
      })),
      chatLogId: savedLog.id
    });

  } catch (error) {
    console.error('RAG Query Error:', error);
    res.status(500).json({ error: `Query execution failed: ${error.message}` });
  }
}
