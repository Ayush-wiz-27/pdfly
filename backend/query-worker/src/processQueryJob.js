import { getQueryById, updateQueryStatus, getDocumentById, searchChunks, getRecentConversationHistory } from './services/dbService.js';
import { getEmbedding } from './services/embedderService.js';
import { getChatCompletion } from './services/geminiService.js';
import { determineIntent } from './services/intentService.js';

export async function processQueryJob(payload) {
  const { queryId, userId, documentId, conversationId } = payload;
  console.log(`[Query Worker] Starting processing for Query ID ${queryId} (User ID ${userId}, Doc ID ${documentId || 'NONE'})`);

  const queryRecord = await getQueryById(queryId);
  if (!queryRecord) {
    console.error(`[Query Worker] Query ID ${queryId} not found in database.`);
    return;
  }

  if (queryRecord.status === 'COMPLETED') {
    console.log(`[Query Worker] Query ID ${queryId} is already COMPLETED. Skipping.`);
    return;
  }

  try {
    await updateQueryStatus(queryId, 'PROCESSING');

    const doc = documentId ? await getDocumentById(documentId) : null;
    const recentHistory = conversationId ? await getRecentConversationHistory(conversationId, 10) : [];

    console.log(`[Query Worker] Classifying intent for query: "${queryRecord.query}"...`);
    const { intent, confidence } = await determineIntent(queryRecord.query, recentHistory);
    console.log(`[Query Worker] Determined Intent: ${intent} (Confidence: ${confidence.toFixed(2)})`);

    // Handle queries when no specific document is selected
    if (!doc && !documentId) {
      if (intent === 'CONVERSATION') {
        const systemPrompt = `You are a helpful AI document assistant. Answer the user politely. If they ask about document contents, remind them to select a document from the sidebar.`;
        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: queryRecord.query }
        ];
        const answerText = await getChatCompletion(messages);
        await updateQueryStatus(queryId, 'COMPLETED', answerText);
        return;
      }

      console.log(`[Query Worker] No document selected for Query ID ${queryId}. Prompting user to select a document.`);
      await updateQueryStatus(queryId, 'COMPLETED', 'Please select a document from the sidebar to ask questions or get summaries about it.');
      return;
    }

    let systemPrompt = '';
    let userPrompt = queryRecord.query;

    const historyText = recentHistory.length > 0
      ? `RECENT CONVERSATION HISTORY:\n${recentHistory.slice(-5).map(h => `User: ${h.query}\nAssistant: ${h.answer}`).join('\n')}\n\n`
      : '';

    if (intent === 'SUMMARY' && doc && doc.summary) {
      console.log(`[Query Worker] Handling SUMMARY intent using pre-computed Master Summary for Doc ID ${doc.id}`);
      systemPrompt = `You are an expert AI research assistant.
The user is asking for a summary or high-level overview of their selected document (${doc.filename}).
Answer their request clearly and thoroughly using ONLY the pre-computed Master Summary below.
If the user's request asks for specific facts or details not present in the document summary, state clearly: "I could not find information about this in the uploaded document."
Do NOT invent or hallucinate information outside of the provided text.

MASTER DOCUMENT SUMMARY (${doc.filename}):
${doc.summary}
`;
    } else if (intent === 'CONVERSATION' && recentHistory.length > 0) {
      console.log(`[Query Worker] Handling CONVERSATION intent using recent conversation history.`);
      const docOverview = doc && doc.summary ? `DOCUMENT OVERVIEW (${doc.filename}): ${doc.summary}\n\n` : '';
      systemPrompt = `You are an expert AI research assistant following up on an ongoing conversation.
Answer the user's question directly, concisely, and helpfully using ONLY the conversation and document context below.
If the user's question asks about details not covered in the document or previous conversation, state clearly: "I could not find information about this in the uploaded document."
Do NOT invent or hallucinate any facts.

${docOverview}`;
    } else {
      console.log(`[Query Worker] Handling RETRIEVAL intent strictly scoped to selected Doc ID ${doc.id}...`);
      const queryEmbedding = await getEmbedding(queryRecord.query);
      const matchedChunks = await searchChunks(queryEmbedding, 5, [doc.id], userId);

      const contextText = matchedChunks.length > 0
        ? matchedChunks.map(c => c.content).join('\n\n')
        : (doc && doc.summary ? doc.summary : null);

      if (!contextText) {
        await updateQueryStatus(queryId, 'COMPLETED', `I could not find any information regarding your query in the selected document (${doc.filename}).`);
        console.log(`[Query Worker] No relevant context found in selected Doc ID ${doc.id} for Query ID ${queryId}.`);
        return;
      }

      systemPrompt = `You are an expert AI research assistant analyzing the selected PDF document (${doc.filename}).
Strictly base your answer ONLY on the provided relevant text chunks below.
If the answer to the user's query is NOT explicitly contained or clearly supported by the provided text chunks, state clearly: "I could not find information about this in the selected document."
Do NOT invent, assume, or hallucinate facts outside of the provided text.
Do NOT include source citations, indices, or brackets in your text output.

RELEVANT TEXT CHUNKS FROM SELECTED DOCUMENT (${doc.filename}):
${contextText}`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${historyText}USER QUESTION: ${userPrompt}` }
    ];

    console.log(`[Query Worker] Generating LLM completion for Query ID ${queryId}...`);
    const answerText = await getChatCompletion(messages);

    await updateQueryStatus(queryId, 'COMPLETED', answerText);
    console.log(`[Query Worker] Successfully completed Query ID ${queryId}`);
  } catch (error) {
    console.error(`[Query Worker] Error processing Query ID ${queryId}:`, error);
    await updateQueryStatus(queryId, 'FAILED', null, error.message);
  }
}
