import Notification from '../models/Notification.model.js';
import User from '../models/User.model.js';
import AuditLog from '../models/AuditLog.model.js';

// @desc    Get user's notifications
// @route   GET /api/notifications
// @access  Private
export const getUserNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const query = { recipientId: req.user.id };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const options = {
      sort: { createdAt: -1 },
      skip: (parseInt(page) - 1) * parseInt(limit),
      limit: parseInt(limit),
      populate: {
        path: 'createdBy',
        select: 'firstName fatherName role'
      }
    };

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query, null, options),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipientId: req.user.id, isRead: false })
    ]);

    res.status(200).json({
      success: true,
      message: 'Notifications retrieved successfully',
      data: {
        notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        unreadCount
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/mark-read
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check if notification belongs to the user
    if (notification.recipientId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this notification'
      });
    }

    // Mark as read if not already
    if (!notification.isRead) {
      notification.isRead = true;
      await notification.save();
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: {
        notification
      }
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private
export const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipientId: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: {
        count: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check if notification belongs to the user
    if (notification.recipientId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this notification'
      });
    }

    await Notification.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Create notification (Admin only)
// @route   POST /api/notifications
// @access  Private (Admin, Registrar, Department Head)
export const createNotification = async (req, res) => {
  try {
    const { recipientId, title, message, type, link, sourceType, sourceId, sourceModel, expiresAt } = req.body;

    // Validate recipient
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    const notification = await Notification.create({
      recipientId,
      title,
      message,
      type: type || 'Info',
      link,
      sourceType: sourceType || 'admin',
      sourceId,
      sourceModel,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      createdBy: req.user.id
    });

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'NOTIFICATION_CREATED',
      targetId: notification._id,
      targetModel: 'Notification',
      targetName: notification.title,
      category: 'data_modification',
      severity: 'low',
      details: {
        recipientId,
        recipientName: `${recipient.firstName} ${recipient.fatherName}`,
        notificationType: type,
        message
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: {
        notification
      }
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Create broadcast notification (Admin only)
// @route   POST /api/notifications/broadcast
// @access  Private (Admin, Registrar)
export const createBroadcast = async (req, res) => {
  try {
    const { title, message, type, roles, link, expiresAt } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    // Create broadcast
    const count = await Notification.createBroadcast({
      title,
      message,
      type: type || 'System',
      link,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      createdBy: req.user.id
    }, roles);

    // Create audit log
    await AuditLog.createLog({
      actorId: req.user.id,
      actorName: `${req.user.firstName} ${req.user.fatherName}`,
      actorRole: req.user.role,
      action: 'NOTIFICATION_BROADCAST',
      category: 'data_modification',
      severity: 'medium',
      details: {
        title,
        type,
        targetRoles: roles || 'All',
        recipientCount: count
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      message: 'Broadcast notification sent successfully',
      data: {
        recipientCount: count
      }
    });
  } catch (error) {
    console.error('Create broadcast error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send broadcast notification',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// @desc    Get notification statistics (Admin only)
// @route   GET /api/notifications/stats
// @access  Private (Admin, Registrar)
export const getNotificationStats = async (req, res) => {
  try {
    const stats = await Notification.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          read: { $sum: { $cond: ['$isRead', 1, 0] } },
          unread: { $sum: { $cond: ['$isRead', 0, 1] } }
        }
      }
    ]);

    const totalStats = await Notification.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          read: { $sum: { $cond: ['$isRead', 1, 0] } },
          unread: { $sum: { $cond: ['$isRead', 0, 1] } }
        }
      }
    ]);

    // Get recent notifications
    const recentNotifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('recipientId', 'firstName fatherName role')
      .populate('createdBy', 'firstName fatherName role');

    res.status(200).json({
      success: true,
      message: 'Notification statistics retrieved successfully',
      data: {
        byType: stats,
        total: totalStats[0] || { total: 0, read: 0, unread: 0 },
        recent: recentNotifications
      }
    });
  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve notification statistics',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// Utility function to create a notification
export const createSystemNotification = async (data) => {
  try {
    const notification = await Notification.create({
      recipientId: data.recipientId,
      title: data.title,
      message: data.message,
      type: data.type || 'System',
      link: data.link,
      sourceType: data.sourceType || 'system',
      sourceId: data.sourceId,
      sourceModel: data.sourceModel,
      expiresAt: data.expiresAt,
      createdBy: data.createdBy
    });

    return notification;
  } catch (error) {
    console.error('Create system notification error:', error);
    return null;
  }
};

// Export utility functions for use in other controllers
export const notificationUtils = {
  createSystemNotification,
  createBroadcastNotification: async (data, roles) => {
    try {
      return await Notification.createBroadcast(data, roles);
    } catch (error) {
      console.error('Create broadcast notification error:', error);
      return 0;
    }
  }
};