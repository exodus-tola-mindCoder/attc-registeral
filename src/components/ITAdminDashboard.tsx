import React, { useState, useEffect } from 'react';
import {
  Shield, Users, Activity, AlertTriangle, CheckCircle, Clock,
  Plus, Edit, Trash2, Key, Search, Filter, Download,
  Server, Database, Cpu, HardDrive, TrendingUp, TrendingDown,
  Eye, RefreshCw, Settings, UserPlus, Lock, Unlock
} from 'lucide-react';
import { User } from '../types';

interface ITAdminDashboardProps {
  user: User;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

interface SystemHealth {
  status: string;
  score: number;
  metrics: {
    uptime: { seconds: number; formatted: string };
    memory: { used: number; total: number; percentage: string };
    database: { status: string; collections: number; documents: number };
    requests: { total: number; errors: number; active: number; errorRate: string };
  };
  recentErrors: any[];
  recommendations: any[];
}

interface AuditLog {
  _id: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetName?: string;
  category: string;
  severity: string;
  success: boolean;
  createdAt: string;
  details?: any;
}

interface UserAccount {
  _id: string;
  firstName: string;
  fatherName: string;
  grandfatherName: string;
  email: string;
  role: string;
  department?: string;
  status: string;
  mustChangePassword: boolean;
  createdAt: string;
}

const API_BASE = 'http://localhost:5000/api';

const ITAdminDashboard: React.FC<ITAdminDashboardProps> = ({ user, token, onError, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'health' | 'audit' | 'create'>('dashboard');
  const [loading, setLoading] = useState(false);

  // Dashboard data
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);

  // Filters and pagination
  const [userFilters, setUserFilters] = useState({
    role: '',
    status: '',
    search: ''
  });
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    category: '',
    severity: '',
    success: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  });

  // Create user form
  const [createUserForm, setCreateUserForm] = useState({
    firstName: '',
    fatherName: '',
    grandfatherName: '',
    email: '',
    role: '',
    department: '',
    temporaryPassword: '',
    mustChangePassword: true
  });

  const roles = ['instructor', 'departmentHead', 'registrar', 'itAdmin', 'president', 'placementCommittee'];
  const departments = ['Electrical', 'Manufacturing', 'Automotive', 'Construction', 'ICT'];

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboardData();
    } else if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'health') {
      fetchSystemHealth();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, userFilters, auditFilters, pagination.page]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/itadmin/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setDashboardData(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemHealth = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/itadmin/system-health`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setSystemHealth(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch system health');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...userFilters
      });

      const response = await fetch(`${API_BASE}/itadmin/users?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.data.users);
        setPagination(prev => ({ ...prev, total: data.data.pagination.total }));
      }
    } catch (err) {
      console.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...auditFilters
      });

      const response = await fetch(`${API_BASE}/itadmin/audit-logs?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setAuditLogs(data.data.logs);
        setPagination(prev => ({ ...prev, total: data.data.pagination.total }));
      }
    } catch (err) {
      console.error('Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/itadmin/create-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createUserForm)
      });

      const data = await response.json();
      if (data.success) {
        onSuccess(`User created successfully! Temporary password: ${data.data.temporaryPassword}`);
        setCreateUserForm({
          firstName: '',
          fatherName: '',
          grandfatherName: '',
          email: '',
          role: '',
          department: '',
          temporaryPassword: '',
          mustChangePassword: true
        });
        setActiveTab('users');
      } else {
        onError(data.message);
      }
    } catch (err) {
      onError('Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (userId: string, userName: string) => {
    if (!confirm(`Reset password for ${userName}?`)) return;

    try {
      const response = await fetch(`${API_BASE}/itadmin/reset-password/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mustChangePassword: true })
      });

      const data = await response.json();
      if (data.success) {
        onSuccess(`Password reset for ${userName}. New password: ${data.data.temporaryPassword}`);
      } else {
        onError(data.message);
      }
    } catch (err) {
      onError('Failed to reset password');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Delete user ${userName}? This action cannot be undone.`)) return;

    try {
      const response = await fetch(`${API_BASE}/itadmin/delete-user/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        onSuccess(`User ${userName} deleted successfully`);
        fetchUsers();
      } else {
        onError(data.message);
      }
    } catch (err) {
      onError('Failed to delete user');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'text-blue-600 bg-blue-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* IT Admin Dashboard Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Shield className="h-6 w-6 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-900">IT Administration Dashboard</h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'dashboard'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <Activity className="h-4 w-4 inline mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'users'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <Users className="h-4 w-4 inline mr-2" />
            User Management
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'create'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <UserPlus className="h-4 w-4 inline mr-2" />
            Create User
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'health'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <Server className="h-4 w-4 inline mr-2" />
            System Health
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'audit'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <Eye className="h-4 w-4 inline mr-2" />
            Audit Logs
          </button>
        </div>

        {/* Dashboard Overview */}
        {activeTab === 'dashboard' && dashboardData && (
          <div className="space-y-6">
            {/* System Alerts */}
            {dashboardData.alerts?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-medium text-red-900 mb-3 flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  System Alerts
                </h3>
                <div className="space-y-2">
                  {dashboardData.alerts.map((alert: any, index: number) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-red-800">{alert.message}</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-blue-600">System Uptime</p>
                    <p className="text-lg font-bold text-blue-900">
                      {Math.floor(dashboardData.systemMetrics.uptime / 3600)}h
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-green-600">Total Requests</p>
                    <p className="text-lg font-bold text-green-900">
                      {dashboardData.systemMetrics.requestCount.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <HardDrive className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-yellow-600">Memory Usage</p>
                    <p className="text-lg font-bold text-yellow-900">
                      {dashboardData.systemMetrics.memoryUsage}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-red-600">Error Count</p>
                    <p className="text-lg font-bold text-red-900">
                      {dashboardData.systemMetrics.errorCount}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* User Statistics */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-4">User Statistics by Role</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {dashboardData.userStats?.map((stat: any) => (
                  <div key={stat._id} className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{stat.count}</div>
                    <div className="text-sm text-gray-600 capitalize">{stat._id}</div>
                    <div className="text-xs text-green-600">{stat.active} active</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activities */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">Recent Activities</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {dashboardData.recentActivities?.slice(0, 10).map((activity: any) => (
                  <div key={activity._id} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {activity.actorName} ({activity.actorRole})
                      </div>
                      <div className="text-sm text-gray-600">
                        {activity.action.replace(/_/g, ' ').toLowerCase()}
                        {activity.targetName && ` - ${activity.targetName}`}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(activity.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* User Management */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <select
                    value={userFilters.role}
                    onChange={(e) => setUserFilters(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">All Roles</option>
                    {roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={userFilters.status}
                    onChange={(e) => setUserFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      value={userFilters.search}
                      onChange={(e) => setUserFilters(prev => ({ ...prev, search: e.target.value }))}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Search by name or email..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {user.firstName} {user.fatherName} {user.grandfatherName}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {user.role}
                          </span>
                          {user.department && (
                            <div className="text-xs text-gray-500 mt-1">{user.department}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                            {user.status}
                          </span>
                          {user.mustChangePassword && (
                            <div className="flex items-center mt-1">
                              <Lock className="h-3 w-3 text-yellow-500 mr-1" />
                              <span className="text-xs text-yellow-600">Must change password</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleResetPassword(user._id, `${user.firstName} ${user.fatherName}`)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Reset Password"
                            >
                              <Key className="h-4 w-4" />
                            </button>
                            {user.role !== 'itAdmin' && (
                              <button
                                onClick={() => handleDeleteUser(user._id, `${user.firstName} ${user.fatherName}`)}
                                className="text-red-600 hover:text-red-900"
                                title="Delete User"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Create User */}
        {activeTab === 'create' && (
          <div className="max-w-2xl">
            <h3 className="text-lg font-medium text-gray-900 mb-6">Create New User Account</h3>

            <form onSubmit={handleCreateUser} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                  <input
                    type="text"
                    required
                    value={createUserForm.firstName}
                    onChange={(e) => setCreateUserForm(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Father's Name</label>
                  <input
                    type="text"
                    required
                    value={createUserForm.fatherName}
                    onChange={(e) => setCreateUserForm(prev => ({ ...prev, fatherName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Grandfather's Name</label>
                <input
                  type="text"
                  required
                  value={createUserForm.grandfatherName}
                  onChange={(e) => setCreateUserForm(prev => ({ ...prev, grandfatherName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  required
                  value={createUserForm.email}
                  onChange={(e) => setCreateUserForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <select
                    required
                    value={createUserForm.role}
                    onChange={(e) => setCreateUserForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select Role</option>
                    {roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                {createUserForm.role === 'departmentHead' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                    <select
                      required
                      value={createUserForm.department}
                      onChange={(e) => setCreateUserForm(prev => ({ ...prev, department: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select Department</option>
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temporary Password (optional)
                </label>
                <input
                  type="text"
                  value={createUserForm.temporaryPassword}
                  onChange={(e) => setCreateUserForm(prev => ({ ...prev, temporaryPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Leave empty to auto-generate"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="mustChangePassword"
                  checked={createUserForm.mustChangePassword}
                  onChange={(e) => setCreateUserForm(prev => ({ ...prev, mustChangePassword: e.target.checked }))}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <label htmlFor="mustChangePassword" className="ml-2 block text-sm text-gray-900">
                  User must change password on first login
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-3 px-4 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span>{loading ? 'Creating...' : 'Create User'}</span>
              </button>
            </form>
          </div>
        )}

        {/* System Health */}
        {activeTab === 'health' && systemHealth && (
          <div className="space-y-6">
            {/* Health Status */}
            <div className={`border rounded-lg p-6 ${getStatusColor(systemHealth.status)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">System Health Status</h3>
                  <p className="text-sm mt-1">Overall system health score: {systemHealth.score}/100</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{systemHealth.status.toUpperCase()}</div>
                  <button
                    onClick={fetchSystemHealth}
                    className="mt-2 text-sm underline flex items-center"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            {/* System Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-blue-600">Uptime</p>
                    <p className="text-lg font-bold text-blue-900">{systemHealth.metrics.uptime.formatted}</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <Cpu className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-green-600">Memory Usage</p>
                    <p className="text-lg font-bold text-green-900">{systemHealth.metrics.memory.percentage}%</p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <Database className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-purple-600">Database</p>
                    <p className="text-lg font-bold text-purple-900">{systemHealth.metrics.database.status}</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <TrendingDown className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-yellow-600">Error Rate</p>
                    <p className="text-lg font-bold text-yellow-900">{systemHealth.metrics.requests.errorRate}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {systemHealth.recommendations?.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="font-medium text-yellow-900 mb-4">System Recommendations</h3>
                <div className="space-y-2">
                  {systemHealth.recommendations.map((rec: any, index: number) => (
                    <div key={index} className="flex items-start space-x-3">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-yellow-800">{rec.type}</div>
                        <div className="text-sm text-yellow-700">{rec.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Errors */}
            {systemHealth.recentErrors?.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="font-medium text-gray-900">Recent Errors (Last 24 Hours)</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {systemHealth.recentErrors.map((error: any, index: number) => (
                    <div key={index} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{error.action}</div>
                          <div className="text-sm text-red-600">{error.errorMessage}</div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(error.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audit Logs */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            {/* Audit Filters */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
                  <select
                    value={auditFilters.action}
                    onChange={(e) => setAuditFilters(prev => ({ ...prev, action: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">All Actions</option>
                    <option value="USER_LOGIN">User Login</option>
                    <option value="USER_CREATED">User Created</option>
                    <option value="PASSWORD_RESET">Password Reset</option>
                    <option value="GRADE_SUBMITTED">Grade Submitted</option>
                    <option value="GRADE_APPROVED">Grade Approved</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={auditFilters.category}
                    onChange={(e) => setAuditFilters(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">All Categories</option>
                    <option value="authentication">Authentication</option>
                    <option value="authorization">Authorization</option>
                    <option value="data_modification">Data Modification</option>
                    <option value="system_operation">System Operation</option>
                    <option value="security">Security</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
                  <select
                    value={auditFilters.severity}
                    onChange={(e) => setAuditFilters(prev => ({ ...prev, severity: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">All Severities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={auditFilters.success}
                    onChange={(e) => setAuditFilters(prev => ({ ...prev, success: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">All</option>
                    <option value="true">Success</option>
                    <option value="false">Failed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Target
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Severity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Timestamp
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {auditLogs.map((log) => (
                      <tr key={log._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{log.actorName}</div>
                            <div className="text-sm text-gray-500">{log.actorRole}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{log.action.replace(/_/g, ' ')}</div>
                          <div className="text-sm text-gray-500">{log.category}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.targetName || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(log.severity)}`}>
                            {log.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {log.success ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page * pagination.limit >= pagination.total}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ITAdminDashboard;