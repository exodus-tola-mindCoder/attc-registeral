import React, { useState, useEffect } from 'react';
import {
  Bell, Send, Users, Filter, Loader2, AlertCircle,
  Info, Clock, AlertTriangle, BarChart3, CheckCircle, X
} from 'lucide-react';
import { User } from '../types';

interface AdminNotificationsProps {
  user: User;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

const API_BASE = 'http://localhost:5000/api';

function getNotificationIcon(type: string) {
  switch (type) {
    case 'System':
      return <Info className="h-5 w-5 text-blue-600" />;
    case 'Deadline':
      return <Clock className="h-5 w-5 text-yellow-600" />;
    case 'Warning':
      return <AlertTriangle className="h-5 w-5 text-red-600" />;
    case 'Info':
    default:
      return <CheckCircle className="h-5 w-5 text-green-600" />;
  }
}

const AdminNotifications: React.FC<AdminNotificationsProps> = ({ user, token, onError, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'create' | 'broadcast' | 'stats'>('create');

  // Form states
  const [createForm, setCreateForm] = useState({
    recipientId: '',
    title: '',
    message: '',
    type: 'Info',
    link: ''
  });

  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    type: 'System',
    roles: [] as string[],
    link: '',
    expiresAt: ''
  });

  const [recipients, setRecipients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (activeTab === 'stats') {
      fetchNotificationStats();
    }
  }, [activeTab]);

  const fetchNotificationStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/notifications/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch notification stats');
      onError('Failed to load notification statistics');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    if (!searchTerm || searchTerm.length < 3) return;

    setSearching(true);
    try {
      const response = await fetch(`${API_BASE}/itadmin/users?search=${searchTerm}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setSearchResults(data.data.users || []);
      }
    } catch (err) {
      console.error('Failed to search users');
    } finally {
      setSearching(false);
    }
  };

  const selectRecipient = (user: any) => {
    setCreateForm(prev => ({ ...prev, recipientId: user._id }));
    setRecipients([user]);
    setSearchResults([]);
    setSearchTerm('');
  };

  const handleCreateNotification = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createForm.recipientId) {
      onError('Recipient is required');
      return;
    }

    if (!createForm.title || !createForm.message) {
      onError('Title and message are required');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/notifications`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createForm),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Notification sent successfully');
        setCreateForm({
          recipientId: '',
          title: '',
          message: '',
          type: 'Info',
          link: ''
        });
        setRecipients([]);
      } else {
        onError(data.message || 'Failed to send notification');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!broadcastForm.title || !broadcastForm.message) {
      onError('Title and message are required');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/notifications/broadcast`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...broadcastForm,
          roles: broadcastForm.roles.length > 0 ? broadcastForm.roles : undefined
        }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess(`Broadcast sent to ${data.data.recipientCount} recipients`);
        setBroadcastForm({
          title: '',
          message: '',
          type: 'System',
          roles: [],
          link: '',
          expiresAt: ''
        });
      } else {
        onError(data.message || 'Failed to send broadcast');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (role: string) => {
    setBroadcastForm(prev => {
      const roles = [...prev.roles];
      if (roles.includes(role)) {
        return { ...prev, roles: roles.filter(r => r !== role) };
      } else {
        return { ...prev, roles: [...roles, role] };
      }
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'System':
        return 'text-blue-600 bg-blue-50';
      case 'Deadline':
        return 'text-yellow-600 bg-yellow-50';
      case 'Warning':
        return 'text-red-600 bg-red-50';
      case 'Info':
      default:
        return 'text-green-600 bg-green-50';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Bell className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Notification Management</h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'create'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <Send className="h-4 w-4 inline mr-2" />
            Send to User
          </button>
          <button
            onClick={() => setActiveTab('broadcast')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'broadcast'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <Users className="h-4 w-4 inline mr-2" />
            Broadcast
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'stats'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <BarChart3 className="h-4 w-4 inline mr-2" />
            Statistics
          </button>
        </div>

        {/* Create Notification Tab */}
        {activeTab === 'create' && (
          <div className="space-y-6">
            <form onSubmit={handleCreateNotification} className="space-y-4">
              {/* Recipient Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyUp={(e) => {
                      if (e.key === 'Enter') {
                        searchUsers();
                      }
                    }}
                    placeholder="Search by name, email, or ID..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={searchUsers}
                    className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                  >
                    {searching ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Filter className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-md overflow-hidden">
                    <div className="max-h-40 overflow-y-auto">
                      {searchResults.map((user) => (
                        <div
                          key={user._id}
                          className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-200 last:border-b-0"
                          onClick={() => selectRecipient(user)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {user.firstName} {user.fatherName} {user.grandfatherName}
                              </div>
                              <div className="text-xs text-gray-500">{user.email}</div>
                            </div>
                            <div className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                              {user.role}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Recipients */}
                {recipients.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {recipients.map((user) => (
                      <div key={user._id} className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded-md">
                        <div>
                          <div className="text-sm font-medium text-blue-900">
                            {user.firstName} {user.fatherName}
                          </div>
                          <div className="text-xs text-blue-700">{user.email}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setRecipients([]);
                            setCreateForm(prev => ({ ...prev, recipientId: '' }));
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notification Details */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={createForm.title}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Notification title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  required
                  value={createForm.message}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Notification message"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type
                  </label>
                  <select
                    value={createForm.type}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Info">Info</option>
                    <option value="Deadline">Deadline</option>
                    <option value="Warning">Warning</option>
                    <option value="System">System</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Link (Optional)
                  </label>
                  <input
                    type="text"
                    value={createForm.link}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, link: e.target.value }))}
                    placeholder="e.g., /grades or /registration"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !createForm.recipientId || !createForm.title || !createForm.message}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
                <span>{loading ? 'Sending...' : 'Send Notification'}</span>
              </button>
            </form>
          </div>
        )}

        {/* Broadcast Tab */}
        {activeTab === 'broadcast' && (
          <div className="space-y-6">
            <form onSubmit={handleBroadcast} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={broadcastForm.title}
                  onChange={(e) => setBroadcastForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Broadcast title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  required
                  value={broadcastForm.message}
                  onChange={(e) => setBroadcastForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Broadcast message"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Roles (leave empty for all users)
                </label>
                <div className="flex flex-wrap gap-2">
                  {['student', 'instructor', 'departmentHead', 'registrar', 'itAdmin', 'president'].map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`px-3 py-1 rounded-full text-sm ${broadcastForm.roles.includes(role)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                        }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type
                  </label>
                  <select
                    value={broadcastForm.type}
                    onChange={(e) => setBroadcastForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="System">System</option>
                    <option value="Info">Info</option>
                    <option value="Deadline">Deadline</option>
                    <option value="Warning">Warning</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Link (Optional)
                  </label>
                  <input
                    type="text"
                    value={broadcastForm.link}
                    onChange={(e) => setBroadcastForm(prev => ({ ...prev, link: e.target.value }))}
                    placeholder="e.g., /grades or /registration"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expires At (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={broadcastForm.expiresAt}
                  onChange={(e) => setBroadcastForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If set, the notification will be automatically deleted after this time.
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">Broadcast Warning</h4>
                    <p className="text-xs text-yellow-700 mt-1">
                      This will send a notification to {broadcastForm.roles.length > 0 ? `all users with roles: ${broadcastForm.roles.join(', ')}` : 'ALL users'}.
                      Use this feature responsibly.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !broadcastForm.title || !broadcastForm.message}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Users className="h-5 w-5" />
                )}
                <span>{loading ? 'Sending...' : 'Send Broadcast'}</span>
              </button>
            </form>
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : stats ? (
              <>
                {/* Overall Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm font-medium text-blue-700">Total Notifications</div>
                    <div className="text-2xl font-bold text-blue-900">{stats.total?.total || 0}</div>
                    <div className="text-xs text-blue-600 mt-1">
                      {stats.total?.read || 0} read, {stats.total?.unread || 0} unread
                    </div>
                  </div>

                  {stats.byType?.map((type: any) => (
                    <div key={type._id} className={`p-4 rounded-lg ${getTypeColor(type._id)}`}>
                      <div className="text-sm font-medium">{type._id}</div>
                      <div className="text-2xl font-bold">{type.count}</div>
                      <div className="text-xs mt-1">
                        {type.read} read, {type.unread} unread
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recent Notifications */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="font-medium text-gray-900">Recent Notifications</h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {stats.recent?.map((notification: any) => (
                      <div key={notification._id} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {getNotificationIcon(notification.type)}
                            <div>
                              <div className="text-sm font-medium text-gray-900">{notification.title}</div>
                              <div className="text-xs text-gray-500">
                                To: {notification.recipientId?.firstName} {notification.recipientId?.fatherName} ({notification.recipientId?.role})
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(notification.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-600">{notification.message}</div>
                        <div className="mt-2 flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(notification.type)}`}>
                            {notification.type}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${notification.isRead ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {notification.isRead ? 'Read' : 'Unread'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No statistics available</h3>
                <p className="text-gray-600">
                  Statistics will appear here once notifications have been sent.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminNotifications;