import 'dotenv/config';
import { registerQueryWorkerConsumer } from './services/kafkaService.js';
import { processQueryJob } from './processQueryJob.js';

export async function startWorker() {
  console.log('[Query Worker Microservice] Starting worker consumer loop...');
  await registerQueryWorkerConsumer(processQueryJob);
}

startWorker().catch(err => {
  console.error('[Query Worker Microservice] Fatal error starting worker:', err);
  process.exit(1);
});
