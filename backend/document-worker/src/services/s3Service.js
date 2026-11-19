import 'dotenv/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const bucketName = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION || 'us-east-1';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const isS3Configured = Boolean(bucketName && accessKeyId && secretAccessKey);

const endpoint = process.env.AWS_S3_ENDPOINT;

let s3Client = null;
if (isS3Configured) {
  s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    ...(endpoint ? { endpoint } : {}),
  });
}

function getS3Client() {
  if (!s3Client) {
    throw new Error('AWS S3 client is not configured. Set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION.');
  }
  return s3Client;
}

export async function getS3ObjectBuffer(s3Key) {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
  });
  const response = await client.send(command);
  const byteArray = await response.Body.transformToByteArray();
  return Buffer.from(byteArray);
}
