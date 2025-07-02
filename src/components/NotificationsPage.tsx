import React, { useState, useEffect } from 'react';
import {
  Bell, Check, X, ExternalLink, Info, Clock, AlertTriangle,
  Filter, Search, Trash2, CheckCheck, Loader2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { User, Notification } from '../types';

interface NotificationsPageProps {
  user: User;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

const API_BASE = 'http://localhost:5000/api';

const NotificationsPage: React.FC<NotificationsPageProps> = ({ user, token, onError, onSuccess }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1
  });

  // Filters
  const [filters, setFilters] = useState({
    type: '',
    unreadOnly: false
  });

  useEffect(() => {
    fetchNotifications();
  }, [pagination.page, filters]);

  const fetchNotifications = async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        unreadOnly: filters.unreadOnly.toString()
      });

      if (filters.type) {
        params.append('type', filters.type);
      }

      const response = await fetch(`${API_BASE}/notifications?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setNotifications(data.data.notifications || []);
        setUnreadCount(data.data.unreadCount || 0);
        setPagination(prev => ({
          ...prev,
          total: data.data.pagination.total,
          pages: data.data.pagination.pages
        }));
      }
    } catch (err) {
      console.error('Failed to fetch notifications');
      onError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/notifications/${id}/mark-read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        // Update local state
        setNotifications(prev =>
          prev.map(notif =>
            notif._id === id ? { ...notif, isRead: true } : notif
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to mark notification as read');
      onError('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch(`${API_BASE}/notifications/mark-all-read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        // Update local state
        setNotifications(prev =>
          prev.map(notif => ({ ...notif, isRead: true }))
        );
        setUnreadCount(0);
        onSuccess('All notifications marked as read');
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read');
      onError('Failed to mark all as read');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        // Update local state
        const deletedNotification = notifications.find(n => n._id === id);
        setNotifications(prev => prev.filter(notif => notif._id !== id));

        if (deletedNotification && !deletedNotification.isRead) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }

        onSuccess('Notification deleted');
      }
    } catch (err) {
      console.error('Failed to delete notification');
      onError('Failed to delete notification');
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      markAsRead(notification._id);
    }

    // Navigate to link if provided
    if (notification.link) {
      // For this example, we'll just log the link
      console.log(`Navigating to: ${notification.link}`);

      // In a real app, you would use router navigation
      // navigate(notification.link);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'System':
        return <Bell className="h-5 w-5 text-blue-600" />;
      case 'Deadline':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'Warning':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'Info':
      default:
        return <Info className="h-5 w-5 text-green-600" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'System':
        return 'bg-blue-50 border-blue-200';
      case 'Deadline':
        return 'bg-yellow-50 border-yellow-200';
      case 'Warning':
        return 'bg-red-50 border-red-200';
      case 'Info':
      default:
        return 'bg-green-50 border-green-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Bell className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Notifications</h2>
          </div>

          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm transition-colors duration-200"
              >
                <CheckCheck className="h-4 w-4" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center space-x-4 mb-6">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700">Filter:</span>
          </div>

          <div>
            <select
              value={filters.type}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="System">System</option>
              <option value="Deadline">Deadline</option>
              <option value="Warning">Warning</option>
              <option value="Info">Info</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="unreadOnly"
              checked={filters.unreadOnly}
              onChange={(e) => setFilters(prev => ({ ...prev, unreadOnly: e.target.checked }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="unreadOnly" className="text-sm text-gray-700">
              Unread only
            </label>
          </div>

          <div className="text-sm text-gray-600">
            {unreadCount} unread
          </div>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : notifications.length > 0 ? (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification._id}
                className={`border rounded-lg overflow-hidden ${!notification.isRead ? 'border-blue-300 shadow-sm' : 'border-gray-200'}`}
              >
                <div className={`p-4 ${!notification.isRead ? 'bg-blue-50' : 'bg-white'}`}>
                  <div className="flex items-start">
                    <div className="flex-shrink-0 pt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="ml-3 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </p>
                        <div className="flex items-center space-x-2">
                          {!notification.isRead && (
                            <button
                              onClick={() => markAsRead(notification._id)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Mark as read"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification._id)}
                            className="text-gray-400 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <p className="text-xs text-gray-500">
                            {notification.age || new Date(notification.createdAt).toLocaleString()}
                          </p>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getNotificationColor(notification.type)}`}>
                            {notification.type}
                          </span>
                        </div>
                        {notification.link && (
                          <button
                            onClick={() => handleNotificationClick(notification)}
                            className="flex items-center text-xs text-blue-600 hover:text-blue-800"
                          >
                            View details <ExternalLink className="h-3 w-3 ml-1" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-700">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} notifications
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                    disabled={pagination.page === pagination.pages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
              <Bell className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="mt-3 text-sm font-medium text-gray-900">No notifications</h3>
            <p className="mt-1 text-sm text-gray-500">
              You don't have any notifications at the moment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;