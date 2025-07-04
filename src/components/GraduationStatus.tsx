import React, { useState, useEffect } from 'react';
import {
  GraduationCap, FileText, CheckCircle, XCircle, Clock,
  Upload, Download, AlertTriangle, Award, Loader2
} from 'lucide-react';
import { User } from '../types';

interface GraduationStatusProps {
  user: User;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

interface GraduationStatus {
  student: {
    _id: string;
    name: string;
    studentId: string;
    department: string;
    currentYear: number;
    currentSemester: number;
    enrollmentYear: number;
  };
  isGraduated: boolean;
  graduationDate: string | null;
  finalProject: {
    status: string;
    title: string | null;
    description: string | null;
    submittedAt: string | null;
    supervisor: string | null;
    approvedBy: string | null;
    approvedAt: string | null;
    comments: string | null;
    rejectionReason: string | null;
  };
  internship: {
    status: string;
    company: string | null;
    position: string | null;
    duration: string | null;
    submittedAt: string | null;
    approvedBy: string | null;
    approvedAt: string | null;
    comments: string | null;
    rejectionReason: string | null;
  };
  clearance: {
    status: string;
    items: Array<{
      itemType: string;
      itemName: string;
      status: string;
      notes: string;
    }>;
  };
  graduationApproval: {
    isApproved: boolean;
    approvedBy: string | null;
    approvedAt: string | null;
    comments: string | null;
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

const API_BASE = 'http://localhost:5000/api';

const GraduationStatus: React.FC<GraduationStatusProps> = ({ user, token, onError, onSuccess }) => {
  const [graduationStatus, setGraduationStatus] = useState<GraduationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'project' | 'internship'>('status');

  // Project submission form
  const [projectForm, setProjectForm] = useState({
    title: '',
    description: '',
    supervisorId: '',
    projectFile: null as File | null
  });

  // Internship submission form
  const [internshipForm, setInternshipForm] = useState({
    company: '',
    position: '',
    startDate: '',
    endDate: '',
    supervisorName: '',
    supervisorContact: '',
    internshipDocument: null as File | null
  });

  // Submission states
  const [submittingProject, setSubmittingProject] = useState(false);
  const [submittingInternship, setSubmittingInternship] = useState(false);

  // Available supervisors
  const [supervisors, setSupervisors] = useState<Array<{ _id: string, name: string }>>([]);

  useEffect(() => {
    fetchGraduationStatus();
    fetchSupervisors();
  }, []);

  const fetchGraduationStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/graduation/status/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setGraduationStatus(data.data);
      } else {
        onError(data.message || 'Failed to fetch graduation status');
      }
    } catch (err) {
      console.error('Failed to fetch graduation status');
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSupervisors = async () => {
    try {
      const response = await fetch(`${API_BASE}/itadmin/users?role=instructor&status=active&limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        const supervisorsList = data.data.users.map((user: any) => ({
          _id: user._id,
          name: `${user.firstName} ${user.fatherName}`
        }));
        setSupervisors(supervisorsList);
      }
    } catch (err) {
      console.error('Failed to fetch supervisors');
    }
  };

  const handleProjectFileChange = (file: File | null) => {
    if (file) {
      // Validate file type
      if (file.type !== 'application/pdf') {
        onError('Only PDF files are allowed');
        return;
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        onError('File size must be less than 10MB');
        return;
      }
    }

    setProjectForm(prev => ({ ...prev, projectFile: file }));
  };

  const handleInternshipFileChange = (file: File | null) => {
    if (file) {
      // Validate file type
      if (file.type !== 'application/pdf') {
        onError('Only PDF files are allowed');
        return;
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        onError('File size must be less than 10MB');
        return;
      }
    }

    setInternshipForm(prev => ({ ...prev, internshipDocument: file }));
  };

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectForm.projectFile) {
      onError('Project file (PDF) is required');
      return;
    }

    setSubmittingProject(true);

    try {
      const formData = new FormData();
      formData.append('title', projectForm.title);
      formData.append('description', projectForm.description);
      formData.append('supervisorId', projectForm.supervisorId);
      formData.append('projectFile', projectForm.projectFile);

      const response = await fetch(`${API_BASE}/graduation/finalproject/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Final year project submitted successfully!');
        setProjectForm({
          title: '',
          description: '',
          supervisorId: '',
          projectFile: null
        });
        fetchGraduationStatus();
        setActiveTab('status');
      } else {
        onError(data.message || 'Failed to submit project');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setSubmittingProject(false);
    }
  };

  const handleSubmitInternship = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!internshipForm.internshipDocument) {
      onError('Internship documentation (PDF) is required');
      return;
    }

    setSubmittingInternship(true);

    try {
      const formData = new FormData();
      formData.append('company', internshipForm.company);
      formData.append('position', internshipForm.position);
      formData.append('startDate', internshipForm.startDate);
      formData.append('endDate', internshipForm.endDate);
      formData.append('supervisorName', internshipForm.supervisorName);
      formData.append('supervisorContact', internshipForm.supervisorContact);
      formData.append('internshipDocument', internshipForm.internshipDocument);

      const response = await fetch(`${API_BASE}/graduation/internship/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Internship documentation submitted successfully!');
        setInternshipForm({
          company: '',
          position: '',
          startDate: '',
          endDate: '',
          supervisorName: '',
          supervisorContact: '',
          internshipDocument: null
        });
        fetchGraduationStatus();
        setActiveTab('status');
      } else {
        onError(data.message || 'Failed to submit internship documentation');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setSubmittingInternship(false);
    }
  };

  const downloadTranscript = async () => {
    try {
      const response = await fetch(`${API_BASE}/transcript/download`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download transcript');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${user.firstName}_${user.fatherName}_transcript.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      onSuccess('Transcript downloaded successfully!');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to download transcript');
    }
  };

  const getStatusColor = (isCompleted: boolean) => {
    return isCompleted ? 'text-green-600 bg-green-50 border-green-200' : 'text-yellow-600 bg-yellow-50 border-yellow-200';
  };

  const getStatusIcon = (isCompleted: boolean) => {
    return isCompleted ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-yellow-600" />;
  };

  const getItemStatusColor = (status: string) => {
    switch (status) {
      case 'Cleared':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'Blocked':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'Pending':
      default:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  const getItemStatusIcon = (status: string) => {
    switch (status) {
      case 'Cleared':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Blocked':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'Pending':
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Graduation Status Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-6">
          <GraduationCap className="h-6 w-6 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-900">Graduation Status</h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('status')}
            className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'status'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <Award className="h-4 w-4 inline mr-2" />
            Graduation Status
          </button>

          {(!graduationStatus ||
            (graduationStatus &&
              !graduationStatus.isGraduated &&
              graduationStatus.finalProject.status !== 'Approved')) && (
              <button
                onClick={() => setActiveTab('project')}
                className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'project'
                    ? 'bg-white text-purple-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                <FileText className="h-4 w-4 inline mr-2" />
                Final Year Project
              </button>
            )}

          {(!graduationStatus ||
            (graduationStatus &&
              !graduationStatus.isGraduated &&
              graduationStatus.internship.status !== 'Approved' &&
              graduationStatus.internship.status !== 'N/A')) && (
              <button
                onClick={() => setActiveTab('internship')}
                className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'internship'
                    ? 'bg-white text-purple-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                <FileText className="h-4 w-4 inline mr-2" />
                Internship
              </button>
            )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : !graduationStatus ? (
          <div className="text-center py-8">
            <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No graduation data</h3>
            <p className="text-gray-600">
              Your graduation status information is not available yet.
            </p>
          </div>
        ) : activeTab === 'status' ? (
          <div className="space-y-6">
            {/* Graduation Status */}
            <div className={`border rounded-lg p-6 ${graduationStatus.isGraduated
                ? 'bg-green-50 border-green-200'
                : graduationStatus.eligibility.isEligible
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
              <div className="flex items-center space-x-3 mb-4">
                {graduationStatus.isGraduated ? (
                  <Award className="h-6 w-6 text-green-600" />
                ) : graduationStatus.eligibility.isEligible ? (
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                ) : (
                  <Clock className="h-6 w-6 text-yellow-600" />
                )}
                <h3 className="text-lg font-medium">
                  {graduationStatus.isGraduated
                    ? 'Graduated'
                    : graduationStatus.eligibility.isEligible
                      ? 'Eligible for Graduation'
                      : 'Not Yet Eligible for Graduation'
                  }
                </h3>
              </div>

              {graduationStatus.isGraduated && graduationStatus.graduationDate && (
                <p className="text-green-700 mb-4">
                  Graduation Date: {new Date(graduationStatus.graduationDate).toLocaleDateString()}
                </p>
              )}

              {graduationStatus.isGraduated && (
                <div className="flex justify-end">
                  <button
                    onClick={downloadTranscript}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Official Transcript</span>
                  </button>
                </div>
              )}
            </div>

            {/* Graduation Requirements Checklist */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">Graduation Requirements Checklist</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(graduationStatus.eligibility.checklist.creditsCompleted)}`}>
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(graduationStatus.eligibility.checklist.creditsCompleted)}
                    <span className="font-medium">Required Credits</span>
                  </div>
                  <span>
                    {graduationStatus.eligibility.details.totalCredits}/{graduationStatus.eligibility.details.requiredCredits} credits
                  </span>
                </div>

                <div className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(graduationStatus.eligibility.checklist.cgpaRequirementMet)}`}>
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(graduationStatus.eligibility.checklist.cgpaRequirementMet)}
                    <span className="font-medium">Minimum CGPA (2.0+)</span>
                  </div>
                  <span>
                    Current CGPA: {graduationStatus.eligibility.details.cgpa.toFixed(2)}
                  </span>
                </div>

                <div className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(graduationStatus.eligibility.checklist.requiredCoursesPassed)}`}>
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(graduationStatus.eligibility.checklist.requiredCoursesPassed)}
                    <span className="font-medium">Required Courses</span>
                  </div>
                  <span>
                    {graduationStatus.eligibility.checklist.requiredCoursesPassed ? 'All Passed' : 'Some Required Courses Missing'}
                  </span>
                </div>

                <div className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(graduationStatus.eligibility.checklist.finalProjectApproved)}`}>
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(graduationStatus.eligibility.checklist.finalProjectApproved)}
                    <span className="font-medium">Final Year Project</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span>{graduationStatus.finalProject.status}</span>
                    {graduationStatus.finalProject.status !== 'Approved' && graduationStatus.finalProject.status !== 'Not Submitted' && (
                      <button
                        onClick={() => setActiveTab('project')}
                        className="text-purple-600 hover:text-purple-800 text-sm underline"
                      >
                        View Details
                      </button>
                    )}
                    {graduationStatus.finalProject.status === 'Not Submitted' && (
                      <button
                        onClick={() => setActiveTab('project')}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs"
                      >
                        Submit
                      </button>
                    )}
                  </div>
                </div>

                <div className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(graduationStatus.eligibility.checklist.internshipApproved)}`}>
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(graduationStatus.eligibility.checklist.internshipApproved)}
                    <span className="font-medium">Internship</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span>{graduationStatus.internship.status}</span>
                    {graduationStatus.internship.status !== 'Approved' &&
                      graduationStatus.internship.status !== 'Not Submitted' &&
                      graduationStatus.internship.status !== 'N/A' && (
                        <button
                          onClick={() => setActiveTab('internship')}
                          className="text-purple-600 hover:text-purple-800 text-sm underline"
                        >
                          View Details
                        </button>
                      )}
                    {graduationStatus.internship.status === 'Not Submitted' && (
                      <button
                        onClick={() => setActiveTab('internship')}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs"
                      >
                        Submit
                      </button>
                    )}
                  </div>
                </div>

                <div className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(graduationStatus.eligibility.checklist.clearanceApproved)}`}>
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(graduationStatus.eligibility.checklist.clearanceApproved)}
                    <span className="font-medium">Clearance</span>
                  </div>
                  <span>{graduationStatus.clearance.status}</span>
                </div>
              </div>
            </div>

            {/* Clearance Items */}
            {graduationStatus.clearance.items && graduationStatus.clearance.items.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="font-medium text-gray-900">Clearance Items</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Item Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Item Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {graduationStatus.clearance.items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.itemType}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.itemName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.status === 'Cleared' ? 'bg-green-100 text-green-800' :
                                item.status === 'Blocked' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                              }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {item.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Graduation Committee Approval */}
            {graduationStatus.eligibility.isEligible && !graduationStatus.isGraduated && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <div>
                    <h4 className="font-medium text-yellow-800">Awaiting Graduation Committee Approval</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      You have met all the requirements for graduation. Your application is now pending final approval from the Graduation Committee.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Graduation Approved */}
            {graduationStatus.isGraduated && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <Award className="h-5 w-5 text-green-600" />
                  <div>
                    <h4 className="font-medium text-green-800">Graduation Approved</h4>
                    <p className="text-sm text-green-700 mt-1">
                      Congratulations! Your graduation has been approved by the Graduation Committee.
                    </p>
                    {graduationStatus.graduationApproval.approvedBy && (
                      <p className="text-sm text-green-700 mt-1">
                        Approved by: {graduationStatus.graduationApproval.approvedBy} on {new Date(graduationStatus.graduationApproval.approvedAt || '').toLocaleDateString()}
                      </p>
                    )}
                    {graduationStatus.graduationApproval.comments && (
                      <p className="text-sm text-green-700 mt-1">
                        Comments: {graduationStatus.graduationApproval.comments}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'project' ? (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Final Year Project</h3>

            {/* Project Status */}
            {graduationStatus && graduationStatus.finalProject.status !== 'Not Submitted' && (
              <div className={`border rounded-lg p-4 ${graduationStatus.finalProject.status === 'Approved' ? 'bg-green-50 border-green-200' :
                  graduationStatus.finalProject.status === 'Rejected' ? 'bg-red-50 border-red-200' :
                    'bg-yellow-50 border-yellow-200'
                }`}>
                <div className="flex items-center space-x-3 mb-3">
                  {graduationStatus.finalProject.status === 'Approved' ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : graduationStatus.finalProject.status === 'Rejected' ? (
                    <XCircle className="h-5 w-5 text-red-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-yellow-600" />
                  )}
                  <h4 className="font-medium">
                    Status: {graduationStatus.finalProject.status}
                  </h4>
                </div>

                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Title:</span> {graduationStatus.finalProject.title}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Supervisor:</span> {graduationStatus.finalProject.supervisor}
                  </p>
                  {graduationStatus.finalProject.submittedAt && (
                    <p className="text-sm">
                      <span className="font-medium">Submitted:</span> {new Date(graduationStatus.finalProject.submittedAt).toLocaleDateString()}
                    </p>
                  )}
                  {graduationStatus.finalProject.approvedBy && (
                    <p className="text-sm">
                      <span className="font-medium">Approved By:</span> {graduationStatus.finalProject.approvedBy}
                    </p>
                  )}
                  {graduationStatus.finalProject.approvedAt && (
                    <p className="text-sm">
                      <span className="font-medium">Approved On:</span> {new Date(graduationStatus.finalProject.approvedAt).toLocaleDateString()}
                    </p>
                  )}
                  {graduationStatus.finalProject.comments && (
                    <p className="text-sm">
                      <span className="font-medium">Comments:</span> {graduationStatus.finalProject.comments}
                    </p>
                  )}
                  {graduationStatus.finalProject.rejectionReason && (
                    <p className="text-sm text-red-600">
                      <span className="font-medium">Rejection Reason:</span> {graduationStatus.finalProject.rejectionReason}
                    </p>
                  )}
                </div>

                {graduationStatus.finalProject.status === 'Rejected' && (
                  <div className="mt-4 bg-white bg-opacity-50 p-3 rounded">
                    <p className="text-sm text-red-800">
                      Your project was rejected. Please submit a revised version addressing the feedback.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Project Submission Form */}
            {(!graduationStatus ||
              graduationStatus.finalProject.status === 'Not Submitted' ||
              graduationStatus.finalProject.status === 'Rejected') && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 mb-4">Submit Final Year Project</h4>

                  <form onSubmit={handleSubmitProject} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Project Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={projectForm.title}
                        onChange={(e) => setProjectForm(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter your project title"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Project Description *
                      </label>
                      <textarea
                        required
                        value={projectForm.description}
                        onChange={(e) => setProjectForm(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        rows={4}
                        placeholder="Describe your project..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Project Supervisor *
                      </label>
                      <select
                        required
                        value={projectForm.supervisorId}
                        onChange={(e) => setProjectForm(prev => ({ ...prev, supervisorId: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Select a supervisor</option>
                        {supervisors.map(supervisor => (
                          <option key={supervisor._id} value={supervisor._id}>
                            {supervisor.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Project File (PDF) *
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => handleProjectFileChange(e.target.files?.[0] || null)}
                          className="hidden"
                          id="projectFile"
                        />
                        <label
                          htmlFor="projectFile"
                          className="flex-1 flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-purple-400 transition-colors duration-200"
                        >
                          <Upload className="h-4 w-4 mr-2 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {projectForm.projectFile ? projectForm.projectFile.name : 'Choose PDF file'}
                          </span>
                        </label>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submittingProject}
                      className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
                    >
                      {submittingProject ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      <span>{submittingProject ? 'Submitting...' : 'Submit Project'}</span>
                    </button>
                  </form>
                </div>
              )}
          </div>
        ) : activeTab === 'internship' ? (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Internship Documentation</h3>

            {/* Internship Status */}
            {graduationStatus && graduationStatus.internship.status !== 'Not Submitted' && graduationStatus.internship.status !== 'N/A' && (
              <div className={`border rounded-lg p-4 ${graduationStatus.internship.status === 'Approved' ? 'bg-green-50 border-green-200' :
                  graduationStatus.internship.status === 'Rejected' ? 'bg-red-50 border-red-200' :
                    'bg-yellow-50 border-yellow-200'
                }`}>
                <div className="flex items-center space-x-3 mb-3">
                  {graduationStatus.internship.status === 'Approved' ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : graduationStatus.internship.status === 'Rejected' ? (
                    <XCircle className="h-5 w-5 text-red-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-yellow-600" />
                  )}
                  <h4 className="font-medium">
                    Status: {graduationStatus.internship.status}
                  </h4>
                </div>

                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Company:</span> {graduationStatus.internship.company}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Position:</span> {graduationStatus.internship.position}
                  </p>
                  {graduationStatus.internship.duration && (
                    <p className="text-sm">
                      <span className="font-medium">Duration:</span> {graduationStatus.internship.duration}
                    </p>
                  )}
                  {graduationStatus.internship.submittedAt && (
                    <p className="text-sm">
                      <span className="font-medium">Submitted:</span> {new Date(graduationStatus.internship.submittedAt).toLocaleDateString()}
                    </p>
                  )}
                  {graduationStatus.internship.approvedBy && (
                    <p className="text-sm">
                      <span className="font-medium">Approved By:</span> {graduationStatus.internship.approvedBy}
                    </p>
                  )}
                  {graduationStatus.internship.approvedAt && (
                    <p className="text-sm">
                      <span className="font-medium">Approved On:</span> {new Date(graduationStatus.internship.approvedAt).toLocaleDateString()}
                    </p>
                  )}
                  {graduationStatus.internship.comments && (
                    <p className="text-sm">
                      <span className="font-medium">Comments:</span> {graduationStatus.internship.comments}
                    </p>
                  )}
                  {graduationStatus.internship.rejectionReason && (
                    <p className="text-sm text-red-600">
                      <span className="font-medium">Rejection Reason:</span> {graduationStatus.internship.rejectionReason}
                    </p>
                  )}
                </div>

                {graduationStatus.internship.status === 'Rejected' && (
                  <div className="mt-4 bg-white bg-opacity-50 p-3 rounded">
                    <p className="text-sm text-red-800">
                      Your internship documentation was rejected. Please submit revised documentation addressing the feedback.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Internship Submission Form */}
            {(!graduationStatus ||
              graduationStatus.internship.status === 'Not Submitted' ||
              graduationStatus.internship.status === 'Rejected') && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 mb-4">Submit Internship Documentation</h4>

                  <form onSubmit={handleSubmitInternship} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Company Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={internshipForm.company}
                          onChange={(e) => setInternshipForm(prev => ({ ...prev, company: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Enter company name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Position *
                        </label>
                        <input
                          type="text"
                          required
                          value={internshipForm.position}
                          onChange={(e) => setInternshipForm(prev => ({ ...prev, position: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Enter your position"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Start Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={internshipForm.startDate}
                          onChange={(e) => setInternshipForm(prev => ({ ...prev, startDate: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          End Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={internshipForm.endDate}
                          onChange={(e) => setInternshipForm(prev => ({ ...prev, endDate: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Supervisor Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={internshipForm.supervisorName}
                          onChange={(e) => setInternshipForm(prev => ({ ...prev, supervisorName: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Enter supervisor's name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Supervisor Contact *
                        </label>
                        <input
                          type="text"
                          required
                          value={internshipForm.supervisorContact}
                          onChange={(e) => setInternshipForm(prev => ({ ...prev, supervisorContact: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Enter supervisor's email or phone"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Internship Documentation (PDF) *
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => handleInternshipFileChange(e.target.files?.[0] || null)}
                          className="hidden"
                          id="internshipDocument"
                        />
                        <label
                          htmlFor="internshipDocument"
                          className="flex-1 flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-purple-400 transition-colors duration-200"
                        >
                          <Upload className="h-4 w-4 mr-2 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {internshipForm.internshipDocument ? internshipForm.internshipDocument.name : 'Choose PDF file'}
                          </span>
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Upload your internship completion certificate, evaluation, or other documentation
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={submittingInternship}
                      className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
                    >
                      {submittingInternship ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      <span>{submittingInternship ? 'Submitting...' : 'Submit Internship Documentation'}</span>
                    </button>
                  </form>
                </div>
              )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default GraduationStatus;