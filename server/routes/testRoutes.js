import express from 'express';
import verifyToken from '../middleware/verifyToken.js';
import checkRole from '../middleware/checkRole.js';

const router = express.Router();

// @desc    Test protected route with token verification
// @route   GET /api/test/protected
// @access  Private
router.get('/protected', verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Access granted! Token is valid.',
    data: {
      user: req.user,
      timestamp: new Date().toISOString()
    }
  });
});

// @desc    Test student-only route
// @route   GET /api/test/student-only
// @access  Private (Students only)
router.get('/student-only', verifyToken, checkRole(['student']), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome, student! You have access to student features.',
    data: {
      user: req.user,
      availableFeatures: [
        'Course Registration',
        'View Grades',
        'Academic Calendar',
        'Student Profile'
      ]
    }
  });
});

// @desc    Test admin-only route
// @route   GET /api/test/admin-only
// @access  Private (IT Admins only)
router.get('/admin-only', verifyToken, checkRole(['itAdmin']), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome, admin! You have access to administrative features.',
    data: {
      user: req.user,
      availableFeatures: [
        'User Management',
        'System Configuration',
        'Database Administration',
        'Security Settings'
      ]
    }
  });
});

// @desc    Test multi-role route
// @route   GET /api/test/staff-only
// @access  Private (Department Head, Registrar, IT Admin, President)
router.get('/staff-only', verifyToken, checkRole(['departmentHead', 'registrar', 'itAdmin', 'president']), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome, staff member! You have access to staff features.',
    data: {
      user: req.user,
      role: req.user.role,
      availableFeatures: {
        departmentHead: ['Manage Courses', 'Student Analytics', 'Faculty Management'],
        registrar: ['Student Records', 'Enrollment Management', 'Academic Reports'],
        itAdmin: ['System Administration', 'User Management', 'Technical Support'],
        president: ['Executive Dashboard', 'Strategic Reports', 'Institution Overview']
      }[req.user.role] || []
    }
  });
});

// @desc    Test route info
// @route   GET /api/test/info
// @access  Public
router.get('/info', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ATTC College Management System - Test Routes',
    availableRoutes: {
      public: [
        'GET /api/test/info - This information page'
      ],
      protected: [
        'GET /api/test/protected - Basic token verification test',
        'GET /api/test/student-only - Student role access test',
        'GET /api/test/admin-only - IT Admin role access test',
        'GET /api/test/staff-only - Staff roles access test'
      ]
    },
    roles: {
      student: 'Can access student-specific features',
      instructor: 'Can access teaching and grading features',
      departmentHead: 'Can manage department courses and students',
      registrar: 'Can manage student records and enrollment',
      itAdmin: 'Can manage system and users',
      president: 'Can access executive dashboard and reports'
    }
  });
});

export default router;