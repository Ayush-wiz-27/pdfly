import 'dotenv/config';
import { Kafka } from 'kafkajs';

const rawBrokerConfig = process.env.KAFKA_BROKER || process.env.KAFKA_BROKERS;
const kafkaBrokers = rawBrokerConfig ? rawBrokerConfig.split(',').map(b => b.trim()).filter(Boolean) : null;

if (!kafkaBrokers || kafkaBrokers.length === 0) {
  console.warn('WARNING: KAFKA_BROKER environment variable is not set. Document worker requires a Kafka broker address.');
}

export const TOPICS = {
  DOCUMENT_JOBS: 'pdfly-document-jobs',
};

export const CONSUMER_GROUPS = {
  DOCUMENT_WORKERS: 'document-workers-group',
};

let kafka = null;
if (kafkaBrokers && kafkaBrokers.length > 0) {
  kafka = new Kafka({
    clientId: 'pdfly-document-worker-consumer',
    brokers: kafkaBrokers,
  });
}

function getKafkaInstance() {
  if (!kafka) {
    throw new Error('Kafka is not configured. Set KAFKA_BROKER in environment variables.');
  }
  return kafka;
}

export async function registerDocumentWorkerConsumer(handler) {
  const activeKafka = getKafkaInstance();
  const consumer = activeKafka.consumer({ 
    groupId: CONSUMER_GROUPS.DOCUMENT_WORKERS,
    sessionTimeout: 120000, // 2 minutes timeout for long-running CPU embedding jobs
    rebalanceTimeout: 180000,
    heartbeatInterval: 3000,
  });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.DOCUMENT_JOBS, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message, heartbeat }) => {
      const payload = JSON.parse(message.value.toString());
      await handler(payload, heartbeat);
    },
  });
  console.log(`Document Worker consumer subscribed to ${TOPICS.DOCUMENT_JOBS} (${CONSUMER_GROUPS.DOCUMENT_WORKERS})`);
}
