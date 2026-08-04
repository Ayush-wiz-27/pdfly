import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

let pool;

export function initDB(dbUrl = process.env.DATABASE_URL) {
  if (pool) {
    pool.end();
  }

  if (dbUrl) {
    const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
    pool = new Pool({
      connectionString: dbUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
  } else {
    pool = new Pool({
      connectionTimeoutMillis: 5000,
    });
  }

  return pool;
}

// Default pool initialization
initDB();

// Test the database connection and initialize schemas
export async function testAndSetupDB() {
  const client = await pool.connect();
  try {
    console.log('Successfully connected to PostgreSQL. Setting up database tables...');
    
    // 1. Vector extension (optional/graceful)
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    } catch (vErr) {
      console.warn('pgvector extension warning:', vErr.message);
    }

    // 2. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Documents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
          id SERIAL PRIMARY KEY,
          filename TEXT NOT NULL,
          char_count INT DEFAULT 0,
          chunk_count INT DEFAULT 0,
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          summary TEXT
      );
    `);

    // 4. Document chunks table
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

    // 5. Chat history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_history (
          id SERIAL PRIMARY KEY,
          query TEXT NOT NULL,
          response TEXT NOT NULL,
          model TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          document_ids INT[]
      );
    `);

    // 6. Vector Index
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx 
        ON document_chunks USING hnsw (embedding vector_cosine_ops);
      `);
    } catch (idxErr) {
      console.warn('HNSW index warning:', idxErr.message);
    }

    console.log('Database tables successfully initialized.');
  } catch (error) {
    console.error('Error during database schema initialization:', error);
    throw error;
  } finally {
    client.release();
  }
}

// -------------------------------------------------------------
// Users Table Queries
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// Documents Table Queries (Scoped to User)
// -------------------------------------------------------------
export async function listDocuments(userId) {
  const res = await pool.query(
    'SELECT * FROM documents WHERE user_id = $1 ORDER BY uploaded_at DESC',
    [userId]
  );
  return res.rows;
}

export async function createDocument(filename, charCount, chunkCount, userId, summary = null) {
  const res = await pool.query(
    'INSERT INTO documents (filename, char_count, chunk_count, user_id, summary) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [filename, charCount, chunkCount, userId, summary]
  );
  return res.rows[0];
}

export async function updateDocumentSummary(id, userId, summary) {
  const res = await pool.query(
    'UPDATE documents SET summary = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
    [summary, id, userId]
  );
  return res.rows[0];
}

export async function getDocumentSummaries(documentIds = null, userId) {
  let query = 'SELECT id, filename, summary FROM documents WHERE user_id = $1 AND summary IS NOT NULL';
  const queryParams = [userId];

  if (Array.isArray(documentIds) && documentIds.length > 0) {
    queryParams.push(documentIds);
    query += ' AND id = ANY($2)';
  }

  const res = await pool.query(query, queryParams);
  return res.rows;
}

export async function deleteDocument(id, userId) {
  const res = await pool.query(
    'DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId]
  );
  return res.rows[0];
}

// -------------------------------------------------------------
// Document Chunks Queries (Scoped to User via join)
// -------------------------------------------------------------
export async function insertChunk(documentId, chunkIndex, content, embedding) {
  const vectorStr = `[${embedding.join(',')}]`;
  const res = await pool.query(
    'INSERT INTO document_chunks (document_id, chunk_index, content, embedding) VALUES ($1, $2, $3, $4) RETURNING id',
    [documentId, chunkIndex, content, vectorStr]
  );
  return res.rows[0].id;
}

export async function searchChunks(queryEmbedding, limit = 10, documentIds = null, userId) {
  const vectorStr = `[${queryEmbedding.join(',')}]`;
  
  // Enforce document query filtering scoped to documents belonging to the request user ID
  let queryText = `
    SELECT c.content, c.chunk_index, d.filename, d.id as document_id, 
           (1 - (c.embedding <=> $1)) as similarity
    FROM document_chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE d.user_id = $2
  `;
  
  const queryParams = [vectorStr, userId];
  
  if (Array.isArray(documentIds) && documentIds.length > 0) {
    queryParams.push(documentIds);
    queryText += ` AND d.id = ANY($3)`;
  }
  
  queryText += ` ORDER BY c.embedding <=> $1 LIMIT $${queryParams.length + 1}`;
  queryParams.push(limit);

  const res = await pool.query(queryText, queryParams);
  return res.rows;
}

// -------------------------------------------------------------
// Chat History Queries (Scoped to User)
// -------------------------------------------------------------
export async function listChatHistory(userId) {
  const res = await pool.query(
    'SELECT * FROM chat_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [userId]
  );
  return res.rows;
}

export async function createChatLog(query, response, model, userId, documentIds) {
  const res = await pool.query(
    'INSERT INTO chat_history (query, response, model, user_id, document_ids) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [query, response, model, userId, documentIds]
  );
  return res.rows[0];
}

export async function clearChatHistory(userId) {
  await pool.query('DELETE FROM chat_history WHERE user_id = $1', [userId]);
}
