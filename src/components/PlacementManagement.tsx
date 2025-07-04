import React, { useState, useEffect } from 'react';
import { MapPin, Users, TrendingUp, Clock, CheckCircle, AlertTriangle, FileText, Send } from 'lucide-react';
import { User } from '../types';

interface PlacementRequest {
  _id: string;
  studentId?: {
    firstName: string;
    fatherName: string;
    grandfatherName: string;
    studentId: string;
    email: string;
  };
  firstChoice: string;
  secondChoice?: string;
  personalStatement: string;
  reasonForChoice: string;
  careerGoals?: string;
  currentCGPA: number;
  totalCredits: number;
  status: string;
  approvedDepartment?: string;
  committeeComments?: string;
  rejectionReason?: string;
  submittedAt: string;
  priorityScore: number;
}

interface DepartmentCapacity {
  department: string;
  capacity: number;
  approved: number;
  available: number;
  isFull: boolean;
}

interface PlacementManagementProps {
  user: User;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

const API_BASE = 'http://localhost:5000/api';

const PlacementManagement: React.FC<PlacementManagementProps> = ({ user, token, onError, onSuccess }) => {
  const [placementRequest, setPlacementRequest] = useState<PlacementRequest | null>(null);
  const [pendingPlacements, setPendingPlacements] = useState<PlacementRequest[]>([]);
  const [departmentCapacities, setDepartmentCapacities] = useState<DepartmentCapacity[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'submit' | 'status' | 'review' | 'stats'>('submit');

  // Placement form state
  const [placementForm, setPlacementForm] = useState({
    firstChoice: '',
    secondChoice: '',
    personalStatement: '',
    reasonForChoice: '',
    careerGoals: ''
  });

  const departments = ['Electrical', 'Manufacturing', 'Automotive', 'Construction', 'ICT'];

  useEffect(() => {
    if (user.role === 'student') {
      fetchPlacementStatus();
      setActiveTab('status');
    } else {
      fetchPendingPlacements();
      setActiveTab('review');
    }
  }, [user.role]);

  const fetchPlacementStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/placement/student/placement-status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success && data.data.hasRequest) {
        setPlacementRequest(data.data.placementRequest);
        // Pre-fill form if request exists and can be modified
        if (data.data.canModify) {
          const req = data.data.placementRequest;
          setPlacementForm({
            firstChoice: req.firstChoice,
            secondChoice: req.secondChoice || '',
            personalStatement: req.personalStatement,
            reasonForChoice: req.reasonForChoice,
            careerGoals: req.careerGoals || ''
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch placement status');
    }
  };

  const fetchPendingPlacements = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/placement/committee/pending-placements`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setPendingPlacements(data.data.pendingPlacements || []);
        setDepartmentCapacities(data.data.departmentCapacities || []);
      }
    } catch (err) {
      console.error('Failed to fetch pending placements');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPlacement = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/placement/student/submit-placement`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(placementForm),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Placement request submitted successfully!');
        fetchPlacementStatus();
        setActiveTab('status');
      } else {
        onError(data.message || 'Failed to submit placement request');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewPlacement = async (requestId: string, decision: 'approve' | 'reject', approvedDepartment?: string, comments?: string) => {
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/placement/committee/review-placement/${requestId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ decision, approvedDepartment, comments }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess(`Placement request ${decision}d successfully!`);
        fetchPendingPlacements();
      } else {
        onError(data.message || `Failed to ${decision} placement request`);
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'approved':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'rejected':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'placed':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Clock className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <AlertTriangle className="h-4 w-4" />;
      case 'placed':
        return <MapPin className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const canSubmitPlacement = () => {
    return user.currentYear === 1 && user.currentSemester === 2 && !user.dismissed;
  };

  return (
    <div className="space-y-6">
      {/* Placement Management Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-6">
          <MapPin className="h-6 w-6 text-indigo-600" />
          <h2 className="text-xl font-semibold text-gray-900">Department Placement</h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
          {user.role === 'student' && (
            <>
              {canSubmitPlacement() && (
                <button
                  onClick={() => setActiveTab('submit')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'submit'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Submit Request
                </button>
              )}
              <button
                onClick={() => setActiveTab('status')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'status'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                My Status
              </button>
            </>
          )}

          {['departmentHead', 'registrar', 'placementCommittee'].includes(user.role) && (
            <>
              <button
                onClick={() => setActiveTab('review')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'review'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                Review Requests
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'stats'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                Statistics
              </button>
            </>
          )}
        </div>

        {/* Eligibility Check for Students */}
        {user.role === 'student' && !canSubmitPlacement() && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">Placement Not Available</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  {user.dismissed
                    ? 'Students with dismissed status cannot submit placement requests.'
                    : user.currentYear !== 1
                      ? 'Only freshman students can submit placement requests.'
                      : 'Placement requests can only be submitted in the second semester.'
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Submit Placement Request */}
        {activeTab === 'submit' && user.role === 'student' && canSubmitPlacement() && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Submit Department Placement Request</h3>

            <form onSubmit={handleSubmitPlacement} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Choice Department *
                  </label>
                  <select
                    required
                    value={placementForm.firstChoice}
                    onChange={(e) => setPlacementForm({ ...placementForm, firstChoice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select your first choice</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Second Choice Department (Optional)
                  </label>
                  <select
                    value={placementForm.secondChoice}
                    onChange={(e) => setPlacementForm({ ...placementForm, secondChoice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select your second choice</option>
                    {departments.filter(dept => dept !== placementForm.firstChoice).map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personal Statement * (100-1000 characters)
                </label>
                <textarea
                  required
                  minLength={100}
                  maxLength={1000}
                  value={placementForm.personalStatement}
                  onChange={(e) => setPlacementForm({ ...placementForm, personalStatement: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={4}
                  placeholder="Tell us about yourself, your interests, and why you want to pursue this field..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  {placementForm.personalStatement.length}/1000 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Choice * (Max 500 characters)
                </label>
                <textarea
                  required
                  maxLength={500}
                  value={placementForm.reasonForChoice}
                  onChange={(e) => setPlacementForm({ ...placementForm, reasonForChoice: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Explain why you chose this department and how it aligns with your goals..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  {placementForm.reasonForChoice.length}/500 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Career Goals (Optional, Max 500 characters)
                </label>
                <textarea
                  maxLength={500}
                  value={placementForm.careerGoals}
                  onChange={(e) => setPlacementForm({ ...placementForm, careerGoals: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Describe your career aspirations and how this department will help you achieve them..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  {placementForm.careerGoals.length}/500 characters
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white py-3 px-4 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>{loading ? 'Submitting...' : 'Submit Placement Request'}</span>
              </button>
            </form>
          </div>
        )}

        {/* Placement Status */}
        {activeTab === 'status' && user.role === 'student' && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Placement Request Status</h3>

            {placementRequest ? (
              <div className="space-y-4">
                <div className={`border rounded-lg p-4 ${getStatusColor(placementRequest.status)}`}>
                  <div className="flex items-center space-x-3 mb-3">
                    {getStatusIcon(placementRequest.status)}
                    <h4 className="font-medium capitalize">{placementRequest.status.replace('_', ' ')}</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">First Choice:</span> {placementRequest.firstChoice}
                    </div>
                    <div>
                      <span className="font-medium">Second Choice:</span> {placementRequest.secondChoice || 'None'}
                    </div>
                    <div>
                      <span className="font-medium">CGPA:</span> {placementRequest.currentCGPA?.toFixed(2)}
                    </div>
                    <div>
                      <span className="font-medium">Priority Score:</span> {placementRequest.priorityScore}/100
                    </div>
                    <div>
                      <span className="font-medium">Submitted:</span> {new Date(placementRequest.submittedAt).toLocaleDateString()}
                    </div>
                    {placementRequest.approvedDepartment && (
                      <div>
                        <span className="font-medium">Approved Department:</span> {placementRequest.approvedDepartment}
                      </div>
                    )}
                  </div>

                  {placementRequest.committeeComments && (
                    <div className="mt-3 p-3 bg-white bg-opacity-50 rounded">
                      <p className="text-sm">
                        <span className="font-medium">Committee Comments:</span> {placementRequest.committeeComments}
                      </p>
                    </div>
                  )}

                  {placementRequest.rejectionReason && (
                    <div className="mt-3 p-3 bg-white bg-opacity-50 rounded">
                      <p className="text-sm">
                        <span className="font-medium">Rejection Reason:</span> {placementRequest.rejectionReason}
                      </p>
                    </div>
                  )}
                </div>

                {placementRequest.status === 'approved' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                      <div>
                        <h4 className="font-medium text-green-800">Congratulations!</h4>
                        <p className="text-sm text-green-700 mt-1">
                          You have been placed in the {placementRequest.approvedDepartment} department.
                          You will be automatically enrolled in Year 2, Semester 1 courses for the next academic term.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Placement Request</h3>
                <p className="text-gray-600">
                  {canSubmitPlacement()
                    ? 'You have not submitted a placement request yet.'
                    : 'Placement requests are only available for freshman students in their second semester.'
                  }
                </p>
              </div>
            )}
          </div>
        )}

        {/* Review Requests */}
        {activeTab === 'review' && ['departmentHead', 'registrar', 'placementCommittee'].includes(user.role) && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Pending Placement Requests</h3>
              <div className="text-sm text-gray-600">
                Total: {pendingPlacements.length} requests
              </div>
            </div>

            {/* Department Capacities */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              {departmentCapacities.map((capacity) => (
                <div key={capacity.department} className={`p-4 rounded-lg border ${capacity.isFull ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                  <h4 className="font-medium text-sm">{capacity.department}</h4>
                  <p className="text-xs text-gray-600 mt-1">
                    {capacity.approved}/{capacity.capacity} filled
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className={`h-2 rounded-full ${capacity.isFull ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{ width: `${(capacity.approved / capacity.capacity) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            {pendingPlacements.length > 0 ? (
              <div className="space-y-4">
                {pendingPlacements.map((request) => (
                  <div key={request._id} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {request.studentId?.firstName} {request.studentId?.fatherName} {request.studentId?.grandfatherName}
                        </h4>
                        <p className="text-sm text-gray-600">{request.studentId?.studentId}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-indigo-600">
                          Priority Score: {request.priorityScore}/100
                        </div>
                        <div className="text-sm text-gray-600">
                          CGPA: {request.currentCGPA?.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <span className="text-sm font-medium text-gray-700">First Choice:</span>
                        <span className="ml-2 text-sm text-gray-900">{request.firstChoice}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">Second Choice:</span>
                        <span className="ml-2 text-sm text-gray-900">{request.secondChoice || 'None'}</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Personal Statement:</h5>
                      <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                        {request.personalStatement}
                      </p>
                    </div>

                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Reason for Choice:</h5>
                      <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                        {request.reasonForChoice}
                      </p>
                    </div>

                    <div className="flex space-x-3">
                      {departments.map(dept => {
                        const capacity = departmentCapacities.find(c => c.department === dept);
                        const isAvailable = capacity && !capacity.isFull;

                        return (
                          <button
                            key={dept}
                            onClick={() => handleReviewPlacement(request._id, 'approve', dept, `Approved for ${dept} department`)}
                            disabled={loading || !isAvailable}
                            className={`px-3 py-2 rounded text-sm font-medium transition-colors duration-200 ${isAvailable
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                          >
                            Approve for {dept}
                            {!isAvailable && ' (Full)'}
                          </button>
                        );
                      })}

                      <button
                        onClick={() => handleReviewPlacement(request._id, 'reject', undefined, 'Does not meet placement criteria')}
                        disabled={loading}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded text-sm font-medium transition-colors duration-200"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Requests</h3>
                <p className="text-gray-600">
                  All placement requests have been reviewed.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Statistics */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Placement Statistics</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-blue-600">Total Requests</p>
                    <p className="text-2xl font-bold text-blue-900">{pendingPlacements.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-green-600">Approved</p>
                    <p className="text-2xl font-bold text-green-900">
                      {departmentCapacities.reduce((sum, dept) => sum + dept.approved, 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-yellow-600">Avg Priority Score</p>
                    <p className="text-2xl font-bold text-yellow-900">
                      {pendingPlacements.length > 0
                        ? Math.round(pendingPlacements.reduce((sum, req) => sum + req.priorityScore, 0) / pendingPlacements.length)
                        : 0
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Department Capacity Overview */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-4">Department Capacity Overview</h4>
              <div className="space-y-3">
                {departmentCapacities.map((capacity) => (
                  <div key={capacity.department} className="flex items-center justify-between">
                    <span className="font-medium">{capacity.department}</span>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-600">
                        {capacity.approved}/{capacity.capacity}
                      </span>
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${capacity.isFull ? 'bg-red-500' : 'bg-green-500'}`}
                          style={{ width: `${(capacity.approved / capacity.capacity) * 100}%` }}
                        ></div>
                      </div>
                      <span className={`text-sm font-medium ${capacity.isFull ? 'text-red-600' : 'text-green-600'}`}>
                        {capacity.available} available
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlacementManagement;