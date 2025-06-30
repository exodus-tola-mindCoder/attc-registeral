import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';
import RegistrationPeriod from '../models/RegistrationPeriod.model.js';
import { cleanupUploadedFiles } from '../middleware/fileUploadMiddleware.js';

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h'
  });
};

// @desc    Generate institutional email for freshman
// @route   POST /api/auth/generate-email
// @access  Public
export const generateEmail = async (req, res) => {
  try {
    const { firstName, fatherName } = req.body;

    // Validation
    if (!firstName || !fatherName) {
      return res.status(400).json({
        success: false,
        message: 'First name and father name are required'
      });
    }

    // Validate name format (only letters and spaces)
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(firstName) || !nameRegex.test(fatherName)) {
      return res.status(400).json({
        success: false,
        message: 'Names can only contain letters and spaces'
      });
    }

    // Check if signup period is open
    const isSignupOpen = await RegistrationPeriod.isRegistrationOpen('signup', 'Freshman');
    if (!isSignupOpen) {
      return res.status(403).json({
        success: false,
        message: 'Freshman registration is currently closed. Please contact the registrar\'s office.'
      });
    }

    // Generate unique institutional email
    const email = await User.generateInstitutionalEmail(firstName, fatherName);

    res.status(200).json({
      success: true,
      message: 'Institutional email generated successfully',
      data: {
        email,
        expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString() // 2 minutes from now
      }
    });

  } catch (error) {
    console.error('Email generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate institutional email',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Register a new freshman student
// @route   POST /api/auth/signup
// @access  Public (only for freshman students)
export const signup = async (req, res) => {
  try {
    const { firstName, fatherName, grandfatherName, email, password, confirmPassword } = req.body;

    // Check if signup period is open
    const isSignupOpen = await RegistrationPeriod.isRegistrationOpen('signup', 'Freshman');
    if (!isSignupOpen) {
      cleanupUploadedFiles(req.files);
      return res.status(403).json({
        success: false,
        message: 'Freshman registration is currently closed. Please contact the registrar\'s office.'
      });
    }

    // Validation
    if (!firstName || !fatherName || !grandfatherName || !email || !password || !confirmPassword) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'All fields are required: firstName, fatherName, grandfatherName, email, password, confirmPassword'
      });
    }

    // Validate name format
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(firstName) || !nameRegex.test(fatherName) || !nameRegex.test(grandfatherName)) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Names can only contain letters and spaces'
      });
    }

    // Validate password match
    if (password !== confirmPassword) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Validate password length
    if (password.length < 6) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Validate email format (must be institutional email)
    if (!email.endsWith('@attc.edu.et')) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Invalid institutional email format'
      });
    }

    // Verify the email was generated for these names
    const expectedEmail = await User.generateInstitutionalEmail(firstName, fatherName);
    if (email !== expectedEmail) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Email does not match the generated institutional email for the provided names'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'A student with this email already exists'
      });
    }

    // Validate file uploads
    if (!req.files || !req.files.grade11Transcript || !req.files.grade12Transcript || !req.files.entranceExamResult) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'All three PDF documents are required: Grade 11 transcript, Grade 12 transcript, and University entrance exam result'
      });
    }

    // Get current year for enrollment
    const currentYear = new Date().getFullYear();

    // Generate student ID for freshman (format: FRESH-YEAR-XXXX)
    const studentCount = await User.countDocuments({
      currentYear: 1,
      enrollmentYear: currentYear,
      role: 'student'
    });

    const studentId = `FRESH-${currentYear}-${String(studentCount + 1).padStart(4, '0')}`;

    // Create new freshman user
    const user = new User({
      firstName: firstName.trim(),
      fatherName: fatherName.trim(),
      grandfatherName: grandfatherName.trim(),
      email,
      password,
      role: 'student',
      currentYear: 1, // Freshman
      currentSemester: 1, // First semester
      enrollmentYear: currentYear,
      studentId,
      mustChangePassword: false,
      grade11Transcript: req.files.grade11Transcript[0].path,
      grade12Transcript: req.files.grade12Transcript[0].path,
      entranceExamResult: req.files.entranceExamResult[0].path
    });

    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Freshman registration successful! Please login with your institutional email.',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          fatherName: user.fatherName,
          grandfatherName: user.grandfatherName,
          email: user.email,
          role: user.role,
          currentYear: user.currentYear,
          currentSemester: user.currentSemester,
          studentId: user.studentId,
          enrollmentYear: user.enrollmentYear
        },
        token
      }
    });

  } catch (error) {
    console.error('Signup error:', error);

    // Clean up uploaded files in case of error
    cleanupUploadedFiles(req.files);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email or student ID already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user account is active
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: `Account is ${user.status}. Please contact the registrar office.`
      });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    // Prepare user data (password excluded by toJSON transform)
    const userData = user.toJSON();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userData,
        token,
        mustChangePassword: user.mustChangePassword
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
export const getProfile = async (req, res) => {
  try {
    // User is attached to req by verifyToken middleware
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: user.toJSON()
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Find user with password
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};