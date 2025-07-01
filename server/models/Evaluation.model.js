import mongoose from 'mongoose';
import crypto from 'crypto';

const evaluationSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student ID is required']
  },
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Instructor ID is required']
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course ID is required']
  },
  registrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration',
    required: [true, 'Registration ID is required']
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required']
  },
  semester: {
    type: Number,
    required: [true, 'Semester is required'],
    enum: [1, 2]
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: 1,
    max: 5
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    enum: ['Freshman', 'Electrical', 'Manufacturing', 'Automotive',]
  },

  // Evaluation Questions and Ratings
  ratings: [{
    questionId: {
      type: String,
      required: true
    },
    question: {
      type: String,
      required: true
    },
    score: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    }
  }],

  // Overall Rating
  overallRating: {
    type: Number,
    min: 1,
    max: 5,
    default: 0
  },

  // Optional Comments
  comments: {
    type: String,
    maxlength: [500, 'Comments cannot exceed 500 characters'],
    trim: true
  },

  // Submission Details
  submittedAt: {
    type: Date,
    default: Date.now,
    required: true
  },

  // Status
  status: {
    type: String,
    enum: ['submitted', 'processed'],
    default: 'submitted'
  },

  // Anonymous Hash (for tracking without revealing identity)
  anonymousHash: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate evaluations
evaluationSchema.index({
  studentId: 1,
  instructorId: 1,
  courseId: 1,
  academicYear: 1
}, {
  unique: true,
  name: 'unique_evaluation_per_course'
});

// Index for efficient queries
evaluationSchema.index({ instructorId: 1, academicYear: 1, semester: 1 });
evaluationSchema.index({ department: 1, academicYear: 1 });
evaluationSchema.index({ submittedAt: -1 });
evaluationSchema.index({ status: 1 });

// Pre-save middleware to calculate overall rating and generate anonymous hash
evaluationSchema.pre('save', function (next) {
  // Calculate overall rating as average of all ratings
  if (this.ratings && this.ratings.length > 0) {
    const totalScore = this.ratings.reduce((sum, rating) => sum + rating.score, 0);
    this.overallRating = Math.round((totalScore / this.ratings.length) * 100) / 100;
  }

  // Generate anonymous hash for tracking
  if (!this.anonymousHash) {
    this.anonymousHash = crypto.createHash('sha256')
      .update(`${this.studentId}-${this.instructorId}-${this.courseId}-${this.academicYear}`)
      .digest('hex')
      .substring(0, 16);
  }

  next();
});

// Static method to get evaluation questions
evaluationSchema.statics.getEvaluationQuestions = function () {
  return [
    {
      id: 'teaching_clarity',
      question: 'The instructor explains concepts clearly and effectively',
      category: 'Teaching Quality'
    },
    {
      id: 'subject_mastery',
      question: 'The instructor demonstrates strong knowledge of the subject matter',
      category: 'Subject Knowledge'
    },
    {
      id: 'punctuality',
      question: 'The instructor is punctual and well-prepared for classes',
      category: 'Professionalism'
    },
    {
      id: 'feedback_quality',
      question: 'The instructor provides helpful and timely feedback on assignments',
      category: 'Feedback'
    },
    {
      id: 'student_engagement',
      question: 'The instructor encourages student participation and engagement',
      category: 'Engagement'
    },
    {
      id: 'course_organization',
      question: 'The course is well-organized with clear learning objectives',
      category: 'Organization'
    },
    {
      id: 'availability',
      question: 'The instructor is available for help during office hours',
      category: 'Accessibility'
    },
    {
      id: 'fairness',
      question: 'The instructor treats all students fairly and respectfully',
      category: 'Fairness'
    },
    {
      id: 'learning_environment',
      question: 'The instructor creates a positive learning environment',
      category: 'Environment'
    },
    {
      id: 'overall_satisfaction',
      question: 'Overall, I am satisfied with this instructor\'s teaching',
      category: 'Overall'
    }
  ];
};

// Static method to check if student can evaluate instructor
evaluationSchema.statics.canStudentEvaluate = async function (studentId, instructorId, courseId, academicYear) {
  // Check if student was registered for this course with this instructor
  const Registration = mongoose.model('Registration');
  const Grade = mongoose.model('Grade');

  // Check if student has a grade record for this course (meaning they took it)
  const gradeRecord = await Grade.findOne({
    studentId,
    courseId,
    academicYear,
    status: { $in: ['finalized', 'locked'] }
  });

  if (!gradeRecord) {
    return {
      canEvaluate: false,
      message: 'You can only evaluate instructors for courses you have completed'
    };
  }

  // Check if evaluation already exists
  const existingEvaluation = await this.findOne({
    studentId,
    instructorId,
    courseId,
    academicYear
  });

  if (existingEvaluation) {
    return {
      canEvaluate: false,
      message: 'You have already evaluated this instructor for this course'
    };
  }

  return {
    canEvaluate: true,
    message: 'You can evaluate this instructor'
  };
};

// Static method to get instructor evaluation summary
evaluationSchema.statics.getInstructorSummary = async function (instructorId, academicYear = null) {
  const matchQuery = { instructorId };
  if (academicYear) {
    matchQuery.academicYear = academicYear;
  }

  const summary = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalEvaluations: { $sum: 1 },
        averageOverallRating: { $avg: '$overallRating' },
        ratingDistribution: {
          $push: '$overallRating'
        },
        questionAverages: {
          $push: '$ratings'
        }
      }
    }
  ]);

  if (summary.length === 0) {
    return {
      totalEvaluations: 0,
      averageOverallRating: 0,
      questionAverages: {},
      ratingDistribution: {}
    };
  }

  const result = summary[0];

  // Calculate question averages
  const questionAverages = {};
  const questionCounts = {};

  result.questionAverages.forEach(ratings => {
    ratings.forEach(rating => {
      if (!questionAverages[rating.questionId]) {
        questionAverages[rating.questionId] = 0;
        questionCounts[rating.questionId] = 0;
      }
      questionAverages[rating.questionId] += rating.score;
      questionCounts[rating.questionId]++;
    });
  });

  Object.keys(questionAverages).forEach(questionId => {
    questionAverages[questionId] = Math.round((questionAverages[questionId] / questionCounts[questionId]) * 100) / 100;
  });

  // Calculate rating distribution
  const ratingDistribution = {};
  result.ratingDistribution.forEach(rating => {
    const roundedRating = Math.round(rating);
    ratingDistribution[roundedRating] = (ratingDistribution[roundedRating] || 0) + 1;
  });

  return {
    totalEvaluations: result.totalEvaluations,
    averageOverallRating: Math.round(result.averageOverallRating * 100) / 100,
    questionAverages,
    ratingDistribution
  };
};

// Static method to get department evaluation statistics
evaluationSchema.statics.getDepartmentStats = async function (department, academicYear = null) {
  const matchQuery = { department };
  if (academicYear) {
    matchQuery.academicYear = academicYear;
  }

  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $lookup: {
        from: 'users',
        localField: 'instructorId',
        foreignField: '_id',
        as: 'instructor'
      }
    },
    { $unwind: '$instructor' },
    {
      $group: {
        _id: '$instructorId',
        instructorName: {
          $first: {
            $concat: ['$instructor.firstName', ' ', '$instructor.fatherName']
          }
        },
        totalEvaluations: { $sum: 1 },
        averageRating: { $avg: '$overallRating' },
        courses: {
          $addToSet: '$courseId'
        }
      }
    },
    {
      $sort: { averageRating: -1 }
    }
  ]);

  return stats;
};

// Static method to check if student has completed all required evaluations
evaluationSchema.statics.hasCompletedAllEvaluations = async function (studentId, academicYear) {
  const Grade = mongoose.model('Grade');

  // Get all courses the student completed this academic year
  const completedCourses = await Grade.find({
    studentId,
    academicYear,
    status: { $in: ['finalized', 'locked'] }
  }).populate('courseId', 'courseCode courseName');

  if (completedCourses.length === 0) {
    return {
      hasCompleted: true,
      message: 'No courses to evaluate'
    };
  }

  // Get all evaluations submitted by the student for this academic year
  const submittedEvaluations = await this.find({
    studentId,
    academicYear
  });

  const evaluatedCourses = submittedEvaluations.map(evaluation => evaluation.courseId.toString());
  const requiredCourses = completedCourses.map(grade => grade.courseId._id.toString());

  const missingEvaluations = requiredCourses.filter(courseId =>
    !evaluatedCourses.includes(courseId)
  );

  return {
    hasCompleted: missingEvaluations.length === 0,
    totalRequired: requiredCourses.length,
    completed: evaluatedCourses.length,
    missing: missingEvaluations.length,
    missingCourses: missingEvaluations
  };
};

const Evaluation = mongoose.model('Evaluation', evaluationSchema);

export default Evaluation;