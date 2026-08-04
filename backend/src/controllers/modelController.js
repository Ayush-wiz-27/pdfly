import { fetchOpenRouterModels } from '../services/openrouterService.js';

/**
 * Returns available LLM choices from OpenRouter.
 */
export async function getModels(req, res) {
  try {
    const models = await fetchOpenRouterModels();
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
