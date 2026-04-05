import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from './jwt';

declare global {
  namespace Express {
    interface Request { userId?: string; }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const cookieToken = req.cookies?.tenex_session;
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;
  const token = bearerToken || cookieToken;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
