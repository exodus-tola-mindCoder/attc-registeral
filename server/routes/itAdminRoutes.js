import express from 'express';
import {
  createUser,
  updateUser,
  resetPassword,
  getUsers,
  deleteUser,
  getSystemHealth,
  getAuditLogs,
  getAuditStats,
  getDashboardOverview,
  trackRequest
} from '../controllers/itAdminController.js';
import verifyToken from '../middleware/verifyToken.js';
import checkRole from '../middleware/checkRole.js';

const router = express.Router();

// All IT Admin routes require authentication and IT Admin role
router.use(verifyToken);
router.use(checkRole(['itAdmin']));

// Apply request tracking middleware
router.use(trackRequest);

// User Management Routes
router.post('/create-user', createUser);
router.put('/update-user/:id', updateUser);
router.post('/reset-password/:id', resetPassword);
router.get('/users', getUsers);
router.delete('/delete-user/:id', deleteUser);

// System Health Routes
router.get('/system-health', getSystemHealth);
router.get('/dashboard', getDashboardOverview);

// Audit Log Routes
router.get('/audit-logs', getAuditLogs);
router.get('/audit-stats', getAuditStats);

export default router;