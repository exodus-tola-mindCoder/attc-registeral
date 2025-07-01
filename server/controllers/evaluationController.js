import Evaluation from '../models/Evaluation.model.js';
import Grade from '../models/Grade.model.js';
import User from '../models/User.model.js';
import Course from '../models/Course.model.js';
import Registration from '../models/Registration.model.js';

// @desc    Submit instructor evaluation by student
// @route   POST /api/student/submit-evaluation
// @access  Private (Student only)
export const submitEvaluation = async (req, res) => {
  try {
    const {
      instructorId,
      courseId,
      registrationId,
      ratings,
      comments
    } = req.body;

    // Validation
    if (!instructorId || !courseId || !registrationId || !ratings || !Array.isArray(ratings)) {
      return res.status(400).json({
        success: false,
        message: 'Instructor ID, Course ID, Registration ID, and ratings are required'
      });
    }

    // Validate ratings
    const evaluationQuestions = Evaluation.getEvaluationQuestions();
    if (ratings.length !== evaluationQuestions.length) {
      return res.status(400).json({
        success: false,
        message: `All ${evaluationQuestions.length} questions must be answered`
      });
    }

    // Validate each rating
    for (const rating of ratings) {
      if (!rating.questionId || !rating.score || rating.score < 1 || rating.score > 5) {
        return res.status(400).json({
          success: false,
          message: 'Each rating must have a questionId and score between 1-5'
        });
      }
    }

    // Get course and registration details
    const course = await Course.findById(courseId);
    const registration = await Registration.findById(registrationId);
    const instructor = await User.findById(instructorId);

    if (!course || !registration || !instructor) {
      return res.status(404).json({
        success: false,
        message: 'Course, registration, or instructor not found'
      });
    }

    // Verify instructor role
    if (instructor.role !== 'instructor') {
      return res.status(400).json({
        success: false,
        message: 'Selected user is not an instructor'
      });
    }

    // Check if student can evaluate this instructor
    const canEvaluate = await Evaluation.canStudentEvaluate(
      req.user.id,
      instructorId,
      courseId,
      registration.academicYear
    );

    if (!canEvaluate.canEvaluate) {
      return res.status(400).json({
        success: false,
        message: canEvaluate.message
      });
    }

    // Prepare ratings with question text
    const ratingsWithQuestions = ratings.map(rating => {
      const question = evaluationQuestions.find(q => q.id === rating.questionId);
      return {
        questionId: rating.questionId,
        question: question ? question.question : 'Unknown question',
        score: rating.score
      };
    });

    // Create evaluation
    const evaluation = new Evaluation({
      studentId: req.user.id,
      instructorId,
      courseId,
      registrationId,
      academicYear: registration.academicYear,
      semester: course.semester,
      year: course.year,
      department: course.department,
      ratings: ratingsWithQuestions,
      comments: comments || ''
    });

    await evaluation.save();

    console.log(`📝 Evaluation submitted: ${instructor.firstName} ${instructor.fatherName} for ${course.courseCode}`);
    console.log(`   👤 Student: ${req.user.firstName} ${req.user.fatherName}`);
    console.log(`   📊 Overall Rating: ${evaluation.overallRating}/5`);

    res.status(201).json({
      success: true,
      message: 'Evaluation submitted successfully',
      data: {
        evaluation: {
          _id: evaluation._id,
          overallRating: evaluation.overallRating,
          submittedAt: evaluation.submittedAt,
          anonymousHash: evaluation.anonymousHash
        }
      }
    });

  } catch (error) {
    console.error('Submit evaluation error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already evaluated this instructor for this course'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to submit evaluation',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get student's evaluation requirements and status
// @route   GET /api/student/evaluation-status
// @access  Private (Student only)
export const getEvaluationStatus = async (req, res) => {
  try {
    const { academicYear } = req.query;
    const currentAcademicYear = academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

    // Get all courses the student completed this academic year
    const completedGrades = await Grade.find({
      studentId: req.user.id,
      academicYear: currentAcademicYear,
      status: { $in: ['finalized', 'locked'] }
    })
      .populate('courseId', 'courseCode courseName department')
      .populate('instructorId', 'firstName fatherName');

    // Get all evaluations submitted by the student for this academic year
    const submittedEvaluations = await Evaluation.find({
      studentId: req.user.id,
      academicYear: currentAcademicYear
    });

    const evaluatedCourses = submittedEvaluations.map(evaluation => evaluation.courseId.toString());

    // Prepare evaluation requirements
    const evaluationRequirements = completedGrades.map(grade => {
      const isEvaluated = evaluatedCourses.includes(grade.courseId._id.toString());
      const evaluation = submittedEvaluations.find(evaluation =>
        evaluation.courseId.toString() === grade.courseId._id.toString()
      );

      return {
        gradeId: grade._id,
        courseId: grade.courseId._id,
        courseCode: grade.courseId.courseCode,
        courseName: grade.courseId.courseName,
        department: grade.courseId.department,
        instructorId: grade.instructorId._id,
        instructorName: `${grade.instructorId.firstName} ${grade.instructorId.fatherName}`,
        isEvaluated,
        evaluationId: evaluation?._id,
        submittedAt: evaluation?.submittedAt,
        overallRating: evaluation?.overallRating
      };
    });

    const completionStatus = await Evaluation.hasCompletedAllEvaluations(
      req.user.id,
      currentAcademicYear
    );

    res.status(200).json({
      success: true,
      message: 'Evaluation status retrieved successfully',
      data: {
        evaluationRequirements,
        completionStatus,
        academicYear: currentAcademicYear,
        canRegisterNextSemester: completionStatus.hasCompleted
      }
    });

  } catch (error) {
    console.error('Get evaluation status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve evaluation status',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get evaluation questions
// @route   GET /api/student/evaluation-questions
// @access  Private (Student only)
export const getEvaluationQuestions = async (req, res) => {
  try {
    const questions = Evaluation.getEvaluationQuestions();

    res.status(200).json({
      success: true,
      message: 'Evaluation questions retrieved successfully',
      data: {
        questions,
        ratingScale: {
          1: 'Strongly Disagree',
          2: 'Disagree',
          3: 'Neutral',
          4: 'Agree',
          5: 'Strongly Agree'
        }
      }
    });

  } catch (error) {
    console.error('Get evaluation questions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve evaluation questions',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get instructor's evaluation summary
// @route   GET /api/instructor/evaluations
// @access  Private (Instructor only)
export const getInstructorEvaluations = async (req, res) => {
  try {
    const { academicYear } = req.query;

    const summary = await Evaluation.getInstructorSummary(req.user.id, academicYear);
    const questions = Evaluation.getEvaluationQuestions();

    // Map question averages to question details
    const questionSummary = questions.map(question => ({
      ...question,
      averageScore: summary.questionAverages[question.id] || 0
    }));

    res.status(200).json({
      success: true,
      message: 'Instructor evaluation summary retrieved successfully',
      data: {
        summary: {
          totalEvaluations: summary.totalEvaluations,
          averageOverallRating: summary.averageOverallRating,
          ratingDistribution: summary.ratingDistribution
        },
        questionSummary,
        academicYear: academicYear || 'All years'
      }
    });

  } catch (error) {
    console.error('Get instructor evaluations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve instructor evaluations',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get department evaluation statistics
// @route   GET /api/depthead/evaluations
// @access  Private (Department Head only)
export const getDepartmentEvaluations = async (req, res) => {
  try {
    const { department, academicYear } = req.query;

    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'Department parameter is required'
      });
    }

    const departmentStats = await Evaluation.getDepartmentStats(department, academicYear);
    const questions = Evaluation.getEvaluationQuestions();

    // Get detailed evaluations for the department
    const matchQuery = { department };
    if (academicYear) {
      matchQuery.academicYear = academicYear;
    }

    const detailedEvaluations = await Evaluation.find(matchQuery)
      .populate('instructorId', 'firstName fatherName')
      .populate('courseId', 'courseCode courseName')
      .sort({ submittedAt: -1 });

    // Calculate overall department statistics
    const overallStats = await Evaluation.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalEvaluations: { $sum: 1 },
          averageRating: { $avg: '$overallRating' },
          uniqueInstructors: { $addToSet: '$instructorId' },
          uniqueCourses: { $addToSet: '$courseId' }
        }
      }
    ]);

    const stats = overallStats.length > 0 ? overallStats[0] : {
      totalEvaluations: 0,
      averageRating: 0,
      uniqueInstructors: [],
      uniqueCourses: []
    };

    res.status(200).json({
      success: true,
      message: 'Department evaluation statistics retrieved successfully',
      data: {
        departmentStats,
        overallStats: {
          totalEvaluations: stats.totalEvaluations,
          averageRating: Math.round(stats.averageRating * 100) / 100,
          uniqueInstructors: stats.uniqueInstructors.length,
          uniqueCourses: stats.uniqueCourses.length
        },
        evaluations: detailedEvaluations,
        questions,
        filters: {
          department,
          academicYear: academicYear || 'All years'
        }
      }
    });

  } catch (error) {
    console.error('Get department evaluations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve department evaluations',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get comprehensive evaluation reports for president
// @route   GET /api/president/evaluations
// @access  Private (President only)
export const getPresidentEvaluationReports = async (req, res) => {
  try {
    const { academicYear, department } = req.query;

    const matchQuery = {};
    if (academicYear) matchQuery.academicYear = academicYear;
    if (department) matchQuery.department = department;

    // Get evaluation statistics by department
    const departmentStats = await Evaluation.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$department',
          totalEvaluations: { $sum: 1 },
          averageRating: { $avg: '$overallRating' },
          uniqueInstructors: { $addToSet: '$instructorId' },
          uniqueCourses: { $addToSet: '$courseId' }
        }
      },
      {
        $sort: { averageRating: -1 }
      }
    ]);

    // Get top and bottom performing instructors
    const instructorPerformance = await Evaluation.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$instructorId',
          totalEvaluations: { $sum: 1 },
          averageRating: { $avg: '$overallRating' },
          department: { $first: '$department' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'instructor'
        }
      },
      { $unwind: '$instructor' },
      {
        $project: {
          instructorName: {
            $concat: ['$instructor.firstName', ' ', '$instructor.fatherName']
          },
          totalEvaluations: 1,
          averageRating: 1,
          department: 1
        }
      },
      {
        $sort: { averageRating: -1 }
      }
    ]);

    // Get evaluation trends over time
    const evaluationTrends = await Evaluation.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            year: { $year: '$submittedAt' },
            month: { $month: '$submittedAt' }
          },
          totalEvaluations: { $sum: 1 },
          averageRating: { $avg: '$overallRating' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Get question-wise analysis
    const questionAnalysis = await Evaluation.aggregate([
      { $match: matchQuery },
      { $unwind: '$ratings' },
      {
        $group: {
          _id: '$ratings.questionId',
          question: { $first: '$ratings.question' },
          averageScore: { $avg: '$ratings.score' },
          totalResponses: { $sum: 1 }
        }
      },
      {
        $sort: { averageScore: -1 }
      }
    ]);

    res.status(200).json({
      success: true,
      message: 'President evaluation reports retrieved successfully',
      data: {
        departmentStats,
        instructorPerformance: {
          topPerformers: instructorPerformance.slice(0, 10),
          bottomPerformers: instructorPerformance.slice(-10).reverse(),
          total: instructorPerformance.length
        },
        evaluationTrends,
        questionAnalysis,
        overallSummary: {
          totalEvaluations: departmentStats.reduce((sum, dept) => sum + dept.totalEvaluations, 0),
          averageRating: departmentStats.length > 0 ?
            Math.round((departmentStats.reduce((sum, dept) => sum + dept.averageRating, 0) / departmentStats.length) * 100) / 100 : 0,
          totalDepartments: departmentStats.length,
          totalInstructors: [...new Set(instructorPerformance.map(ip => ip._id))].length
        },
        filters: {
          academicYear: academicYear || 'All years',
          department: department || 'All departments'
        }
      }
    });

  } catch (error) {
    console.error('Get president evaluation reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve evaluation reports',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Check if student can register for next semester
// @route   GET /api/student/registration-eligibility
// @access  Private (Student only)
export const checkRegistrationEligibility = async (req, res) => {
  try {
    const currentAcademicYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

    // Check if student has completed all required evaluations
    const evaluationStatus = await Evaluation.hasCompletedAllEvaluations(
      req.user.id,
      currentAcademicYear
    );

    // Get student's current academic standing
    const student = await User.findById(req.user.id);

    let canRegister = true;
    let blockingReasons = [];

    // Check evaluation completion
    if (!evaluationStatus.hasCompleted) {
      canRegister = false;
      blockingReasons.push(`You must complete ${evaluationStatus.missing} instructor evaluation(s) before registering for next semester`);
    }

    // Check academic standing
    if (student.dismissed) {
      canRegister = false;
      blockingReasons.push('Registration blocked due to academic dismissal');
    }

    res.status(200).json({
      success: true,
      message: 'Registration eligibility checked successfully',
      data: {
        canRegister,
        blockingReasons,
        evaluationStatus,
        academicStanding: {
          probation: student.probation || false,
          dismissed: student.dismissed || false,
          status: student.status
        }
      }
    });

  } catch (error) {
    console.error('Check registration eligibility error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check registration eligibility',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};