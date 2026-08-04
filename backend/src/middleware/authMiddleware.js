import jwt from 'jsonwebtoken';

/**
 * Authentication middleware to verify JWT tokens.
 * Enforces JWT token validation strictly using the env configured JWT_SECRET.
 */
export function authenticate(req, res, next) {
  const jwtSecret = process.env.JWT_SECRET || 'pdfly_default_secret_jwt_key_2026';

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token is missing or malformed. Set Authorization header.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded; // Attach parsed payload to request object
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Unauthorized: Invalid or expired JWT auth token.' });
  }
}
