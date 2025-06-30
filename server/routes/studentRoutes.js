import express from 'express';
import {
  getAvailableCourses,
  registerForSemester,
  getStudentRegistrations,
  downloadRegistrationSlip,
  cancelRegistration,
  getRegistrationStats
} from '../controllers/registrationController.js';
import verifyToken from '../middleware/verifyToken.js';
import checkRole from '../middleware/checkRole.js';

const router = express.Router();

// All student routes require authentication
router.use(verifyToken);

// Student-only routes
router.get('/available-courses', checkRole(['student']), getAvailableCourses);
router.post('/register-semester', checkRole(['student']), registerForSemester);
router.get('/registrations', checkRole(['student']), getStudentRegistrations);
router.get('/registration-slip/:registrationId', checkRole(['student']), downloadRegistrationSlip);
router.delete('/registration/:registrationId', checkRole(['student']), cancelRegistration);

// Admin/Staff routes for statistics
router.get('/registration-stats', checkRole(['registrar', 'itAdmin', 'president']), getRegistrationStats);

export default router;