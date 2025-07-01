import express from 'express';
import {
  createRegistrationPeriod,
  getRegistrationPeriods,
  getRegistrationPeriodById,
  deleteRegistrationPeriod,
  checkRegistrationPeriod
} from '../controllers/registrationPeriodController.js';
import verifyToken from '../middleware/verifyToken.js';
import checkRole from '../middleware/checkRole.js';

const router = express.Router();

// Public route to check if registration is open
router.get('/check', checkRegistrationPeriod);

// Protected routes
router.use(verifyToken);

// Admin routes
router.post(
  '/',
  checkRole(['registrar', 'itAdmin']),
  createRegistrationPeriod
);

router.get(
  '/',
  checkRole(['registrar', 'itAdmin']),
  getRegistrationPeriods
);

router.get(
  '/:id',
  checkRole(['registrar', 'itAdmin']),
  getRegistrationPeriodById
);

router.delete(
  '/:id',
  checkRole(['registrar', 'itAdmin']),
  deleteRegistrationPeriod
);

export default router;