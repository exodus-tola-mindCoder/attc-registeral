import User from '../models/User.model.js';
import AuditLog from '../models/AuditLog.model.js';
import mongoose from 'mongoose';
import os from 'os';

// System health tracking
let systemStats = {
  startTime: new Date(),
  requestCount: 0,
  errorCount: 0,
  lastError: null,
  activeConnections: 0
};

// Middleware to track requests
export const trackRequest = (req, res, next) => {
  systemStats.requestCount++;
  systemStats.activeConnections++;

  res.on('finish', () => {
    systemStats.activeConnections--;
    if (res.statusCode >= 400) {
      systemStats.errorCount++;
      systemStats.lastError = {
        timestamp: new Date(),
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      };
    }
  });

  next();
};

// @desc    Create new user account (staff/admin only)
// @route   POST /api/itadmin/create-user
// @access  Private (IT Admin only)
export const createUser = async (req, res) => {
  try {
    const {
      firstName,
      fatherName,
      grandfatherName,
      email,
      role,
      department,
      temporaryPassword,
      mustChangePassword = true
    } = req.body;

    // Validation
    if (!firstName || !fatherName || !grandfatherName || !email || !role) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate role
    const allowedRoles = ['instructor', 'departmentHead', 'registrar', 'itAdmin', 'president', 'placementCommittee'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${allowedRoles.join(', ')}`
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Generate temporary password if not provided
    const password = temporaryPassword || User.generateTempPassword();

    // Create user
    const userData = {
      firstName: firstName.trim(),
      fatherName: fatherName.trim(),
      grandfatherName: grandfatherName.trim(),
      email: email.toLowerCase().trim(),
      password,
      role,
      mustChangePassword,
      status: 'active'
    };

    // Add department for department heads
    if (role === 'departmentHead' && department) {
      userData.department = department;
    }

    const user = new User(userData);
    await user.save();

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'USER_CREATED',
      targetId: user._id,
      targetModel: 'User',
      targetName: `${user.firstName} ${user.fatherName}`,
      category: 'data_modification',
      severity: 'medium',
      details: {
        userRole: role,
        department: department || null,
        createdBy: req.user.id
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    console.log(`👤 New user created: ${user.firstName} ${user.fatherName} (${role}) by ${req.user.firstName} ${req.user.fatherName}`);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          fatherName: user.fatherName,
          grandfatherName: user.grandfatherName,
          email: user.email,
          role: user.role,
          department: user.department,
          status: user.status,
          mustChangePassword: user.mustChangePassword
        },
        temporaryPassword: password
      }
    });

  } catch (error) {
    console.error('Create user error:', error);

    // Log error
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'USER_CREATED',
      category: 'data_modification',
      severity: 'high',
      success: false,
      errorMessage: error.message,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Update user information
// @route   PUT /api/itadmin/update-user/:id
// @access  Private (IT Admin only)
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      fatherName,
      grandfatherName,
      email,
      role,
      department,
      status
    } = req.body;

    // Find user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Store original data for audit
    const originalData = {
      firstName: user.firstName,
      fatherName: user.fatherName,
      grandfatherName: user.grandfatherName,
      email: user.email,
      role: user.role,
      department: user.department,
      status: user.status
    };

    // Update fields
    if (firstName) user.firstName = firstName.trim();
    if (fatherName) user.fatherName = fatherName.trim();
    if (grandfatherName) user.grandfatherName = grandfatherName.trim();
    if (email) user.email = email.toLowerCase().trim();
    if (role) user.role = role;
    if (department) user.department = department;
    if (status) user.status = status;

    await user.save();

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'USER_UPDATED',
      targetId: user._id,
      targetModel: 'User',
      targetName: `${user.firstName} ${user.fatherName}`,
      category: 'data_modification',
      severity: 'medium',
      details: {
        originalData,
        updatedData: {
          firstName: user.firstName,
          fatherName: user.fatherName,
          grandfatherName: user.grandfatherName,
          email: user.email,
          role: user.role,
          department: user.department,
          status: user.status
        },
        updatedBy: req.user.id
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    console.log(`✏️ User updated: ${user.firstName} ${user.fatherName} by ${req.user.firstName} ${req.user.fatherName}`);

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: user.toJSON()
      }
    });

  } catch (error) {
    console.error('Update user error:', error);

    // Log error
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'USER_UPDATED',
      targetId: req.params.id,
      category: 'data_modification',
      severity: 'high',
      success: false,
      errorMessage: error.message,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Reset user password
// @route   POST /api/itadmin/reset-password/:id
// @access  Private (IT Admin only)
export const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword, mustChangePassword = true } = req.body;

    // Find user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate new password if not provided
    const password = newPassword || User.generateTempPassword();

    // Update password
    user.password = password;
    user.mustChangePassword = mustChangePassword;
    await user.save();

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'PASSWORD_RESET',
      targetId: user._id,
      targetModel: 'User',
      targetName: `${user.firstName} ${user.fatherName}`,
      category: 'authentication',
      severity: 'high',
      details: {
        resetBy: req.user.id,
        mustChangePassword,
        targetUserRole: user.role
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    console.log(`🔑 Password reset: ${user.firstName} ${user.fatherName} (${user.role}) by ${req.user.firstName} ${req.user.fatherName}`);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
      data: {
        temporaryPassword: password,
        mustChangePassword
      }
    });

  } catch (error) {
    console.error('Reset password error:', error);

    // Log error
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'PASSWORD_RESET',
      targetId: req.params.id,
      category: 'authentication',
      severity: 'critical',
      success: false,
      errorMessage: error.message,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get all users with filtering
// @route   GET /api/itadmin/users
// @access  Private (IT Admin only)
export const getUsers = async (req, res) => {
  try {
    const {
      role,
      department,
      status,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (role) query.role = role;
    if (department) query.department = department;
    if (status) query.status = status;

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { fatherName: { $regex: search, $options: 'i' } },
        { grandfatherName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [users, total] = await Promise.all([
      User.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Delete user account
// @route   DELETE /api/itadmin/delete-user/:id
// @access  Private (IT Admin only)
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Find user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deletion of IT Admin accounts (safety measure)
    if (user.role === 'itAdmin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete IT Admin accounts'
      });
    }

    // Store user data for audit
    const userData = {
      firstName: user.firstName,
      fatherName: user.fatherName,
      grandfatherName: user.grandfatherName,
      email: user.email,
      role: user.role,
      department: user.department,
      studentId: user.studentId
    };

    await User.findByIdAndDelete(id);

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'USER_DELETED',
      targetId: id,
      targetModel: 'User',
      targetName: `${userData.firstName} ${userData.fatherName}`,
      category: 'data_modification',
      severity: 'high',
      details: {
        deletedUserData: userData,
        deletedBy: req.user.id
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    console.log(`🗑️ User deleted: ${userData.firstName} ${userData.fatherName} (${userData.role}) by ${req.user.firstName} ${req.user.fatherName}`);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);

    // Log error
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'USER_DELETED',
      targetId: req.params.id,
      category: 'data_modification',
      severity: 'critical',
      success: false,
      errorMessage: error.message,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get system health status
// @route   GET /api/itadmin/system-health
// @access  Private (IT Admin only)
export const getSystemHealth = async (req, res) => {
  try {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Database connection status
    const dbStatus = mongoose.connection.readyState;
    const dbStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    // System information
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg(),
      hostname: os.hostname()
    };

    // Database statistics
    const dbStats = await mongoose.connection.db.stats();

    // Recent error logs
    const recentErrors = await AuditLog.find({
      success: false,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('action errorMessage createdAt severity');

    // System metrics
    const metrics = {
      uptime: {
        seconds: uptime,
        formatted: formatUptime(uptime)
      },
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        percentage: ((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(2)
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      database: {
        status: dbStates[dbStatus],
        collections: dbStats.collections,
        documents: dbStats.objects,
        dataSize: dbStats.dataSize,
        storageSize: dbStats.storageSize,
        indexes: dbStats.indexes,
        indexSize: dbStats.indexSize
      },
      requests: {
        total: systemStats.requestCount,
        errors: systemStats.errorCount,
        active: systemStats.activeConnections,
        errorRate: systemStats.requestCount > 0 ?
          ((systemStats.errorCount / systemStats.requestCount) * 100).toFixed(2) : 0
      },
      lastError: systemStats.lastError
    };

    // Health score calculation
    let healthScore = 100;

    // Deduct points for high memory usage
    if (metrics.memory.percentage > 90) healthScore -= 20;
    else if (metrics.memory.percentage > 70) healthScore -= 10;

    // Deduct points for high error rate
    if (metrics.requests.errorRate > 10) healthScore -= 30;
    else if (metrics.requests.errorRate > 5) healthScore -= 15;

    // Deduct points for database issues
    if (dbStatus !== 1) healthScore -= 40;

    // Deduct points for recent errors
    if (recentErrors.length > 10) healthScore -= 20;
    else if (recentErrors.length > 5) healthScore -= 10;

    const healthStatus = healthScore >= 80 ? 'healthy' :
      healthScore >= 60 ? 'warning' : 'critical';

    res.status(200).json({
      success: true,
      message: 'System health retrieved successfully',
      data: {
        status: healthStatus,
        score: Math.max(0, healthScore),
        timestamp: new Date(),
        metrics,
        systemInfo,
        recentErrors,
        recommendations: generateRecommendations(metrics, recentErrors)
      }
    });

  } catch (error) {
    console.error('Get system health error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve system health',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get audit logs
// @route   GET /api/itadmin/audit-logs
// @access  Private (IT Admin only)
export const getAuditLogs = async (req, res) => {
  try {
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
      sortOrder = 'desc'
    } = req.query;

    const filters = {
      actorId,
      action,
      category,
      severity,
      success: success !== undefined ? success === 'true' : undefined,
      startDate,
      endDate,
      targetId
    };

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder: sortOrder === 'desc' ? -1 : 1
    };

    const result = await AuditLog.getLogs(filters, options);

    res.status(200).json({
      success: true,
      message: 'Audit logs retrieved successfully',
      data: result
    });

  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit logs',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get audit statistics
// @route   GET /api/itadmin/audit-stats
// @access  Private (IT Admin only)
export const getAuditStats = async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;

    const stats = await AuditLog.getStatistics(timeframe);

    res.status(200).json({
      success: true,
      message: 'Audit statistics retrieved successfully',
      data: stats
    });

  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit statistics',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get dashboard overview
// @route   GET /api/itadmin/dashboard
// @access  Private (IT Admin only)
export const getDashboardOverview = async (req, res) => {
  try {
    // Get user counts by role
    const userStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          inactive: {
            $sum: { $cond: [{ $ne: ['$status', 'active'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get recent activities
    const recentActivities = await AuditLog.find()
      .populate('actorId', 'firstName fatherName role')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('action actorName actorRole targetName createdAt severity category');

    // Get system alerts
    const alerts = [];

    // Check for recent errors
    const recentErrorCount = await AuditLog.countDocuments({
      success: false,
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    });

    if (recentErrorCount > 5) {
      alerts.push({
        type: 'error',
        message: `${recentErrorCount} errors in the last hour`,
        severity: 'high',
        timestamp: new Date()
      });
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    if (memoryPercentage > 85) {
      alerts.push({
        type: 'performance',
        message: `High memory usage: ${memoryPercentage.toFixed(1)}%`,
        severity: 'warning',
        timestamp: new Date()
      });
    }

    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      alerts.push({
        type: 'database',
        message: 'Database connection issue detected',
        severity: 'critical',
        timestamp: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: 'Dashboard overview retrieved successfully',
      data: {
        userStats,
        recentActivities,
        alerts,
        systemMetrics: {
          uptime: process.uptime(),
          memoryUsage: memoryPercentage.toFixed(1),
          requestCount: systemStats.requestCount,
          errorCount: systemStats.errorCount,
          activeConnections: systemStats.activeConnections
        }
      }
    });

  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard overview',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// Helper functions
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

function generateRecommendations(metrics, recentErrors) {
  const recommendations = [];

  if (metrics.memory.percentage > 80) {
    recommendations.push({
      type: 'performance',
      priority: 'high',
      message: 'Consider optimizing memory usage or increasing server resources'
    });
  }

  if (metrics.requests.errorRate > 5) {
    recommendations.push({
      type: 'reliability',
      priority: 'medium',
      message: 'High error rate detected. Review recent error logs and fix underlying issues'
    });
  }

  if (recentErrors.length > 5) {
    recommendations.push({
      type: 'monitoring',
      priority: 'medium',
      message: 'Multiple recent errors detected. Consider implementing additional monitoring'
    });
  }

  if (metrics.database.status !== 'connected') {
    recommendations.push({
      type: 'database',
      priority: 'critical',
      message: 'Database connection issues detected. Check database server status'
    });
  }

  return recommendations;
}