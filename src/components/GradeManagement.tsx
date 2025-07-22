import React, { useState, useEffect } from 'react';
import axios from 'axios';
import GradeUploadForm from './GradeUploadForm';

interface Course {
  _id: string;
  courseCode: string;
  courseName: string;
  department: string;
  year: number;
  semester: number;
}

interface GradeManagementProps {
  instructorId?: string;
}

const GradeManagement: React.FC<GradeManagementProps> = ({ instructorId }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'history' | 'manual'>('upload');

  useEffect(() => {
    fetchInstructorCourses();
  }, [instructorId]);

  const fetchInstructorCourses = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/courses/instructor', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      setCourses(response.data.courses || []);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCourseSelect = (course: Course) => {
    setSelectedCourse(course);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Grade Management</h1>
        <p className="text-gray-600">Manage and upload grades for your courses</p>
      </div>

      {/* Course Selection */}
      <div className="mb-6 p-4 bg-white rounded-lg shadow border">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Select Course</h2>
        {courses.length === 0 ? (
          <p className="text-gray-500">No courses assigned to you yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <div
                key={course._id}
                onClick={() => handleCourseSelect(course)}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedCourse?._id === course._id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <h3 className="font-semibold text-gray-800">{course.courseCode}</h3>
                <p className="text-sm text-gray-600">{course.courseName}</p>
                <p className="text-xs text-gray-500">
                  {course.department} • Year {course.year} • Semester {course.semester}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      {selectedCourse && (
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('upload')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'upload'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Excel Upload
              </button>
              <button
                onClick={() => setActiveTab('manual')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'manual'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Manual Entry
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'history'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Upload History
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {selectedCourse && (
        <div>
          {activeTab === 'upload' && (
            <GradeUploadForm
              courseId={selectedCourse._id}
              courseCode={selectedCourse.courseCode}
              courseName={selectedCourse.courseName}
              academicYear={new Date().getFullYear().toString()}
              semester={selectedCourse.semester}
            />
          )}

          {activeTab === 'manual' && (
            <div className="p-6 bg-white rounded-lg shadow border">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Manual Grade Entry - {selectedCourse.courseCode}
              </h2>
              <p className="text-gray-600 mb-4">
                Use the Excel upload feature for bulk grade entry, or contact your administrator for manual entry access.
              </p>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-blue-800">
                  💡 Tip: For bulk grade entry, use the Excel Upload tab above. It's faster and less error-prone.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="p-6 bg-white rounded-lg shadow border">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Upload History - {selectedCourse.courseCode}
              </h2>
              <p className="text-gray-600">
                View recent grade uploads and their status.
              </p>
              {/* You can add upload history component here */}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {!selectedCourse && courses.length > 0 && (
        <div className="p-6 bg-yellow-50 rounded-lg border border-yellow-200">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Getting Started</h3>
          <p className="text-yellow-700">
            Select a course from the list above to start managing grades. You can upload grades via Excel file or enter them manually.
          </p>
        </div>
      )}
    </div>
  );
};

export default GradeManagement;