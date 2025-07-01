import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Edit, Trash2, Save, X, Loader2 } from 'lucide-react';
import { User, Course } from '../types';

interface CourseManagementProps {
  user: User;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

const API_BASE = 'http://localhost:5000/api';

const CourseManagement: React.FC<CourseManagementProps> = ({ user, token, onError, onSuccess }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('Freshman');
  const [selectedYear, setSelectedYear] = useState(1);
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<string | null>(null);

  const [newCourse, setNewCourse] = useState({
    courseCode: '',
    courseName: '',
    credit: 1
  });

  const departments = ['Freshman', 'Electrical', 'Manufacturing', 'Automotive', 'Construction', 'ICT'];
  const years = [1, 2, 3, 4, 5];
  const semesters = [1, 2];

  useEffect(() => {
    fetchCourses();
  }, [selectedDepartment, selectedYear, selectedSemester]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/depthead/courses?department=${selectedDepartment}&year=${selectedYear}&semester=${selectedSemester}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setCourses(data.data.courses || []);
      }
    } catch (err) {
      console.error('Failed to fetch courses');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/depthead/courses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courses: [{
            ...newCourse,
            department: selectedDepartment,
            year: selectedYear,
            semester: selectedSemester
          }]
        }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Course added successfully!');
        setNewCourse({ courseCode: '', courseName: '', credit: 1 });
        setShowAddForm(false);
        fetchCourses();
      } else {
        onError(data.message || 'Failed to add course');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCourse = async (courseId: string, updatedData: Partial<Course>) => {
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/depthead/courses/${courseId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Course updated successfully!');
        setEditingCourse(null);
        fetchCourses();
      } else {
        onError(data.message || 'Failed to update course');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course?')) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/depthead/courses/${courseId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Course deleted successfully!');
        fetchCourses();
      } else {
        onError(data.message || 'Failed to delete course');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkReplace = async () => {
    if (!confirm('This will replace ALL courses for the selected department/year/semester. Continue?')) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/depthead/courses/bulk-replace`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          department: selectedDepartment,
          year: selectedYear,
          semester: selectedSemester,
          courses: courses.map(course => ({
            courseCode: course.courseCode,
            courseName: course.courseName,
            credit: course.credit
          }))
        }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Courses updated successfully!');
        fetchCourses();
      } else {
        onError(data.message || 'Failed to update courses');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Course Management Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Calendar className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Course Management</h2>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {years.map(year => (
                <option key={year} value={year}>Year {year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {semesters.map(semester => (
                <option key={semester} value={semester}>Semester {semester}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Course</span>
            </button>
          </div>
        </div>

        {/* Add Course Form */}
        {showAddForm && (
          <div className="bg-gray-50 p-4 rounded-md mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Add New Course</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddCourse} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Course Code</label>
                <input
                  type="text"
                  required
                  value={newCourse.courseCode}
                  onChange={(e) => setNewCourse({ ...newCourse, courseCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="MATH 1011"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Course Name</label>
                <input
                  type="text"
                  required
                  value={newCourse.courseName}
                  onChange={(e) => setNewCourse({ ...newCourse, courseName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Mathematics for Natural Sciences"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Credits</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="6"
                  value={newCourse.credit}
                  onChange={(e) => setNewCourse({ ...newCourse, credit: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-4 flex space-x-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>{loading ? 'Adding...' : 'Add Course'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Courses List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Courses for {selectedDepartment} - Year {selectedYear}, Semester {selectedSemester}
          </h3>
          {courses.length > 0 && (
            <button
              onClick={handleBulkReplace}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Save All Changes</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : courses.length > 0 ? (
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
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {courses.map((course) => (
                  <tr key={course._id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {editingCourse === course._id ? (
                        <input
                          type="text"
                          value={course.courseCode}
                          onChange={(e) => {
                            const updatedCourses = courses.map(c =>
                              c._id === course._id ? { ...c, courseCode: e.target.value } : c
                            );
                            setCourses(updatedCourses);
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        course.courseCode
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {editingCourse === course._id ? (
                        <input
                          type="text"
                          value={course.courseName}
                          onChange={(e) => {
                            const updatedCourses = courses.map(c =>
                              c._id === course._id ? { ...c, courseName: e.target.value } : c
                            );
                            setCourses(updatedCourses);
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        course.courseName
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {editingCourse === course._id ? (
                        <input
                          type="number"
                          min="1"
                          max="6"
                          value={course.credit}
                          onChange={(e) => {
                            const updatedCourses = courses.map(c =>
                              c._id === course._id ? { ...c, credit: Number(e.target.value) } : c
                            );
                            setCourses(updatedCourses);
                          }}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        course.credit
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {editingCourse === course._id ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleUpdateCourse(course._id, course)}
                            className="text-green-600 hover:text-green-900"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingCourse(null);
                              fetchCourses(); // Reset changes
                            }}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setEditingCourse(course._id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCourse(course._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
            <p className="text-gray-600">
              No courses have been added for {selectedDepartment} - Year {selectedYear}, Semester {selectedSemester} yet.
            </p>
          </div>
        )}

        {courses.length > 0 && (
          <div className="mt-4 bg-blue-50 p-4 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Total Courses:</strong> {courses.length} •
              <strong> Total Credits:</strong> {courses.reduce((sum, course) => sum + course.credit, 0)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseManagement;