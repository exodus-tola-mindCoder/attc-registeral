import express from 'express';
import upload from '../middleware/gradeUploadMiddleware.js';
import { uploadGrades, downloadTemplate, getUploadHistory } from '../controllers/gradeUploadController.js';
import verifyToken from '../middleware/verifyToken.js';
import checkRole from '../middleware/checkRole.js';

const router = express.Router();

// All routes require authentication and instructor role
router.use(verifyToken);
router.use(checkRole(['instructor']));

// POST /api/grades/upload - Upload Excel file with grades
router.post('/upload', upload.single('file'), uploadGrades);

// GET /api/grades/template/:courseId - Download Excel template
router.get('/template/:courseId', downloadTemplate);

// GET /api/grades/upload-history - Get upload history for instructor
router.get('/upload-history', getUploadHistory);

export default router;
