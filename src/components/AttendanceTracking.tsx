import React, { useState, useEffect } from 'react';
import {
  Calendar, Users, CheckCircle, XCircle, Clock, Download,
  Search, Filter, AlertTriangle, BarChart3, Loader2,
  ChevronDown, ChevronUp, Check, X, AlertCircle
} from 'lucide-react';
import { User } from '../types';

interface AttendanceTrackingProps {
  user: User;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

interface Course {
  _id: string;
  courseCode: string;
  courseName: string;
  department: string;
  year: number;
  semester: number;
  studentCount: number;
  schedules: Schedule[];
}

interface Schedule {
  _id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomNumber: string;
}

interface Student {
  _id: string;
  name: string;
  studentId: string;
  attendance: {
    status: string;
    notes: string;
    attendanceId: string | null;
  };
}

interface AttendanceRecord {
  _id: string;
  date: string;
  status: string;
  notes: string;
  schedule?: {
    dayOfWeek: string;
    time: string;
    room: string;
  } | null;
}

interface AttendanceStats {
  percentage: number;
  totalClasses: number;
  present: number;
  absent: number;
  excused: number;
}

interface CourseAttendance {
  courseId: string;
  courseCode: string;
  courseName: string;
  percentage: number;
  totalClasses: number;
  present: number;
  absent: number;
  excused: number;
  schedules?: Schedule[];
}

const API_BASE = 'http://localhost:5000/api';

const AttendanceTracking: React.FC<AttendanceTrackingProps> = ({ user, token, onError, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'mark' | 'view' | 'report' | 'at-risk'>('mark');
  const [loading, setLoading] = useState(false);

  // Instructor data
  const [instructorCourses, setInstructorCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<{ [key: string]: { status: string, notes: string } }>({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

  // Student data
  const [studentAttendance, setStudentAttendance] = useState<CourseAttendance[]>([]);
  const [selectedStudentCourse, setSelectedStudentCourse] = useState<string>('');
  const [attendanceDetails, setAttendanceDetails] = useState<{
    stats: AttendanceStats;
    records: AttendanceRecord[];
    eligibility: {
      eligible: boolean;
      percentage: number;
      requiredPercentage: number;
      deficit: number;
    };
  } | null>(null);

  // Department Head / Registrar data
  const [departmentCourses, setDepartmentCourses] = useState<any[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<any[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string>(user.department || 'Freshman');

  useEffect(() => {
    if (user.role === 'instructor') {
      fetchInstructorCourses();
      setActiveTab('mark');
    } else if (user.role === 'student') {
      fetchStudentAttendance();
      setActiveTab('view');
    } else if (['departmentHead', 'registrar'].includes(user.role)) {
      fetchDepartmentOverview();
      setActiveTab('report');
    }
  }, [user.role]);

  // Instructor functions
  const fetchInstructorCourses = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/attendance/instructor/courses`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setInstructorCourses(data.data.courses || []);
        if (data.data.courses.length > 0) {
          setSelectedCourse(data.data.courses[0]._id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch instructor courses');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsForAttendance = async () => {
    if (!selectedCourse) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/attendance/students/${selectedCourse}?date=${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setStudents(data.data.students || []);
        setSelectedSchedule(data.data.schedule || null);

        // Initialize attendance status from existing data
        const initialStatus: { [key: string]: { status: string, notes: string } } = {};
        data.data.students.forEach((student: Student) => {
          initialStatus[student._id] = {
            status: student.attendance.status === 'not_marked' ? 'present' : student.attendance.status,
            notes: student.attendance.notes || ''
          };
        });
        setAttendanceStatus(initialStatus);
      } else {
        onError(data.message);
      }
    } catch (err) {
      console.error('Failed to fetch students for attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceChange = (studentId: string, status: string) => {
    setAttendanceStatus(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status
      }
    }));
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setAttendanceStatus(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        notes
      }
    }));
  };

  const handleSubmitAttendance = async () => {
    if (!selectedCourse || !selectedDate) {
      onError('Course and date are required');
      return;
    }

    if (!selectedSchedule) {
      onError('No valid class schedule found for this date');
      return;
    }

    setSubmitting(true);

    try {
      // Prepare attendance records
      const attendanceRecords = students.map(student => ({
        studentId: student._id,
        status: attendanceStatus[student._id]?.status || 'present',
        notes: attendanceStatus[student._id]?.notes || ''
      }));

      const response = await fetch(`${API_BASE}/attendance/mark`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId: selectedCourse,
          date: selectedDate,
          attendanceRecords
        }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Attendance marked successfully!');
        fetchStudentsForAttendance(); // Refresh the list
      } else {
        onError(data.message || 'Failed to mark attendance');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Student functions
  const fetchStudentAttendance = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/attendance/student/all`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setStudentAttendance(data.data.courses || []);
        if (data.data.courses.length > 0) {
          setSelectedStudentCourse(data.data.courses[0].courseId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch student attendance');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceDetails = async () => {
    if (!selectedStudentCourse) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/attendance/${selectedStudentCourse}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setAttendanceDetails({
          stats: data.data.attendanceStats,
          records: data.data.records,
          eligibility: data.data.eligibility
        });
      }
    } catch (err) {
      console.error('Failed to fetch attendance details');
    } finally {
      setLoading(false);
    }
  };

  // Department Head / Registrar functions
  const fetchDepartmentOverview = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/attendance/department/overview?department=${departmentFilter}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setDepartmentCourses(data.data.courses || []);
      }
    } catch (err) {
      console.error('Failed to fetch department overview');
    } finally {
      setLoading(false);
    }
  };

  const fetchAtRiskStudents = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/attendance/at-risk?department=${departmentFilter}&threshold=75`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setAtRiskStudents(data.data.atRiskStudents || []);
      }
    } catch (err) {
      console.error('Failed to fetch at-risk students');
    } finally {
      setLoading(false);
    }
  };

  const exportAttendanceReport = async (courseId: string) => {
    try {
      const response = await fetch(`${API_BASE}/attendance/export/${courseId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export attendance report');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_report_${courseId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      onSuccess('Attendance report exported successfully!');
    } catch (err) {
      onError('Failed to export attendance report');
    }
  };

  // Effects
  useEffect(() => {
    if (selectedCourse && selectedDate) {
      fetchStudentsForAttendance();
    }
  }, [selectedCourse, selectedDate]);

  useEffect(() => {
    if (selectedStudentCourse) {
      fetchAttendanceDetails();
    }
  }, [selectedStudentCourse]);

  useEffect(() => {
    if (['departmentHead', 'registrar'].includes(user.role)) {
      if (activeTab === 'report') {
        fetchDepartmentOverview();
      } else if (activeTab === 'at-risk') {
        fetchAtRiskStudents();
      }
    }
  }, [activeTab, departmentFilter]);

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'absent':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'excused':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'absent':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'excused':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getAttendancePercentageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 75) return 'text-blue-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDayOfWeek = (dateString: string) => {
    const date = new Date(dateString);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  const isDateScheduled = (dateString: string) => {
    if (!selectedCourse) return false;

    const course = instructorCourses.find(c => c._id === selectedCourse);
    if (!course || !course.schedules || course.schedules.length === 0) return false;

    const dayOfWeek = getDayOfWeek(dateString);
    return course.schedules.some(schedule => schedule.dayOfWeek === dayOfWeek);
  };

  return (
    <div className="space-y-6">
      {/* Attendance Tracking Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Calendar className="h-6 w-6 text-indigo-600" />
          <h2 className="text-xl font-semibold text-gray-900">Attendance Tracking</h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6 overflow-x-auto">
          {user.role === 'instructor' && (
            <button
              onClick={() => setActiveTab('mark')}
              className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'mark'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <CheckCircle className="h-4 w-4 inline mr-2" />
              Mark Attendance
            </button>
          )}

          {user.role === 'student' && (
            <button
              onClick={() => setActiveTab('view')}
              className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'view'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <Calendar className="h-4 w-4 inline mr-2" />
              My Attendance
            </button>
          )}

          {['departmentHead', 'registrar'].includes(user.role) && (
            <>
              <button
                onClick={() => setActiveTab('report')}
                className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'report'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                <BarChart3 className="h-4 w-4 inline mr-2" />
                Attendance Reports
              </button>
              <button
                onClick={() => setActiveTab('at-risk')}
                className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'at-risk'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                At-Risk Students
              </button>
            </>
          )}
        </div>

        {/* Mark Attendance (Instructor) */}
        {activeTab === 'mark' && user.role === 'instructor' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Course
                </label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a course</option>
                  {instructorCourses.map((course) => (
                    <option key={course._id} value={course._id}>
                      {course.courseCode} - {course.courseName} ({course.studentCount} students)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]} // Prevent future dates
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {selectedCourse && !isDateScheduled(selectedDate) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3" />
                  <div>
                    <h4 className="font-medium text-yellow-800">No Class Scheduled</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      There is no class scheduled for this course on {getDayOfWeek(selectedDate)}.
                      You can only mark attendance for scheduled class days.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedSchedule && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-blue-600 mr-3" />
                  <div>
                    <h4 className="font-medium text-blue-800">Class Schedule</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      {selectedSchedule.dayOfWeek}, {selectedSchedule.startTime} - {selectedSchedule.endTime}, Room {selectedSchedule.roomNumber}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : students.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    Student Attendance
                  </h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        // Mark all as present
                        const newStatus = { ...attendanceStatus };
                        students.forEach(student => {
                          newStatus[student._id] = {
                            ...newStatus[student._id],
                            status: 'present'
                          };
                        });
                        setAttendanceStatus(newStatus);
                      }}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                    >
                      All Present
                    </button>
                    <button
                      onClick={handleSubmitAttendance}
                      disabled={submitting || !selectedSchedule}
                      className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-400 flex items-center space-x-2"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      <span>{submitting ? 'Saving...' : 'Save Attendance'}</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Student
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Notes (Optional)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {students.map((student) => (
                          <tr key={student._id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{student.name}</div>
                              <div className="text-sm text-gray-500">{student.studentId}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleAttendanceChange(student._id, 'present')}
                                  className={`px-3 py-1 rounded-full text-sm font-medium ${attendanceStatus[student._id]?.status === 'present'
                                      ? 'bg-green-100 text-green-800 border border-green-300'
                                      : 'bg-gray-100 text-gray-800 hover:bg-green-50'
                                    }`}
                                >
                                  Present
                                </button>
                                <button
                                  onClick={() => handleAttendanceChange(student._id, 'absent')}
                                  className={`px-3 py-1 rounded-full text-sm font-medium ${attendanceStatus[student._id]?.status === 'absent'
                                      ? 'bg-red-100 text-red-800 border border-red-300'
                                      : 'bg-gray-100 text-gray-800 hover:bg-red-50'
                                    }`}
                                >
                                  Absent
                                </button>
                                <button
                                  onClick={() => handleAttendanceChange(student._id, 'excused')}
                                  className={`px-3 py-1 rounded-full text-sm font-medium ${attendanceStatus[student._id]?.status === 'excused'
                                      ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                      : 'bg-gray-100 text-gray-800 hover:bg-yellow-50'
                                    }`}
                                >
                                  Excused
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <input
                                type="text"
                                value={attendanceStatus[student._id]?.notes || ''}
                                onChange={(e) => handleNotesChange(student._id, e.target.value)}
                                placeholder="Add notes (optional)"
                                className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : selectedCourse ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No students found</h3>
                <p className="text-gray-600">
                  No students are registered for this course or attendance data couldn't be loaded.
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a course</h3>
                <p className="text-gray-600">
                  Please select a course to mark attendance.
                </p>
              </div>
            )}
          </div>
        )}

        {/* View Attendance (Student) */}
        {activeTab === 'view' && user.role === 'student' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {studentAttendance.map((course) => (
                <div
                  key={course.courseId}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors duration-200 ${selectedStudentCourse === course.courseId
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/30'
                    }`}
                  onClick={() => setSelectedStudentCourse(course.courseId)}
                >
                  <h3 className="font-medium text-gray-900">{course.courseCode}</h3>
                  <p className="text-sm text-gray-600 mb-2">{course.courseName}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">
                      <span className={getAttendancePercentageColor(course.percentage)}>
                        {course.percentage}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {course.totalClasses} classes
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className={`h-2 rounded-full ${course.percentage >= 90 ? 'bg-green-500' :
                          course.percentage >= 75 ? 'bg-blue-500' :
                            course.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                      style={{ width: `${Math.min(100, course.percentage)}%` }}
                    ></div>
                  </div>
                  {course.schedules && course.schedules.length > 0 && (
                    <div className="mt-3 text-xs text-gray-500">
                      <p className="font-medium">Schedule:</p>
                      {course.schedules.map((schedule, index) => (
                        <p key={index}>
                          {schedule.dayOfWeek}, {schedule.startTime}-{schedule.endTime}, Room {schedule.roomNumber}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : attendanceDetails && selectedStudentCourse ? (
              <div className="space-y-6">
                {/* Attendance Summary */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Attendance Summary</h3>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-indigo-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-indigo-700">Attendance Rate</div>
                      <div className={`text-2xl font-bold ${getAttendancePercentageColor(attendanceDetails.stats.percentage)}`}>
                        {attendanceDetails.stats.percentage}%
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-green-700">Present</div>
                      <div className="text-2xl font-bold text-green-700">
                        {attendanceDetails.stats.present} <span className="text-sm">/ {attendanceDetails.stats.totalClasses}</span>
                      </div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-red-700">Absent</div>
                      <div className="text-2xl font-bold text-red-700">
                        {attendanceDetails.stats.absent} <span className="text-sm">/ {attendanceDetails.stats.totalClasses}</span>
                      </div>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-yellow-700">Excused</div>
                      <div className="text-2xl font-bold text-yellow-700">
                        {attendanceDetails.stats.excused} <span className="text-sm">/ {attendanceDetails.stats.totalClasses}</span>
                      </div>
                    </div>
                  </div>

                  {/* Final Exam Eligibility */}
                  <div className={`mt-6 p-4 rounded-lg border ${attendanceDetails.eligibility.eligible
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                    }`}>
                    <div className="flex items-center">
                      {attendanceDetails.eligibility.eligible ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
                      )}
                      <div>
                        <h4 className={`font-medium ${attendanceDetails.eligibility.eligible ? 'text-green-800' : 'text-red-800'
                          }`}>
                          {attendanceDetails.eligibility.eligible
                            ? 'Eligible for Final Exam'
                            : 'At Risk: May Not Be Eligible for Final Exam'
                          }
                        </h4>
                        <p className={`text-sm mt-1 ${attendanceDetails.eligibility.eligible ? 'text-green-700' : 'text-red-700'
                          }`}>
                          {attendanceDetails.eligibility.eligible
                            ? `Your attendance is above the required ${attendanceDetails.eligibility.requiredPercentage}% threshold.`
                            : `Your attendance is ${attendanceDetails.eligibility.deficit.toFixed(1)}% below the required ${attendanceDetails.eligibility.requiredPercentage}% threshold.`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Attendance Records */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="font-medium text-gray-900">Attendance Records</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Class Session
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {attendanceDetails.records.length > 0 ? (
                          attendanceDetails.records.map((record) => (
                            <tr key={record._id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(record.date).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  {getStatusIcon(record.status)}
                                  <span className={`ml-2 text-sm font-medium capitalize ${record.status === 'present' ? 'text-green-600' :
                                      record.status === 'absent' ? 'text-red-600' : 'text-yellow-600'
                                    }`}>
                                    {record.status}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {record.schedule ? (
                                  <span>
                                    {record.schedule.dayOfWeek}, {record.schedule.time}, Room {record.schedule.room}
                                  </span>
                                ) : (
                                  <span className="text-gray-500">Not specified</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {record.notes || '-'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                              No attendance records found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No attendance data</h3>
                <p className="text-gray-600">
                  {studentAttendance.length > 0
                    ? 'Select a course to view attendance details'
                    : 'No attendance records found for your courses'
                  }
                </p>
              </div>
            )}
          </div>
        )}

        {/* Attendance Reports (Department Head / Registrar) */}
        {activeTab === 'report' && ['departmentHead', 'registrar'].includes(user.role) && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Department Attendance Overview</h3>
              <div>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Freshman">Freshman</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Automotive">Automotive</option>
                  <option value="Construction">Construction</option>
                  <option value="ICT">ICT</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : departmentCourses.length > 0 ? (
              <div className="space-y-4">
                {departmentCourses.map((course) => (
                  <div key={course.courseCode} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-medium text-gray-900">{course.courseCode}</h4>
                        <p className="text-sm text-gray-600">{course.courseName}</p>
                      </div>
                      <button
                        onClick={() => exportAttendanceReport(course._id)}
                        className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 flex items-center space-x-1"
                      >
                        <Download className="h-3 w-3" />
                        <span>Export</span>
                      </button>
                    </div>

                    {course.schedules && course.schedules.length > 0 && (
                      <div className="mb-4 bg-blue-50 p-3 rounded-md">
                        <p className="text-xs font-medium text-blue-700 mb-1">Class Schedule:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {course.schedules.map((schedule: Schedule, index: number) => (
                            <div key={index} className="text-xs text-blue-600">
                              {schedule.dayOfWeek}, {schedule.startTime}-{schedule.endTime}, Room {schedule.roomNumber}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-gray-50 p-3 rounded-md">
                        <div className="text-xs text-gray-500">Class Sessions</div>
                        <div className="text-lg font-medium text-gray-900">{course.classSessions}</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-md">
                        <div className="text-xs text-gray-500">Students</div>
                        <div className="text-lg font-medium text-gray-900">{course.studentCount}</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-md">
                        <div className="text-xs text-gray-500">Avg. Attendance</div>
                        <div className={`text-lg font-medium ${getAttendancePercentageColor(course.attendancePercentage)}`}>
                          {course.attendancePercentage}%
                        </div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-md">
                        <div className="text-xs text-gray-500">At Risk Students</div>
                        <div className="text-lg font-medium text-red-600">{course.atRiskCount}</div>
                      </div>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${course.attendancePercentage >= 90 ? 'bg-green-500' :
                            course.attendancePercentage >= 75 ? 'bg-blue-500' :
                              course.attendancePercentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                        style={{ width: `${Math.min(100, course.attendancePercentage)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No attendance data</h3>
                <p className="text-gray-600">
                  No attendance records found for this department
                </p>
              </div>
            )}
          </div>
        )}

        {/* At-Risk Students (Department Head / Registrar) */}
        {activeTab === 'at-risk' && ['departmentHead', 'registrar'].includes(user.role) && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Students at Risk (Below 75% Attendance)</h3>
              <div>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Freshman">Freshman</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Automotive">Automotive</option>
                  <option value="Construction">Construction</option>
                  <option value="ICT">ICT</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : atRiskStudents.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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
                          Attendance
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Schedule
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {atRiskStudents.map((item, index) => (
                        <tr key={`${item.student._id}-${item.course._id}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{item.student.name}</div>
                            <div className="text-sm text-gray-500">{item.student.studentId}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{item.course.courseCode}</div>
                            <div className="text-sm text-gray-500">{item.course.courseName}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className={`text-sm font-medium ${getAttendancePercentageColor(item.attendance.percentage)}`}>
                                {item.attendance.percentage}%
                              </div>
                              <span className="text-xs text-gray-500 ml-2">
                                ({item.attendance.present}/{item.attendance.totalClasses})
                              </span>
                            </div>
                            <div className="w-24 bg-gray-200 rounded-full h-1.5 mt-1">
                              <div
                                className={`h-1.5 rounded-full ${item.attendance.percentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                style={{ width: `${Math.min(100, item.attendance.percentage)}%` }}
                              ></div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.schedules && item.schedules.length > 0 ? (
                              <div className="space-y-1">
                                {item.schedules.map((schedule: Schedule, idx: number) => (
                                  <div key={idx} className="text-xs">
                                    {schedule.dayOfWeek}, {schedule.startTime}-{schedule.endTime}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span>No schedule</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                              {item.attendance.deficit.toFixed(1)}% below threshold
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No at-risk students</h3>
                <p className="text-gray-600">
                  All students are currently meeting the attendance requirements
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceTracking;