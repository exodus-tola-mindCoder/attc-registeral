import express from 'express';
import {
  createSchedule,
  getStudentSchedule,
  getInstructorSchedule,
  getDepartmentSchedules,
  updateSchedule,
  deleteSchedule,
  getAvailableInstructors,
  getAvailableRooms,
  getCourseSchedule,
  getScheduleStats
} from '../controllers/scheduleController.js';
import verifyToken from '../middleware/verifyToken.js';
import checkRole from '../middleware/checkRole.js';

const router = express.Router();

// All schedule routes require authentication
router.use(verifyToken);

// Department Head and Registrar routes
router.post('/create', checkRole(['departmentHead', 'registrar']), createSchedule);
router.get('/department', checkRole(['departmentHead', 'registrar']), getDepartmentSchedules);
router.put('/:scheduleId', checkRole(['departmentHead', 'registrar']), updateSchedule);
router.delete('/:scheduleId', checkRole(['departmentHead', 'registrar']), deleteSchedule);
router.get('/available-instructors', checkRole(['departmentHead', 'registrar']), getAvailableInstructors);
router.get('/available-rooms', checkRole(['departmentHead', 'registrar']), getAvailableRooms);
router.get('/stats', checkRole(['departmentHead', 'registrar']), getScheduleStats);

// Student routes
router.get('/student', checkRole(['student']), getStudentSchedule);

// Instructor routes
router.get('/instructor', checkRole(['instructor']), getInstructorSchedule);

// Course schedule (accessible by all roles)
router.get('/course/:courseId', getCourseSchedule);

export default router;