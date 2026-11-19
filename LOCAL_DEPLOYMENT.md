# PDFly Local Deployment Guide

This guide starts PDFly from source on macOS or another Unix-like environment.

## 1. Prerequisites

Install:

- Node.js 20 or later
- npm
- Docker Desktop
- A Google Gemini API key
- Git

Verify the tools:

```bash
node --version
npm --version
docker --version
git --version
```

## 2. Clone and enter the project

```bash
git clone https://github.com/kunaljaju/pdfly-.git
cd pdfly-
```

If you already have the repository, run:

```bash
cd /path/to/pdfly-
```

## 3. Start infrastructure with Docker

The API, workers, PostgreSQL, Kafka, and S3-compatible storage can run locally together.

### 3.1 Create a Docker network

```bash
docker network create pdfly-network
```

### 3.2 Start PostgreSQL with pgvector

```bash
docker run -d --name pdfly-postgres --network pdfly-network \
  -e POSTGRES_DB=pdfly_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgrespassword \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

Confirm PostgreSQL is reachable:

```bash
docker exec -it pdfly-postgres pg_isready -U postgres -d pdfly_db
```

The API performs schema initialization and creates required tables and indexes when it starts. It also creates the `vector` extension.

### 3.3 Start Redpanda Kafka

Redpanda is Kafka-compatible and is simpler to run locally:

```bash
docker run -d --name pdfly-redpanda --network pdfly-network \
  -p 9092:9092 -p 9644:9644 \
  redpandadata/redpanda:v24.1.7 \
  redpanda start --overprovisioned --smp 1 --memory 1G \
  --node-id 0 --check=false \
  --kafka-addr PLAINTEXT://0.0.0.0:9092 \
  --advertise-kafka-addr PLAINTEXT://localhost:9092
```

Check the broker:

```bash
docker exec pdfly-redpanda rpk cluster health
```

### 3.4 Start MinIO S3-compatible storage

```bash
docker run -d --name pdfly-minio --network pdfly-network \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin123 \
  -p 9000:9000 -p 9001:9001 \
  minio/minio server /data --console-address ':9001'
```

Open `http://localhost:9001`, log in with `minioadmin` / `minioadmin123`, and create a bucket named `pdfly-storage`.

## 4. Configure environment variables

Copy every example file:

```bash
cp backend/api/.env.example backend/api/.env
cp backend/document-worker/.env.example backend/document-worker/.env
cp backend/query-worker/.env.example backend/query-worker/.env
cp frontend/.env.example frontend/.env
```

Do not commit the resulting `.env` files.

### API environment: `backend/api/.env`

```dotenv
PORT=5001
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/pdfly_db
JWT_SECRET=replace-with-a-long-random-secret
KAFKA_BROKER=localhost:9092

AWS_REGION=us-east-1
AWS_S3_BUCKET=pdfly-storage
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin123
AWS_S3_ENDPOINT=http://localhost:9000

GEMINI_API_KEY=replace-with-your-google-gemini-api-key
```

Generate a JWT secret with:

```bash
openssl rand -hex 32
```

### Document worker environment: `backend/document-worker/.env`

```dotenv
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/pdfly_db
KAFKA_BROKER=localhost:9092

AWS_REGION=us-east-1
AWS_S3_BUCKET=pdfly-storage
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin123
AWS_S3_ENDPOINT=http://localhost:9000

GEMINI_API_KEY=replace-with-your-google-gemini-api-key
```

### Query worker environment: `backend/query-worker/.env`

```dotenv
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/pdfly_db
KAFKA_BROKER=localhost:9092
GEMINI_API_KEY=replace-with-your-google-gemini-api-key
```

The query worker does not read S3 credentials.

### Frontend environment: `frontend/.env`

```dotenv
VITE_API_BASE_URL=http://localhost:5001/api
```

For AWS S3 instead of MinIO, use the AWS bucket name, IAM access key, secret key, AWS region, and leave `AWS_S3_ENDPOINT` empty or omit it.

## 5. Install dependencies

Run these commands in separate terminal sessions or from the project root:

```bash
cd frontend && npm install
cd backend/api && npm install
cd backend/document-worker && npm install
cd backend/query-worker && npm install
```

Each service has a separate `package.json`, so dependencies must be installed for all four.

## 6. Start the services

Open five terminals in the repository root.

### Terminal 1: API

```bash
cd backend/api
npm run dev
```

The API is available at `http://localhost:5001`.

### Terminal 2: Document worker

```bash
cd backend/document-worker
npm run dev
```

### Terminal 3: Query worker

```bash
cd backend/query-worker
npm run dev
```

### Terminal 4: Frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:5200`.

## 7. Verify the installation

Check the API:

```bash
curl http://localhost:5001/
```

Expected response:

```json
{"status":"online","service":"PDFly API Microservice","version":"1.0.0"}
```

Create an account in the frontend, upload a PDF, wait for processing, and then submit a question. Successful document processing should set the document status to `READY`.

## 8. Useful checks

```bash
# View container logs
docker logs pdfly-postgres
docker logs pdfly-redpanda
docker logs pdfly-minio

# Verify PostgreSQL tables
docker exec -it pdfly-postgres psql -U postgres -d pdfly_db -c '\dt'

# Stop infrastructure
docker stop pdfly-postgres pdfly-redpanda pdfly-minio

# Start infrastructure again
docker start pdfly-postgres pdfly-redpanda pdfly-minio

# Remove local infrastructure containers and data
docker rm -f pdfly-postgres pdfly-redpanda pdfly-minio
```

Removing the PostgreSQL container deletes the local database unless the container uses a persistent Docker volume.

## 9. Troubleshooting

### API cannot connect to PostgreSQL

- Confirm PostgreSQL is running on port `5432`.
- Confirm `DATABASE_URL` uses `localhost` when all processes run on the host.
- Confirm the database name and password match the Docker container.

### Kafka or worker connection fails

- Confirm Redpanda is running and `localhost:9092` is reachable.
- Restart workers after changing `KAFKA_BROKER`.
- Kafka job topics are created automatically when the producers publish.

### PDF upload fails

- Confirm the bucket `pdfly-storage` exists in MinIO.
- Confirm MinIO credentials match both Node.js environment files.
- Confirm `AWS_S3_ENDPOINT=http://localhost:9000`.

### Gemini calls fail

- Confirm `GEMINI_API_KEY` is set in all processes that generate text.
- Confirm the API key has access to the requested Gemini models.
- Never expose the key in frontend code or Git.

### Frontend cannot reach the API

- Confirm the API uses port `5001`.
- Confirm `VITE_API_BASE_URL=http://localhost:5001/api`.
- Restart Vite after changing `frontend/.env`.
