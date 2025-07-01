import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Recipient ID is required']
  },
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: {
      values: ['System', 'Deadline', 'Warning', 'Info'],
      message: 'Type must be one of: System, Deadline, Warning, Info'
    },
    default: 'Info'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  link: {
    type: String,
    trim: true
  },
  sourceType: {
    type: String,
    enum: ['registration', 'grade', 'placement', 'attendance', 'evaluation', 'system', 'admin'],
    default: 'system'
  },
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'sourceModel'
  },
  sourceModel: {
    type: String,
    enum: ['Registration', 'Grade', 'PlacementRequest', 'Attendance', 'Evaluation', 'User', null],
    default: null
  },
  expiresAt: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, isRead: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion
notificationSchema.index({ sourceType: 1, sourceId: 1 });

// Virtual for age of notification
notificationSchema.virtual('age').get(function () {
  const now = new Date();
  const created = new Date(this.createdAt);
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
});

// Method to mark notification as read
notificationSchema.methods.markAsRead = function () {
  this.isRead = true;
  return this.save();
};

// Static method to create a notification
notificationSchema.statics.createNotification = async function (notificationData) {
  try {
    const notification = new this(notificationData);
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    throw error;
  }
};

// Static method to get unread count for a user
notificationSchema.statics.getUnreadCount = async function (userId) {
  try {
    return await this.countDocuments({
      recipientId: userId,
      isRead: false
    });
  } catch (error) {
    console.error('Failed to get unread count:', error);
    return 0;
  }
};

// Static method to mark all as read for a user
notificationSchema.statics.markAllAsRead = async function (userId) {
  try {
    const result = await this.updateMany(
      { recipientId: userId, isRead: false },
      { $set: { isRead: true } }
    );
    return result.modifiedCount;
  } catch (error) {
    console.error('Failed to mark all as read:', error);
    throw error;
  }
};

// Static method to create system broadcast
notificationSchema.statics.createBroadcast = async function (data, roleFilter = null) {
  try {
    const User = mongoose.model('User');

    // Build query for recipients
    const query = { status: 'active' };
    if (roleFilter) {
      if (Array.isArray(roleFilter)) {
        query.role = { $in: roleFilter };
      } else {
        query.role = roleFilter;
      }
    }

    // Get all active users matching role filter
    const users = await User.find(query).select('_id');

    // Create notifications in bulk
    const notifications = users.map(user => ({
      recipientId: user._id,
      title: data.title,
      message: data.message,
      type: data.type || 'System',
      link: data.link,
      sourceType: 'admin',
      createdBy: data.createdBy
    }));

    if (notifications.length > 0) {
      await this.insertMany(notifications);
    }

    return notifications.length;
  } catch (error) {
    console.error('Failed to create broadcast:', error);
    throw error;
  }
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;