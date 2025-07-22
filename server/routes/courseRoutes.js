import express from 'express';
import {
  addCourses,
  getCourses,
  updateCourse,
  deleteCourse,
  bulkReplaceCourses,
  getDepartmentStats
} from '../controllers/courseController.js';
import verifyToken from '../middleware/verifyToken.js';
import checkRole from '../middleware/checkRole.js';
import { validateAddCourses } from '../validators/courseValidators.js';

const router = express.Router();

// All course routes require authentication and Department Head role
router.use(verifyToken);
router.use(checkRole(['departmentHead']));

// @desc    Add or update courses for a department/year/semester
// @route   POST /api/depthead/courses
// @access  Private (Department Head only)
router.post('/', validateAddCourses, addCourses);

// @desc    Get courses for a specific department/year/semester
// @route   GET /api/depthead/courses
// @access  Private (Department Head only)
router.get('/', getCourses);

// @desc    Update a specific course
// @route   PUT /api/depthead/courses/:courseId
// @access  Private (Department Head only)
router.put('/:courseId', updateCourse);

// @desc    Delete a specific course
// @route   DELETE /api/depthead/courses/:courseId
// @access  Private (Department Head only)
router.delete('/:courseId', deleteCourse);

// @desc    Bulk replace courses for a semester
// @route   POST /api/depthead/courses/bulk-replace
// @access  Private (Department Head only)
router.post('/bulk-replace', bulkReplaceCourses);

// @desc    Get all departments with course statistics
// @route   GET /api/depthead/departments-stats
// @access  Private (Department Head only)
router.get('/departments-stats', getDepartmentStats);

export default router;