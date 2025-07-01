import express from 'express';
import { downloadTranscript, generateTranscriptForAdmin } from '../controllers/transcriptController.js';
import verifyToken from '../middleware/verifyToken.js';
import checkRole from '../middleware/checkRole.js';

const router = express.Router();

// All transcript routes require authentication
router.use(verifyToken);

// Student route to download their own transcript
router.get('/download', checkRole(['student']), downloadTranscript);

// Admin route for registrar to generate transcript for any student
router.get('/admin/:studentId', checkRole(['registrar', 'itAdmin', 'graduationCommittee']), generateTranscriptForAdmin);

export default router;