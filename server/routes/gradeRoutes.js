import express from 'express';
import {
  submitGrade,
  getInstructorGrades,
  approveGrade,
  getPendingGrades,
  finalizeGrade,
  lockGrades,
  getStudentGrades,
  getGradeReports
} from '../controllers/gradeController.js';
import verifyToken from '../middleware/verifyToken.js';
import checkRole from '../middleware/checkRole.js';

const router = express.Router();

// All grade routes require authentication
router.use(verifyToken);

// Instructor routes
router.post('/instructor/submit-grade', checkRole(['instructor']), submitGrade);
router.get('/instructor/grades', checkRole(['instructor']), getInstructorGrades);

// Department Head routes
router.put('/depthead/approve-grade/:gradeId', checkRole(['departmentHead']), approveGrade);
router.get('/depthead/pending-grades', checkRole(['departmentHead']), getPendingGrades);

// Registrar routes
router.put('/registrar/finalize-grade/:gradeId', checkRole(['registrar']), finalizeGrade);
router.put('/registrar/lock-grades', checkRole(['registrar']), lockGrades);

// Student routes
router.get('/student/grades', checkRole(['student']), getStudentGrades);

// President routes (view-only)
router.get('/president/reports', checkRole(['president']), getGradeReports);

// Admin routes (for comprehensive reports)
router.get('/admin/reports', checkRole(['itAdmin', 'registrar']), getGradeReports);

export default router;