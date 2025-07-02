import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, ExternalLink, Info, Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import { User, Notification } from '../types';

interface NotificationBellProps {
  user: User;
  token: string;
  onError: (message: string) => void;
}

const API_BASE = 'http://localhost:5000/api';

const NotificationBell: React.FC<NotificationBellProps> = ({ user, token, onError }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();

    // Set up polling for new notifications
    const interval = setInterval(() => {
      fetchNotifications(true);
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/notifications?limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setNotifications(data.data.notifications || []);
        setUnreadCount(data.data.unreadCount || 0);
      }
    } catch (err) {
      if (!silent) {
        console.error('Failed to fetch notifications');
        onError('Failed to load notifications');
      }
    } finally {
      if (!silent) setLoading(false);
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

    // Close dropdown
    setIsOpen(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'System':
        return <Bell className="h-4 w-4 text-blue-600" />;
      case 'Deadline':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'Warning':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'Info':
      default:
        return <Info className="h-4 w-4 text-green-600" />;
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
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
        aria-label="Notifications"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg overflow-hidden z-50 border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
              </div>
            ) : notifications.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <div
                    key={notification._id}
                    className={`p-4 ${!notification.isRead ? 'bg-blue-50' : ''} hover:bg-gray-50 transition-colors duration-150`}
                  >
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
                            <button
                              onClick={() => markAsRead(notification._id)}
                              className="text-gray-400 hover:text-gray-600"
                              title="Mark as read"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteNotification(notification._id)}
                              className="text-gray-400 hover:text-red-600"
                              title="Delete"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-xs text-gray-500">
                            {notification.age || new Date(notification.createdAt).toLocaleString()}
                          </p>
                          {notification.link && (
                            <button
                              onClick={() => handleNotificationClick(notification)}
                              className="flex items-center text-xs text-blue-600 hover:text-blue-800"
                            >
                              View <ExternalLink className="h-3 w-3 ml-1" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100">
                  <Bell className="h-6 w-6 text-gray-600" />
                </div>
                <h3 className="mt-3 text-sm font-medium text-gray-900">No notifications</h3>
                <p className="mt-1 text-sm text-gray-500">
                  You don't have any notifications at the moment.
                </p>
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <a
              href="/notifications"
              className="block text-sm text-center font-medium text-blue-600 hover:text-blue-800"
            >
              View all notifications
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;