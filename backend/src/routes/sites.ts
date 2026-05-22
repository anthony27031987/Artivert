import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../utils/database';
import { logger } from '../utils/logger';
import { verifyToken, requireRole, auditLog, AuthRequest } from '../middleware/auth';

const router = express.Router();

// =============================================
// 📍 GET /api/v1/sites
// Lister tous les sites
// =============================================
router.get('/', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;

    let query = 'SELECT * FROM sites WHERE 1=1';
    const params: any[] = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      total: result.rows.length,
      sites: result.rows,
    });
  } catch (error) {
    logger.error('Get sites error', { error });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// =============================================
// 📍 POST /api/v1/sites (Gérant)
// Créer un nouveau site
// =============================================
router.post(
  '/',
  verifyToken,
  requireRole([1, 2]),
  [
    body('name').notEmpty(),
    body('address').notEmpty(),
    body('city').notEmpty(),
    body('postal_code').notEmpty(),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    body('client_name').optional(),
    body('description').optional(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, address, city, postal_code, latitude, longitude, client_name, description } = req.body;

      const result = await pool.query(
        `INSERT INTO sites (name, address, city, postal_code, latitude, longitude, client_name, description, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9)
         RETURNING *`,
        [name, address, city, postal_code, latitude, longitude, client_name || null, description || null, req.user?.id]
      );

      const site = result.rows[0];

      // Audit log
      await auditLog(
        req.user?.id || 'unknown',
        'CREATE_SITE',
        'SITE',
        site.id,
        { name, city, latitude, longitude },
        req.ip
      );

      logger.info('Site created', { site_id: site.id, name });

      res.status(201).json({
        message: 'Site créé avec succès',
        site,
      });
    } catch (error) {
      logger.error('Create site error', { error });
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// =============================================
// 📍 GET /api/v1/sites/:id
// Détails d'un site
// =============================================
router.get('/:id', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM sites WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Site non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Get site error', { error });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// =============================================
// 📍 PUT /api/v1/sites/:id (Gérant)
// Modifier un site
// =============================================
router.put(
  '/:id',
  verifyToken,
  requireRole([1, 2]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, address, city, postal_code, latitude, longitude, client_name, description, status } = req.body;

      const result = await pool.query(
        'SELECT * FROM sites WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Site non trouvé' });
      }

      const oldSite = result.rows[0];

      const updateResult = await pool.query(
        `UPDATE sites
         SET name = COALESCE($1, name),
             address = COALESCE($2, address),
             city = COALESCE($3, city),
             postal_code = COALESCE($4, postal_code),
             latitude = COALESCE($5, latitude),
             longitude = COALESCE($6, longitude),
             client_name = COALESCE($7, client_name),
             description = COALESCE($8, description),
             status = COALESCE($9, status),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $10
         RETURNING *`,
        [name || null, address || null, city || null, postal_code || null, latitude || null, longitude || null, client_name || null, description || null, status || null, id]
      );

      const updatedSite = updateResult.rows[0];

      // Audit log
      await auditLog(
        req.user?.id || 'unknown',
        'UPDATE_SITE',
        'SITE',
        id,
        { old: oldSite, new: updatedSite },
        req.ip
      );

      logger.info('Site updated', { site_id: id });

      res.json({
        message: 'Site modifié avec succès',
        site: updatedSite,
      });
    } catch (error) {
      logger.error('Update site error', { error });
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// =============================================
// 📍 DELETE /api/v1/sites/:id (Admin)
// Supprimer un site
// =============================================
router.delete(
  '/:id',
  verifyToken,
  requireRole([1]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'SELECT * FROM sites WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Site non trouvé' });
      }

      const site = result.rows[0];

      await pool.query('DELETE FROM sites WHERE id = $1', [id]);

      // Audit log
      await auditLog(
        req.user?.id || 'unknown',
        'DELETE_SITE',
        'SITE',
        id,
        { site },
        req.ip
      );

      logger.info('Site deleted', { site_id: id });

      res.json({ message: 'Site supprimé avec succès' });
    } catch (error) {
      logger.error('Delete site error', { error });
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

export default router;
