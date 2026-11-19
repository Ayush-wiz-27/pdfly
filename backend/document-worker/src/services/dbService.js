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
    pool = new Pool({ connectionTimeoutMillis: 15000 });
    return pool;
  }

  const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 60000,
    keepAlive: true,
    max: 10,
  });

  return pool;
}

initDB();

export async function getDocumentById(documentId) {
  const res = await pool.query('SELECT *, storage_key AS s3_key FROM documents WHERE id = $1', [documentId]);
  const row = res.rows[0];
  if (row && !row.s3_key) row.s3_key = row.storage_key;
  return row;
}

export async function updateDocumentStatus(documentId, status, summary = null) {
  const query = summary !== null
    ? `UPDATE documents SET status = $1, summary = $2 WHERE id = $3 RETURNING *`
    : `UPDATE documents SET status = $1 WHERE id = $2 RETURNING *`;
  const params = summary !== null ? [status, summary, documentId] : [status, documentId];
  const res = await pool.query(query, params);
  return res.rows[0];
}

export async function saveDocumentChunksAndSummary(documentId, summary, chunksWithEmbeddings) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM document_chunks WHERE document_id = $1', [documentId]);

    // Batch insert 50 chunks per query for 100x faster execution and database connection stability
    const BATCH_SIZE = 50;
    for (let i = 0; i < chunksWithEmbeddings.length; i += BATCH_SIZE) {
      const batch = chunksWithEmbeddings.slice(i, i + BATCH_SIZE);
      const valueRows = [];
      const queryParams = [];
      let paramIdx = 1;

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const chunkIndex = i + j;
        const vectorStr = `[${item.embedding.join(',')}]`;

        valueRows.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3})`);
        queryParams.push(documentId, chunkIndex, item.content, vectorStr);
        paramIdx += 4;
      }

      const insertSql = `
        INSERT INTO document_chunks (document_id, chunk_index, content, embedding) 
        VALUES ${valueRows.join(', ')}
        ON CONFLICT (document_id, chunk_index) DO UPDATE 
        SET content = EXCLUDED.content, embedding = EXCLUDED.embedding
      `;
      await client.query(insertSql, queryParams);
    }

    await client.query(
      `UPDATE documents SET summary = $1, status = 'READY' WHERE id = $2`,
      [summary, documentId]
    );

    await client.query('COMMIT');
    console.log(`[Document Worker] Successfully committed ${chunksWithEmbeddings.length} chunks & summary for Doc ID ${documentId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[Document Worker] Transaction failed for Doc ID ${documentId}:`, err);
    throw err;
  } finally {
    client.release();
  }
}
