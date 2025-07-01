import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, Plus, Edit, Trash2, Save, X,
  Loader2, CheckCircle, AlertTriangle, Bell, Users
} from 'lucide-react';
import { User } from '../types';

interface RegistrationPeriodManagementProps {
  user: User;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

interface RegistrationPeriod {
  _id: string;
  type: 'signup' | 'courseRegistration';
  academicYear: string;
  semester: number;
  department: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  notes?: string;
  createdBy?: {
    firstName: string;
    fatherName: string;
  };
  createdAt: string;
  updatedAt: string;
}

const API_BASE = 'http://localhost:5000/api';

const RegistrationPeriodManagement: React.FC<RegistrationPeriodManagementProps> = ({ user, token, onError, onSuccess }) => {
  const [periods, setPeriods] = useState<RegistrationPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<string | null>(null);

  // Form state
  const [periodForm, setPeriodForm] = useState({
    type: 'signup' as 'signup' | 'courseRegistration',
    academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    semester: 1,
    department: 'All',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 weeks from now
    isActive: true,
    notes: ''
  });

  // Filters
  const [filters, setFilters] = useState({
    type: '',
    academicYear: '',
    isActive: ''
  });

  useEffect(() => {
    fetchRegistrationPeriods();
  }, [filters]);

  const fetchRegistrationPeriods = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (filters.type) params.append('type', filters.type);
      if (filters.academicYear) params.append('academicYear', filters.academicYear);
      if (filters.isActive) params.append('isActive', filters.isActive);

      const response = await fetch(`${API_BASE}/registration-period?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setPeriods(data.data.periods || []);
      } else {
        onError(data.message || 'Failed to fetch registration periods');
      }
    } catch (err) {
      console.error('Failed to fetch registration periods');
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/registration-period`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(periodForm),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Registration period created successfully');
        setShowForm(false);
        setPeriodForm({
          type: 'signup',
          academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
          semester: 1,
          department: 'All',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          isActive: true,
          notes: ''
        });
        fetchRegistrationPeriods();
      } else {
        onError(data.message || 'Failed to create registration period');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePeriod = async (periodId: string) => {
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/registration-period/${periodId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(periodForm),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Registration period updated successfully');
        setEditingPeriod(null);
        fetchRegistrationPeriods();
      } else {
        onError(data.message || 'Failed to update registration period');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePeriod = async (periodId: string) => {
    if (!confirm('Are you sure you want to delete this registration period?')) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/registration-period/${periodId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Registration period deleted successfully');
        fetchRegistrationPeriods();
      } else {
        onError(data.message || 'Failed to delete registration period');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPeriod = (period: RegistrationPeriod) => {
    setPeriodForm({
      type: period.type,
      academicYear: period.academicYear,
      semester: period.semester,
      department: period.department,
      startDate: new Date(period.startDate).toISOString().split('T')[0],
      endDate: new Date(period.endDate).toISOString().split('T')[0],
      isActive: period.isActive,
      notes: period.notes || ''
    });
    setEditingPeriod(period._id);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusLabel = (period: RegistrationPeriod) => {
    if (!period.isActive) {
      return { label: 'Inactive', color: 'bg-gray-100 text-gray-800' };
    }

    const now = new Date();
    const startDate = new Date(period.startDate);
    const endDate = new Date(period.endDate);

    if (now < startDate) {
      return { label: 'Scheduled', color: 'bg-blue-100 text-blue-800' };
    } else if (now > endDate) {
      return { label: 'Expired', color: 'bg-red-100 text-red-800' };
    } else {
      return { label: 'Active', color: 'bg-green-100 text-green-800' };
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Calendar className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Registration Period Management</h2>
        </div>

        {/* Filters */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="signup">Freshman Signup</option>
                <option value="courseRegistration">Course Registration</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
              <select
                value={filters.academicYear}
                onChange={(e) => setFilters(prev => ({ ...prev, academicYear: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Years</option>
                <option value={`${new Date().getFullYear()}-${new Date().getFullYear() + 1}`}>
                  {new Date().getFullYear()}-{new Date().getFullYear() + 1}
                </option>
                <option value={`${new Date().getFullYear() - 1}-${new Date().getFullYear()}`}>
                  {new Date().getFullYear() - 1}-{new Date().getFullYear()}
                </option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.isActive}
                onChange={(e) => setFilters(prev => ({ ...prev, isActive: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => setShowForm(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Create New Period</span>
              </button>
            </div>
          </div>
        </div>

        {/* Create/Edit Form */}
        {(showForm || editingPeriod) && (
          <div className="bg-gray-50 p-6 rounded-lg mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingPeriod ? 'Edit Registration Period' : 'Create New Registration Period'}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingPeriod(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={editingPeriod ? () => handleUpdatePeriod(editingPeriod) : handleCreatePeriod} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Registration Type *
                  </label>
                  <select
                    value={periodForm.type}
                    onChange={(e) => setPeriodForm(prev => ({ ...prev, type: e.target.value as 'signup' | 'courseRegistration' }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="signup">Freshman Signup</option>
                    <option value="courseRegistration">Course Registration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Academic Year *
                  </label>
                  <input
                    type="text"
                    value={periodForm.academicYear}
                    onChange={(e) => setPeriodForm(prev => ({ ...prev, academicYear: e.target.value }))}
                    required
                    pattern="\d{4}-\d{4}"
                    placeholder="YYYY-YYYY"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Semester *
                  </label>
                  <select
                    value={periodForm.semester}
                    onChange={(e) => setPeriodForm(prev => ({ ...prev, semester: parseInt(e.target.value) }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department *
                  </label>
                  <select
                    value={periodForm.department}
                    onChange={(e) => setPeriodForm(prev => ({ ...prev, department: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="All">All Departments</option>
                    <option value="Freshman">Freshman</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Automotive">Automotive</option>
                    <option value="Construction">Construction</option>
                    <option value="ICT">ICT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={periodForm.startDate}
                    onChange={(e) => setPeriodForm(prev => ({ ...prev, startDate: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={periodForm.endDate}
                    onChange={(e) => setPeriodForm(prev => ({ ...prev, endDate: e.target.value }))}
                    required
                    min={periodForm.startDate}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={periodForm.isActive}
                  onChange={(e) => setPeriodForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                  Active
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={periodForm.notes}
                  onChange={(e) => setPeriodForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Add any notes about this registration period..."
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>
                    {loading ? 'Saving...' : editingPeriod ? 'Update Period' : 'Create Period'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingPeriod(null);
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-md transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Periods List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : periods.length > 0 ? (
          <div className="space-y-4">
            {periods.map((period) => {
              const status = getStatusLabel(period);
              const now = new Date();
              const startDate = new Date(period.startDate);
              const endDate = new Date(period.endDate);
              const isActive = period.isActive && now >= startDate && now <= endDate;

              return (
                <div key={period._id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {period.type === 'signup' ? 'Freshman Signup' : 'Course Registration'} - {period.academicYear}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Semester {period.semester} - {period.department === 'All' ? 'All Departments' : period.department}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                      {isActive && (
                        <span className="flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="font-medium">Start Date:</span> {formatDate(period.startDate)}
                    </div>
                    <div>
                      <span className="font-medium">End Date:</span> {formatDate(period.endDate)}
                    </div>
                    <div>
                      <span className="font-medium">Created By:</span> {period.createdBy ? `${period.createdBy.firstName} ${period.createdBy.fatherName}` : 'System'}
                    </div>
                    <div>
                      <span className="font-medium">Created At:</span> {formatDate(period.createdAt)}
                    </div>
                  </div>

                  {period.notes && (
                    <div className="bg-gray-50 p-2 rounded text-sm mb-3">
                      <span className="font-medium">Notes:</span> {period.notes}
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditPeriod(period)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePeriod(period._id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No registration periods found</h3>
            <p className="text-gray-600">
              Create a new registration period to control when students can sign up or register for courses.
            </p>
          </div>
        )}
      </div>

      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-blue-900 mb-4">Registration Period Control</h3>

        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <Users className="h-5 w-5 text-blue-600 mt-1" />
            <div>
              <h4 className="font-medium text-blue-800">Freshman Signup</h4>
              <p className="text-sm text-blue-700">
                Controls when new freshman students can sign up for accounts. When closed, the signup form will be hidden and backend requests will be rejected.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Calendar className="h-5 w-5 text-blue-600 mt-1" />
            <div>
              <h4 className="font-medium text-blue-800">Course Registration</h4>
              <p className="text-sm text-blue-700">
                Controls when existing students can register for courses. When closed, registration buttons will be hidden and backend requests will be rejected.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Bell className="h-5 w-5 text-blue-600 mt-1" />
            <div>
              <h4 className="font-medium text-blue-800">Automatic Notifications</h4>
              <p className="text-sm text-blue-700">
                When a registration period is created or updated, affected students will automatically receive notifications.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-1" />
            <div>
              <h4 className="font-medium text-yellow-800">Important Note</h4>
              <p className="text-sm text-yellow-700">
                Both frontend and backend enforce these registration windows for security. Any changes are logged for audit purposes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationPeriodManagement;