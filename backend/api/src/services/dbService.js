import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
let pool;

export function initDB(dbUrl = process.env.DATABASE_URL) {
  if (pool) {
    pool.end();
  }

  if (!dbUrl) {
    console.warn('WARNING: DATABASE_URL environment variable is missing. Set DATABASE_URL in environment variables.');
    pool = new Pool({ connectionTimeoutMillis: 5000 });
    return pool;
  }

  const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  return pool;
}

initDB();

export function getPool() {
  return pool;
}

export async function testAndSetupDB() {
  const client = await pool.connect();
  try {
    console.log('Successfully connected to PostgreSQL. Initializing schema...');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    } catch (vErr) {
      console.warn('pgvector extension warning:', vErr.message);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          filename TEXT NOT NULL,
          s3_key TEXT,
          status VARCHAR(50) DEFAULT 'AWAITING_UPLOAD',
          summary TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
      );
    `);
    await client.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS s3_key TEXT;');
    await client.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'AWAITING_UPLOAD\';');
    await client.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS summary TEXT;');
    await client.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL \'30 days\');');

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS document_chunks (
            id SERIAL PRIMARY KEY,
            document_id INT REFERENCES documents(id) ON DELETE CASCADE,
            chunk_index INT NOT NULL,
            content TEXT NOT NULL,
            embedding VECTOR(384)
        );
      `);
    } catch (chunkErr) {
      console.warn('document_chunks table warning:', chunkErr.message);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS queries (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          document_id INT REFERENCES documents(id) ON DELETE CASCADE,
          conversation_id TEXT NOT NULL,
          query TEXT NOT NULL,
          answer TEXT,
          status VARCHAR(50) DEFAULT 'QUEUED',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
          error TEXT
      );
    `);

    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_documents_expires_at ON documents(expires_at);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_queries_user_id ON queries(user_id);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_queries_document_id ON queries(document_id);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_queries_expires_at ON queries(expires_at);');

      await client.query(`
        CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx 
        ON document_chunks USING hnsw (embedding vector_cosine_ops);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_queries_conversation_created 
        ON queries (conversation_id, created_at DESC);
      `);
    } catch (idxErr) {
      console.warn('Index initialization warning:', idxErr.message);
    }

    console.log('Database schema successfully initialized.');
  } catch (error) {
    console.error('Error during database schema initialization:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function createUser(username, passwordHash) {
  const res = await pool.query(
    'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
    [username, passwordHash]
  );
  return res.rows[0];
}

export async function findUserByUsername(username) {
  const res = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return res.rows[0];
}

export async function listDocuments(userId) {
  const res = await pool.query(
    'SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return res.rows;
}

export async function createPendingDocument(userId, filename, storageKey) {
  const res = await pool.query(
    `INSERT INTO documents (user_id, filename, storage_key, status, created_at, expires_at) 
     VALUES ($1, $2, $3, 'AWAITING_UPLOAD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days') 
     RETURNING *, storage_key AS s3_key`,
    [userId, filename, storageKey]
  );
  const row = res.rows[0];
  if (row && !row.s3_key) row.s3_key = row.storage_key;
  return row;
}

export async function updateDocumentS3Key(documentId, storageKey) {
  const res = await pool.query(
    'UPDATE documents SET storage_key = $1 WHERE id = $2 RETURNING *, storage_key AS s3_key',
    [storageKey, documentId]
  );
  const row = res.rows[0];
  if (row && !row.s3_key) row.s3_key = row.storage_key;
  return row;
}

export async function confirmDocumentQueued(documentId, userId) {
  const res = await pool.query(
    `UPDATE documents SET status = 'QUEUED' WHERE id = $1 AND user_id = $2 RETURNING *, storage_key AS s3_key`,
    [documentId, userId]
  );
  const row = res.rows[0];
  if (row && !row.s3_key) row.s3_key = row.storage_key;
  return row;
}

export async function getDocumentById(documentId, userId = null) {
  let queryText = 'SELECT *, storage_key AS s3_key FROM documents WHERE id = $1';
  const params = [documentId];
  if (userId) {
    queryText += ' AND user_id = $2';
    params.push(userId);
  }
  const res = await pool.query(queryText, params);
  const row = res.rows[0];
  if (row && !row.s3_key) row.s3_key = row.storage_key;
  return row;
}

export async function deleteDocument(id, userId) {
  const res = await pool.query(
    'DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId]
  );
  return res.rows[0];
}

export async function createQueryRecord(userId, documentId, conversationId, queryText) {
  const res = await pool.query(
    `INSERT INTO queries (user_id, document_id, conversation_id, query, status, created_at, expires_at)
     VALUES ($1, $2, $3, $4, 'QUEUED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days')
     RETURNING *`,
    [userId, documentId, conversationId, queryText]
  );
  return res.rows[0];
}

export async function getQueryById(queryId, userId = null) {
  let queryText = 'SELECT * FROM queries WHERE id = $1';
  const params = [queryId];

  if (userId) {
    params.push(userId);
    queryText += ' AND user_id = $2';
  }

  const res = await pool.query(queryText, params);
  return res.rows[0];
}

export async function listChatHistory(userId) {
  const res = await pool.query(
    `SELECT q.id, q.document_id, q.conversation_id, q.query, q.answer, q.created_at, d.filename
     FROM queries q
     LEFT JOIN documents d ON q.document_id = d.id
     WHERE q.user_id = $1 AND q.status = 'COMPLETED'
     ORDER BY q.created_at DESC`,
    [userId]
  );
  return res.rows;
}

export async function clearChatHistory(userId) {
  await pool.query('DELETE FROM queries WHERE user_id = $1', [userId]);
}

export async function purgeExpiredRecords() {
  try {
    const docRes = await pool.query('DELETE FROM documents WHERE expires_at < CURRENT_TIMESTAMP RETURNING id');
    const queryRes = await pool.query('DELETE FROM queries WHERE expires_at < CURRENT_TIMESTAMP RETURNING id');
    const staleRes = await pool.query("DELETE FROM documents WHERE status = 'AWAITING_UPLOAD' AND created_at < NOW() - INTERVAL '1 hour' RETURNING id");
    if (docRes.rowCount > 0 || queryRes.rowCount > 0 || staleRes.rowCount > 0) {
      console.log(`Purged ${docRes.rowCount} expired docs, ${queryRes.rowCount} queries, and ${staleRes.rowCount} stale pending uploads from database.`);
    }
  } catch (err) {
    console.error('Error purging expired database records:', err.message);
  }
}
