import express from 'express';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  createBroadcast,
  getNotificationStats
} from '../controllers/notificationController.js';
import verifyToken from '../middleware/verifyToken.js';
import checkRole from '../middleware/checkRole.js';

const router = express.Router();

// All notification routes require authentication
router.use(verifyToken);

// User routes
router.get('/', getUserNotifications);
router.put('/:id/mark-read', markAsRead);
router.put('/mark-all-read', markAllAsRead);
router.delete('/:id', deleteNotification);

// Admin routes
router.post('/', checkRole(['itAdmin', 'registrar', 'departmentHead']), createNotification);
router.post('/broadcast', checkRole(['itAdmin', 'registrar']), createBroadcast);
router.get('/stats', checkRole(['itAdmin', 'registrar']), getNotificationStats);

export default router;