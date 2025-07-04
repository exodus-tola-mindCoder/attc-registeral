import React, { useState, useEffect } from 'react';
import {
  Building, Users, CheckCircle, XCircle, Clock,
  Search, Filter, Loader2, Check, X, Plus, Save,
  Download, Trash2, Edit
} from 'lucide-react';
import { User } from '../types';

interface ClearanceManagementProps {
  user: User;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

interface Student {
  _id: string;
  firstName: string;
  fatherName: string;
  grandfatherName: string;
  studentId: string;
  department: string;
  currentYear: number;
  clearanceStatus: string;
  clearanceItems: Array<{
    itemType: string;
    itemName: string;
    status: string;
    notes: string;
  }>;
}

const API_BASE = 'http://localhost:5000/api';

const ClearanceManagement: React.FC<ClearanceManagementProps> = ({ user, token, onError, onSuccess }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    department: '',
    year: '',
    status: '',
    search: ''
  });

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0
  });

  // New clearance item form
  const [newItem, setNewItem] = useState({
    itemType: 'Library',
    itemName: '',
    status: 'Pending',
    notes: ''
  });

  // Edit mode
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, [filters, pagination.page]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        role: 'student',
        status: 'active',
        currentYear: '4,5' // Final year students
      });

      if (filters.department) params.append('department', filters.department);
      if (filters.search) params.append('search', filters.search);

      const response = await fetch(`${API_BASE}/itadmin/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setStudents(data.data.users || []);
        setPagination(prev => ({
          ...prev,
          total: data.data.pagination.total
        }));
      } else {
        onError(data.message || 'Failed to fetch students');
      }
    } catch (err) {
      console.error('Failed to fetch students');
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
        // Find the student in the list and update with clearance details
        const updatedStudents = students.map(student => {
          if (student._id === studentId) {
            return {
              ...student,
              clearanceStatus: data.data.clearance.status,
              clearanceItems: data.data.clearance.items || []
            };
          }
          return student;
        });

        setStudents(updatedStudents);

        // Set selected student
        const selectedStudent = updatedStudents.find(s => s._id === studentId);
        if (selectedStudent) {
          setSelectedStudent(selectedStudent);
        }
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

  const handleAddItem = () => {
    if (!newItem.itemName) {
      onError('Item name is required');
      return;
    }

    if (!selectedStudent) return;

    const updatedStudent = {
      ...selectedStudent,
      clearanceItems: [
        ...selectedStudent.clearanceItems || [],
        newItem
      ]
    };

    setSelectedStudent(updatedStudent);
    setNewItem({
      itemType: 'Library',
      itemName: '',
      status: 'Pending',
      notes: ''
    });
  };

  const handleEditItem = (index: number) => {
    if (!selectedStudent || !selectedStudent.clearanceItems) return;

    setNewItem(selectedStudent.clearanceItems[index]);
    setEditingItemIndex(index);
  };

  const handleUpdateItem = () => {
    if (!selectedStudent || editingItemIndex === null) return;

    const updatedItems = [...selectedStudent.clearanceItems];
    updatedItems[editingItemIndex] = newItem;

    setSelectedStudent({
      ...selectedStudent,
      clearanceItems: updatedItems
    });

    setNewItem({
      itemType: 'Library',
      itemName: '',
      status: 'Pending',
      notes: ''
    });

    setEditingItemIndex(null);
  };

  const handleDeleteItem = (index: number) => {
    if (!selectedStudent) return;

    const updatedItems = selectedStudent.clearanceItems.filter((_, i) => i !== index);

    setSelectedStudent({
      ...selectedStudent,
      clearanceItems: updatedItems
    });
  };

  const handleSaveClearance = async () => {
    if (!selectedStudent) return;

    setSubmitting(true);

    try {
      // Determine overall status based on items
      let overallStatus = 'Cleared';

      if (selectedStudent.clearanceItems.some(item => item.status === 'Blocked')) {
        overallStatus = 'Blocked';
      } else if (selectedStudent.clearanceItems.some(item => item.status === 'Pending')) {
        overallStatus = 'Pending';
      }

      const response = await fetch(`${API_BASE}/graduation/clearance/mark/${selectedStudent._id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: overallStatus,
          items: selectedStudent.clearanceItems
        }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess(`Clearance status updated to ${overallStatus}`);

        // Update student in list
        const updatedStudents = students.map(student => {
          if (student._id === selectedStudent._id) {
            return {
              ...student,
              clearanceStatus: overallStatus
            };
          }
          return student;
        });

        setStudents(updatedStudents);
        setSelectedStudent(null);
      } else {
        onError(data.message || 'Failed to update clearance status');
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

  const getStatusColor = (status: string) => {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Cleared':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'Blocked':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'Pending':
      default:
        return <Clock className="h-5 w-5 text-yellow-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Clearance Management Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Building className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Clearance Management</h2>
        </div>

        {/* Filters */}
        {!selectedStudent && (
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <select
                  value={filters.department}
                  onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Years</option>
                  <option value="4">Year 4</option>
                  <option value="5">Year 5</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Clearance Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="Cleared">Cleared</option>
                  <option value="Pending">Pending</option>
                  <option value="Blocked">Blocked</option>
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
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Search by name or ID..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : selectedStudent ? (
          <div className="space-y-6">
            {/* Student Details */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedStudent.firstName} {selectedStudent.fatherName} {selectedStudent.grandfatherName}
                </h3>
                <p className="text-gray-600">
                  ID: {selectedStudent.studentId} | Department: {selectedStudent.department} | Year: {selectedStudent.currentYear}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors duration-200"
                >
                  Back to List
                </button>
                <button
                  onClick={() => generateTranscript(selectedStudent._id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors duration-200 flex items-center space-x-1"
                >
                  <Download className="h-3 w-3" />
                  <span>Transcript</span>
                </button>
              </div>
            </div>

            {/* Clearance Status */}
            <div className={`border rounded-lg p-4 ${getStatusColor(selectedStudent.clearanceStatus || 'Pending')}`}>
              <div className="flex items-center space-x-3">
                {getStatusIcon(selectedStudent.clearanceStatus || 'Pending')}
                <h4 className="font-medium">
                  Current Clearance Status: {selectedStudent.clearanceStatus || 'Pending'}
                </h4>
              </div>
            </div>

            {/* Clearance Items */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h4 className="font-medium text-gray-900">Clearance Items</h4>
                <div className="text-sm text-gray-600">
                  {selectedStudent.clearanceItems?.length || 0} items
                </div>
              </div>

              {selectedStudent.clearanceItems && selectedStudent.clearanceItems.length > 0 ? (
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedStudent.clearanceItems.map((item, index) => (
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditItem(index)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(index)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-6 py-4 text-center text-gray-500">
                  No clearance items found. Add items below.
                </div>
              )}
            </div>

            {/* Add/Edit Item Form */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">
                {editingItemIndex !== null ? 'Edit Clearance Item' : 'Add Clearance Item'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Item Type</label>
                  <select
                    value={newItem.itemType}
                    onChange={(e) => setNewItem(prev => ({ ...prev, itemType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Library">Library</option>
                    <option value="Laboratory">Laboratory</option>
                    <option value="Dormitory">Dormitory</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Item Name</label>
                  <input
                    type="text"
                    value={newItem.itemName}
                    onChange={(e) => setNewItem(prev => ({ ...prev, itemName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter item name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={newItem.status}
                    onChange={(e) => setNewItem(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Cleared">Cleared</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <input
                    type="text"
                    value={newItem.notes}
                    onChange={(e) => setNewItem(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional notes"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end space-x-3">
                {editingItemIndex !== null ? (
                  <>
                    <button
                      onClick={() => {
                        setEditingItemIndex(null);
                        setNewItem({
                          itemType: 'Library',
                          itemName: '',
                          status: 'Pending',
                          notes: ''
                        });
                      }}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateItem}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors duration-200 flex items-center space-x-1"
                    >
                      <Save className="h-3 w-3" />
                      <span>Update Item</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleAddItem}
                    disabled={!newItem.itemName}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors duration-200 flex items-center space-x-1"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Item</span>
                  </button>
                )}
              </div>
            </div>

            {/* Save Clearance */}
            <div className="flex justify-end">
              <button
                onClick={handleSaveClearance}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{submitting ? 'Saving...' : 'Save Clearance Status'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Student Clearance List</h3>
              <div className="text-sm text-gray-600">
                Total: {pagination.total} students
              </div>
            </div>

            {students.length > 0 ? (
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
                          Year
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Clearance Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {students.map((student) => (
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
                            Year {student.currentYear}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${student.clearanceStatus === 'Cleared' ? 'bg-green-100 text-green-800' :
                                student.clearanceStatus === 'Blocked' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                              }`}>
                              {student.clearanceStatus || 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => fetchStudentDetails(student._id)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Manage Clearance
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
                <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No students found</h3>
                <p className="text-gray-600">
                  No students match your current filters.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClearanceManagement;