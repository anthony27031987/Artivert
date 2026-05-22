import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import pool from '../utils/database';
import { logger } from '../utils/logger';
import { verifyToken, requireRole, auditLog, AuthRequest } from '../middleware/auth';

const router = express.Router();

// =============================================
// 📍 GET /api/v1/users (Admin/Gérant)
// =============================================
router.get('/', verifyToken, requireRole([1, 2]), async (req: AuthRequest, res: Response) => {
  try {
    const { role_id, is_active, search } = req.query;

    let query = `SELECT u.*, r.name as role_name FROM users u
                 LEFT JOIN roles r ON u.role_id = r.id
                 WHERE 1=1`;
    const params: any[] = [];

    if (role_id) {
      params.push(role_id);
      query += ` AND u.role_id = $${params.length}`;
    }

    if (is_active !== undefined) {
      params.push(is_active === 'true');
      query += ` AND u.is_active = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (u.email ILIKE $${params.length} OR u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length})`;
    }

    query += ' ORDER BY u.created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      total: result.rows.length,
      users: result.rows.map(u => ({
        id: u.id,
        email: u.email,
        first_name: u.first_name,
        last_name: u.last_name,
        phone: u.phone,
        role_id: u.role_id,
        role_name: u.role_name,
        is_active: u.is_active,
        last_login: u.last_login,
        created_at: u.created_at,
      })),
    });
  } catch (error) {
    logger.error('Get users error', { error });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// =============================================
// 📍 GET /api/v1/users/:id (Admin/Gérant)
// =============================================
router.get('/:id', verifyToken, requireRole([1, 2]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT u.*, r.name as role_name FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [id]
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
      created_at: user.created_at,
    });
  } catch (error) {
    logger.error('Get user error', { error });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// =============================================
// 📍 PUT /api/v1/users/:id (Admin/Gérant)
// =============================================
router.put(
  '/:id',
  verifyToken,
  requireRole([1, 2]),
  [
    body('first_name').optional().notEmpty(),
    body('last_name').optional().notEmpty(),
    body('phone').optional(),
    body('role_id').optional().isInt(),
    body('is_active').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { first_name, last_name, phone, role_id, is_active } = req.body;

      // Vérifier que l'utilisateur existe
      const userResult = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      const oldUser = userResult.rows[0];
      const updates: any = {};
      const params: any[] = [];
      let paramCount = 1;

      if (first_name !== undefined) {
        params.push(first_name);
        updates.first_name = `$${paramCount++}`;
      }
      if (last_name !== undefined) {
        params.push(last_name);
        updates.last_name = `$${paramCount++}`;
      }
      if (phone !== undefined) {
        params.push(phone);
        updates.phone = `$${paramCount++}`;
      }
      if (role_id !== undefined) {
        params.push(role_id);
        updates.role_id = `$${paramCount++}`;
      }
      if (is_active !== undefined) {
        params.push(is_active);
        updates.is_active = `$${paramCount++}`;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
      }

      params.push(id);
      updates.updated_at = 'CURRENT_TIMESTAMP';

      const updateQuery = `UPDATE users SET ${Object.entries(updates)
        .map(([key, value]) => `${key} = ${value}`)
        .join(', ')} WHERE id = $${paramCount} RETURNING *`;

      const result = await pool.query(updateQuery, params);
      const updatedUser = result.rows[0];

      // Audit log
      await auditLog(
        req.user?.id || 'unknown',
        'UPDATE_USER',
        'USER',
        id,
        { old: oldUser, new: updatedUser },
        req.ip
      );

      logger.info('User updated', { user_id: id, updated_by: req.user?.id });

      res.json({
        message: 'Utilisateur modifié avec succès',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          first_name: updatedUser.first_name,
          last_name: updatedUser.last_name,
          phone: updatedUser.phone,
          role_id: updatedUser.role_id,
          is_active: updatedUser.is_active,
        },
      });
    } catch (error) {
      logger.error('Update user error', { error });
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// =============================================
// 📍 DELETE /api/v1/users/:id (Admin only)
// =============================================
router.delete('/:id', verifyToken, requireRole([1]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Vérifier que l'utilisateur existe
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const user = result.rows[0];

    // Supprimer l'utilisateur
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    // Audit log
    await auditLog(
      req.user?.id || 'unknown',
      'DELETE_USER',
      'USER',
      id,
      { user },
      req.ip
    );

    logger.info('User deleted', { user_id: id, deleted_by: req.user?.id });

    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    logger.error('Delete user error', { error });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
