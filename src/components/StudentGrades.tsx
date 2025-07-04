import React, { useState, useEffect } from 'react';
import { GraduationCap, TrendingUp, AlertTriangle, CheckCircle, Download } from 'lucide-react';
import { User, StudentGrade, AcademicStanding } from '../types';

interface StudentGradesProps {
  user: User;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

const API_BASE = 'http://localhost:5000/api';

const StudentGrades: React.FC<StudentGradesProps> = ({ user, token, onError, onSuccess }) => {
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [transcript, setTranscript] = useState<any>(null);
  const [academicStanding, setAcademicStanding] = useState<AcademicStanding | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'grades' | 'transcript' | 'standing'>('grades');

  useEffect(() => {
    fetchStudentGrades();
    fetchStudentTranscript();
  }, []);

  const fetchStudentGrades = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/grades/student/grades`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setGrades(data.data.grades || []);
        setAcademicStanding(data.data.academicStanding);
      }
    } catch (err) {
      console.error('Failed to fetch student grades');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentTranscript = async () => {
    try {
      const response = await fetch(`${API_BASE}/student/transcript`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setTranscript(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch student transcript');
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

  const getGradeColor = (letterGrade: string) => {
    switch (letterGrade) {
      case 'A+':
      case 'A':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'A-':
      case 'B+':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'B':
      case 'B-':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'C+':
      case 'C':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'D':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'F':
      case 'NG':
        return 'text-red-800 bg-red-100 border-red-300';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStandingIcon = () => {
    if (academicStanding?.dismissed) {
      return <AlertTriangle className="h-5 w-5 text-red-600" />;
    }
    if (academicStanding?.probation) {
      return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    }
    return <CheckCircle className="h-5 w-5 text-green-600" />;
  };

  const getStandingMessage = () => {
    if (academicStanding?.dismissed) {
      return 'Academic Dismissal - Contact Academic Affairs';
    }
    if (academicStanding?.probation) {
      return 'Academic Probation - CGPA Below 2.0';
    }
    return 'Good Academic Standing';
  };

  const getStandingColor = () => {
    if (academicStanding?.dismissed) {
      return 'bg-red-50 border-red-200 text-red-800';
    }
    if (academicStanding?.probation) {
      return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    }
    return 'bg-green-50 border-green-200 text-green-800';
  };

  return (
    <div className="space-y-6">
      {/* Academic Standing Alert */}
      {academicStanding && (academicStanding.probation || academicStanding.dismissed) && (
        <div className={`border rounded-lg p-4 ${getStandingColor()}`}>
          <div className="flex items-center space-x-3">
            {getStandingIcon()}
            <div>
              <h3 className="font-medium">{getStandingMessage()}</h3>
              <p className="text-sm mt-1">
                {academicStanding.dismissed
                  ? 'Your academic performance requires immediate attention. Please contact the Academic Affairs office.'
                  : 'Your CGPA is below the required 2.0 minimum. You must improve your grades to maintain good standing.'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grades Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-6">
          <GraduationCap className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Academic Records</h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
          <button
            onClick={() => setActiveTab('grades')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'grades'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Current Grades
          </button>
          <button
            onClick={() => setActiveTab('transcript')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'transcript'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Transcript
          </button>
          <button
            onClick={() => setActiveTab('standing')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'standing'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Academic Standing
          </button>
        </div>

        {/* Current Grades Tab */}
        {activeTab === 'grades' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Current Semester Grades</h3>

            {grades.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Course
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Credits
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Mark
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Letter Grade
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Grade Points
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Academic Year
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {grades.map((grade) => (
                      <tr key={grade._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {grade.courseId?.courseCode}
                          </div>
                          <div className="text-sm text-gray-500">
                            {grade.courseId?.courseName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {grade.courseId?.credit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {grade.totalMark}/100
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getGradeColor(grade.letterGrade)}`}>
                            {grade.letterGrade}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {grade.gradePoints.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {grade.academicYear}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No grades available</h3>
                <p className="text-gray-600">
                  Your grades will appear here once they are finalized by the registrar.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Transcript Tab */}
        {activeTab === 'transcript' && transcript && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Official Transcript</h3>
              <button
                onClick={downloadTranscript}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Download PDF</span>
              </button>
            </div>

            {/* Student Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Student Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Name:</span> {transcript.student?.name}
                </div>
                <div>
                  <span className="font-medium">Student ID:</span> {transcript.student?.studentId}
                </div>
                <div>
                  <span className="font-medium">Department:</span> {transcript.student?.department || 'Freshman'}
                </div>
                <div>
                  <span className="font-medium">Enrollment Year:</span> {transcript.student?.enrollmentYear}
                </div>
              </div>
            </div>

            {/* Semester-wise Grades */}
            {transcript.transcript?.map((semester: any, index: number) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900">
                    {semester.academicYear} - Semester {semester.semester}
                  </h4>
                  <div className="text-sm text-gray-600">
                    GPA: <span className="font-medium">{semester.semesterGPA}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Credits</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {semester.courses?.map((course: any, courseIndex: number) => (
                        <tr key={courseIndex}>
                          <td className="px-4 py-2 text-sm">
                            <div className="font-medium">{course.courseCode}</div>
                            <div className="text-gray-500">{course.courseName}</div>
                          </td>
                          <td className="px-4 py-2 text-sm">{course.credit}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getGradeColor(course.letterGrade)}`}>
                              {course.letterGrade}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm">{course.gradePoints}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-2 text-sm text-gray-600">
                  Semester Credits: {semester.semesterCredits} | Semester GPA: {semester.semesterGPA}
                </div>
              </div>
            ))}

            {/* Summary */}
            {transcript.summary && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Academic Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-blue-700">Total Credits:</span>
                    <div className="text-blue-900">{transcript.summary.totalCreditsAttempted}</div>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">CGPA:</span>
                    <div className="text-blue-900 text-lg font-bold">{transcript.summary.cgpa}</div>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Status:</span>
                    <div className="text-blue-900 capitalize">{transcript.summary.academicStanding?.status}</div>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Standing:</span>
                    <div className="text-blue-900">{getStandingMessage()}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Academic Standing Tab */}
        {activeTab === 'standing' && academicStanding && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Academic Standing</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-blue-600">Current CGPA</p>
                    <p className="text-2xl font-bold text-blue-900">{academicStanding.cgpa?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-green-600">Credits Earned</p>
                    <p className="text-2xl font-bold text-green-900">{academicStanding.totalCredits || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <GraduationCap className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-purple-600">Courses Completed</p>
                    <p className="text-2xl font-bold text-purple-900">{academicStanding.courseCount || 0}</p>
                  </div>
                </div>
              </div>

              <div className={`p-6 rounded-lg ${getStandingColor()}`}>
                <div className="flex items-center">
                  {getStandingIcon()}
                  <div className="ml-4">
                    <p className="text-sm font-medium">Academic Status</p>
                    <p className="text-lg font-bold">{academicStanding.status?.toUpperCase() || 'ACTIVE'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-4">Academic Standing Information</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">Minimum CGPA Required:</span>
                  <span>2.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Probation Threshold:</span>
                  <span>Below 2.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Dismissal Threshold:</span>
                  <span>Below 1.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Current Standing:</span>
                  <span className={academicStanding.probation || academicStanding.dismissed ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                    {getStandingMessage()}
                  </span>
                </div>
              </div>

              {(academicStanding.probation || academicStanding.dismissed) && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <h5 className="font-medium text-yellow-800 mb-2">Action Required</h5>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Meet with your academic advisor</li>
                    <li>• Develop an academic improvement plan</li>
                    <li>• Consider tutoring or study groups</li>
                    <li>• Review course load and time management</li>
                    {academicStanding.dismissed && (
                      <li>• Contact Academic Affairs for readmission process</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentGrades;