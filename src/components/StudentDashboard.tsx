import React, { useState, useEffect } from 'react';
import { BookOpen, FileCheck, Download, Loader2, Calendar, CheckCircle, GraduationCap, Clock, AlertTriangle } from 'lucide-react';
import { User, Course, Registration } from '../types';

interface StudentDashboardProps {
  user: User;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

interface RegistrationPeriod {
  isOpen: boolean;
  message: string;
  period?: {
    startDate: string;
    endDate: string;
    isActive: boolean;
  };
}

const API_BASE = 'http://localhost:5000/api';

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, token, onError, onSuccess }) => {
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationPeriod, setRegistrationPeriod] = useState<RegistrationPeriod | null>(null);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    fetchAvailableCourses();
    fetchRegistrations();
  }, []);

  const fetchAvailableCourses = async () => {
    try {
      const response = await fetch(`${API_BASE}/student/available-courses`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setAvailableCourses(data.data.courses || []);
        if (data.data.registrationPeriod) {
          setRegistrationPeriod(data.data.registrationPeriod);
        }
      }
    } catch (err) {
      console.error('Failed to fetch available courses');
    }
  };

  const fetchRegistrations = async () => {
    try {
      const response = await fetch(`${API_BASE}/student/registrations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setRegistrations(data.data.registrations || []);
      }
    } catch (err) {
      console.error('Failed to fetch registrations');
    }
  };

  const handleRegisterSemester = async () => {
    setRegistering(true);

    try {
      const response = await fetch(`${API_BASE}/student/register-semester`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Successfully registered for semester courses!');
        fetchRegistrations();
        fetchAvailableCourses();
      } else {
        onError(data.message || 'Registration failed');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  const downloadRegistrationSlip = async (registrationId: string) => {
    try {
      const response = await fetch(`${API_BASE}/student/registration-slip/${registrationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `registration-slip-${registrationId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        onSuccess('Registration slip downloaded!');
      } else {
        onError('Failed to download registration slip');
      }
    } catch (err) {
      onError('Failed to download registration slip');
    }
  };

  const currentSemesterRegistration = registrations.find(
    reg => reg.year === user.currentYear && reg.semester === user.currentSemester
  );

  return (
    <div className="space-y-6">
      {/* Registration Status */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-4">
          <GraduationCap className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Course Registration</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-md">
            <p className="text-sm font-medium text-blue-700">Current Year</p>
            <p className="text-2xl font-bold text-blue-900">Year {user.currentYear}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-md">
            <p className="text-sm font-medium text-green-700">Current Semester</p>
            <p className="text-2xl font-bold text-green-900">Semester {user.currentSemester}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-md">
            <p className="text-sm font-medium text-purple-700">Department</p>
            <p className="text-lg font-bold text-purple-900">
              {user.currentYear === 1 ? 'Freshman' : user.department || 'Not Assigned'}
            </p>
          </div>
        </div>

        {/* Registration Period Status */}
        {registrationPeriod && (
          <div className={`mb-6 p-4 rounded-lg border ${registrationPeriod.isOpen ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
            }`}>
            <div className="flex items-center space-x-3">
              {registrationPeriod.isOpen ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <Clock className="h-5 w-5 text-yellow-600" />
              )}
              <div>
                <h3 className="font-medium text-gray-900">Registration Period</h3>
                <p className="text-sm text-gray-700">{registrationPeriod.message}</p>
                {registrationPeriod.period && (
                  <p className="text-xs text-gray-600 mt-1">
                    {new Date(registrationPeriod.period.startDate).toLocaleDateString()} - {new Date(registrationPeriod.period.endDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {currentSemesterRegistration ? (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-green-900">
                  ✅ Registered for Year {currentSemesterRegistration.year}, Semester {currentSemesterRegistration.semester}
                </h3>
                <p className="text-sm text-green-700">
                  {currentSemesterRegistration.courses.length} courses • {currentSemesterRegistration.totalCredits} total credits
                </p>
                <p className="text-xs text-green-600">
                  Registered on: {new Date(currentSemesterRegistration.registrationDate).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => downloadRegistrationSlip(currentSemesterRegistration._id)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Download Slip</span>
              </button>
            </div>
          </div>
        ) : availableCourses.length > 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-yellow-900">
                  📚 Ready to Register for Year {user.currentYear}, Semester {user.currentSemester}
                </h3>
                <p className="text-sm text-yellow-700">
                  {availableCourses.length} courses available for registration
                </p>
              </div>
              <button
                onClick={handleRegisterSemester}
                disabled={registering || (registrationPeriod && !registrationPeriod.isOpen)}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
              >
                {registering ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BookOpen className="h-4 w-4" />
                )}
                <span>
                  {registering ? 'Registering...' :
                    (registrationPeriod && !registrationPeriod.isOpen) ? 'Registration Closed' :
                      'Register for Semester'}
                </span>
              </button>
            </div>

            {registrationPeriod && !registrationPeriod.isOpen && (
              <div className="mt-3 bg-yellow-100 p-2 rounded-md">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-700" />
                  <p className="text-sm text-yellow-700">
                    Registration is currently closed. Please contact the registrar's office.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-gray-700">
              ⏳ No courses available for registration
            </h3>
            <p className="text-sm text-gray-600">
              Course schedules for Year {user.currentYear}, Semester {user.currentSemester} have not been published yet.
            </p>
          </div>
        )}
      </div>

      {/* Available Courses */}
      {availableCourses.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Calendar className="h-6 w-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">Available Courses</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {availableCourses.map((course) => (
                  <tr key={course._id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {course.courseCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {course.courseName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {course.credit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {course.department}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 bg-blue-50 p-4 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Total Credits:</strong> {availableCourses.reduce((sum, course) => sum + course.credit, 0)}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              All courses will be registered together with one click.
            </p>
          </div>
        </div>
      )}

      {/* Registration History */}
      {registrations.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center space-x-3 mb-4">
            <FileCheck className="h-6 w-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">Registration History</h2>
          </div>

          <div className="space-y-4">
            {registrations.map((registration) => (
              <div key={registration._id} className="border border-gray-200 rounded-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium text-gray-900">
                    Year {registration.year}, Semester {registration.semester}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {registration.status}
                    </span>
                    <button
                      onClick={() => downloadRegistrationSlip(registration._id)}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs transition-colors duration-200 flex items-center space-x-1"
                    >
                      <Download className="h-3 w-3" />
                      <span>Slip</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">
                      <strong>Courses:</strong> {registration.courses.length}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Total Credits:</strong> {registration.totalCredits}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">
                      <strong>Department:</strong> {registration.department}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Registered:</strong> {new Date(registration.registrationDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800">
                      View Course Details
                    </summary>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {registration.courses.map((course, index) => (
                        <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                          <span className="font-medium">{course.courseCode}</span> - {course.courseName} ({course.credit} credits)
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;