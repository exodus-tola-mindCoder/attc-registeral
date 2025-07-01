import Course from '../models/Course.model.js';
import Registration from '../models/Registration.model.js';
import Grade from '../models/Grade.model.js';
import User from '../models/User.model.js';
import Evaluation from '../models/Evaluation.model.js';
import RegistrationPeriod from '../models/RegistrationPeriod.model.js';
import { generateRegistrationSlip } from '../utils/pdfGenerator.js';
import { checkPrerequisites, canRegisterForSemester } from '../utils/gradeUtils.js';

// @desc    Get available courses with prerequisite checking and evaluation validation
// @route   GET /api/student/available-courses-enhanced
// @access  Private (Student only)
export const getAvailableCoursesEnhanced = async (req, res) => {
  try {
    const student = await User.findById(req.user.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if student has completed all required evaluations for previous semester
    const currentAcademicYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    const evaluationStatus = await Evaluation.hasCompletedAllEvaluations(
      student._id,
      currentAcademicYear
    );

    if (!evaluationStatus.hasCompleted) {
      return res.status(400).json({
        success: false,
        message: `You must complete ${evaluationStatus.missing} instructor evaluation(s) before registering for next semester`,
        data: {
          canRegister: false,
          reason: 'Incomplete evaluations',
          evaluationStatus
        }
      });
    }

    // Check if student can register
    const registrationCheck = await canRegisterForSemester(
      student._id,
      student.currentYear,
      student.currentSemester
    );

    if (!registrationCheck.canRegister) {
      return res.status(400).json({
        success: false,
        message: registrationCheck.message,
        data: {
          canRegister: false,
          reason: registrationCheck.message
        }
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
    const periodDetails = await RegistrationPeriod.getPeriodDetails('courseRegistration', department);
    const isRegistrationOpen = periodDetails.isOpen;

    if (!isRegistrationOpen) {
      return res.status(403).json({
        success: false,
        message: 'Course registration is currently closed. Please contact the registrar\'s office.',
        data: {
          canRegister: false,
          reason: 'Registration closed',
          registrationPeriod: periodDetails
        }
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
          registration: existingRegistration,
          canRegister: false
        }
      });
    }

    // Get available courses
    let availableCourses = await Course.getCoursesForSemester(
      department,
      student.currentYear,
      student.currentSemester
    );

    // Get repeat courses if any
    const repeatCourses = registrationCheck.requiresRepeat ?
      await getRepeatCourses(student._id) : [];

    // If student needs to repeat courses, prioritize them
    if (repeatCourses.length > 0) {
      const repeatCourseIds = repeatCourses.map(rc => rc.course._id.toString());

      // Filter available courses to include repeat courses
      availableCourses = availableCourses.filter(course =>
        repeatCourseIds.includes(course._id.toString())
      );

      // Add repeat course information
      availableCourses = availableCourses.map(course => {
        const repeatInfo = repeatCourses.find(rc =>
          rc.course._id.toString() === course._id.toString()
        );
        return {
          ...course.toObject(),
          isRepeat: true,
          previousGrade: repeatInfo?.letterGrade,
          previousYear: repeatInfo?.academicYear
        };
      });
    } else {
      // Check prerequisites for each course
      const coursesWithPrereqCheck = await Promise.all(
        availableCourses.map(async (course) => {
          const prereqCheck = await checkPrerequisites(student._id, course._id);
          return {
            ...course.toObject(),
            canRegister: prereqCheck.canRegister,
            prerequisiteMessage: prereqCheck.message,
            missingPrerequisites: prereqCheck.missingPrerequisites || [],
            isRepeat: false
          };
        })
      );

      // Filter out courses with unmet prerequisites
      availableCourses = coursesWithPrereqCheck.filter(course => course.canRegister);
    }

    const totalCredits = availableCourses.reduce((sum, course) => sum + course.credit, 0);

    res.status(200).json({
      success: true,
      message: `Available courses for ${department} - Year ${student.currentYear}, Semester ${student.currentSemester}`,
      data: {
        courses: availableCourses,
        summary: {
          courseCount: availableCourses.length,
          totalCredits,
          department,
          year: student.currentYear,
          semester: student.currentSemester,
          hasRepeatCourses: repeatCourses.length > 0,
          repeatCoursesCount: repeatCourses.length
        },
        alreadyRegistered: false,
        canRegister: true,
        academicStanding: {
          probation: student.probation || false,
          dismissed: student.dismissed || false,
          status: student.status
        },
        evaluationStatus,
        registrationPeriod: periodDetails
      }
    });

  } catch (error) {
    console.error('Get available courses enhanced error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve available courses',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Register student for semester with enhanced validation including evaluation check
// @route   POST /api/student/register-semester-enhanced
// @access  Private (Student only)
export const registerForSemesterEnhanced = async (req, res) => {
  try {
    const student = await User.findById(req.user.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if student has completed all required evaluations for previous semester
    const currentAcademicYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    const evaluationStatus = await Evaluation.hasCompletedAllEvaluations(
      student._id,
      currentAcademicYear
    );

    if (!evaluationStatus.hasCompleted) {
      return res.status(400).json({
        success: false,
        message: `You must complete ${evaluationStatus.missing} instructor evaluation(s) before registering for next semester`,
        data: {
          evaluationStatus
        }
      });
    }

    // Check if student can register
    const registrationCheck = await canRegisterForSemester(
      student._id,
      student.currentYear,
      student.currentSemester
    );

    if (!registrationCheck.canRegister) {
      return res.status(400).json({
        success: false,
        message: registrationCheck.message
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

    let coursesToRegister = [];

    if (registrationCheck.requiresRepeat) {
      // Register for repeat courses
      const repeatCourses = await getRepeatCourses(student._id);

      if (repeatCourses.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No repeat courses found for registration'
        });
      }

      coursesToRegister = repeatCourses.map(rc => ({
        courseId: rc.course._id,
        courseCode: rc.course.courseCode,
        courseName: rc.course.courseName,
        credit: rc.course.credit,
        registrationDate: new Date(),
        isRepeat: true,
        previousGrade: rc.letterGrade
      }));

    } else {
      // Register for regular semester courses
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

      // Check prerequisites for each course
      const prereqChecks = await Promise.all(
        availableCourses.map(async (course) => {
          const prereqCheck = await checkPrerequisites(student._id, course._id);
          return {
            course,
            canRegister: prereqCheck.canRegister,
            message: prereqCheck.message
          };
        })
      );

      // Filter courses that can be registered
      const eligibleCourses = prereqChecks.filter(check => check.canRegister);

      if (eligibleCourses.length === 0) {
        const blockedCourses = prereqChecks.filter(check => !check.canRegister);
        return res.status(400).json({
          success: false,
          message: 'No courses available due to unmet prerequisites',
          data: {
            blockedCourses: blockedCourses.map(bc => ({
              courseCode: bc.course.courseCode,
              courseName: bc.course.courseName,
              reason: bc.message
            }))
          }
        });
      }

      coursesToRegister = eligibleCourses.map(ec => ({
        courseId: ec.course._id,
        courseCode: ec.course.courseCode,
        courseName: ec.course.courseName,
        credit: ec.course.credit,
        registrationDate: new Date(),
        isRepeat: false
      }));
    }

    const totalCredits = coursesToRegister.reduce((sum, course) => sum + course.credit, 0);

    // Create registration record
    const registration = new Registration({
      studentId: student._id,
      department,
      year: student.currentYear,
      semester: student.currentSemester,
      courses: coursesToRegister,
      totalCredits,
      status: 'registered',
      isRepeatSemester: registrationCheck.requiresRepeat || false
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

    console.log(`✅ Student registered for semester (Enhanced with Evaluation Check):`);
    console.log(`   👤 Student: ${student.firstName} ${student.fatherName} (${student.studentId})`);
    console.log(`   📚 Department: ${department}`);
    console.log(`   📅 Year ${student.currentYear}, Semester ${student.currentSemester}`);
    console.log(`   📊 Courses: ${coursesToRegister.length}, Credits: ${totalCredits}`);
    console.log(`   🔄 Repeat Semester: ${registrationCheck.requiresRepeat}`);
    console.log(`   ⭐ Evaluations Completed: ${evaluationStatus.hasCompleted}`);
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
          isRepeatSemester: registration.isRepeatSemester,
          registrationDate: registration.registrationDate,
          registrationSlipPath: registration.registrationSlipPath
        },
        summary: {
          coursesRegistered: coursesToRegister.length,
          totalCredits,
          registrationDate: registration.registrationDate,
          isRepeatSemester: registrationCheck.requiresRepeat,
          repeatCoursesCount: registrationCheck.requiresRepeat ? coursesToRegister.length : 0,
          evaluationsCompleted: evaluationStatus.hasCompleted
        }
      }
    });

  } catch (error) {
    console.error('Register for semester enhanced error:', error);

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

// @desc    Get student's academic transcript
// @route   GET /api/student/transcript
// @access  Private (Student only)
export const getStudentTranscript = async (req, res) => {
  try {
    const student = await User.findById(req.user.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get all finalized grades
    const grades = await Grade.find({
      studentId: req.user.id,
      status: { $in: ['finalized', 'locked'] }
    })
      .populate('courseId', 'courseCode courseName credit')
      .sort({ academicYear: 1, semester: 1 });

    // Group grades by academic year and semester
    const transcript = {};
    let cumulativeCredits = 0;
    let cumulativeGradePoints = 0;

    grades.forEach(grade => {
      const key = `${grade.academicYear}-S${grade.semester}`;

      if (!transcript[key]) {
        transcript[key] = {
          academicYear: grade.academicYear,
          semester: grade.semester,
          courses: [],
          semesterCredits: 0,
          semesterGradePoints: 0,
          semesterGPA: 0
        };
      }

      transcript[key].courses.push({
        courseCode: grade.courseId.courseCode,
        courseName: grade.courseId.courseName,
        credit: grade.courseId.credit,
        letterGrade: grade.letterGrade,
        gradePoints: grade.gradePoints,
        totalMark: grade.totalMark
      });

      transcript[key].semesterCredits += grade.courseId.credit;
      transcript[key].semesterGradePoints += (grade.gradePoints * grade.courseId.credit);

      cumulativeCredits += grade.courseId.credit;
      cumulativeGradePoints += (grade.gradePoints * grade.courseId.credit);
    });

    // Calculate semester GPAs
    Object.keys(transcript).forEach(key => {
      const semester = transcript[key];
      semester.semesterGPA = semester.semesterCredits > 0 ?
        Math.round((semester.semesterGradePoints / semester.semesterCredits) * 100) / 100 : 0;
    });

    const cgpa = cumulativeCredits > 0 ?
      Math.round((cumulativeGradePoints / cumulativeCredits) * 100) / 100 : 0;

    res.status(200).json({
      success: true,
      message: 'Student transcript retrieved successfully',
      data: {
        student: {
          studentId: student.studentId,
          name: `${student.firstName} ${student.fatherName} ${student.grandfatherName}`,
          department: student.department,
          currentYear: student.currentYear,
          enrollmentYear: student.enrollmentYear
        },
        transcript: Object.values(transcript),
        summary: {
          totalCreditsAttempted: cumulativeCredits,
          totalCreditsEarned: cumulativeCredits, // Assuming all attempted are earned for now
          cgpa,
          academicStanding: {
            probation: student.probation || false,
            dismissed: student.dismissed || false,
            status: student.status
          }
        }
      }
    });

  } catch (error) {
    console.error('Get student transcript error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transcript',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};