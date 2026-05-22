import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import pool from '../utils/database';
import { logger } from '../utils/logger';
import { verifyToken, auditLog, AuthRequest } from '../middleware/auth';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

// =============================================
// 📍 POST /api/v1/auth/login
// =============================================
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Récupérer l'utilisateur
      const result = await pool.query(
        `SELECT u.*, r.name as role_name FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.email = $1 AND u.is_active = true`,
        [email]
      );

      if (result.rows.length === 0) {
        logger.warn('Login attempt with non-existent email', { email });
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      const user = result.rows[0];

      // Vérifier le mot de passe
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        logger.warn('Failed login attempt', { email });
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      // Générer le JWT
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role_id: user.role_id,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRE }
      );

      // Mettre à jour last_login
      await pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      // Audit log
      await auditLog(
        user.id,
        'LOGIN',
        'AUTH',
        user.id,
        {},
        req.ip
      );

      logger.info('User logged in', { email, user_id: user.id });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role_id: user.role_id,
          role_name: user.role_name,
        },
      });
    } catch (error) {
      logger.error('Login error', { error });
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// =============================================
// 📍 POST /api/v1/auth/register (Admin only)
// =============================================
router.post(
  '/register',
  verifyToken,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('first_name').notEmpty(),
    body('last_name').notEmpty(),
    body('role_id').isInt({ min: 1 }),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Vérifier que l'utilisateur a les droits (admin ou gérant)
      if (![1, 2].includes(req.user?.role_id || 0)) {
        return res.status(403).json({ error: 'Accès refusé' });
      }

      const { email, password, first_name, last_name, phone, role_id } = req.body;

      // Vérifier que l'email n'existe pas
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Email déjà utilisé' });
      }

      // Hasher le mot de passe
      const passwordHash = await bcrypt.hash(password, 10);

      // Insérer l'utilisateur
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone, role_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING id, email, first_name, last_name, role_id`,
        [email, passwordHash, first_name, last_name, phone || null, role_id]
      );

      const newUser = result.rows[0];

      // Audit log
      await auditLog(
        req.user?.id || 'system',
        'CREATE_USER',
        'USER',
        newUser.id,
        { email, role_id },
        req.ip
      );

      logger.info('New user created', { email, role_id, created_by: req.user?.id });

      res.status(201).json({
        message: 'Utilisateur créé avec succès',
        user: newUser,
      });
    } catch (error) {
      logger.error('Register error', { error });
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// =============================================
// 📍 GET /api/v1/auth/me
// =============================================
router.get('/me', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT u.*, r.name as role_name FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [req.user?.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      role_id: user.role_id,
      role_name: user.role_name,
      is_active: user.is_active,
      last_login: user.last_login,
    });
  } catch (error) {
    logger.error('Get user error', { error });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// =============================================
// 📍 POST /api/v1/auth/logout
// =============================================
router.post('/logout', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    // Audit log
    await auditLog(
      req.user?.id || 'unknown',
      'LOGOUT',
      'AUTH',
      req.user?.id || 'unknown',
      {},
      req.ip
    );

    logger.info('User logged out', { user_id: req.user?.id });

    res.json({ message: 'Déconnexion réussie' });
  } catch (error) {
    logger.error('Logout error', { error });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// =============================================
// 📍 PUT /api/v1/auth/password
// =============================================
router.put(
  '/password',
  verifyToken,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;

      // Récupérer l'utilisateur
      const result = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user?.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      // Vérifier le mot de passe actuel
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        result.rows[0].password_hash
      );

      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
      }

      // Hasher le nouveau mot de passe
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Mettre à jour le mot de passe
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newPasswordHash, req.user?.id]
      );

      // Audit log
      await auditLog(
        req.user?.id || 'unknown',
        'PASSWORD_CHANGE',
        'AUTH',
        req.user?.id || 'unknown',
        {},
        req.ip
      );

      logger.info('User password changed', { user_id: req.user?.id });

      res.json({ message: 'Mot de passe modifié avec succès' });
    } catch (error) {
      logger.error('Password change error', { error });
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

export default router;
