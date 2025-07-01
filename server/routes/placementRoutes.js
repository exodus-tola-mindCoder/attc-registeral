import express from 'express';
import {
  submitPlacementRequest,
  getPlacementStatus,
  getPendingPlacements,
  reviewPlacementRequest,
  getPlacementStats,
  bulkApprovePlacements
} from '../controllers/placementController.js';
import verifyToken from '../middleware/verifyToken.js';
import checkRole from '../middleware/checkRole.js';

const router = express.Router();

// All placement routes require authentication
router.use(verifyToken);

// Student routes
router.post('/student/submit-placement', checkRole(['student']), submitPlacementRequest);
router.get('/student/placement-status', checkRole(['student']), getPlacementStatus);

// Committee routes (Department Head, Registrar, Placement Committee)
router.get('/committee/pending-placements', checkRole(['departmentHead', 'registrar', 'placementCommittee']), getPendingPlacements);
router.put('/committee/review-placement/:requestId', checkRole(['departmentHead', 'registrar', 'placementCommittee']), reviewPlacementRequest);
router.post('/committee/bulk-approve-placements', checkRole(['departmentHead', 'registrar', 'placementCommittee']), bulkApprovePlacements);

// Admin/Registrar routes for statistics
router.get('/admin/placement-stats', checkRole(['registrar', 'itAdmin', 'president']), getPlacementStats);

export default router;