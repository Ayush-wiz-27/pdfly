import 'dotenv/config';
import { Kafka } from 'kafkajs';

const rawBrokerConfig = process.env.KAFKA_BROKER || process.env.KAFKA_BROKERS;
const kafkaBrokers = rawBrokerConfig ? rawBrokerConfig.split(',').map(b => b.trim()).filter(Boolean) : null;

if (!kafkaBrokers || kafkaBrokers.length === 0) {
  console.warn('WARNING: KAFKA_BROKER environment variable is not set. Query worker requires a Kafka broker address.');
}

export const TOPICS = {
  QUERY_JOBS: 'pdfly-query-jobs',
};

export const CONSUMER_GROUPS = {
  QUERY_WORKERS: 'query-workers-group',
};

let kafka = null;
if (kafkaBrokers && kafkaBrokers.length > 0) {
  kafka = new Kafka({
    clientId: 'pdfly-query-worker-consumer',
    brokers: kafkaBrokers,
  });
}

function getKafkaInstance() {
  if (!kafka) {
    throw new Error('Kafka is not configured. Set KAFKA_BROKER in environment variables.');
  }
  return kafka;
}

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
