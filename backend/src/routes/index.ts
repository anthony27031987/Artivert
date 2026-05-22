import express from 'express';
import authRoutes from './auth';
import usersRoutes from './users';
import timesheetsRoutes from './timesheets';
import sitesRoutes from './sites';

const router = express.Router();

// Routes
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/timesheets', timesheetsRoutes);
router.use('/sites', sitesRoutes);

export default router;
