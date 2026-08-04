import { pipeline } from '@xenova/transformers';

let embedderPipeline = null;

async function getPipeline() {
  if (!embedderPipeline) {
    console.log('Loading local embedding model (Xenova/all-MiniLM-L6-v2)...');
    embedderPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('Embedding model loaded successfully.');
  }
  return embedderPipeline;
}

export async function getEmbedding(text) {
  try {
    const extractor = await getPipeline();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}
