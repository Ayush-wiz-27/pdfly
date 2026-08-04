import axios from 'axios';

export async function fetchOpenRouterModels() {
  // Return popular and active free/low-cost models on OpenRouter including Gemini
  return [
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (Free)' },
    { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (Free)' },
    { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B (Free)' }
  ];
}

export async function getChatCompletion(messages, model) {
  const token = process.env.OPENROUTER_API_KEY;
  if (!token) {
    throw new Error('OpenRouter API Key is missing. Provide it in the frontend settings or backend .env file.');
  }

  const modelId = model || 'google/gemini-2.5-flash';

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: modelId,
        messages: messages,
        max_tokens: 2048
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Title': 'PDF Vector Analyser Web App',
        },
        timeout: 30000,
      }
    );

    if (response.data && response.data.choices && response.data.choices[0]) {
      return response.data.choices[0].message.content;
    }
    throw new Error('Failed to get completions choices from OpenRouter API');
  } catch (error) {
    console.error('OpenRouter Completion API Error:', error.response?.data || error.message);
    const apiError = error.response?.data?.error?.message || error.message;
    throw new Error(`OpenRouter API Error: ${apiError}`);
  }
}
