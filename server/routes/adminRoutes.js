import express from 'express';
import { signup, login, getProfile, changePassword, generateEmail } from '../controllers/authController.js';
import verifyToken from '../middleware/verifyToken.js';
import { uploadTranscripts, handleUploadErrors } from '../middleware/fileUploadMiddleware.js';

const router = express.Router();

// Public routes
router.post('/generate-email', generateEmail);
router.post('/signup', uploadTranscripts, handleUploadErrors, signup);
router.post('/login', login);

// Protected routes
router.get('/profile', verifyToken, getProfile);
router.put('/change-password', verifyToken, changePassword);

export default router;