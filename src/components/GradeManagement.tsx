import React, { useState, useEffect } from 'react';
import { GraduationCap, FileCheck, AlertTriangle, CheckCircle, Clock, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { User, Grade, GradeSubmission } from '../types';

interface GradeManagementProps {
  user: User;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

const API_BASE = 'http://localhost:5000/api';

const GradeManagement: React.FC<GradeManagementProps> = ({ user, token, onError, onSuccess }) => {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'submit' | 'pending' | 'reports'>('submit');

  // Grade submission form
  const [gradeForm, setGradeForm] = useState<GradeSubmission>({
    studentId: '',
    courseId: '',
    registrationId: '',
    midtermMark: 0,
    continuousMark: 0,
    finalExamMark: 0,
    instructorComments: ''
  });

  useEffect(() => {
    if (user.role === 'instructor') {
      fetchInstructorGrades();
    } else if (user.role === 'departmentHead') {
      fetchPendingGrades();
    }
  }, [user.role]);

  const fetchInstructorGrades = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/grades/instructor/grades`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setGrades(data.data.grades || []);
      }
    } catch (err) {
      console.error('Failed to fetch instructor grades');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingGrades = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/grades/depthead/pending-grades`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setGrades(data.data.grades || []);
      }
    } catch (err) {
      console.error('Failed to fetch pending grades');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/grades/instructor/submit-grade`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gradeForm),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Grade submitted successfully!');
        setGradeForm({
          studentId: '',
          courseId: '',
          registrationId: '',
          midtermMark: 0,
          continuousMark: 0,
          finalExamMark: 0,
          instructorComments: ''
        });
        fetchInstructorGrades();
      } else {
        onError(data.message || 'Failed to submit grade');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveGrade = async (gradeId: string, action: 'approve' | 'reject', comments?: string) => {
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/grades/depthead/approve-grade/${gradeId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, comments }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess(`Grade ${action}d successfully!`);
        fetchPendingGrades();
      } else {
        onError(data.message || `Failed to ${action} grade`);
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (letterGrade: string) => {
    switch (letterGrade) {
      case 'A+':
      case 'A':
        return 'text-green-600 bg-green-50';
      case 'A-':
      case 'B+':
        return 'text-blue-600 bg-blue-50';
      case 'B':
      case 'B-':
        return 'text-yellow-600 bg-yellow-50';
      case 'C+':
      case 'C':
        return 'text-orange-600 bg-orange-50';
      case 'D':
        return 'text-red-600 bg-red-50';
      case 'F':
      case 'NG':
        return 'text-red-800 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'finalized':
        return <FileCheck className="h-4 w-4 text-blue-600" />;
      case 'locked':
        return <FileCheck className="h-4 w-4 text-purple-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Grade Management Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-6">
          <GraduationCap className="h-6 w-6 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-900">Grade Management</h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
          {user.role === 'instructor' && (
            <button
              onClick={() => setActiveTab('submit')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'submit'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Submit Grades
            </button>
          )}

          {(user.role === 'instructor' || user.role === 'departmentHead') && (
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'pending'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              {user.role === 'instructor' ? 'My Grades' : 'Pending Approval'}
            </button>
          )}

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'reports'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Reports
          </button>
        </div>

        {/* Grade Submission Form */}
        {activeTab === 'submit' && user.role === 'instructor' && (
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Submit Grade</h3>

            <form onSubmit={handleSubmitGrade} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Student ID
                  </label>
                  <input
                    type="text"
                    required
                    value={gradeForm.studentId}
                    onChange={(e) => setGradeForm({ ...gradeForm, studentId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter student ID"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course ID
                  </label>
                  <input
                    type="text"
                    required
                    value={gradeForm.courseId}
                    onChange={(e) => setGradeForm({ ...gradeForm, courseId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter course ID"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Registration ID
                  </label>
                  <input
                    type="text"
                    required
                    value={gradeForm.registrationId}
                    onChange={(e) => setGradeForm({ ...gradeForm, registrationId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter registration ID"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Midterm Mark (0-30)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    required
                    value={gradeForm.midtermMark}
                    onChange={(e) => setGradeForm({ ...gradeForm, midtermMark: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Continuous Mark (0-30)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    required
                    value={gradeForm.continuousMark}
                    onChange={(e) => setGradeForm({ ...gradeForm, continuousMark: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Final Exam Mark (0-40)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="40"
                    required
                    value={gradeForm.finalExamMark}
                    onChange={(e) => setGradeForm({ ...gradeForm, finalExamMark: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comments (Optional)
                </label>
                <textarea
                  value={gradeForm.instructorComments}
                  onChange={(e) => setGradeForm({ ...gradeForm, instructorComments: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                  placeholder="Enter any comments about the grade..."
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Total Mark:</strong> {gradeForm.midtermMark + gradeForm.continuousMark + gradeForm.finalExamMark}/100
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Grade will be automatically calculated based on the total mark.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors duration-200"
              >
                {loading ? 'Submitting...' : 'Submit Grade'}
              </button>
            </form>
          </div>
        )}

        {/* Grades List */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              {user.role === 'instructor' ? 'My Submitted Grades' : 'Grades Pending Approval'}
            </h3>

            {grades.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Course
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Mark
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Grade
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      {user.role === 'departmentHead' && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {grades.map((grade) => (
                      <tr key={grade._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {grade.studentId?.firstName} {grade.studentId?.fatherName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {grade.studentId?.studentId}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {grade.courseId?.courseCode}
                          </div>
                          <div className="text-sm text-gray-500">
                            {grade.courseId?.courseName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {grade.totalMark}/100
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getGradeColor(grade.letterGrade)}`}>
                            {grade.letterGrade} ({grade.gradePoints})
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(grade.status)}
                            <span className="text-sm text-gray-900 capitalize">
                              {grade.status}
                            </span>
                          </div>
                        </td>
                        {user.role === 'departmentHead' && grade.status === 'submitted' && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleApproveGrade(grade._id, 'approve')}
                                className="text-green-600 hover:text-green-900"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleApproveGrade(grade._id, 'reject', 'Needs revision')}
                                className="text-red-600 hover:text-red-900"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <FileCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No grades found</h3>
                <p className="text-gray-600">
                  {user.role === 'instructor'
                    ? 'No grades have been submitted yet.'
                    : 'No grades are pending approval.'
                  }
                </p>
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Grade Reports & Analytics</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-blue-600">Total Grades</p>
                    <p className="text-2xl font-bold text-blue-900">{grades.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-green-600">Passing Rate</p>
                    <p className="text-2xl font-bold text-green-900">
                      {grades.length > 0
                        ? Math.round((grades.filter(g => !['F', 'NG'].includes(g.letterGrade)).length / grades.length) * 100)
                        : 0
                      }%
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <TrendingDown className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-yellow-600">Average GPA</p>
                    <p className="text-2xl font-bold text-yellow-900">
                      {grades.length > 0
                        ? (grades.reduce((sum, g) => sum + g.gradePoints, 0) / grades.length).toFixed(2)
                        : '0.00'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="text-md font-medium text-gray-900 mb-4">Grade Distribution</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'F'].map(grade => {
                  const count = grades.filter(g => g.letterGrade === grade).length;
                  const percentage = grades.length > 0 ? (count / grades.length) * 100 : 0;

                  return (
                    <div key={grade} className="text-center">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getGradeColor(grade)}`}>
                        {grade}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{count} ({percentage.toFixed(1)}%)</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GradeManagement;