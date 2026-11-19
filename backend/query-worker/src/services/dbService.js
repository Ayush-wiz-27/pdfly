import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
let pool;

export function initDB(dbUrl = process.env.DATABASE_URL) {
  if (pool) {
    pool.end();
  }

  if (!dbUrl) {
    console.warn('WARNING: DATABASE_URL environment variable is missing.');
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

export async function updateQueryStatus(queryId, status, answer = null, error = null) {
  let queryText = 'UPDATE queries SET status = $1';
  const params = [status];

  if (answer !== null) {
    params.push(answer);
    queryText += `, answer = $${params.length}, completed_at = CURRENT_TIMESTAMP`;
  }

  if (error !== null) {
    params.push(error);
    queryText += `, error = $${params.length}`;
  }

  params.push(queryId);
  queryText += ` WHERE id = $${params.length} RETURNING *`;

  const res = await pool.query(queryText, params);
  return res.rows[0];
}

export async function getDocumentById(documentId) {
  const res = await pool.query('SELECT * FROM documents WHERE id = $1', [documentId]);
  return res.rows[0];
}

export async function searchChunks(queryEmbedding, limit = 5, documentIds = null, userId = null) {
  const vectorStr = `[${queryEmbedding.join(',')}]`;
  
  let queryText = `
    SELECT c.content, c.chunk_index, d.filename, d.id as document_id, 
           (1 - (c.embedding <=> $1)) as similarity
    FROM document_chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE 1=1
  `;
  
  const queryParams = [vectorStr];

  if (userId) {
    queryParams.push(userId);
    queryText += ` AND d.user_id = $${queryParams.length}`;
  }
  
  if (Array.isArray(documentIds) && documentIds.length > 0) {
    queryParams.push(documentIds);
    queryText += ` AND d.id = ANY($${queryParams.length})`;
  }
  
  queryText += ` ORDER BY c.embedding <=> $1 LIMIT $${queryParams.length + 1}`;
  queryParams.push(limit);

  const res = await pool.query(queryText, queryParams);
  return res.rows;
}

export async function getRecentConversationHistory(conversationId, limit = 10) {
  const res = await pool.query(
    `SELECT query, answer FROM queries 
     WHERE conversation_id = $1 AND status = 'COMPLETED' 
     ORDER BY created_at DESC LIMIT $2`,
    [conversationId, limit]
  );
  return res.rows.reverse();
}
