import { getChatCompletion } from './geminiService.js';

// Classify user queries into SUMMARY, RETRIEVAL, CONVERSATION, or CLARIFICATION

export async function determineIntent(queryText, recentHistory = []) {
  if (!queryText || typeof queryText !== 'string' || !queryText.trim()) {
    return { intent: 'RETRIEVAL', confidence: 1.0, source: 'DEFAULT' };
  }

  const cleanQuery = queryText.trim();

  // Ask Gemini to classify query intent
  const historyContext = recentHistory.length > 0
    ? `RECENT CONVERSATION HISTORY:\n${recentHistory.slice(-2).map(h => `User: "${h.query}"\nAssistant: "${h.answer}"`).join('\n')}\n\n`
    : '';

  const systemPrompt = `You are an expert Intent Classification Engine for an enterprise RAG (Retrieval-Augmented Generation) document assistant.

Analyze the user's input query alongside the conversation history and classify it into EXACTLY ONE of the following 4 categories:

1. "SUMMARY": The user is requesting a high-level summary, main points, key takeaways, executive summary, or general topic overview of the document.
   Examples: "Give me an overview of this PDF", "What are the main key takeaways?", "Summarize chapter 2".

2. "RETRIEVAL": The user is asking a specific factual question requiring facts, details, equations, data points, statistics, or evidence from the document.
   Examples: "What is the formula for entropy?", "When was the company founded?", "What are the compliance requirements in section 4?".

3. "CONVERSATION": The user is engaged in small talk, greetings, general chit-chat, expressing gratitude, or asking meta-questions about the assistant.
   Examples: "Hello there", "Thank you for the help", "Who created you?".

4. "CLARIFICATION": The user is following up on a previous assistant response, asking to simplify an answer, rephrase, or elaborate on a past response.
   Examples: "Can you explain that last point in simpler terms?", "Why did you say that?", "Elaborate more on point #2".

OUTPUT FORMAT:
Return strictly valid JSON only. Do NOT include markdown code fences or extra commentary.
JSON format:
{
  "intent": "SUMMARY" | "RETRIEVAL" | "CONVERSATION" | "CLARIFICATION",
  "confidence": 0.0 to 1.0,
  "reasoning": "Short 1-sentence explanation"
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `${historyContext}USER QUERY: "${cleanQuery}"` }
  ];

  try {
    const responseText = await getChatCompletion(messages, 'gemini-2.5-flash');
    const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      let mappedIntent = parsed.intent;

      // Treat clarification questions as general conversation
      if (mappedIntent === 'CLARIFICATION') {
        mappedIntent = 'CONVERSATION';
      }

      if (['SUMMARY', 'RETRIEVAL', 'CONVERSATION'].includes(mappedIntent)) {
        const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.85;
        console.log(`[Intent Classifier] Gemini LLM Matched: ${mappedIntent} (Confidence: ${confidence.toFixed(2)}, Reason: "${parsed.reasoning || 'N/A'}")`);
        return { intent: mappedIntent, confidence, source: 'GEMINI_LLM' };
      }
    }
  } catch (err) {
    console.warn(`[Intent Classifier] LLM classification warning: ${err.message}. Defaulting to RETRIEVAL.`);
  }

  // Fallback to document search if classification fails
  return { intent: 'RETRIEVAL', confidence: 0.70, source: 'FALLBACK' };
}
