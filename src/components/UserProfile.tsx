import React from 'react';
import { User } from 'lucide-react';
import { User as UserType } from '../types';

interface UserProfileProps {
  user: UserType;
}

const UserProfile: React.FC<UserProfileProps> = ({ user }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-3 mb-4">
        <User className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Full Name</p>
            <p className="text-gray-900">{user.firstName} {user.fatherName} {user.grandfatherName}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Email</p>
            <p className="text-gray-900">{user.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Role</p>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {user.role}
            </span>
          </div>
          {user.studentId && (
            <div>
              <p className="text-sm font-medium text-gray-500">Student ID</p>
              <p className="text-gray-900">{user.studentId}</p>
            </div>
          )}
        </div>
        {user.currentYear && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Academic Year</p>
              <p className="text-gray-900">Year {user.currentYear}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Current Semester</p>
              <p className="text-gray-900">Semester {user.currentSemester}</p>
            </div>
          </div>
        )}
        {user.department && (
          <div>
            <p className="text-sm font-medium text-gray-500">Department</p>
            <p className="text-gray-900">{user.department}</p>
          </div>
        )}
        {user.enrollmentYear && (
          <div>
            <p className="text-sm font-medium text-gray-500">Enrollment Year</p>
            <p className="text-gray-900">{user.enrollmentYear}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;