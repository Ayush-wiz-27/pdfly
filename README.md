# PDFly

PDFly is an event-driven Retrieval-Augmented Generation (RAG) application for uploading PDFs, generating document summaries, and asking questions about a document.

The project is split into a React frontend, an Express API, a document-processing worker, and a query-processing worker. PostgreSQL with `pgvector` stores embeddings, Apache Kafka or a Kafka-compatible broker carries jobs, S3-compatible storage stores PDFs, and Google Gemini provides chat and summary generation.

## Repository structure

```text
pdfly-
├── frontend/                 # React 19 + Vite web application
├── backend/
│   ├── api/                  # Express REST API
│   ├── document-worker/      # PDF parsing, chunking, embedding, summarization
│   └── query-worker/         # Intent classification, vector search, RAG answers
├── ARCHITECTURE.md           # Architecture and data-flow documentation
└── LOCAL_DEPLOYMENT.md       # Complete local setup instructions
```

## Technology overview

- **Frontend:** React 19, Vite, Tailwind CSS, Axios
- **API:** Node.js, Express, JWT authentication
- **Database:** PostgreSQL with the `pgvector` extension
- **Message broker:** Apache Kafka or Redpanda
- **Object storage:** AWS S3 or an S3-compatible service such as MinIO
- **AI:** Google Gemini-compatible API
- **Embedding model:** `all-MiniLM-L6-v2` (384 dimensions)

## Prerequisites

- Node.js 20 or later
- npm
- Docker and Docker Compose
- Google Gemini API key
- Optional: AWS S3 credentials and bucket

## Quick start

1. Start PostgreSQL, Kafka/Redpanda, and optional MinIO.
2. Copy each `.env.example` file to `.env` and configure the placeholders.
3. Install dependencies in the API, both workers, and frontend.
4. Start all four Node.js processes in separate terminals.

See [LOCAL_DEPLOYMENT.md](./LOCAL_DEPLOYMENT.md) for complete, step-by-step instructions.

## Running services

| Service | Default address | Start command |
|---|---|---|
| API | `http://localhost:5001` | `cd backend/api && npm run dev` |
| Document worker | No HTTP server | `cd backend/document-worker && npm run dev` |
| Query worker | No HTTP server | `cd backend/query-worker && npm run dev` |
| Frontend | `http://localhost:5200` | `cd frontend && npm run dev` |

## Development commands

```bash
# Frontend
cd frontend
npm run dev
npm run build
npm run lint

# API
cd backend/api
npm run dev

# Workers
cd backend/document-worker
npm run dev

cd backend/query-worker
npm run dev
```

## API and architecture

Detailed component responsibilities, database schema, API endpoints, and processing flows are documented in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Security

Never commit real API keys, database passwords, JWT secrets, or object-storage credentials. Real `.env` files are ignored by Git. Always rotate credentials immediately if they are committed accidentally.
