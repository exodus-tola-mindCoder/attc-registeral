import React, { useState, useEffect } from 'react';
import {
  GraduationCap, Users, CheckCircle, XCircle, Clock,
  Search, Filter, Loader2, Check, X, Download,
  FileText, Award, BarChart3, TrendingUp, AlertTriangle
} from 'lucide-react';
import { User } from '../types';

interface GraduationCommitteeProps {
  user: User;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

interface EligibleStudent {
  student: {
    _id: string;
    name: string;
    studentId: string;
    department: string;
    currentYear: number;
  };
  eligibility: {
    isEligible: boolean;
    checklist: {
      creditsCompleted: boolean;
      cgpaRequirementMet: boolean;
      requiredCoursesPassed: boolean;
      finalProjectApproved: boolean;
      internshipApproved: boolean;
      clearanceApproved: boolean;
    };
    details: {
      totalCredits: number;
      requiredCredits: number;
      cgpa: number;
      finalProjectStatus: string;
      internshipStatus: string;
      clearanceStatus: string;
    };
  };
}

interface GraduatedStudent {
  _id: string;
  firstName: string;
  fatherName: string;
  grandfatherName: string;
  studentId: string;
  department: string;
  graduationDate: string;
  lastCGPA: number;
  totalCreditsEarned: number;
}

const API_BASE = 'http://localhost:5000/api';

const GraduationCommittee: React.FC<GraduationCommitteeProps> = ({ user, token, onError, onSuccess }) => {
  const [eligibleStudents, setEligibleStudents] = useState<EligibleStudent[]>([]);
  const [graduatedStudents, setGraduatedStudents] = useState<GraduatedStudent[]>([]);
  const [graduationStats, setGraduationStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'eligible' | 'graduated' | 'stats'>('eligible');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [studentDetails, setStudentDetails] = useState<any>(null);

  // Filters
  const [filters, setFilters] = useState({
    department: '',
    year: '',
    search: ''
  });

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0
  });

  // Approval form
  const [approvalForm, setApprovalForm] = useState({
    comments: ''
  });

