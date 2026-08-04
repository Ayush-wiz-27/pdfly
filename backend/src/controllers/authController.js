import jwt from 'jsonwebtoken';
import { createUser, findUserByUsername } from '../services/dbService.js';
import { hashPassword } from '../services/authService.js';

/**
 * Handles new user registration, hashes password, and returns a signed session JWT.
 */
export async function signup(req, res) {
  const { username, password } = req.body;
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error('FATAL: JWT_SECRET is missing in server environment.');
    return res.status(500).json({ error: 'Server configuration error: Authentication key is missing.' });
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  const trimmedpass=password.trim();
  const trimmedUsername = username.trim().toLowerCase();
  if (trimmedUsername.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
  }
  if (trimmedpass.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
  }

  try {
    // Verify user doesn't already exist
    const existingUser = await findUserByUsername(trimmedUsername);
    if (existingUser) {
      return res.status(409).json({ error: 'Username is already taken.' });
    }

    const hashedPassword = hashPassword(trimmedpass);
    const user = await createUser(trimmedUsername, hashedPassword);

    // Sign and issue JWT directly upon signup
    const token = jwt.sign({ id: user.id, username: user.username }, jwtSecret, { expiresIn: '24h' });

    res.status(201).json({ 
      token, 
      user: { id: user.id, username: user.username },
      message: 'Account created and logged in successfully.' 
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: `Registration failed: ${error.message}` });
  }
}

/**
 * Validates credentials and returns a signed session JWT.
 */
export async function login(req, res) {
  const { username, password } = req.body;
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error('FATAL: JWT_SECRET is missing in server environment.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const trimmedUsername = username.trim().toLowerCase();
  const trimmedpass=password.trim();
  
  try {
    const user = await findUserByUsername(trimmedUsername);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username' });
    }

    const hashedPassword = hashPassword(trimmedpass);
    if (user.password_hash !== hashedPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Sign JWT carrying the userId in payload
    const token = jwt.sign({ id: user.id, username: user.username }, jwtSecret, { expiresIn: '24h' });

    res.json({ 
      token, 
      user: { id: user.id, username: user.username },
      message: 'Logged in successfully.' 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: `Authentication failed: ${error.message}` });
  }
}
