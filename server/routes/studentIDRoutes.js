import express from 'express';
import {
  generateStudentID,
  bulkGenerateStudentIDs,
  uploadStudentPhoto,
  deactivateStudentID,
  verifyStudentID,
  getStudentIDStatus
} from '../controllers/studentIDController.js';
import verifyToken from '../middleware/verifyToken.js';
import checkRole from '../middleware/checkRole.js';
import { uploadImageFile, handleImageUploadErrors } from '../middleware/imageUploadMiddleware.js';

const router = express.Router();

// Public route for ID verification
router.get('/verify/:studentIdNumber', verifyStudentID);

// Protected routes
router.use(verifyToken);

// Student routes
router.get('/status', checkRole(['student']), getStudentIDStatus);
router.post('/upload-photo', checkRole(['student']), uploadImageFile, handleImageUploadErrors, uploadStudentPhoto);
router.get('/generate/:studentId', checkRole(['student', 'itAdmin', 'registrar']), generateStudentID);

// Admin routes
router.post('/bulk-generate', checkRole(['itAdmin', 'registrar']), bulkGenerateStudentIDs);
router.put('/deactivate/:studentId', checkRole(['itAdmin', 'registrar']), deactivateStudentID);

export default router;