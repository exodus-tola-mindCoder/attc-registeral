import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Actor ID is required']
  },
  actorName: {
    type: String,
    required: [true, 'Actor name is required']
  },
  actorRole: {
    type: String,
    required: [true, 'Actor role is required'],
    enum: ['student', 'instructor', 'departmentHead', 'registrar', 'itAdmin', 'president', 'placementCommittee']
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    enum: [
      // Authentication & User Management
      'USER_LOGIN',
      'USER_LOGOUT',
      'USER_CREATED',
      'USER_UPDATED',
      'USER_DELETED',
      'PASSWORD_RESET',
      'PASSWORD_CHANGED',

      // Academic Operations
      'COURSE_CREATED',
      'COURSE_UPDATED',
      'COURSE_DELETED',
      'STUDENT_REGISTERED',
      'REGISTRATION_CANCELLED',

      // Grade Management
      'GRADE_SUBMITTED',
      'GRADE_APPROVED',
      'GRADE_REJECTED',
      'GRADE_FINALIZED',
      'GRADE_LOCKED',

      // Placement Management
      'PLACEMENT_SUBMITTED',
      'PLACEMENT_APPROVED',
      'PLACEMENT_REJECTED',

      // Evaluation System
      'EVALUATION_SUBMITTED',
      'EVALUATION_VIEWED',

      // System Administration
      'SYSTEM_BACKUP',
      'SYSTEM_RESTORE',
      'DATA_EXPORT',
      'DATA_IMPORT',

      // Security Events
      'UNAUTHORIZED_ACCESS_ATTEMPT',
      'PERMISSION_DENIED',
      'SUSPICIOUS_ACTIVITY'
    ]
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'targetModel'
  },
  targetModel: {
    type: String,
    enum: ['User', 'Course', 'Registration', 'Grade', 'PlacementRequest', 'Evaluation']
  },
  targetName: {
    type: String
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['authentication', 'authorization', 'data_modification', 'system_operation', 'security'],
    required: true
  },
  success: {
    type: Boolean,
    default: true
  },
  errorMessage: {
    type: String
  },
  sessionId: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetId: 1, createdAt: -1 });
auditLogSchema.index({ severity: 1, createdAt: -1 });
auditLogSchema.index({ category: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ success: 1, createdAt: -1 });

// Static method to create audit log entry
auditLogSchema.statics.createLog = async function (logData) {
  try {
    const log = new this(logData);
    await log.save();
    return log;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error to prevent breaking main operations
    return null;
  }
};

// Static method to get logs with filters
auditLogSchema.statics.getLogs = async function (filters = {}, options = {}) {
  const {
    actorId,
    action,
    category,
    severity,
    success,
    startDate,
    endDate,
    targetId,
    page = 1,
    limit = 50,
    sortBy = 'createdAt',
    sortOrder = -1
  } = { ...filters, ...options };

  const query = {};

  if (actorId) query.actorId = actorId;
  if (action) query.action = action;
  if (category) query.category = category;
  if (severity) query.severity = severity;
  if (success !== undefined) query.success = success;
  if (targetId) query.targetId = targetId;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder };

  const [logs, total] = await Promise.all([
    this.find(query)
      .populate('actorId', 'firstName fatherName email role')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    this.countDocuments(query)
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to get audit statistics
auditLogSchema.statics.getStatistics = async function (timeframe = '30d') {
  const now = new Date();
  let startDate;

  switch (timeframe) {
    case '24h':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const stats = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $facet: {
        totalLogs: [{ $count: "count" }],
        byAction: [
          { $group: { _id: "$action", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ],
        byCategory: [
          { $group: { _id: "$category", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ],
        bySeverity: [
          { $group: { _id: "$severity", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ],
        bySuccess: [
          { $group: { _id: "$success", count: { $sum: 1 } } }
        ],
        timeline: [
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$createdAt"
                }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { "_id": 1 } }
        ],
        topActors: [
          { $group: { _id: "$actorId", actorName: { $first: "$actorName" }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]
      }
    }
  ]);

  return {
    timeframe,
    startDate,
    endDate: now,
    ...stats[0]
  };
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;