import express from 'express';
import {
  markAttendance,
  getStudentAttendance,
  getStudentAllAttendance,
  getCourseAttendanceReport,
  exportAttendanceReport,
  updateAttendance,
  getInstructorCourses,
  getStudentsForAttendance,
  getDepartmentAttendanceOverview,
  getAtRiskStudentsReport
} from '../controllers/attendanceController.js';
import verifyToken from '../middleware/verifyToken.js';
import checkRole from '../middleware/checkRole.js';

const router = express.Router();

// All attendance routes require authentication
router.use(verifyToken);

// Instructor routes
router.post('/mark', checkRole(['instructor']), markAttendance);
router.get('/instructor/courses', checkRole(['instructor']), getInstructorCourses);
router.get('/students/:courseId', checkRole(['instructor']), getStudentsForAttendance);

// Student routes
router.get('/:courseId', checkRole(['student']), getStudentAttendance);
router.get('/student/all', checkRole(['student']), getStudentAllAttendance);

// Department Head and Registrar routes
router.get('/report/:courseId', checkRole(['instructor', 'departmentHead', 'registrar']), getCourseAttendanceReport);
router.get('/export/:courseId', checkRole(['instructor', 'departmentHead', 'registrar']), exportAttendanceReport);
router.get('/department/overview', checkRole(['departmentHead', 'registrar']), getDepartmentAttendanceOverview);
router.get('/at-risk', checkRole(['departmentHead', 'registrar']), getAtRiskStudentsReport);

// Update attendance record
router.put('/:attendanceId', checkRole(['instructor', 'departmentHead', 'registrar']), updateAttendance);

export default router;