import Course from '../models/Course.model.js';
import Registration from '../models/Registration.model.js';
import User from '../models/User.model.js';
import RegistrationPeriod from '../models/RegistrationPeriod.model.js';
import { generateRegistrationSlip } from '../utils/pdfGenerator.js';
import { createNotification } from '../utils/notificationUtils.js';

import fs from 'fs';

// @desc    Get available courses for student's current semester
// @route   GET /api/student/available-courses
// @access  Private (Student only)
export const getAvailableCourses = async (req, res) => {
  try {
    const student = await User.findById(req.user.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Determine department based on year
    const department = student.currentYear === 1 ? 'Freshman' : student.department;

    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Student department not assigned. Please contact the registrar office.'
      });
    }

    // Check if student is already registered for current semester
    const existingRegistration = await Registration.findOne({
      studentId: student._id,
      year: student.currentYear,
      semester: student.currentSemester
    });

    if (existingRegistration) {
      return res.status(200).json({
        success: true,
        message: 'Student already registered for this semester',
        data: {
          courses: [],
          alreadyRegistered: true,
          registration: existingRegistration
        }
      });
    }

    // Check if registration period is open
    const periodDetails = await RegistrationPeriod.getPeriodDetails('courseRegistration', department);

    // Get available courses
    const courses = await Course.getCoursesForSemester(
      department,
      student.currentYear,
      student.currentSemester
    );

    const totalCredits = courses.reduce((sum, course) => sum + course.credit, 0);

    res.status(200).json({
      success: true,
      message: `Available courses for ${department} - Year ${student.currentYear}, Semester ${student.currentSemester}`,
      data: {
        courses,
        summary: {
          courseCount: courses.length,
          totalCredits,
          department,
          year: student.currentYear,
          semester: student.currentSemester
        },
        alreadyRegistered: false,
        registrationPeriod: {
          isOpen: periodDetails.isOpen,
          message: periodDetails.message,
          period: periodDetails.period
        }
      }
    });

  } catch (error) {
    console.error('Get available courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve available courses',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Register student for all semester courses (one-click registration)
// @route   POST /api/student/register-semester
// @access  Private (Student only)
export const registerForSemester = async (req, res) => {
  try {
    const student = await User.findById(req.user.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Determine department based on year
    const department = student.currentYear === 1 ? 'Freshman' : student.department;

    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Student department not assigned. Please contact the registrar office.'
      });
    }

    // Check if registration period is open
    const isRegistrationOpen = await RegistrationPeriod.isRegistrationOpen('courseRegistration', department);
    if (!isRegistrationOpen) {
      return res.status(403).json({
        success: false,
        message: 'Course registration is currently closed. Please contact the registrar\'s office.'
      });
    }

    // Check if student is already registered for current semester
    const existingRegistration = await Registration.findOne({
      studentId: student._id,
      year: student.currentYear,
      semester: student.currentSemester
    });

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: `Already registered for Year ${student.currentYear}, Semester ${student.currentSemester}`,
        data: {
          existingRegistration
        }
      });
    }

    // Get available courses for the semester
    const availableCourses = await Course.getCoursesForSemester(
      department,
      student.currentYear,
      student.currentSemester
    );

    if (availableCourses.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No courses available for ${department} - Year ${student.currentYear}, Semester ${student.currentSemester}. Please contact the department head.`
      });
    }

    // Prepare courses for registration
    const coursesToRegister = availableCourses.map(course => ({
      courseId: course._id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      credit: course.credit,
      registrationDate: new Date()
    }));

    const totalCredits = coursesToRegister.reduce((sum, course) => sum + course.credit, 0);

    // Get academicYear from student or request (fallback to current year if not present)
    const academicYear = student.academicYear || req.body.academicYear || new Date().getFullYear();

    // Create registration record
    const registration = new Registration({
      studentId: student._id,
      department,
      year: student.currentYear,
      semester: student.currentSemester,
      academicYear,
      courses: coursesToRegister,
      totalCredits,
      status: 'registered'
    });

    await registration.save();

    // Generate registration slip PDF
    try {
      const slipPath = await generateRegistrationSlip(registration, student);
      registration.registrationSlipPath = slipPath;
      await registration.save();
    } catch (pdfError) {
      console.error('PDF generation error:', pdfError);
      // Continue without PDF - registration is still valid
    }

    // Send notification to student
    try {
      await createNotification({
        recipientId: student._id,
        title: 'Registration Successful',
        message: `You have successfully registered for Year ${student.currentYear}, Semester ${student.currentSemester}. Total courses: ${coursesToRegister.length}, Total credits: ${totalCredits}`,
        type: 'Info',
        link: '/registration',
        sourceType: 'registration',
        sourceId: registration._id,
        sourceModel: 'Registration'
      });
    } catch (notificationError) {
      console.error('Registration notification error:', notificationError);
      // Continue even if notification fails
    }

    console.log(`✅ Student registered for semester:`);
    console.log(`   👤 Student: ${student.firstName} ${student.fatherName} (${student.studentId})`);
    console.log(`   📚 Department: ${department}`);
    console.log(`   📅 Year ${student.currentYear}, Semester ${student.currentSemester}`);
    console.log(`   📊 Courses: ${coursesToRegister.length}, Credits: ${totalCredits}`);
    console.log(`   🆔 Registration: ${registration.registrationNumber}`);

    res.status(201).json({
      success: true,
      message: `Successfully registered for Year ${student.currentYear}, Semester ${student.currentSemester}`,
      data: {
        registration: {
          _id: registration._id,
          registrationNumber: registration.registrationNumber,
          department: registration.department,
          year: registration.year,
          semester: registration.semester,
          courses: registration.courses,
          totalCredits: registration.totalCredits,
          status: registration.status,
          registrationDate: registration.registrationDate,
          registrationSlipPath: registration.registrationSlipPath
        },
        summary: {
          coursesRegistered: coursesToRegister.length,
          totalCredits,
          registrationDate: registration.registrationDate
        }
      }
    });

  } catch (error) {
    console.error('Register for semester error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Already registered for this semester'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get student's registration history
// @route   GET /api/student/registrations
// @access  Private (Student only)
export const getStudentRegistrations = async (req, res) => {
  try {
    const registrations = await Registration.getStudentHistory(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Registration history retrieved successfully',
      data: {
        registrations,
        summary: {
          totalRegistrations: registrations.length,
          completedSemesters: registrations.filter(reg => reg.status === 'completed').length,
          activeSemesters: registrations.filter(reg => reg.status === 'registered').length
        }
      }
    });

  } catch (error) {
    console.error('Get student registrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve registration history',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Download registration slip PDF
// @route   GET /api/student/registration-slip/:registrationId
// @access  Private (Student only)
export const downloadRegistrationSlip = async (req, res) => {
  try {
    const { registrationId } = req.params;

    const registration = await Registration.findOne({
      _id: registrationId,
      studentId: req.user.id
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Check if PDF exists
    if (!registration.registrationSlipPath || !fs.existsSync(registration.registrationSlipPath)) {
      // Generate PDF if it doesn't exist
      try {
        const student = await User.findById(req.user.id);
        const slipPath = await generateRegistrationSlip(registration, student);
        registration.registrationSlipPath = slipPath;
        await registration.save();
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
        return res.status(500).json({
          success: false,
          message: 'Failed to generate registration slip'
        });
      }
    }

    // Send PDF file
    const filename = registration.getSlipFilename();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const fileStream = fs.createReadStream(registration.registrationSlipPath);
    fileStream.pipe(res);

    console.log(`📄 Registration slip downloaded: ${filename} by ${req.user.firstName} ${req.user.fatherName}`);

  } catch (error) {
    console.error('Download registration slip error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download registration slip',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Cancel registration (if allowed)
// @route   DELETE /api/student/registration/:registrationId
// @access  Private (Student only)
export const cancelRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;

    const registration = await Registration.findOne({
      _id: registrationId,
      studentId: req.user.id
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Check if registration can be cancelled
    if (!registration.canBeModified()) {
      return res.status(400).json({
        success: false,
        message: 'Registration cannot be cancelled. Time limit exceeded or status changed.'
      });
    }

    registration.status = 'cancelled';
    await registration.save();

    // Send notification to student
    try {
      await createNotification({
        recipientId: req.user.id,
        title: 'Registration Cancelled',
        message: `Your registration for Year ${registration.year}, Semester ${registration.semester} has been cancelled.`,
        type: 'Info',
        link: '/registration',
        sourceType: 'registration',
        sourceId: registration._id,
        sourceModel: 'Registration'
      });
    } catch (notificationError) {
      console.error('Registration cancellation notification error:', notificationError);
      // Continue even if notification fails
    }

    console.log(`❌ Registration cancelled: ${registration.registrationNumber} by ${req.user.firstName} ${req.user.fatherName}`);

    res.status(200).json({
      success: true,
      message: 'Registration cancelled successfully',
      data: {
        registration
      }
    });

  } catch (error) {
    console.error('Cancel registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel registration',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get registration statistics (for admin/staff)
// @route   GET /api/admin/registration-stats
// @access  Private (Admin/Staff only)
export const getRegistrationStats = async (req, res) => {
  try {
    const { department, year, semester } = req.query;

    let matchQuery = {};

    if (department) matchQuery.department = department;
    if (year) matchQuery.year = parseInt(year);
    if (semester) matchQuery.semester = parseInt(semester);

    const stats = await Registration.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            department: '$department',
            year: '$year',
            semester: '$semester',
            status: '$status'
          },
          count: { $sum: 1 },
          totalCredits: { $sum: '$totalCredits' },
          averageCredits: { $avg: '$totalCredits' }
        }
      },
      {
        $group: {
          _id: {
            department: '$_id.department',
            year: '$_id.year',
            semester: '$_id.semester'
          },
          statusBreakdown: {
            $push: {
              status: '$_id.status',
              count: '$count',
              totalCredits: '$totalCredits',
              averageCredits: '$averageCredits'
            }
          },
          totalRegistrations: { $sum: '$count' }
        }
      },
      {
        $sort: {
          '_id.department': 1,
          '_id.year': 1,
          '_id.semester': 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      message: 'Registration statistics retrieved successfully',
      data: {
        stats,
        filters: {
          department: department || 'All',
          year: year || 'All',
          semester: semester || 'All'
        }
      }
    });

  } catch (error) {
    console.error('Get registration stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve registration statistics',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Open registration for a semester
// @route   POST /api/admin/open-registration
// @access  Private (Registrar only)
export const openRegistration = async (req, res) => {
  try {
    const { department, year, semester, academicYear, deadline } = req.body;

    if (!department || !year || !semester || !academicYear) {
      return res.status(400).json({
        success: false,
        message: 'Department, year, semester, and academic year are required'
      });
    }

    // Create or update registration period
    const period = await RegistrationPeriod.findOneAndUpdate(
      {
        type: 'courseRegistration',
        academicYear,
        semester,
        department
      },
      {
        startDate: new Date(),
        endDate: deadline ? new Date(deadline) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Default to 2 weeks
        isActive: true,
        createdBy: req.user.id,
        updatedBy: req.user.id,
        notes: `Registration opened by ${req.user.firstName} ${req.user.fatherName}`
      },
      {
        new: true,
        upsert: true
      }
    );

    // Find all students in this department and year
    const students = await User.find({
      role: 'student',
      department,
      currentYear: year,
      currentSemester: semester,
      status: 'active'
    });

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No eligible students found for this registration period'
      });
    }

    // Send notifications to all eligible students
    let notificationCount = 0;
    for (const student of students) {
      try {
        await createNotification({
          recipientId: student._id,
          title: 'Course Registration Now Open',
          message: `Registration for ${department} - Year ${year}, Semester ${semester} (${academicYear}) is now open. ${deadline ? `Please register before ${new Date(deadline).toLocaleDateString()}.` : ''}`,
          type: 'Deadline',
          link: '/registration',
          sourceType: 'registration',
          expiresAt: deadline ? new Date(deadline) : undefined,
          createdBy: req.user.id
        });
        notificationCount++;
      } catch (notificationError) {
        console.error('Registration notification error:', notificationError);
        // Continue with next student even if one fails
      }
    }

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'REGISTRATION_OPENED',
      category: 'system_operation',
      severity: 'medium',
      details: {
        department,
        year,
        semester,
        academicYear,
        deadline: deadline || 'Not specified',
        eligibleStudents: students.length,
        notificationsSent: notificationCount
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    console.log(`🔔 Registration opened: ${department} - Year ${year}, Semester ${semester} (${academicYear})`);
    console.log(`   👤 Opened by: ${req.user.firstName} ${req.user.fatherName}`);
    console.log(`   📊 Eligible students: ${students.length}, Notifications sent: ${notificationCount}`);

    res.status(200).json({
      success: true,
      message: 'Registration period opened successfully',
      data: {
        period,
        eligibleStudents: students.length,
        notificationsSent: notificationCount,
        department,
        year,
        semester,
        academicYear,
        deadline: deadline || 'Not specified'
      }
    });

  } catch (error) {
    console.error('Open registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to open registration period',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};