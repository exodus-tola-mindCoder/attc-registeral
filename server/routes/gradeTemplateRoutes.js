import express from 'express';
import { downloadGradeTemplate } from '../controllers/gradeTemplateController.js';
const router = express.Router();
router.get('/template/:courseId', downloadGradeTemplate);
export default router;
