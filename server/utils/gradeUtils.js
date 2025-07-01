import Grade from '../models/Grade.model.js';
import User from '../models/User.model.js';
import Course from '../models/Course.model.js';
import { createNotification } from './notificationUtils.js';

// Calculate letter grade and grade points from total mark
export const calculateLetterGrade = (totalMark) => {
  if (totalMark >= 90) return { letter: 'A+', points: 4.0 };
  if (totalMark >= 85) return { letter: 'A', points: 4.0 };
  if (totalMark >= 80) return { letter: 'A-', points: 3.75 };
  if (totalMark >= 75) return { letter: 'B+', points: 3.5 };
  if (totalMark >= 70) return { letter: 'B', points: 3.0 };
  if (totalMark >= 65) return { letter: 'B-', points: 2.75 };
  if (totalMark >= 60) return { letter: 'C+', points: 2.5 };
  if (totalMark >= 50) return { letter: 'C', points: 2.0 };
  if (totalMark >= 40) return { letter: 'D', points: 1.0 };
  return { letter: 'F', points: 0.0 };
};

// Calculate student's CGPA and update academic standing
export const updateAcademicStanding = async (studentId) => {
  try {
    // Calculate current CGPA
    const cgpaInfo = await Grade.calculateStudentCGPA(studentId);

    // Get student
    const student = await User.findById(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    // Determine academic standing
    let probation = false;
    let dismissed = false;
    let status = student.status;

    if (cgpaInfo.cgpa < 1.0 && cgpaInfo.courseCount >= 3) {
      // Dismiss if CGPA < 1.0 and has completed at least 3 courses
      dismissed = true;
      status = 'suspended';
      probation = false;
    } else if (cgpaInfo.cgpa < 2.0 && cgpaInfo.courseCount >= 3) {
      // Probation if CGPA < 2.0 and has completed at least 3 courses
      probation = true;
      dismissed = false;
    } else {
      // Good standing
      probation = false;
      dismissed = false;
      if (status === 'suspended') {
        status = 'active'; // Reinstate if improved
      }
    }

    // Check if academic standing has changed
    const standingChanged = (
      student.probation !== probation ||
      student.dismissed !== dismissed ||
      student.status !== status
    );

    // Update student record
    await User.findByIdAndUpdate(studentId, {
      probation,
      dismissed,
      status,
      lastCGPA: cgpaInfo.cgpa,
      totalCreditsEarned: cgpaInfo.totalCredits,
      academicStandingLastUpdated: new Date()
    });

    // Send notification if academic standing has changed
    if (standingChanged) {
      try {
        if (dismissed) {
          await createNotification({
            recipientId: studentId,
            title: 'URGENT: Academic Dismissal Warning',
            message: 'Your CGPA has fallen below 1.0. You are subject to academic dismissal. Please contact the Academic Affairs office immediately.',
            type: 'Warning',
            link: '/grades/standing',
            sourceType: 'grade'
          });
        } else if (probation) {
          await createNotification({
            recipientId: studentId,
            title: 'Academic Probation Warning',
            message: 'Your CGPA is below 2.0. You are on academic probation. Please meet with your academic advisor to develop an improvement plan.',
            type: 'Warning',
            link: '/grades/standing',
            sourceType: 'grade'
          });
        } else if (student.probation || student.dismissed) {
          // Student has improved from probation/dismissal
          await createNotification({
            recipientId: studentId,
            title: 'Academic Standing Improved',
            message: 'Congratulations! Your academic standing has improved. You are now in good standing with the university.',
            type: 'Info',
            link: '/grades/standing',
            sourceType: 'grade'
          });
        }
      } catch (notificationError) {
        console.error('Academic standing notification error:', notificationError);
        // Continue even if notification fails
      }
    }

    console.log(`📊 Academic standing updated for student ${student.studentId}:`);
    console.log(`   CGPA: ${cgpaInfo.cgpa}`);
    console.log(`   Probation: ${probation}`);
    console.log(`   Dismissed: ${dismissed}`);
    console.log(`   Status: ${status}`);

    return {
      cgpa: cgpaInfo.cgpa,
      probation,
      dismissed,
      status
    };

  } catch (error) {
    console.error('Error updating academic standing:', error);
    throw error;
  }
};

// Check course prerequisites before registration
export const checkPrerequisites = async (studentId, courseId) => {
  try {
    const course = await Course.findById(courseId);
    if (!course || !course.prerequisites || course.prerequisites.length === 0) {
      return { canRegister: true, message: 'No prerequisites required' };
    }

    // Get student's completed courses with passing grades
    const completedCourses = await Grade.find({
      studentId,
      status: { $in: ['finalized', 'locked'] },
      letterGrade: { $nin: ['F', 'NG', 'W', 'I'] }
    }).populate('courseId', 'courseCode');

    const completedCourseCodes = completedCourses.map(grade => grade.courseId.courseCode);

    // Check if all prerequisites are met
    const missingPrereqs = course.prerequisites.filter(prereq =>
      !completedCourseCodes.includes(prereq)
    );

    if (missingPrereqs.length > 0) {
      return {
        canRegister: false,
        message: `Missing prerequisites: ${missingPrereqs.join(', ')}`,
        missingPrerequisites: missingPrereqs
      };
    }

    return { canRegister: true, message: 'All prerequisites met' };

  } catch (error) {
    console.error('Error checking prerequisites:', error);
    return {
      canRegister: false,
      message: 'Error checking prerequisites',
      error: error.message
    };
  }
};

// Get courses that need to be repeated
export const getRepeatCourses = async (studentId) => {
  try {
    const failedGrades = await Grade.find({
      studentId,
      status: { $in: ['finalized', 'locked'] },
      letterGrade: { $in: ['F', 'NG'] },
      repeatRequired: true
    }).populate('courseId', 'courseCode courseName credit department year semester');

    return failedGrades.map(grade => ({
      gradeId: grade._id,
      course: grade.courseId,
      letterGrade: grade.letterGrade,
      academicYear: grade.academicYear,
      semester: grade.semester
    }));

  } catch (error) {
    console.error('Error getting repeat courses:', error);
    throw error;
  }
};

// Check if student can register for next semester
export const canRegisterForSemester = async (studentId, targetYear, targetSemester) => {
  try {
    const student = await User.findById(studentId);
    if (!student) {
      return { canRegister: false, message: 'Student not found' };
    }

    // Check if student is dismissed
    if (student.dismissed) {
      return {
        canRegister: false,
        message: 'Cannot register: Student is dismissed due to poor academic performance'
      };
    }

    // Check if student is suspended
    if (student.status === 'suspended') {
      return {
        canRegister: false,
        message: 'Cannot register: Student account is suspended'
      };
    }

    // Get repeat courses
    const repeatCourses = await getRepeatCourses(studentId);

    if (repeatCourses.length > 0) {
      return {
        canRegister: true,
        message: 'Can register with repeat courses',
        repeatCourses,
        requiresRepeat: true
      };
    }

    return {
      canRegister: true,
      message: 'Can register for new semester',
      requiresRepeat: false
    };

  } catch (error) {
    console.error('Error checking registration eligibility:', error);
    return {
      canRegister: false,
      message: 'Error checking registration eligibility',
      error: error.message
    };
  }
};

// Generate grade report for export
export const generateGradeReport = async (filters = {}) => {
  try {
    const {
      academicYear,
      semester,
      department,
      year,
      includeDetails = true
    } = filters;

    const matchQuery = { status: { $in: ['finalized', 'locked'] } };

    if (academicYear) matchQuery.academicYear = academicYear;
    if (semester) matchQuery.semester = semester;
    if (department) matchQuery.department = department;
    if (year) matchQuery.year = year;

    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'users',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $unwind: '$student' },
      {
        $lookup: {
          from: 'courses',
          localField: 'courseId',
          foreignField: '_id',
          as: 'course'
        }
      },
      { $unwind: '$course' },
      {
        $project: {
          studentId: '$student.studentId',
          studentName: {
            $concat: ['$student.firstName', ' ', '$student.fatherName', ' ', '$student.grandfatherName']
          },
          courseCode: '$course.courseCode',
          courseName: '$course.courseName',
          credit: '$course.credit',
          department: '$department',
          year: '$year',
          semester: '$semester',
          academicYear: '$academicYear',
          midtermMark: '$midtermMark',
          continuousMark: '$continuousMark',
          finalExamMark: '$finalExamMark',
          totalMark: '$totalMark',
          letterGrade: '$letterGrade',
          gradePoints: '$gradePoints',
          status: '$status'
        }
      },
      {
        $sort: {
          department: 1,
          year: 1,
          semester: 1,
          studentId: 1,
          courseCode: 1
        }
      }
    ];

    const grades = await Grade.aggregate(pipeline);

    // Calculate summary statistics
    const summary = {
      totalGrades: grades.length,
      gradeDistribution: {},
      departmentSummary: {},
      averageGPA: 0
    };

    grades.forEach(grade => {
      // Grade distribution
      summary.gradeDistribution[grade.letterGrade] =
        (summary.gradeDistribution[grade.letterGrade] || 0) + 1;

      // Department summary
      if (!summary.departmentSummary[grade.department]) {
        summary.departmentSummary[grade.department] = {
          totalGrades: 0,
          averageGPA: 0,
          gradeDistribution: {}
        };
      }
      summary.departmentSummary[grade.department].totalGrades++;
      summary.departmentSummary[grade.department].gradeDistribution[grade.letterGrade] =
        (summary.departmentSummary[grade.department].gradeDistribution[grade.letterGrade] || 0) + 1;
    });

    return {
      grades: includeDetails ? grades : [],
      summary,
      filters,
      generatedAt: new Date()
    };

  } catch (error) {
    console.error('Error generating grade report:', error);
    throw error;
  }
};

// Validate grade submission data
export const validateGradeSubmission = (gradeData) => {
  const errors = [];

  if (!gradeData.studentId) {
    errors.push('Student ID is required');
  }

  if (!gradeData.courseId) {
    errors.push('Course ID is required');
  }

  if (!gradeData.registrationId) {
    errors.push('Registration ID is required');
  }

  if (gradeData.midtermMark < 0 || gradeData.midtermMark > 30) {
    errors.push('Midterm mark must be between 0-30');
  }

  if (gradeData.continuousMark < 0 || gradeData.continuousMark > 30) {
    errors.push('Continuous mark must be between 0-30');
  }

  if (gradeData.finalExamMark < 0 || gradeData.finalExamMark > 40) {
    errors.push('Final exam mark must be between 0-40');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};