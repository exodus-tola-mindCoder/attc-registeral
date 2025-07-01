import RegistrationPeriod from '../models/RegistrationPeriod.model.js';
import AuditLog from '../models/AuditLog.model.js';
import { createNotification } from '../utils/notificationUtils.js';
import User from '../models/User.model.js';

// @desc    Create or update registration period
// @route   POST /api/admin/registration-period
// @access  Private (Registrar, IT Admin)
export const createRegistrationPeriod = async (req, res) => {
  try {
    const {
      type,
      academicYear,
      semester,
      department = 'All',
      startDate,
      endDate,
      isActive = true,
      notes
    } = req.body;

    // Validation
    if (!type || !academicYear || !semester || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Check if period already exists
    const existingPeriod = await RegistrationPeriod.findOne({
      type,
      academicYear,
      semester,
      department
    });

    let period;

    if (existingPeriod) {
      // Update existing period
      existingPeriod.startDate = new Date(startDate);
      existingPeriod.endDate = new Date(endDate);
      existingPeriod.isActive = isActive;
      existingPeriod.updatedBy = req.user.id;
      existingPeriod.notes = notes;

      period = await existingPeriod.save();
    } else {
      // Create new period
      period = await RegistrationPeriod.create({
        type,
        academicYear,
        semester,
        department,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive,
        createdBy: req.user.id,
        notes
      });
    }

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: existingPeriod ? 'REGISTRATION_PERIOD_UPDATED' : 'REGISTRATION_PERIOD_CREATED',
      targetId: period._id,
      targetModel: 'RegistrationPeriod',
      targetName: `${type} - ${academicYear} - Semester ${semester}`,
      category: 'data_modification',
      severity: 'medium',
      details: {
        type,
        academicYear,
        semester,
        department,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Send notifications to affected students if period is active
    if (isActive) {
      try {
        // Find students to notify
        const query = { role: 'student', status: 'active' };

        if (department !== 'All') {
          if (department === 'Freshman') {
            query.currentYear = 1;
          } else {
            query.department = department;
          }
        }

        if (type === 'courseRegistration') {
          // For course registration, add year and semester filters
          if (department === 'Freshman') {
            query.currentYear = 1;
            query.currentSemester = semester;
          } else {
            query.currentYear = { $gte: 1 };
            query.currentSemester = semester;
          }
        }

        const students = await User.find(query).select('_id');

        if (students.length > 0) {
          const notificationTitle = type === 'signup'
            ? 'Freshman Registration Period Open'
            : 'Course Registration Period Open';

          const notificationMessage = type === 'signup'
            ? `Freshman registration is now open until ${new Date(endDate).toLocaleDateString()}. Please complete your registration before the deadline.`
            : `Course registration for ${academicYear}, Semester ${semester} is now open until ${new Date(endDate).toLocaleDateString()}. Please register for your courses before the deadline.`;

          // Create notifications in batches to avoid overwhelming the system
          const batchSize = 100;
          for (let i = 0; i < students.length; i += batchSize) {
            const batch = students.slice(i, i + batchSize);

            await Promise.all(batch.map(student =>
              createNotification({
                recipientId: student._id,
                title: notificationTitle,
                message: notificationMessage,
                type: 'Deadline',
                link: type === 'signup' ? '/signup' : '/registration',
                sourceType: 'system',
                expiresAt: new Date(endDate),
                createdBy: req.user.id
              })
            ));
          }
        }
      } catch (notificationError) {
        console.error('Failed to send notifications:', notificationError);
        // Continue even if notifications fail
      }
    }

    res.status(201).json({
      success: true,
      message: `Registration period ${existingPeriod ? 'updated' : 'created'} successfully`,
      data: {
        period
      }
    });

  } catch (error) {
    console.error('Create registration period error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create registration period',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get all registration periods
// @route   GET /api/admin/registration-periods
// @access  Private (Registrar, IT Admin)
export const getRegistrationPeriods = async (req, res) => {
  try {
    const { type, academicYear, semester, department, isActive } = req.query;

    // Build query
    const query = {};
    if (type) query.type = type;
    if (academicYear) query.academicYear = academicYear;
    if (semester) query.semester = parseInt(semester);
    if (department) query.department = department;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const periods = await RegistrationPeriod.find(query)
      .populate('createdBy', 'firstName fatherName')
      .populate('updatedBy', 'firstName fatherName')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Registration periods retrieved successfully',
      data: {
        periods
      }
    });
  } catch (error) {
    console.error('Get registration periods error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve registration periods',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get registration period by ID
// @route   GET /api/admin/registration-period/:id
// @access  Private (Registrar, IT Admin)
export const getRegistrationPeriodById = async (req, res) => {
  try {
    const { id } = req.params;

    const period = await RegistrationPeriod.findById(id)
      .populate('createdBy', 'firstName fatherName')
      .populate('updatedBy', 'firstName fatherName');

    if (!period) {
      return res.status(404).json({
        success: false,
        message: 'Registration period not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Registration period retrieved successfully',
      data: {
        period
      }
    });
  } catch (error) {
    console.error('Get registration period error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve registration period',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Delete registration period
// @route   DELETE /api/admin/registration-period/:id
// @access  Private (Registrar, IT Admin)
export const deleteRegistrationPeriod = async (req, res) => {
  try {
    const { id } = req.params;

    const period = await RegistrationPeriod.findById(id);

    if (!period) {
      return res.status(404).json({
        success: false,
        message: 'Registration period not found'
      });
    }

    await RegistrationPeriod.findByIdAndDelete(id);

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'REGISTRATION_PERIOD_DELETED',
      targetId: id,
      targetModel: 'RegistrationPeriod',
      targetName: `${period.type} - ${period.academicYear} - Semester ${period.semester}`,
      category: 'data_modification',
      severity: 'high',
      details: {
        type: period.type,
        academicYear: period.academicYear,
        semester: period.semester,
        department: period.department
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      message: 'Registration period deleted successfully'
    });
  } catch (error) {
    console.error('Delete registration period error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete registration period',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Check if registration is open
// @route   GET /api/registration-period/check
// @access  Public
export const checkRegistrationPeriod = async (req, res) => {
  try {
    const { type, department = 'All' } = req.query;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Type parameter is required'
      });
    }

    const periodDetails = await RegistrationPeriod.getPeriodDetails(type, department);

    res.status(200).json({
      success: true,
      message: 'Registration period status retrieved successfully',
      data: periodDetails
    });
  } catch (error) {
    console.error('Check registration period error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check registration period',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};