import 'dotenv/config';
import { Kafka } from 'kafkajs';

const rawBrokerConfig = process.env.KAFKA_BROKER || process.env.KAFKA_BROKERS;
const kafkaBrokers = rawBrokerConfig ? rawBrokerConfig.split(',').map(b => b.trim()).filter(Boolean) : null;

if (!kafkaBrokers || kafkaBrokers.length === 0) {
  console.warn('WARNING: KAFKA_BROKER (or KAFKA_BROKERS) environment variable is not set. Kafka streaming service requires a valid Kafka broker address (e.g. KAFKA_BROKER=localhost:9092).');
}

export const TOPICS = {
  DOCUMENT_JOBS: 'pdfly-document-jobs',
  QUERY_JOBS: 'pdfly-query-jobs',
};

export const CONSUMER_GROUPS = {
  DOCUMENT_WORKERS: 'document-workers-group',
  QUERY_WORKERS: 'query-workers-group',
};

let kafka = null;
let producer = null;

if (kafkaBrokers && kafkaBrokers.length > 0) {
  kafka = new Kafka({
    clientId: 'pdfly-backend',
    brokers: kafkaBrokers,
  });
  producer = kafka.producer();
}

let isProducerConnected = false;

function getKafkaInstance() {
  if (!kafka) {
    throw new Error('Kafka is not configured. Set KAFKA_BROKER in environment variables.');
  }
  return kafka;
}

async function ensureProducer() {
  if (!kafka || !producer) {
    throw new Error('Kafka Producer is not configured. Set KAFKA_BROKER in environment variables.');
  }
  if (!isProducerConnected) {
    await producer.connect();
    isProducerConnected = true;
    console.log('Kafka Producer connected successfully.');
  }
  return producer;
}

// Publish document processing job to Kafka
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
  console.log(`Published DOCUMENT_PROCESSING job for document ${payload.documentId} to Kafka topic ${TOPICS.DOCUMENT_JOBS}`);
}

// Publish query job to Kafka
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
  console.log(`Published QUERY_PROCESSING job for query ${payload.queryId} to Kafka topic ${TOPICS.QUERY_JOBS}`);
}

// Subscribe document worker to Kafka jobs
export async function registerDocumentWorkerConsumer(handler) {
  const activeKafka = getKafkaInstance();
  const consumer = activeKafka.consumer({ groupId: CONSUMER_GROUPS.DOCUMENT_WORKERS });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.DOCUMENT_JOBS, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const payload = JSON.parse(message.value.toString());
      await handler(payload);
    },
  });
  console.log(`Document Worker consumer subscribed to ${TOPICS.DOCUMENT_JOBS} (${CONSUMER_GROUPS.DOCUMENT_WORKERS})`);
}

// Subscribe query worker to Kafka jobs
export async function registerQueryWorkerConsumer(handler) {
  const activeKafka = getKafkaInstance();
  const consumer = activeKafka.consumer({ groupId: CONSUMER_GROUPS.QUERY_WORKERS });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.QUERY_JOBS, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const payload = JSON.parse(message.value.toString());
      await handler(payload);
    },
  });
  console.log(`Query Worker consumer subscribed to ${TOPICS.QUERY_JOBS} (${CONSUMER_GROUPS.QUERY_WORKERS})`);
}