  // Submission state
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (activeTab === 'eligible') {
      fetchEligibleStudents();
    } else if (activeTab === 'graduated') {
      fetchGraduatedStudents();
    } else if (activeTab === 'stats') {
      fetchGraduationStats();
    }
  }, [activeTab, filters, pagination.page]);

  const fetchEligibleStudents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (filters.department) params.append('department', filters.department);
      if (filters.year) params.append('year', filters.year);

      const response = await fetch(`${API_BASE}/graduation/eligible?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setEligibleStudents(data.data.students || []);
      } else {
        onError(data.message || 'Failed to fetch eligible students');
      }
    } catch (err) {
      console.error('Failed to fetch eligible students');
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchGraduatedStudents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      if (filters.department) params.append('department', filters.department);
      if (filters.year) params.append('year', filters.year);

      const response = await fetch(`${API_BASE}/graduation/graduated?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setGraduatedStudents(data.data.students || []);
        setPagination(prev => ({
          ...prev,
          total: data.data.pagination.total
        }));
      } else {
        onError(data.message || 'Failed to fetch graduated students');
      }
    } catch (err) {
      console.error('Failed to fetch graduated students');
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchGraduationStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/graduation/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setGraduationStats(data.data);
      } else {
        onError(data.message || 'Failed to fetch graduation statistics');
      }
    } catch (err) {
      console.error('Failed to fetch graduation statistics');
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentDetails = async (studentId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/graduation/status/${studentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setStudentDetails(data.data);
        setSelectedStudent(studentId);
      } else {
        onError(data.message || 'Failed to fetch student details');
      }
    } catch (err) {
      console.error('Failed to fetch student details');
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveGraduation = async () => {
    if (!selectedStudent) return;

    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/graduation/approve/${selectedStudent}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comments: approvalForm.comments
        }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Student graduation approved successfully!');
        setSelectedStudent(null);
        setStudentDetails(null);
        setApprovalForm({ comments: '' });
        fetchEligibleStudents();
      } else {
        onError(data.message || 'Failed to approve graduation');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const generateTranscript = async (studentId: string) => {
    try {
      const response = await fetch(`${API_BASE}/transcript/admin/${studentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate transcript');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcript_${studentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      onSuccess('Transcript generated successfully!');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to generate transcript');
    }
  };

  const getStatusColor = (isCompleted: boolean) => {
    return isCompleted ? 'text-green-600 bg-green-50' : 'text-yellow-600 bg-yellow-50';
  };

  const getStatusIcon = (isCompleted: boolean) => {
    return isCompleted ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-yellow-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Graduation Committee Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-6">
          <GraduationCap className="h-6 w-6 text-indigo-600" />
          <h2 className="text-xl font-semibold text-gray-900">Graduation Committee Dashboard</h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6 overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('eligible');
              setSelectedStudent(null);
              setStudentDetails(null);
            }}
            className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'eligible'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <Users className="h-4 w-4 inline mr-2" />
            Eligible Students
          </button>

          <button
            onClick={() => {
              setActiveTab('graduated');
              setSelectedStudent(null);
              setStudentDetails(null);
            }}
            className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'graduated'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <Award className="h-4 w-4 inline mr-2" />
            Graduated Students
          </button>

          <button
            onClick={() => {
              setActiveTab('stats');
              setSelectedStudent(null);
              setStudentDetails(null);
            }}
            className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'stats'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <BarChart3 className="h-4 w-4 inline mr-2" />
            Graduation Statistics
          </button>
        </div>

        {/* Filters */}
        {!selectedStudent && (
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <select
                  value={filters.department}
                  onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Departments</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Automotive">Automotive</option>
                  <option value="Construction">Construction</option>
                  <option value="ICT">ICT</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                <select
                  value={filters.year}
                  onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Years</option>
                  <option value={new Date().getFullYear().toString()}>{new Date().getFullYear()}</option>
                  <option value={(new Date().getFullYear() - 1).toString()}>{new Date().getFullYear() - 1}</option>
                  <option value={(new Date().getFullYear() - 2).toString()}>{new Date().getFullYear() - 2}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Search by name or ID..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : selectedStudent && studentDetails ? (
          <div className="space-y-6">
            {/* Student Details */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {studentDetails.student.name}
                </h3>
                <p className="text-gray-600">
                  ID: {studentDetails.student.studentId} | Department: {studentDetails.student.department} | Year: {studentDetails.student.currentYear}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setSelectedStudent(null);
                    setStudentDetails(null);
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors duration-200"
                >
                  Back to List
                </button>
                <button
                  onClick={() => generateTranscript(selectedStudent)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors duration-200 flex items-center space-x-1"
                >
                  <Download className="h-3 w-3" />
                  <span>Transcript</span>
                </button>
              </div>
            </div>

            {/* Graduation Eligibility */}
            <div className={`border rounded-lg p-4 ${studentDetails.eligibility.isEligible ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
              }`}>
              <div className="flex items-center space-x-3 mb-3">
                {studentDetails.eligibility.isEligible ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <Clock className="h-5 w-5 text-yellow-600" />
                )}
                <h4 className="font-medium">
                  Graduation Eligibility: {studentDetails.eligibility.isEligible ? 'Eligible' : 'Not Eligible'}
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(studentDetails.eligibility.checklist.creditsCompleted)}
                  <span className="text-sm">
                    Credits: {studentDetails.eligibility.details.totalCredits}/{studentDetails.eligibility.details.requiredCredits}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {getStatusIcon(studentDetails.eligibility.checklist.cgpaRequirementMet)}
                  <span className="text-sm">
                    CGPA: {studentDetails.eligibility.details.cgpa.toFixed(2)} (min 2.0)
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {getStatusIcon(studentDetails.eligibility.checklist.requiredCoursesPassed)}
                  <span className="text-sm">
                    Required Courses: {studentDetails.eligibility.checklist.requiredCoursesPassed ? 'Passed' : 'Incomplete'}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {getStatusIcon(studentDetails.eligibility.checklist.finalProjectApproved)}
                  <span className="text-sm">
                    Final Project: {studentDetails.finalProject.status}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {getStatusIcon(studentDetails.eligibility.checklist.internshipApproved)}
                  <span className="text-sm">
                    Internship: {studentDetails.internship.status}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {getStatusIcon(studentDetails.eligibility.checklist.clearanceApproved)}
                  <span className="text-sm">
                    Clearance: {studentDetails.clearance.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Graduation Approval Form */}
            {studentDetails.eligibility.isEligible && !studentDetails.isGraduated && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Approve Graduation</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Comments (Optional)
                    </label>
                    <textarea
                      value={approvalForm.comments}
                      onChange={(e) => setApprovalForm({ comments: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows={3}
                      placeholder="Add any comments about this graduation approval..."
                    />
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <div className="flex items-center">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3" />
                      <div>
                        <h4 className="font-medium text-yellow-800">Important Notice</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                          Approving graduation is final and cannot be undone. The student will be marked as graduated and will be able to download their official transcript.
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleApproveGraduation}
                    disabled={submitting}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Award className="h-4 w-4" />
                    )}
                    <span>{submitting ? 'Approving...' : 'Approve Graduation'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Already Graduated Notice */}
            {studentDetails.isGraduated && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <Award className="h-5 w-5 text-green-600" />
                  <div>
                    <h4 className="font-medium text-green-800">Already Graduated</h4>
                    <p className="text-sm text-green-700 mt-1">
                      This student has already graduated on {new Date(studentDetails.graduationDate).toLocaleDateString()}.
                    </p>
                    {studentDetails.graduationApproval.approvedBy && (
                      <p className="text-sm text-green-700 mt-1">
                        Approved by: {studentDetails.graduationApproval.approvedBy}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'eligible' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Students Eligible for Graduation</h3>
              {eligibleStudents.length > 0 && (
                <div className="text-sm text-gray-600">
                  {eligibleStudents.filter(s => s.eligibility.isEligible).length} eligible of {eligibleStudents.length} total
                </div>
              )}
            </div>

            {eligibleStudents.length > 0 ? (
              <div className="space-y-4">
                {eligibleStudents.map((student) => (
                  <div
                    key={student.student._id}
                    className={`border rounded-lg p-4 ${student.eligibility.isEligible ? 'border-green-200' : 'border-gray-200'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{student.student.name}</h4>
                        <p className="text-sm text-gray-600">
                          ID: {student.student.studentId} | Department: {student.student.department} | Year: {student.student.currentYear}
                        </p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${student.eligibility.isEligible ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                          {student.eligibility.isEligible ? 'Eligible' : 'Not Eligible'}
                        </span>
                        <button
                          onClick={() => fetchStudentDetails(student.student._id)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm transition-colors duration-200"
                        >
                          View Details
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2">
                      <div className={`p-2 rounded text-xs ${getStatusColor(student.eligibility.checklist.creditsCompleted)}`}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(student.eligibility.checklist.creditsCompleted)}
                          <span>Credits</span>
                        </div>
                      </div>

                      <div className={`p-2 rounded text-xs ${getStatusColor(student.eligibility.checklist.cgpaRequirementMet)}`}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(student.eligibility.checklist.cgpaRequirementMet)}
                          <span>CGPA: {student.eligibility.details.cgpa.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className={`p-2 rounded text-xs ${getStatusColor(student.eligibility.checklist.requiredCoursesPassed)}`}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(student.eligibility.checklist.requiredCoursesPassed)}
                          <span>Courses</span>
                        </div>
                      </div>

                      <div className={`p-2 rounded text-xs ${getStatusColor(student.eligibility.checklist.finalProjectApproved)}`}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(student.eligibility.checklist.finalProjectApproved)}
                          <span>Project</span>
                        </div>
                      </div>

                      <div className={`p-2 rounded text-xs ${getStatusColor(student.eligibility.checklist.internshipApproved)}`}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(student.eligibility.checklist.internshipApproved)}
                          <span>Internship</span>
                        </div>
                      </div>

                      <div className={`p-2 rounded text-xs ${getStatusColor(student.eligibility.checklist.clearanceApproved)}`}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(student.eligibility.checklist.clearanceApproved)}
                          <span>Clearance</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No eligible students</h3>
                <p className="text-gray-600">
                  No students are currently eligible for graduation review.
                </p>
              </div>
            )}
          </div>
        ) : activeTab === 'graduated' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Graduated Students</h3>
              <div className="text-sm text-gray-600">
                Total: {pagination.total} graduates
              </div>
            </div>

            {graduatedStudents.length > 0 ? (
              <>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Student
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Department
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Graduation Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          CGPA
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Credits
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {graduatedStudents.map((student) => (
                        <tr key={student._id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {student.firstName} {student.fatherName} {student.grandfatherName}
                            </div>
                            <div className="text-sm text-gray-500">{student.studentId}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {student.department}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(student.graduationDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {student.lastCGPA.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {student.totalCreditsEarned}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => generateTranscript(student._id)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Transcript
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page * pagination.limit >= pagination.total}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No graduated students</h3>
                <p className="text-gray-600">
                  No students have graduated yet based on your filters.
                </p>
              </div>
            )}
          </div>
        ) : activeTab === 'stats' && graduationStats ? (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Graduation Statistics</h3>

            {/* Overall Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-indigo-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <Award className="h-8 w-8 text-indigo-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-indigo-600">Total Graduates</p>
                    <p className="text-2xl font-bold text-indigo-900">{graduationStats.overallStats.totalGraduated}</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-green-600">Average CGPA</p>
                    <p className="text-2xl font-bold text-green-900">
                      {graduationStats.overallStats.averageCGPA?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-blue-600">Currently Eligible</p>
                    <p className="text-2xl font-bold text-blue-900">{graduationStats.currentEligible}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Department Stats */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h4 className="font-medium text-gray-900">Graduation by Department</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Department
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Year
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Graduates
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg. CGPA
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg. Credits
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {graduationStats.departmentStats.map((stat: any, index: number) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {stat._id.department}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stat._id.year}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stat.count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stat.averageCGPA.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {Math.round(stat.averageCredits)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Yearly Trends */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-medium text-gray-900 mb-4">Graduation Trends by Year</h4>

              <div className="space-y-4">
                {graduationStats.yearlyTrends.map((trend: any) => (
                  <div key={trend._id} className="flex items-center">
                    <div className="w-16 text-sm font-medium text-gray-900">{trend._id}</div>
                    <div className="flex-1">
                      <div className="relative pt-1">
                        <div className="overflow-hidden h-4 text-xs flex rounded bg-indigo-100">
                          <div
                            style={{ width: `${(trend.count / Math.max(...graduationStats.yearlyTrends.map((t: any) => t.count))) * 100}%` }}
                            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-600"
                          ></div>
                        </div>
                      </div>
                    </div>
                    <div className="w-16 text-right text-sm font-medium text-gray-900">{trend.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No data available</h3>
            <p className="text-gray-600">
              Please select a tab to view graduation data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GraduationCommittee;