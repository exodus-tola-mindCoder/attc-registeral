import express from 'express';
import {
  exportGrades,
  exportProbationList,
  exportDismissedList,
  exportEvaluationReports,
  exportAcademicReport
} from '../controllers/excelExportController.js';
import verifyToken from '../middleware/verifyToken.js';
import checkRole from '../middleware/checkRole.js';

const router = express.Router();

// All Excel export routes require authentication
router.use(verifyToken);

// Registrar routes
router.get('/registrar/export-grades', checkRole(['registrar']), exportGrades);
router.get('/registrar/export-probation', checkRole(['registrar']), exportProbationList);
router.get('/registrar/export-dismissed', checkRole(['registrar']), exportDismissedList);
router.get('/registrar/export-evaluations', checkRole(['registrar']), exportEvaluationReports);
router.get('/registrar/export-academic-report', checkRole(['registrar']), exportAcademicReport);

// Admin routes (IT Admin can also export)
router.get('/admin/export-grades', checkRole(['itAdmin']), exportGrades);
router.get('/admin/export-probation', checkRole(['itAdmin']), exportProbationList);
router.get('/admin/export-dismissed', checkRole(['itAdmin']), exportDismissedList);
router.get('/admin/export-evaluations', checkRole(['itAdmin']), exportEvaluationReports);
router.get('/admin/export-academic-report', checkRole(['itAdmin']), exportAcademicReport);

export default router;