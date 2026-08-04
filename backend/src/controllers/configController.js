import { initDB, testAndSetupDB } from '../services/dbService.js';

/**
 * Updates connection string and checks/re-runs migration setup.
 */
export async function updateDbConfig(req, res) {
  const { dbUrl } = req.body;
  if (!dbUrl) {
    return res.status(400).json({ error: 'dbUrl is required' });
  }
  try {
    initDB(dbUrl);
    await testAndSetupDB();
    res.json({ message: 'Database connection updated and verified successfully.' });
  } catch (error) {
    res.status(500).json({ error: `Connection failed: ${error.message}` });
  }
}
