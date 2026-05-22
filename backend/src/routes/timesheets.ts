import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../utils/database';
import { logger } from '../utils/logger';
import { verifyToken, requireRole, auditLog, AuthRequest } from '../middleware/auth';

const router = express.Router();

// =============================================
// 🕐 POST /api/v1/timesheets/clock-in
// Pointage Arrivée
// =============================================
router.post(
  '/clock-in',
  verifyToken,
  requireRole([4]), // Employés uniquement
  [
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    body('site_id').optional().isUUID(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { latitude, longitude, site_id } = req.body;

      // Récupérer l'employé
      const employeeResult = await pool.query(
        'SELECT id FROM employee WHERE user_id = $1',
        [req.user?.id]
      );

      if (employeeResult.rows.length === 0) {
        return res.status(404).json({ error: 'Profil employé non trouvé' });
      }

      const employee_id = employeeResult.rows[0].id;

      // Vérifier s'il y a un pointage en cours
      const activeClockIn = await pool.query(
        'SELECT id FROM work_hours WHERE employee_id = $1 AND clock_out IS NULL',
        [employee_id]
      );

      if (activeClockIn.rows.length > 0) {
        return res.status(400).json({ error: 'Un pointage est déjà en cours. Pointez d\'abord la sortie.' });
      }

      // Créer le pointage
      const result = await pool.query(
        `INSERT INTO work_hours (employee_id, site_id, clock_in, latitude_in, longitude_in)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)
         RETURNING *`,
        [employee_id, site_id || null, latitude, longitude]
      );

      const workHour = result.rows[0];

      // Audit log
      await auditLog(
        req.user?.id || 'unknown',
        'CLOCK_IN',
        'WORK_HOURS',
        workHour.id,
        { latitude, longitude, site_id },
        req.ip
      );

      logger.info('Employee clocked in', { employee_id, user_id: req.user?.id });

      res.status(201).json({
        message: 'Pointage d\'arrivée enregistré',
        work_hour: {
          id: workHour.id,
          clock_in: workHour.clock_in,
          latitude_in: workHour.latitude_in,
          longitude_in: workHour.longitude_in,
        },
      });
    } catch (error) {
      logger.error('Clock in error', { error });
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// =============================================
// 🕐 POST /api/v1/timesheets/clock-out
// Pointage Départ
// =============================================
router.post(
  '/clock-out',
  verifyToken,
  requireRole([4]), // Employés uniquement
  [
    body('work_hour_id').isUUID(),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { work_hour_id, latitude, longitude } = req.body;

      // Récupérer l'employé
      const employeeResult = await pool.query(
        'SELECT id FROM employee WHERE user_id = $1',
        [req.user?.id]
      );

      if (employeeResult.rows.length === 0) {
        return res.status(404).json({ error: 'Profil employé non trouvé' });
      }

      const employee_id = employeeResult.rows[0].id;

      // Vérifier que le pointage existe et appartient à l'employé
      const workHourResult = await pool.query(
        'SELECT * FROM work_hours WHERE id = $1 AND employee_id = $2 AND clock_out IS NULL',
        [work_hour_id, employee_id]
      );

      if (workHourResult.rows.length === 0) {
        return res.status(404).json({ error: 'Pointage non trouvé ou déjà fermé' });
      }

      // Mettre à jour le pointage
      const result = await pool.query(
        `UPDATE work_hours
         SET clock_out = CURRENT_TIMESTAMP, latitude_out = $1, longitude_out = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [latitude, longitude, work_hour_id]
      );

      const updatedWorkHour = result.rows[0];

      // Audit log
      await auditLog(
        req.user?.id || 'unknown',
        'CLOCK_OUT',
        'WORK_HOURS',
        work_hour_id,
        { latitude, longitude },
        req.ip
      );

      logger.info('Employee clocked out', { employee_id, user_id: req.user?.id });

      res.json({
        message: 'Pointage de départ enregistré',
        work_hour: {
          id: updatedWorkHour.id,
          clock_in: updatedWorkHour.clock_in,
          clock_out: updatedWorkHour.clock_out,
          duration_minutes: updatedWorkHour.duration_minutes,
        },
      });
    } catch (error) {
      logger.error('Clock out error', { error });
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// =============================================
// 📍 POST /api/v1/timesheets/geolocation
// Envoyer position en temps réel
// =============================================
router.post(
  '/geolocation',
  verifyToken,
  requireRole([4]),
  [
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    body('accuracy').optional().isFloat(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { latitude, longitude, accuracy } = req.body;

      // Récupérer l'employé
      const employeeResult = await pool.query(
        'SELECT id FROM employee WHERE user_id = $1',
        [req.user?.id]
      );

      if (employeeResult.rows.length === 0) {
        return res.status(404).json({ error: 'Profil employé non trouvé' });
      }

      const employee_id = employeeResult.rows[0].id;

      // Vérifier s'il y a un pointage actif
      const activeWorkHour = await pool.query(
        'SELECT id, site_id FROM work_hours WHERE employee_id = $1 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
        [employee_id]
      );

      let is_within_site = false;
      let site_id = null;

      if (activeWorkHour.rows.length > 0 && activeWorkHour.rows[0].site_id) {
        site_id = activeWorkHour.rows[0].site_id;

        // Vérifier si l'employé est dans les 100m du site (approximation)
        const siteResult = await pool.query(
          'SELECT latitude, longitude FROM sites WHERE id = $1',
          [site_id]
        );

        if (siteResult.rows.length > 0) {
          const site = siteResult.rows[0];
          const distance = calculateDistance(latitude, longitude, site.latitude, site.longitude);
          is_within_site = distance < 0.1; // 100 mètres
        }
      }

      // Enregistrer la géolocalisation
      const result = await pool.query(
        `INSERT INTO geolocation_history (employee_id, latitude, longitude, accuracy, timestamp, is_within_site, site_id)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6)
         RETURNING *`,
        [employee_id, latitude, longitude, accuracy || null, is_within_site, site_id]
      );

      const geoLocation = result.rows[0];

      logger.info('Geolocation recorded', { employee_id, latitude, longitude });

      res.status(201).json({
        message: 'Géolocalisation enregistrée',
        geolocation: {
          id: geoLocation.id,
          latitude: geoLocation.latitude,
          longitude: geoLocation.longitude,
          timestamp: geoLocation.timestamp,
          is_within_site: geoLocation.is_within_site,
        },
      });
    } catch (error) {
      logger.error('Geolocation error', { error });
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// =============================================
// 📊 GET /api/v1/timesheets/my-hours
// Mes heures travaillées
// =============================================
router.get('/my-hours', verifyToken, requireRole([4]), async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date } = req.query;

    // Récupérer l'employé
    const employeeResult = await pool.query(
      'SELECT id FROM employee WHERE user_id = $1',
      [req.user?.id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Profil employé non trouvé' });
    }

    const employee_id = employeeResult.rows[0].id;

    let query = `SELECT wh.*, s.name as site_name FROM work_hours wh
                 LEFT JOIN sites s ON wh.site_id = s.id
                 WHERE wh.employee_id = $1`;
    const params: any[] = [employee_id];

    if (start_date) {
      params.push(start_date);
      query += ` AND DATE(wh.clock_in) >= $${params.length}`;
    }

    if (end_date) {
      params.push(end_date);
      query += ` AND DATE(wh.clock_in) <= $${params.length}`;
    }

    query += ' ORDER BY wh.clock_in DESC';

    const result = await pool.query(query, params);

    const totalMinutes = result.rows.reduce((sum, row) => sum + (row.duration_minutes || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(2);

    res.json({
      total_hours: totalHours,
      total_entries: result.rows.length,
      hours: result.rows.map(h => ({
        id: h.id,
        clock_in: h.clock_in,
        clock_out: h.clock_out,
        duration_minutes: h.duration_minutes,
        site_name: h.site_name,
      })),
    });
  } catch (error) {
    logger.error('Get hours error', { error });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// =============================================
// 📊 GET /api/v1/timesheets/hours/:employee_id (Gérant)
// Heures d'un salarié
// =============================================
router.get(
  '/hours/:employee_id',
  verifyToken,
  requireRole([1, 2, 3]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { employee_id } = req.params;
      const { start_date, end_date } = req.query;

      let query = `SELECT wh.*, s.name as site_name, u.first_name, u.last_name FROM work_hours wh
                   LEFT JOIN sites s ON wh.site_id = s.id
                   LEFT JOIN employee e ON wh.employee_id = e.id
                   LEFT JOIN users u ON e.user_id = u.id
                   WHERE wh.employee_id = $1`;
      const params: any[] = [employee_id];

      if (start_date) {
        params.push(start_date);
        query += ` AND DATE(wh.clock_in) >= $${params.length}`;
      }

      if (end_date) {
        params.push(end_date);
        query += ` AND DATE(wh.clock_in) <= $${params.length}`;
      }

      query += ' ORDER BY wh.clock_in DESC';

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Aucune donnée trouvée' });
      }

      const totalMinutes = result.rows.reduce((sum, row) => sum + (row.duration_minutes || 0), 0);
      const totalHours = (totalMinutes / 60).toFixed(2);

      res.json({
        employee: {
          id: employee_id,
          name: result.rows[0].first_name + ' ' + result.rows[0].last_name,
        },
        total_hours: totalHours,
        total_entries: result.rows.length,
        hours: result.rows.map(h => ({
          id: h.id,
          clock_in: h.clock_in,
          clock_out: h.clock_out,
          duration_minutes: h.duration_minutes,
          site_name: h.site_name,
        })),
      });
    } catch (error) {
      logger.error('Get employee hours error', { error });
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// =============================================
// 🗺️ GET /api/v1/timesheets/geolocation-history
// Historique géolocalisation
// =============================================
router.get(
  '/geolocation-history',
  verifyToken,
  requireRole([1, 2, 3, 4]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { limit = 100 } = req.query;

      // Récupérer l'employé
      const employeeResult = await pool.query(
        'SELECT id FROM employee WHERE user_id = $1',
        [req.user?.id]
      );

      if (employeeResult.rows.length === 0) {
        return res.status(404).json({ error: 'Profil employé non trouvé' });
      }

      const employee_id = employeeResult.rows[0].id;

      const result = await pool.query(
        `SELECT id, latitude, longitude, accuracy, timestamp, is_within_site, site_id
         FROM geolocation_history
         WHERE employee_id = $1
         ORDER BY timestamp DESC
         LIMIT $2`,
        [employee_id, parseInt(limit as string)]
      );

      res.json({
        total: result.rows.length,
        geolocation: result.rows,
      });
    } catch (error) {
      logger.error('Get geolocation history error', { error });
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// =============================================
// 🗺️ GET /api/v1/timesheets/team-locations (Gérant)
// Position en temps réel de l'équipe
// =============================================
router.get(
  '/team-locations',
  verifyToken,
  requireRole([1, 2, 3]),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT DISTINCT ON (gh.employee_id)
           gh.employee_id, gh.latitude, gh.longitude, gh.timestamp,
           u.first_name, u.last_name, e.employee_number, wh.site_id, s.name as site_name
         FROM geolocation_history gh
         LEFT JOIN employee e ON gh.employee_id = e.id
         LEFT JOIN users u ON e.user_id = u.id
         LEFT JOIN work_hours wh ON wh.employee_id = gh.employee_id AND wh.clock_out IS NULL
         LEFT JOIN sites s ON wh.site_id = s.id
         WHERE gh.timestamp > CURRENT_TIMESTAMP - INTERVAL '1 hour'
         ORDER BY gh.employee_id, gh.timestamp DESC`
      );

      res.json({
        total: result.rows.length,
        team_locations: result.rows.map(row => ({
          employee_id: row.employee_id,
          name: row.first_name + ' ' + row.last_name,
          latitude: row.latitude,
          longitude: row.longitude,
          site_name: row.site_name,
          last_update: row.timestamp,
        })),
      });
    } catch (error) {
      logger.error('Get team locations error', { error });
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// =============================================
// Fonction utilitaire: Calcul distance (Haversine)
// =============================================
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default router;
