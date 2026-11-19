import 'dotenv/config';
import { registerDocumentWorkerConsumer } from './services/kafkaService.js';
import { processDocumentJob } from './processDocumentJob.js';

export async function startWorker() {
  console.log('[Document Worker Microservice] Starting worker consumer loop...');
  await registerDocumentWorkerConsumer(processDocumentJob);
}

startWorker().catch(err => {
  console.error('[Document Worker Microservice] Fatal error starting worker:', err);
  process.exit(1);
});
