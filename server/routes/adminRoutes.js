import express from 'express';
import { importSeniorStudents, getImportTemplate } from '../controllers/importController.js';
import verifyToken from '../middleware/verifyToken.js';
import checkRole from '../middleware/checkRole.js';
import { uploadExcelFile, handleExcelUploadErrors } from '../middleware/excelUploadMiddleware.js';

const router = express.Router();

// All admin routes require authentication and IT Admin role
router.use(verifyToken);
router.use(checkRole(['itAdmin']));

// @desc    Import senior students from Excel
// @route   POST /api/admin/import-seniors
// @access  Private (IT Admin only)
router.post('/import-seniors', uploadExcelFile, handleExcelUploadErrors, importSeniorStudents);

// @desc    Get import template information
// @route   GET /api/admin/import-template
// @access  Private (IT Admin only)
router.get('/import-template', getImportTemplate);

export default router;