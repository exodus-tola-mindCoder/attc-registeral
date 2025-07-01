import express from 'express';
import {
  submitFinalProject,
  approveFinalProject,
  submitInternship,
  approveInternship,
  markClearanceStatus,
  checkGraduationEligibility,
  approveGraduation,
  getEligibleStudents,
  getGraduationStatus,
  getGraduatedStudents,
  getGraduationStats
} from '../controllers/graduationController.js';
import verifyToken from '../middleware/verifyToken.js';
import checkRole from '../middleware/checkRole.js';
import { uploadPDFFiles } from '../middleware/fileUploadMiddleware.js';
import { handleUploadErrors } from '../middleware/errorHandlingMiddleware.js';

const router = express.Router();

// All graduation routes require authentication
router.use(verifyToken);

// Final Project Routes
router.post(
  '/finalproject/submit',
  checkRole(['student']),
  uploadPDFFiles([{ name: 'projectFile', maxCount: 1 }]),
  // handleUploadErrors,
  submitFinalProject
);

router.post(
  '/finalproject/approve/:studentId',
  checkRole(['instructor', 'departmentHead', 'graduationCommittee']),
  approveFinalProject
);

// Internship Routes
router.post(
  '/internship/submit',
  checkRole(['student']),
  uploadPDFFiles([{ name: 'internshipDocument', maxCount: 1 }]),
  handleUploadErrors,
  submitInternship
);

router.post(
  '/internship/approve/:studentId',
  checkRole(['departmentHead', 'graduationCommittee']),
  approveInternship
);

// Clearance Routes
router.post(
  '/clearance/mark/:studentId',
  checkRole(['registrar']),
  markClearanceStatus
);

// Graduation Routes
router.get(
  '/check/:studentId',
  checkRole(['student', 'registrar', 'graduationCommittee']),
  checkGraduationEligibility
);

router.post(
  '/approve/:studentId',
  checkRole(['graduationCommittee']),
  approveGraduation
);

router.get(
  '/eligible',
  checkRole(['registrar', 'graduationCommittee']),
  getEligibleStudents
);

router.get(
  '/status/:studentId',
  checkRole(['student', 'registrar', 'graduationCommittee']),
  getGraduationStatus
);

router.get(
  '/graduated',
  checkRole(['registrar', 'graduationCommittee', 'president']),
  getGraduatedStudents
);

router.get(
  '/stats',
  checkRole(['registrar', 'graduationCommittee', 'president']),
  getGraduationStats
);

export default router;