import { fetchGeminiModels } from '../services/geminiService.js';

export async function getModels(req, res) {
  try {
    const models = await fetchGeminiModels();
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
