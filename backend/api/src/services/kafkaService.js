import 'dotenv/config';
import { Kafka } from 'kafkajs';

const rawBrokerConfig = process.env.KAFKA_BROKER || process.env.KAFKA_BROKERS;
const kafkaBrokers = rawBrokerConfig ? rawBrokerConfig.split(',').map(b => b.trim()).filter(Boolean) : null;

if (!kafkaBrokers || kafkaBrokers.length === 0) {
  console.warn('WARNING: KAFKA_BROKER environment variable is not set. API microservice requires a Kafka broker address (e.g. KAFKA_BROKER=localhost:9092).');
}

export const TOPICS = {
  DOCUMENT_JOBS: 'pdfly-document-jobs',
  QUERY_JOBS: 'pdfly-query-jobs',
};

let kafka = null;
let producer = null;

if (kafkaBrokers && kafkaBrokers.length > 0) {
  kafka = new Kafka({
    clientId: 'pdfly-api-producer',
    brokers: kafkaBrokers,
  });
  producer = kafka.producer();
}

let isProducerConnected = false;

async function ensureProducer() {
  if (!kafka || !producer) {
    throw new Error('Kafka Producer is not configured. Set KAFKA_BROKER (e.g. KAFKA_BROKER=localhost:9092) in environment variables.');
  }
  if (!isProducerConnected) {
    await producer.connect();
    isProducerConnected = true;
    console.log('Kafka Producer connected successfully.');
  }
  return producer;
}

export async function publishDocumentJob(payload) {
  const activeProducer = await ensureProducer();
  const messageData = {
    jobType: 'DOCUMENT_PROCESSING',
    ...payload,
    timestamp: Date.now(),
  };

  await activeProducer.send({
    topic: TOPICS.DOCUMENT_JOBS,
    messages: [
      {
        key: String(payload.documentId),
        value: JSON.stringify(messageData),
      },
    ],
  });
  console.log(`[API Microservice] Published DOCUMENT_PROCESSING job for document ${payload.documentId}`);
}

export async function publishQueryJob(payload) {
  const activeProducer = await ensureProducer();
  const messageData = {
    jobType: 'QUERY_PROCESSING',
    ...payload,
    timestamp: Date.now(),
  };

  await activeProducer.send({
    topic: TOPICS.QUERY_JOBS,
    messages: [
      {
        key: String(payload.queryId),
        value: JSON.stringify(messageData),
      },
    ],
  });
  console.log(`[API Microservice] Published QUERY_PROCESSING job for query ${payload.queryId}`);
}
