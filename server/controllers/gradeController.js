import Grade from '../models/Grade.model.js';
import Course from '../models/Course.model.js';
import User from '../models/User.model.js';
import Registration from '../models/Registration.model.js';
import { checkPrerequisites, updateAcademicStanding } from '../utils/gradeUtils.js';
import { createNotification } from '../utils/notificationUtils.js';

// @desc    Submit grades by instructor
// @route   POST /api/instructor/submit-grade
// @access  Private (Instructor only)
export const submitGrade = async (req, res) => {
  try {
    const {
      studentId,
      courseId,
      registrationId,
      midtermMark,
      continuousMark,
      finalExamMark,
      instructorComments
    } = req.body;

    // Validation
    if (!studentId || !courseId || !registrationId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, Course ID, and Registration ID are required'
      });
    }

    // Validate marks
    if (midtermMark < 0 || midtermMark > 30) {
      return res.status(400).json({
        success: false,
        message: 'Midterm mark must be between 0-30'
      });
    }

    if (continuousMark < 0 || continuousMark > 30) {
      return res.status(400).json({
        success: false,
        message: 'Continuous mark must be between 0-30'
      });
    }

    if (finalExamMark < 0 || finalExamMark > 40) {
      return res.status(400).json({
        success: false,
        message: 'Final exam mark must be between 0-40'
      });
    }

    // Get course and registration details
    const course = await Course.findById(courseId);
    const registration = await Registration.findById(registrationId);
    const student = await User.findById(studentId);

    if (!course || !registration || !student) {
      return res.status(404).json({
        success: false,
        message: 'Course, registration, or student not found'
      });
    }

    // Check if grade already exists
    let grade = await Grade.findOne({
      studentId,
      courseId,
      academicYear: registration.academicYear
    });

    if (grade) {
      // Update existing grade if it can be modified
      if (!grade.canBeModified()) {
        return res.status(400).json({
          success: false,
          message: `Grade cannot be modified. Current status: ${grade.status}`
        });
      }

      grade.midtermMark = midtermMark;
      grade.continuousMark = continuousMark;
      grade.finalExamMark = finalExamMark;
      grade.instructorComments = instructorComments || '';
      grade.status = 'submitted';
      grade.submittedAt = new Date();
      grade.submittedBy = req.user.id;
    } else {
      // Create new grade
      grade = new Grade({
        studentId,
        courseId,
        registrationId,
        instructorId: req.user.id,
        academicYear: registration.academicYear,
        semester: course.semester,
        year: course.year,
        department: course.department,
        midtermMark,
        continuousMark,
        finalExamMark,
        instructorComments: instructorComments || '',
        status: 'submitted',
        submittedAt: new Date(),
        submittedBy: req.user.id
      });
    }

    await grade.save();

    // Send notification to department head
    try {
      // Find department head
      const departmentHead = await User.findOne({
        role: 'departmentHead',
        department: course.department,
        status: 'active'
      });

      if (departmentHead) {
        await createNotification({
          recipientId: departmentHead._id,
          title: 'Grade Submission Requires Approval',
          message: `Grades for ${course.courseCode} (${course.courseName}) have been submitted by ${req.user.firstName} ${req.user.fatherName} and require your approval.`,
          type: 'Deadline',
          link: '/grades/pending',
          sourceType: 'grade',
          sourceId: grade._id,
          sourceModel: 'Grade',
          createdBy: req.user.id
        });
      }
    } catch (notificationError) {
      console.error('Grade notification error:', notificationError);
      // Continue even if notification fails
    }

    console.log(`📝 Grade submitted: ${course.courseCode} for ${student.firstName} ${student.fatherName}`);
    console.log(`   📊 Marks: Midterm(${midtermMark}) + Continuous(${continuousMark}) + Final(${finalExamMark}) = ${grade.totalMark}`);
    console.log(`   🎯 Grade: ${grade.letterGrade} (${grade.gradePoints} points)`);

    res.status(201).json({
      success: true,
      message: 'Grade submitted successfully',
      data: {
        grade: {
          _id: grade._id,
          totalMark: grade.totalMark,
          letterGrade: grade.letterGrade,
          gradePoints: grade.gradePoints,
          status: grade.status,
          submittedAt: grade.submittedAt
        }
      }
    });

  } catch (error) {
    console.error('Submit grade error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit grade',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get grades for instructor review
// @route   GET /api/instructor/grades
// @access  Private (Instructor only)
export const getInstructorGrades = async (req, res) => {
  try {
    const { academicYear, semester, status } = req.query;

    const matchQuery = { instructorId: req.user.id };

    if (academicYear) matchQuery.academicYear = academicYear;
    if (semester) matchQuery.semester = parseInt(semester);
    if (status) matchQuery.status = status;

    const grades = await Grade.find(matchQuery)
      .populate('studentId', 'firstName fatherName grandfatherName studentId')
      .populate('courseId', 'courseCode courseName credit')
      .sort({ submittedAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Instructor grades retrieved successfully',
      data: {
        grades,
        summary: {
          total: grades.length,
          byStatus: grades.reduce((acc, grade) => {
            acc[grade.status] = (acc[grade.status] || 0) + 1;
            return acc;
          }, {})
        }
      }
    });

  } catch (error) {
    console.error('Get instructor grades error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve grades',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Approve or reject grade by department head
// @route   PUT /api/depthead/approve-grade/:gradeId
// @access  Private (Department Head only)
export const approveGrade = async (req, res) => {
  try {
    const { gradeId } = req.params;
    const { action, comments } = req.body; // action: 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "approve" or "reject"'
      });
    }

    const grade = await Grade.findById(gradeId)
      .populate('studentId', 'firstName fatherName grandfatherName studentId')
      .populate('courseId', 'courseCode courseName');

    if (!grade) {
      return res.status(404).json({
        success: false,
        message: 'Grade not found'
      });
    }

    if (!grade.canBeApproved()) {
      return res.status(400).json({
        success: false,
        message: `Grade cannot be approved. Current status: ${grade.status}`
      });
    }

    if (action === 'approve') {
      grade.status = 'approved';
      grade.approvedAt = new Date();
      grade.approvedBy = req.user.id;
      grade.deptHeadComments = comments || '';
    } else {
      grade.status = 'rejected';
      grade.rejectionReason = comments || 'No reason provided';
      grade.deptHeadComments = comments || '';
    }

    await grade.save();

    // Send notification based on action
    try {
      if (action === 'approve') {
        // Notify registrar
        const registrars = await User.find({
          role: 'registrar',
          status: 'active'
        });

        if (registrars.length > 0) {
          for (const registrar of registrars) {
            await createNotification({
              recipientId: registrar._id,
              title: 'Grade Approval Requires Finalization',
              message: `Grades for ${grade.courseId.courseCode} (${grade.courseId.courseName}) have been approved by the department head and require finalization.`,
              type: 'Deadline',
              link: '/grades/pending',
              sourceType: 'grade',
              sourceId: grade._id,
              sourceModel: 'Grade',
              createdBy: req.user.id
            });
          }
        }
      } else {
        // Notify instructor about rejection
        await createNotification({
          recipientId: grade.instructorId,
          title: 'Grade Submission Rejected',
          message: `Your grade submission for ${grade.courseId.courseCode} (${grade.courseId.courseName}) has been rejected. Reason: ${comments || 'No reason provided'}`,
          type: 'Warning',
          link: '/grades',
          sourceType: 'grade',
          sourceId: grade._id,
          sourceModel: 'Grade',
          createdBy: req.user.id
        });
      }
    } catch (notificationError) {
      console.error('Grade approval notification error:', notificationError);
      // Continue even if notification fails
    }

    console.log(`${action === 'approve' ? '✅' : '❌'} Grade ${action}d: ${grade.courseId.courseCode} for ${grade.studentId.firstName} ${grade.studentId.fatherName}`);

    res.status(200).json({
      success: true,
      message: `Grade ${action}d successfully`,
      data: {
        grade: {
          _id: grade._id,
          status: grade.status,
          totalMark: grade.totalMark,
          letterGrade: grade.letterGrade,
          [action === 'approve' ? 'approvedAt' : 'rejectionReason']: action === 'approve' ? grade.approvedAt : grade.rejectionReason
        }
      }
    });

  } catch (error) {
    console.error('Approve grade error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process grade approval',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get pending grades for department head approval
// @route   GET /api/depthead/pending-grades
// @access  Private (Department Head only)
export const getPendingGrades = async (req, res) => {
  try {
    const { department, academicYear, semester } = req.query;

    const matchQuery = { status: 'submitted' };

    if (department) matchQuery.department = department;
    if (academicYear) matchQuery.academicYear = academicYear;
    if (semester) matchQuery.semester = parseInt(semester);

    const grades = await Grade.find(matchQuery)
      .populate('studentId', 'firstName fatherName grandfatherName studentId')
      .populate('courseId', 'courseCode courseName credit')
      .populate('instructorId', 'firstName fatherName')
      .sort({ submittedAt: 1 });

    res.status(200).json({
      success: true,
      message: 'Pending grades retrieved successfully',
      data: {
        grades,
        summary: {
          total: grades.length,
          byDepartment: grades.reduce((acc, grade) => {
            acc[grade.department] = (acc[grade.department] || 0) + 1;
            return acc;
          }, {})
        }
      }
    });

  } catch (error) {
    console.error('Get pending grades error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending grades',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Finalize grades by registrar
// @route   PUT /api/registrar/finalize-grade/:gradeId
// @access  Private (Registrar only)
export const finalizeGrade = async (req, res) => {
  try {
    const { gradeId } = req.params;
    const { comments } = req.body;

    const grade = await Grade.findById(gradeId)
      .populate('studentId', 'firstName fatherName grandfatherName studentId')
      .populate('courseId', 'courseCode courseName credit');

    if (!grade) {
      return res.status(404).json({
        success: false,
        message: 'Grade not found'
      });
    }

    if (!grade.canBeFinalized()) {
      return res.status(400).json({
        success: false,
        message: `Grade cannot be finalized. Current status: ${grade.status}`
      });
    }

    grade.status = 'finalized';
    grade.finalizedAt = new Date();
    grade.finalizedBy = req.user.id;
    grade.registrarComments = comments || '';

    await grade.save();

    // Update student's academic standing after finalizing grade
    await updateAcademicStanding(grade.studentId._id);

    // Send notification to student
    try {
      await createNotification({
        recipientId: grade.studentId._id,
        title: 'Final Grade Available',
        message: `Your final grade for ${grade.courseId.courseCode} (${grade.courseId.courseName}) is now available. Grade: ${grade.letterGrade}`,
        type: 'Info',
        link: '/grades',
        sourceType: 'grade',
        sourceId: grade._id,
        sourceModel: 'Grade',
        createdBy: req.user.id
      });
    } catch (notificationError) {
      console.error('Grade finalization notification error:', notificationError);
      // Continue even if notification fails
    }

    console.log(`🔒 Grade finalized: ${grade.courseId.courseCode} for ${grade.studentId.firstName} ${grade.studentId.fatherName}`);
    console.log(`   📊 Final Grade: ${grade.letterGrade} (${grade.gradePoints} points)`);

    res.status(200).json({
      success: true,
      message: 'Grade finalized successfully',
      data: {
        grade: {
          _id: grade._id,
          status: grade.status,
          finalizedAt: grade.finalizedAt,
          totalMark: grade.totalMark,
          letterGrade: grade.letterGrade,
          gradePoints: grade.gradePoints
        }
      }
    });

  } catch (error) {
    console.error('Finalize grade error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to finalize grade',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Lock grades (final step)
// @route   PUT /api/registrar/lock-grades
// @access  Private (Registrar only)
export const lockGrades = async (req, res) => {
  try {
    const { academicYear, semester, department } = req.body;

    if (!academicYear || !semester) {
      return res.status(400).json({
        success: false,
        message: 'Academic year and semester are required'
      });
    }

    const matchQuery = {
      academicYear,
      semester,
      status: 'finalized'
    };

    if (department) {
      matchQuery.department = department;
    }

    const result = await Grade.updateMany(
      matchQuery,
      {
        $set: {
          status: 'locked',
          lockedAt: new Date(),
          lockedBy: req.user.id
        }
      }
    );

    // Send notifications to students
    try {
      if (result.modifiedCount > 0) {
        // Find all affected students
        const grades = await Grade.find({
          academicYear,
          semester,
          status: 'locked',
          ...(department && { department })
        }).populate('studentId', '_id').populate('courseId', 'courseCode');

        // Group by student
        const studentGrades = {};
        grades.forEach(grade => {
          const studentId = grade.studentId._id.toString();
          if (!studentGrades[studentId]) {
            studentGrades[studentId] = [];
          }
          studentGrades[studentId].push(grade.courseId.courseCode);
        });

        // Send notification to each student
        for (const [studentId, courses] of Object.entries(studentGrades)) {
          await createNotification({
            recipientId: studentId,
            title: 'Semester Grades Finalized',
            message: `All your grades for ${academicYear} Semester ${semester} have been finalized and locked. Courses: ${courses.join(', ')}`,
            type: 'Info',
            link: '/grades',
            sourceType: 'grade',
            createdBy: req.user.id
          });
        }
      }
    } catch (notificationError) {
      console.error('Grade locking notification error:', notificationError);
      // Continue even if notification fails
    }

    console.log(`🔐 Grades locked: ${result.modifiedCount} grades for ${academicYear} Semester ${semester}`);

    res.status(200).json({
      success: true,
      message: `Successfully locked ${result.modifiedCount} grades`,
      data: {
        lockedCount: result.modifiedCount,
        academicYear,
        semester,
        department: department || 'All departments'
      }
    });

  } catch (error) {
    console.error('Lock grades error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to lock grades',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get student grades and academic standing
// @route   GET /api/student/grades
// @access  Private (Student only)
export const getStudentGrades = async (req, res) => {
  try {
    const { academicYear } = req.query;

    const matchQuery = {
      studentId: req.user.id,
      status: { $in: ['finalized', 'locked'] }
    };

    if (academicYear) {
      matchQuery.academicYear = academicYear;
    }

    const grades = await Grade.find(matchQuery)
      .populate('courseId', 'courseCode courseName credit')
      .sort({ academicYear: -1, semester: -1 });

    // Calculate CGPA
    const cgpaInfo = await Grade.calculateStudentCGPA(req.user.id, academicYear);

    // Get academic standing
    const student = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Student grades retrieved successfully',
      data: {
        grades,
        academicStanding: {
          cgpa: cgpaInfo.cgpa,
          totalCredits: cgpaInfo.totalCredits,
          courseCount: cgpaInfo.courseCount,
          probation: student.probation || false,
          dismissed: student.dismissed || false,
          status: student.status
        }
      }
    });

  } catch (error) {
    console.error('Get student grades error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve grades',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get grade reports for president
// @route   GET /api/president/grade-reports
// @access  Private (President only)
export const getGradeReports = async (req, res) => {
  try {
    const { academicYear, semester, department } = req.query;

    const matchQuery = { status: { $in: ['finalized', 'locked'] } };

    if (academicYear) matchQuery.academicYear = academicYear;
    if (semester) matchQuery.semester = parseInt(semester);
    if (department) matchQuery.department = department;

    // Grade distribution
    const gradeDistribution = await Grade.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            department: '$department',
            letterGrade: '$letterGrade'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.department',
          grades: {
            $push: {
              grade: '$_id.letterGrade',
              count: '$count'
            }
          },
          totalStudents: { $sum: '$count' }
        }
      }
    ]);

    // Academic standing summary
    const academicStanding = await User.aggregate([
      {
        $match: {
          role: 'student',
          status: 'active'
        }
      },
      {
        $group: {
          _id: '$department',
          totalStudents: { $sum: 1 },
          onProbation: {
            $sum: { $cond: ['$probation', 1, 0] }
          },
          dismissed: {
            $sum: { $cond: ['$dismissed', 1, 0] }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      message: 'Grade reports retrieved successfully',
      data: {
        gradeDistribution,
        academicStanding,
        filters: {
          academicYear: academicYear || 'All',
          semester: semester || 'All',
          department: department || 'All'
        }
      }
    });

  } catch (error) {
    console.error('Get grade reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve grade reports',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};