import axios from 'axios';

export async function fetchGeminiModels() {
  return [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recommended)' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' }
  ];
}

export async function getChatCompletion(messages, model = 'gemini-2.5-flash') {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Set GEMINI_API_KEY in your .env file.');
  }

  let modelName = model || 'gemini-2.5-flash';
  if (modelName.includes('/')) {
    modelName = modelName.split('/').pop().replace(':free', '');
  }
  if (!modelName.startsWith('gemini')) {
    modelName = 'gemini-2.5-flash';
  }

  let systemInstruction = null;
  const contents = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = { parts: [{ text: msg.content }] };
    } else {
      const role = (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user';
      contents.push({
        role,
        parts: [{ text: msg.content }]
      });
    }
  }

  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
  }

  const payload = {
    contents,
    ...(systemInstruction ? { systemInstruction } : {})
  };

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 35000,
    });

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.data.candidates[0].content.parts[0].text;
    }
    throw new Error('No completion candidates returned from Google Gemini API');
  } catch (error) {
    console.error('Google Gemini API Error:', error.response?.data || error.message);
    const apiError = error.response?.data?.error?.message || error.message;
    throw new Error(`Google Gemini API Error: ${apiError}`);
  }
}
