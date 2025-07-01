import Student from '../models/Student.model.js';
import AuditLog from '../models/AuditLog.model.js';
import { createNotification } from '../utils/notificationUtils.js';
import fs from 'fs';
import { cleanupUploadedFiles } from '../middleware/fileUploadMiddleware.js';

// Ensure uploads directory exists
const uploadsDir = 'uploads/final-projects';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const internshipUploadsDir = 'uploads/internships';
if (!fs.existsSync(internshipUploadsDir)) {
  fs.mkdirSync(internshipUploadsDir, { recursive: true });
}

// @desc    Submit final year project
// @route   POST /api/finalproject/submit
// @access  Private (Student only)
export const submitFinalProject = async (req, res) => {
  try {
    const { title, description, supervisorId } = req.body;

    // Validation
    if (!title || !description || !supervisorId) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Title, description, and supervisor are required'
      });
    }

    // Check if file was uploaded
    if (!req.files || !req.files.projectFile) {
      return res.status(400).json({
        success: false,
        message: 'Project file (PDF) is required'
      });
    }

    const student = await Student.findById(req.user.id);
    if (!student) {
      cleanupUploadedFiles(req.files);
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if student is in final year
    if (student.currentYear < 4) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Only final year students can submit final year projects'
      });
    }

    // Update student with project details
    student.finalProject = {
      title,
      description,
      filePath: req.files.projectFile[0].path,
      supervisor: supervisorId,
      submittedAt: new Date()
    };
    student.finalProjectStatus = 'Pending';

    await student.save();

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${student.firstName} ${student.fatherName}`,
      actorRole: 'student',
      action: 'FINAL_PROJECT_SUBMITTED',
      targetId: student._id,
      targetModel: 'Student',
      targetName: `${student.firstName} ${student.fatherName}`,
      category: 'data_modification',
      severity: 'medium',
      details: {
        projectTitle: title,
        supervisorId
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Send notification to supervisor
    try {
      await createNotification({
        recipientId: supervisorId,
        title: 'Final Year Project Submission',
        message: `${student.firstName} ${student.fatherName} has submitted their final year project "${title}" for your review.`,
        type: 'Info',
        link: '/graduation/projects',
        sourceType: 'graduation',
        sourceId: student._id,
        sourceModel: 'Student',
        createdBy: req.user.id
      });
    } catch (notificationError) {
      console.error('Project submission notification error:', notificationError);
      // Continue even if notification fails
    }

    res.status(200).json({
      success: true,
      message: 'Final year project submitted successfully',
      data: {
        finalProject: student.finalProject,
        status: student.finalProjectStatus
      }
    });

  } catch (error) {
    console.error('Submit final project error:', error);
    cleanupUploadedFiles(req.files);
    res.status(500).json({
      success: false,
      message: 'Failed to submit final year project',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Approve or reject final year project
// @route   POST /api/finalproject/approve/:studentId
// @access  Private (Instructor, Department Head, Graduation Committee)
export const approveFinalProject = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { decision, comments } = req.body;

    // Validation
    if (!decision || !['approve', 'reject'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Decision must be either "approve" or "reject"'
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if project is pending review
    if (student.finalProjectStatus !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot review project with status: ${student.finalProjectStatus}`
      });
    }

    // Update project status
    if (decision === 'approve') {
      student.finalProjectStatus = 'Approved';
      student.finalProject.approvedBy = req.user.id;
      student.finalProject.approvedAt = new Date();
      student.finalProject.comments = comments || 'Project approved';
      student.graduationChecklist.finalProjectApproved = true;
    } else {
      student.finalProjectStatus = 'Rejected';
      student.finalProject.rejectionReason = comments || 'Project rejected';
      student.finalProject.comments = comments || 'Project rejected';
      student.graduationChecklist.finalProjectApproved = false;
    }

    await student.save();

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: decision === 'approve' ? 'FINAL_PROJECT_APPROVED' : 'FINAL_PROJECT_REJECTED',
      targetId: student._id,
      targetModel: 'Student',
      targetName: `${student.firstName} ${student.fatherName}`,
      category: 'data_modification',
      severity: 'medium',
      details: {
        projectTitle: student.finalProject.title,
        decision,
        comments
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Send notification to student
    try {
      await createNotification({
        recipientId: student._id,
        title: `Final Year Project ${decision === 'approve' ? 'Approved' : 'Rejected'}`,
        message: decision === 'approve'
          ? `Your final year project "${student.finalProject.title}" has been approved.`
          : `Your final year project "${student.finalProject.title}" has been rejected. Reason: ${comments || 'No reason provided'}`,
        type: decision === 'approve' ? 'Info' : 'Warning',
        link: '/graduation/status',
        sourceType: 'graduation',
        sourceId: student._id,
        sourceModel: 'Student',
        createdBy: req.user.id
      });
    } catch (notificationError) {
      console.error('Project decision notification error:', notificationError);
      // Continue even if notification fails
    }

    res.status(200).json({
      success: true,
      message: `Final year project ${decision}d successfully`,
      data: {
        studentId: student._id,
        studentName: `${student.firstName} ${student.fatherName}`,
        projectTitle: student.finalProject.title,
        status: student.finalProjectStatus
      }
    });

  } catch (error) {
    console.error('Approve final project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process final year project decision',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Submit internship documentation
// @route   POST /api/internship/submit
// @access  Private (Student only)
export const submitInternship = async (req, res) => {
  try {
    const {
      company,
      position,
      startDate,
      endDate,
      supervisorName,
      supervisorContact
    } = req.body;

    // Validation
    if (!company || !position || !startDate || !endDate || !supervisorName || !supervisorContact) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'All internship details are required'
      });
    }

    // Check if file was uploaded
    if (!req.files || !req.files.internshipDocument) {
      return res.status(400).json({
        success: false,
        message: 'Internship documentation (PDF) is required'
      });
    }

    const student = await Student.findById(req.user.id);
    if (!student) {
      cleanupUploadedFiles(req.files);
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if internship is required for this department
    const departmentRequirements = getDepartmentRequirements(student.department);
    if (!departmentRequirements.internshipRequired) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: `Internship is not required for ${student.department} department`
      });
    }

    // Update student with internship details
    student.internship = {
      company,
      position,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      supervisorName,
      supervisorContact,
      documentPath: req.files.internshipDocument[0].path,
      submittedAt: new Date()
    };
    student.internshipStatus = 'Pending';

    await student.save();

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${student.firstName} ${student.fatherName}`,
      actorRole: 'student',
      action: 'INTERNSHIP_SUBMITTED',
      targetId: student._id,
      targetModel: 'Student',
      targetName: `${student.firstName} ${student.fatherName}`,
      category: 'data_modification',
      severity: 'medium',
      details: {
        company,
        position,
        duration: `${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Send notification to department head
    try {
      // Find department head
      const User = mongoose.model('User');
      const departmentHead = await User.findOne({
        role: 'departmentHead',
        department: student.department,
        status: 'active'
      });

      if (departmentHead) {
        await createNotification({
          recipientId: departmentHead._id,
          title: 'Internship Documentation Submitted',
          message: `${student.firstName} ${student.fatherName} has submitted internship documentation for your review.`,
          type: 'Info',
          link: '/graduation/internships',
          sourceType: 'graduation',
          sourceId: student._id,
          sourceModel: 'Student',
          createdBy: req.user.id
        });
      }
    } catch (notificationError) {
      console.error('Internship submission notification error:', notificationError);
      // Continue even if notification fails
    }

    res.status(200).json({
      success: true,
      message: 'Internship documentation submitted successfully',
      data: {
        internship: student.internship,
        status: student.internshipStatus
      }
    });

  } catch (error) {
    console.error('Submit internship error:', error);
    cleanupUploadedFiles(req.files);
    res.status(500).json({
      success: false,
      message: 'Failed to submit internship documentation',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Approve or reject internship
// @route   POST /api/internship/approve/:studentId
// @access  Private (Department Head, Graduation Committee)
export const approveInternship = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { decision, comments } = req.body;

    // Validation
    if (!decision || !['approve', 'reject'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Decision must be either "approve" or "reject"'
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if internship is pending review
    if (student.internshipStatus !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot review internship with status: ${student.internshipStatus}`
      });
    }

    // Update internship status
    if (decision === 'approve') {
      student.internshipStatus = 'Approved';
      student.internship.approvedBy = req.user.id;
      student.internship.approvedAt = new Date();
      student.internship.comments = comments || 'Internship approved';
      student.graduationChecklist.internshipApproved = true;
    } else {
      student.internshipStatus = 'Rejected';
      student.internship.rejectionReason = comments || 'Internship rejected';
      student.internship.comments = comments || 'Internship rejected';
      student.graduationChecklist.internshipApproved = false;
    }

    await student.save();

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: decision === 'approve' ? 'INTERNSHIP_APPROVED' : 'INTERNSHIP_REJECTED',
      targetId: student._id,
      targetModel: 'Student',
      targetName: `${student.firstName} ${student.fatherName}`,
      category: 'data_modification',
      severity: 'medium',
      details: {
        company: student.internship.company,
        decision,
        comments
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Send notification to student
    try {
      await createNotification({
        recipientId: student._id,
        title: `Internship ${decision === 'approve' ? 'Approved' : 'Rejected'}`,
        message: decision === 'approve'
          ? `Your internship at ${student.internship.company} has been approved.`
          : `Your internship at ${student.internship.company} has been rejected. Reason: ${comments || 'No reason provided'}`,
        type: decision === 'approve' ? 'Info' : 'Warning',
        link: '/graduation/status',
        sourceType: 'graduation',
        sourceId: student._id,
        sourceModel: 'Student',
        createdBy: req.user.id
      });
    } catch (notificationError) {
      console.error('Internship decision notification error:', notificationError);
      // Continue even if notification fails
    }

    res.status(200).json({
      success: true,
      message: `Internship ${decision}d successfully`,
      data: {
        studentId: student._id,
        studentName: `${student.firstName} ${student.fatherName}`,
        company: student.internship.company,
        status: student.internshipStatus
      }
    });

  } catch (error) {
    console.error('Approve internship error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process internship decision',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Mark student clearance status
// @route   POST /api/clearance/mark/:studentId
// @access  Private (Registrar only)
export const markClearanceStatus = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status, items } = req.body;

    // Validation
    if (!status || !['Cleared', 'Blocked', 'Pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "Cleared", "Blocked", or "Pending"'
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Update clearance status
    student.clearanceStatus = status;

    // Update clearance items if provided
    if (items && Array.isArray(items)) {
      items.forEach(item => {
        const existingItemIndex = student.clearanceItems.findIndex(
          i => i.itemType === item.itemType && i.itemName === item.itemName
        );

        if (existingItemIndex >= 0) {
          // Update existing item
          student.clearanceItems[existingItemIndex].status = item.status;
          student.clearanceItems[existingItemIndex].notes = item.notes;
          student.clearanceItems[existingItemIndex].clearedBy = req.user.id;
          student.clearanceItems[existingItemIndex].clearedAt = new Date();
        } else {
          // Add new item
          student.clearanceItems.push({
            itemType: item.itemType,
            itemName: item.itemName,
            status: item.status,
            notes: item.notes,
            clearedBy: req.user.id,
            clearedAt: new Date()
          });
        }
      });
    }

    // Update graduation checklist
    student.graduationChecklist.clearanceApproved = status === 'Cleared';

    await student.save();

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'CLEARANCE_STATUS_UPDATED',
      targetId: student._id,
      targetModel: 'Student',
      targetName: `${student.firstName} ${student.fatherName}`,
      category: 'data_modification',
      severity: 'medium',
      details: {
        status,
        items: items?.length || 0
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Send notification to student
    try {
      await createNotification({
        recipientId: student._id,
        title: `Clearance Status: ${status}`,
        message: status === 'Cleared'
          ? 'Your clearance has been approved. You have no outstanding items.'
          : status === 'Blocked'
            ? 'Your clearance has been blocked. Please check with the registrar office.'
            : 'Your clearance status is pending review.',
        type: status === 'Cleared' ? 'Info' : status === 'Blocked' ? 'Warning' : 'Info',
        link: '/graduation/status',
        sourceType: 'graduation',
        sourceId: student._id,
        sourceModel: 'Student',
        createdBy: req.user.id
      });
    } catch (notificationError) {
      console.error('Clearance notification error:', notificationError);
      // Continue even if notification fails
    }

    res.status(200).json({
      success: true,
      message: `Clearance status updated to ${status}`,
      data: {
        studentId: student._id,
        studentName: `${student.firstName} ${student.fatherName}`,
        clearanceStatus: student.clearanceStatus,
        clearanceItems: student.clearanceItems
      }
    });

  } catch (error) {
    console.error('Mark clearance status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update clearance status',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Check student graduation eligibility
// @route   GET /api/graduation/check/:studentId
// @access  Private (Student, Registrar, Graduation Committee)
export const checkGraduationEligibility = async (req, res) => {
  try {
    const { studentId } = req.params;

    // If student is checking their own eligibility
    const targetStudentId = req.user.role === 'student' ? req.user.id : studentId;

    // Security check - students can only check their own eligibility
    if (req.user.role === 'student' && targetStudentId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only check your own graduation eligibility'
      });
    }

    const student = await Student.findById(targetStudentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check graduation eligibility
    const eligibility = await student.checkGraduationEligibility();

    res.status(200).json({
      success: true,
      message: 'Graduation eligibility checked successfully',
      data: eligibility
    });

  } catch (error) {
    console.error('Check graduation eligibility error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check graduation eligibility',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Approve student graduation
// @route   POST /api/graduation/approve/:studentId
// @access  Private (Graduation Committee only)
export const approveGraduation = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { comments } = req.body;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if student is already graduated
    if (student.isGraduated) {
      return res.status(400).json({
        success: false,
        message: 'Student is already graduated'
      });
    }

    // Check graduation eligibility
    const eligibility = await student.checkGraduationEligibility();

    if (!eligibility.isEligible) {
      return res.status(400).json({
        success: false,
        message: 'Student does not meet all graduation requirements',
        data: eligibility
      });
    }

    // Mark student as graduated
    await student.markAsGraduated(req.user.id, comments);

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'GRADUATION_APPROVED',
      targetId: student._id,
      targetModel: 'Student',
      targetName: `${student.firstName} ${student.fatherName}`,
      category: 'data_modification',
      severity: 'high',
      details: {
        graduationDate: student.graduationDate,
        comments
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Send notification to student
    try {
      await createNotification({
        recipientId: student._id,
        title: 'Graduation Approved',
        message: 'Congratulations! Your graduation has been approved. You can now download your official transcript.',
        type: 'Info',
        link: '/graduation/status',
        sourceType: 'graduation',
        sourceId: student._id,
        sourceModel: 'Student',
        createdBy: req.user.id
      });
    } catch (notificationError) {
      console.error('Graduation approval notification error:', notificationError);
      // Continue even if notification fails
    }

    res.status(200).json({
      success: true,
      message: 'Student graduation approved successfully',
      data: {
        studentId: student._id,
        studentName: `${student.firstName} ${student.fatherName}`,
        graduationDate: student.graduationDate,
        department: student.department,
        studentId: student.studentId
      }
    });

  } catch (error) {
    console.error('Approve graduation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve graduation',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get list of students eligible for graduation
// @route   GET /api/graduation/eligible
// @access  Private (Graduation Committee, Registrar)
export const getEligibleStudents = async (req, res) => {
  try {
    const { department, year } = req.query;

    // Build query
    const query = {
      role: 'student',
      isGraduated: false,
      status: 'active',
      currentYear: { $gte: 4 } // Final year or above
    };

    if (department) {
      query.department = department;
    }

    if (year) {
      query.enrollmentYear = parseInt(year);
    }

    // Find potential graduates
    const students = await Student.find(query)
      .select('firstName fatherName grandfatherName studentId department currentYear lastCGPA totalCreditsEarned finalProjectStatus internshipStatus clearanceStatus graduationChecklist')
      .sort({ department: 1, lastName: 1 });

    // Check eligibility for each student
    const eligibilityResults = [];

    for (const student of students) {
      const eligibility = await student.checkGraduationEligibility();
      eligibilityResults.push({
        student: {
          _id: student._id,
          name: `${student.firstName} ${student.fatherName} ${student.grandfatherName}`,
          studentId: student.studentId,
          department: student.department,
          currentYear: student.currentYear
        },
        eligibility
      });
    }

    // Sort by eligibility status (eligible first)
    eligibilityResults.sort((a, b) => {
      if (a.eligibility.isEligible && !b.eligibility.isEligible) return -1;
      if (!a.eligibility.isEligible && b.eligibility.isEligible) return 1;
      return 0;
    });

    res.status(200).json({
      success: true,
      message: 'Eligible students retrieved successfully',
      data: {
        students: eligibilityResults,
        summary: {
          total: eligibilityResults.length,
          eligible: eligibilityResults.filter(r => r.eligibility.isEligible).length,
          pending: eligibilityResults.filter(r => !r.eligibility.isEligible).length
        }
      }
    });

  } catch (error) {
    console.error('Get eligible students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve eligible students',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get student graduation status
// @route   GET /api/graduation/status/:studentId
// @access  Private (Student, Registrar, Graduation Committee)
export const getGraduationStatus = async (req, res) => {
  try {
    const { studentId } = req.params;

    // If student is checking their own status
    const targetStudentId = req.user.role === 'student' ? req.user.id : studentId;

    // Security check - students can only check their own status
    if (req.user.role === 'student' && targetStudentId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only check your own graduation status'
      });
    }

    const student = await Student.findById(targetStudentId)
      .populate('finalProject.supervisor', 'firstName fatherName')
      .populate('finalProject.approvedBy', 'firstName fatherName')
      .populate('internship.approvedBy', 'firstName fatherName')
      .populate('graduationApproval.approvedBy', 'firstName fatherName');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check graduation eligibility
    const eligibility = await student.checkGraduationEligibility();

    res.status(200).json({
      success: true,
      message: 'Graduation status retrieved successfully',
      data: {
        student: {
          _id: student._id,
          name: `${student.firstName} ${student.fatherName} ${student.grandfatherName}`,
          studentId: student.studentId,
          department: student.department,
          currentYear: student.currentYear,
          currentSemester: student.currentSemester,
          enrollmentYear: student.enrollmentYear
        },
        isGraduated: student.isGraduated,
        graduationDate: student.graduationDate,
        finalProject: {
          status: student.finalProjectStatus,
          title: student.finalProject?.title,
          description: student.finalProject?.description,
          submittedAt: student.finalProject?.submittedAt,
          supervisor: student.finalProject?.supervisor ?
            `${student.finalProject.supervisor.firstName} ${student.finalProject.supervisor.fatherName}` : null,
          approvedBy: student.finalProject?.approvedBy ?
            `${student.finalProject.approvedBy.firstName} ${student.finalProject.approvedBy.fatherName}` : null,
          approvedAt: student.finalProject?.approvedAt,
          comments: student.finalProject?.comments,
          rejectionReason: student.finalProject?.rejectionReason
        },
        internship: {
          status: student.internshipStatus,
          company: student.internship?.company,
          position: student.internship?.position,
          duration: student.internship?.startDate && student.internship?.endDate ?
            `${new Date(student.internship.startDate).toLocaleDateString()} to ${new Date(student.internship.endDate).toLocaleDateString()}` : null,
          submittedAt: student.internship?.submittedAt,
          approvedBy: student.internship?.approvedBy ?
            `${student.internship.approvedBy.firstName} ${student.internship.approvedBy.fatherName}` : null,
          approvedAt: student.internship?.approvedAt,
          comments: student.internship?.comments,
          rejectionReason: student.internship?.rejectionReason
        },
        clearance: {
          status: student.clearanceStatus,
          items: student.clearanceItems
        },
        graduationApproval: {
          isApproved: student.graduationApproval?.isApproved,
          approvedBy: student.graduationApproval?.approvedBy ?
            `${student.graduationApproval.approvedBy.firstName} ${student.graduationApproval.approvedBy.fatherName}` : null,
          approvedAt: student.graduationApproval?.approvedAt,
          comments: student.graduationApproval?.comments
        },
        eligibility
      }
    });

  } catch (error) {
    console.error('Get graduation status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve graduation status',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get list of graduated students
// @route   GET /api/graduation/graduated
// @access  Private (Registrar, Graduation Committee)
export const getGraduatedStudents = async (req, res) => {
  try {
    const { department, year, page = 1, limit = 20 } = req.query;

    // Build query
    const query = {
      role: 'student',
      isGraduated: true,
      status: 'graduated'
    };

    if (department) {
      query.department = department;
    }

    if (year) {
      // Find students who graduated in the specified year
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);

      query.graduationDate = {
        $gte: startDate,
        $lte: endDate
      };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Find graduated students
    const [students, total] = await Promise.all([
      Student.find(query)
        .select('firstName fatherName grandfatherName studentId department graduationDate lastCGPA totalCreditsEarned')
        .sort({ graduationDate: -1, lastName: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Student.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      message: 'Graduated students retrieved successfully',
      data: {
        students,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Get graduated students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve graduated students',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get graduation statistics
// @route   GET /api/graduation/stats
// @access  Private (Registrar, Graduation Committee, President)
export const getGraduationStats = async (req, res) => {
  try {
    // Get graduation statistics by department and year
    const departmentStats = await Student.aggregate([
      { $match: { isGraduated: true, status: 'graduated' } },
      {
        $group: {
          _id: {
            department: '$department',
            year: { $year: '$graduationDate' }
          },
          count: { $sum: 1 },
          averageCGPA: { $avg: '$lastCGPA' },
          averageCredits: { $avg: '$totalCreditsEarned' }
        }
      },
      { $sort: { '_id.year': -1, '_id.department': 1 } }
    ]);

    // Get overall statistics
    const overallStats = await Student.aggregate([
      { $match: { isGraduated: true, status: 'graduated' } },
      {
        $group: {
          _id: null,
          totalGraduated: { $sum: 1 },
          averageCGPA: { $avg: '$lastCGPA' },
          averageCredits: { $avg: '$totalCreditsEarned' }
        }
      }
    ]);

    // Get graduation trends by year
    const yearlyTrends = await Student.aggregate([
      { $match: { isGraduated: true, status: 'graduated' } },
      {
        $group: {
          _id: { $year: '$graduationDate' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Get current eligible students count
    const eligibleCount = await Student.countDocuments({
      role: 'student',
      isGraduated: false,
      status: 'active',
      currentYear: { $gte: 4 },
      lastCGPA: { $gte: 2.0 },
      totalCreditsEarned: { $gte: 170 }
    });

    res.status(200).json({
      success: true,
      message: 'Graduation statistics retrieved successfully',
      data: {
        departmentStats,
        overallStats: overallStats[0] || { totalGraduated: 0, averageCGPA: 0, averageCredits: 0 },
        yearlyTrends,
        currentEligible: eligibleCount
      }
    });

  } catch (error) {
    console.error('Get graduation stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve graduation statistics',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// Helper function to get department-specific graduation requirements
function getDepartmentRequirements(department) {
  const requirements = {
    'Electrical': {
      requiredCredits: 180,
      requiredCourses: ['ELE 4001', 'ELE 4002', 'ELE 3005'],
      internshipRequired: true
    },
    'Manufacturing': {
      requiredCredits: 175,
      requiredCourses: ['MAN 4001', 'MAN 4002', 'MAN 3005'],
      internshipRequired: true
    },
    'Automotive': {
      requiredCredits: 178,
      requiredCourses: ['AUTO 4001', 'AUTO 4002', 'AUTO 3005'],
      internshipRequired: true
    },
    'Construction': {
      requiredCredits: 182,
      requiredCourses: ['CONS 4001', 'CONS 4002', 'CONS 3005'],
      internshipRequired: true
    },
    'ICT': {
      requiredCredits: 170,
      requiredCourses: ['ICT 4001', 'ICT 4002', 'ICT 3005'],
      internshipRequired: true
    }
  };

  return requirements[department] || {
    requiredCredits: 180,
    requiredCourses: [],
    internshipRequired: false
  };
}