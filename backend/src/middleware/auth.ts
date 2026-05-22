import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import pool from '../utils/database';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role_id: number;
  };
  token?: string;
}

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      logger.warn('No token provided');
      return res.status(401).json({ error: 'Token requis' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    req.user = decoded;
    req.token = token;
    next();
  } catch (error) {
    logger.error('Token verification failed', { error });
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
};

export const requireRole = (allowedRoles: number[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    if (!allowedRoles.includes(req.user.role_id)) {
      logger.warn('Unauthorized access attempt', { user_id: req.user.id, role_id: req.user.role_id });
      return res.status(403).json({ error: 'Accès refusé' });
    }

    next();
  };
};

export const auditLog = async (
  user_id: string,
  action: string,
  entity_type: string,
  entity_id: string,
  changes?: any,
  ip_address?: string
) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user_id, action, entity_type, entity_id, JSON.stringify(changes), ip_address]
    );
  } catch (error) {
    logger.error('Audit log failed', { error });
  }
};
