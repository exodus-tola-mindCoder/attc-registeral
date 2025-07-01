import express from 'express';
import {
  generateRegistrationSlipPDF,
  generateTranscriptPDF
} from '../controllers/pdfController.js';
import verifyToken from '../middleware/verifyToken.js';
import checkRole from '../middleware/checkRole.js';

const router = express.Router();

// All PDF routes require authentication
router.use(verifyToken);

// Student routes
router.get('/student/registration-slip/:registrationId', checkRole(['student']), generateRegistrationSlipPDF);
router.get('/student/transcript-pdf', checkRole(['student']), generateTranscriptPDF);

export default router;