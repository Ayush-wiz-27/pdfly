import 'dotenv/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const bucketName = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION || 'us-east-1';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const isS3Configured = Boolean(bucketName && accessKeyId && secretAccessKey);

if (!isS3Configured) {
  console.warn('WARNING: AWS S3 environment variables (AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are missing or incomplete.');
}

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
    throw new Error('AWS S3 client is not configured. Set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION environment variables.');
  }
  return s3Client;
}

export function buildS3Key(userId, documentId) {
  return `users/${userId}/documents/${documentId}.pdf`;
}

export async function uploadS3Object(s3Key, buffer, contentType = 'application/pdf') {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
  });
  await client.send(command);
  console.log(`Uploaded file directly to S3 at key: ${s3Key}`);
}

export async function getPresignedUploadUrl(s3Key, contentType = 'application/pdf') {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
    ContentType: contentType,
  });
  return await getSignedUrl(client, command, { expiresIn: 900 });
}

export async function deleteS3Object(s3Key) {
  const client = getS3Client();
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
  });
  await client.send(command);
  console.log(`Deleted S3 object: ${s3Key}`);
}

export async function checkS3ObjectExists(s3Key) {
  const client = getS3Client();
  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });
    await client.send(command);
    return true;
  } catch (err) {
    if (err.name === 'NotFound' || err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    console.error(`AWS S3 Configuration / Access Error checking key ${s3Key}:`, err);
    throw new Error(`AWS S3 Error: ${err.message || err.name || 'Access or Configuration Failure'}`);
  }
}
