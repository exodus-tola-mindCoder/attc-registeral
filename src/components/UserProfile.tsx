import React, { useState } from 'react';
import { User, Save, Eye, EyeOff, Loader2, AlertTriangle } from 'lucide-react';
import { User as UserType } from '../types';

interface ProfileSettingsProps {
  user: UserType;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

const API_BASE = 'http://localhost:5000/api';

const UserProfile: React.FC<ProfileSettingsProps> = ({ user, token, onError, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      onError('New password and confirmation do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      onError('New password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Password changed successfully');
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        onError(data.message || 'Failed to change password');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-6">
          <User className="h-6 w-6 text-indigo-600" />
          <h2 className="text-xl font-semibold text-gray-900">Profile Settings</h2>
        </div>

        {/* User Information (Read-only) */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                {user.firstName} {user.fatherName} {user.grandfatherName}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Contact IT Admin to update your name
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                {user.email}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Institutional email cannot be changed
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 capitalize">
                {user.role}
              </div>
            </div>

            {user.department && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                  {user.department}
                </div>
              </div>
            )}

            {user.studentId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Student ID</label>
                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                  {user.studentId}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Change Password Form */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter new password (min. 6 characters)"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Confirm your new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {passwordForm.newPassword && passwordForm.confirmPassword &&
              passwordForm.newPassword !== passwordForm.confirmPassword && (
                <div className="flex items-center text-red-600">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  <span className="text-sm">Passwords do not match</span>
                </div>
              )}

            <button
              type="submit"
              disabled={loading || (passwordForm.newPassword !== passwordForm.confirmPassword)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{loading ? 'Saving...' : 'Change Password'}</span>
            </button>

          </form>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Account Security Tips:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Use a strong password with a mix of letters, numbers, and symbols</li>
          <li>• Never share your password with anyone</li>
          <li>• Change your password regularly</li>
          <li>• Don't use the same password for multiple accounts</li>
          <li>• Contact IT Admin immediately if you suspect unauthorized access</li>
        </ul>
      </div>
    </div>
  );
};

export default UserProfile;