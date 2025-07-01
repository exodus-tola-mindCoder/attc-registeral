import mongoose from 'mongoose';

const placementRequestSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student ID is required'],
    unique: true // One placement request per student
  },
  firstChoice: {
    type: String,
    required: [true, 'First choice department is required'],
    enum: {
      values: ['Electrical', 'Manufacturing', 'Automotive'],
      message: 'First choice must be one of: Electrical, Manufacturing, Automotive'
    }
  },
  secondChoice: {
    type: String,
    enum: {
      values: ['Electrical', 'Manufacturing', 'Automotive', 'Construction', 'ICT'],
      message: 'Second choice must be one of: Electrical, Manufacturing, Automotive'
    }
  },
  personalStatement: {
    type: String,
    required: [true, 'Personal statement is required'],
    maxlength: [1000, 'Personal statement cannot exceed 1000 characters'],
    minlength: [100, 'Personal statement must be at least 100 characters']
  },
  reasonForChoice: {
    type: String,
    required: [true, 'Reason for choice is required'],
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  careerGoals: {
    type: String,
    maxlength: [500, 'Career goals cannot exceed 500 characters']
  },
  
  // Academic Information
  currentCGPA: {
    type: Number,
    min: 0,
    max: 4,
    default: 0
  },
  totalCredits: {
    type: Number,
    min: 0,
    default: 0
  },
  
  // Status and Workflow
  status: {
    type: String,
    enum: {
      values: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'placed'],
      message: 'Status must be one of: draft, submitted, under_review, approved, rejected, placed'
    },
    default: 'draft'
  },
  
  // Placement Decision
  approvedDepartment: {
    type: String,
    enum: ['Electrical', 'Manufacturing', 'Automotive', 'Construction', 'ICT']
  },
  
  // Committee Review
  committeeComments: {
    type: String,
    maxlength: [1000, 'Committee comments cannot exceed 1000 characters']
  },
  rejectionReason: {
    type: String,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  },
  
  // Workflow Tracking
  submittedAt: Date,
  reviewedAt: Date,
  decidedAt: Date,
  placedAt: Date,
  
  // Committee Members
  reviewedBy: [{
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['departmentHead', 'registrar', 'placementCommittee']
    },
    decision: {
      type: String,
      enum: ['approve', 'reject', 'pending']
    },
    comments: String,
    reviewedAt: Date
  }],
  
  // Academic Year
  academicYear: {
    type: String,
    required: true
  },
  
  // Priority Score (calculated based on CGPA and other factors)
  priorityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  // Department Capacity Check
  departmentCapacityChecked: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Compound indexes
placementRequestSchema.index({ studentId: 1, academicYear: 1 }, { unique: true });
placementRequestSchema.index({ status: 1, submittedAt: -1 });
placementRequestSchema.index({ firstChoice: 1, status: 1 });
placementRequestSchema.index({ approvedDepartment: 1, status: 1 });
placementRequestSchema.index({ priorityScore: -1 });

// Pre-save middleware to calculate priority score and academic year
placementRequestSchema.pre('save', function(next) {
  // Calculate academic year
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  this.academicYear = `${year}-${year + 1}`;
  
  // Calculate priority score based on CGPA and other factors
  let score = 0;
  
  // CGPA component (70% weight)
  if (this.currentCGPA) {
    score += (this.currentCGPA / 4.0) * 70;
  }
  
  // Credits completed component (20% weight)
  if (this.totalCredits >= 30) { // Expected credits for freshman year
    score += 20;
  } else if (this.totalCredits >= 24) {
    score += 15;
  } else if (this.totalCredits >= 18) {
    score += 10;
  }
  
  // Personal statement quality (10% weight - basic length check)
  if (this.personalStatement && this.personalStatement.length >= 300) {
    score += 10;
  } else if (this.personalStatement && this.personalStatement.length >= 200) {
    score += 7;
  } else if (this.personalStatement && this.personalStatement.length >= 100) {
    score += 5;
  }
  
  this.priorityScore = Math.round(score);
  
  next();
});

// Instance method to check if placement request can be submitted
placementRequestSchema.methods.canBeSubmitted = function() {
  return ['draft', 'rejected'].includes(this.status);
};

// Instance method to check if placement request can be modified
placementRequestSchema.methods.canBeModified = function() {
  return ['draft', 'rejected'].includes(this.status);
};

// Instance method to check if placement request can be reviewed
placementRequestSchema.methods.canBeReviewed = function() {
  return this.status === 'submitted';
};

// Instance method to get placement summary
placementRequestSchema.methods.getPlacementSummary = function() {
  return {
    studentId: this.studentId,
    firstChoice: this.firstChoice,
    secondChoice: this.secondChoice,
    status: this.status,
    priorityScore: this.priorityScore,
    currentCGPA: this.currentCGPA,
    submittedAt: this.submittedAt,
    approvedDepartment: this.approvedDepartment
  };
};

// Static method to get placement statistics
placementRequestSchema.statics.getPlacementStats = async function(academicYear = null) {
  const matchQuery = {};
  if (academicYear) {
    matchQuery.academicYear = academicYear;
  }

  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          status: '$status',
          firstChoice: '$firstChoice'
        },
        count: { $sum: 1 },
        averageCGPA: { $avg: '$currentCGPA' },
        averagePriorityScore: { $avg: '$priorityScore' }
      }
    },
    {
      $group: {
        _id: '$_id.firstChoice',
        statusBreakdown: {
          $push: {
            status: '$_id.status',
            count: '$count',
            averageCGPA: '$averageCGPA',
            averagePriorityScore: '$averagePriorityScore'
          }
        },
        totalRequests: { $sum: '$count' }
      }
    },
    {
      $sort: { '_id': 1 }
    }
  ]);

  return stats;
};

// Static method to get pending placements for committee review
placementRequestSchema.statics.getPendingPlacements = function() {
  return this.find({ status: 'submitted' })
    .populate('studentId', 'firstName fatherName grandfatherName studentId email currentCGPA')
    .sort({ priorityScore: -1, submittedAt: 1 });
};

// Static method to check department capacity
placementRequestSchema.statics.checkDepartmentCapacity = async function(department, academicYear) {
  // Get approved placements for the department
  const approvedCount = await this.countDocuments({
    approvedDepartment: department,
    status: { $in: ['approved', 'placed'] },
    academicYear
  });

  // Define department capacities (can be made configurable)
  const departmentCapacities = {
    'Electrical': 50,
    'Manufacturing': 40,
    'Automotive': 35,
    'Construction': 30,
    'ICT': 45
  };

  const capacity = departmentCapacities[department] || 30;
  const available = capacity - approvedCount;

  return {
    department,
    capacity,
    approved: approvedCount,
    available: Math.max(0, available),
    isFull: available <= 0
  };
};

const PlacementRequest = mongoose.model('PlacementRequest', placementRequestSchema);

export default PlacementRequest;