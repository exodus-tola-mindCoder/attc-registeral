import express from 'express';
import {
  submitEvaluation,
  getEvaluationStatus,
  getEvaluationQuestions,
  getInstructorEvaluations,
  getDepartmentEvaluations,
  getPresidentEvaluationReports,
  checkRegistrationEligibility
} from '../controllers/evaluationController.js';
import verifyToken from '../middleware/verifyToken.js';
import checkRole from '../middleware/checkRole.js';

const router = express.Router();

// All evaluation routes require authentication
router.use(verifyToken);

// Student routes
router.post('/student/submit-evaluation', checkRole(['student']), submitEvaluation);
router.get('/student/evaluation-status', checkRole(['student']), getEvaluationStatus);
router.get('/student/evaluation-questions', checkRole(['student']), getEvaluationQuestions);
router.get('/student/registration-eligibility', checkRole(['student']), checkRegistrationEligibility);

// Instructor routes
router.get('/instructor/evaluations', checkRole(['instructor']), getInstructorEvaluations);

// Department Head routes
router.get('/depthead/evaluations', checkRole(['departmentHead']), getDepartmentEvaluations);

// President routes (comprehensive reports)
router.get('/president/evaluations', checkRole(['president']), getPresidentEvaluationReports);

// Admin routes (for comprehensive reports)
router.get('/admin/evaluations', checkRole(['itAdmin', 'registrar']), getPresidentEvaluationReports);

export default router;