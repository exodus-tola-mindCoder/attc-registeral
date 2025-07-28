import React, { useState, useEffect } from 'react';
import {
  Calendar, Users, Clock, Loader2, Plus, Edit, Trash2,
  Save, X, Search, Filter, Building, BookOpen, CheckCircle,
  AlertTriangle, BarChart3, ChevronDown, ChevronUp
} from 'lucide-react';
import { User, ClassSchedule } from '../types';

interface ClassSchedulingProps {
  user: User;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

interface Course {
  _id: string;
  courseCode: string;
  courseName: string;
  credit: number;
  department: string;
  year: number;
  semester: number;
}

interface Instructor {
  _id: string;
  name: string;
  email: string;
}

interface Room {
  roomNumber: string;
}

interface ScheduleData {
  _id?: string;
  courseId: string;
  instructorId: string;
  academicYear: string;
  semester: number;
  department: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomNumber: string;
  notes?: string;
}

const API_BASE = 'http://localhost:5000/api';

const ClassScheduling: React.FC<ClassSchedulingProps> = ({ user, token, onError, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'view' | 'manage' | 'stats'>('view');
  const [loading, setLoading] = useState(false);

  // Shared data
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);

  // Department Head / Registrar data
  const [departmentSchedules, setDepartmentSchedules] = useState<any>({});
  const [departmentFilter, setDepartmentFilter] = useState<string>(user.department || 'Freshman');
  const [scheduleStats, setScheduleStats] = useState<any>(null);

  // Student data
  const [studentSchedule, setStudentSchedule] = useState<any>({});

  // Instructor data
  const [instructorSchedule, setInstructorSchedule] = useState<any>({});

  // Form data
  const [scheduleForm, setScheduleForm] = useState<ScheduleData>({
    courseId: '',
    instructorId: '',
    academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    semester: new Date().getMonth() < 6 ? 1 : 2,
    department: user.department || 'Freshman',
    dayOfWeek: 'Monday',
    startTime: '08:00',
    endTime: '10:00',
    roomNumber: '',
    notes: ''
  });

  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [conflictDetails, setConflictDetails] = useState<any>(null);

  const departments = ['Freshman', 'Electrical', 'Manufacturing', 'Automotive', 'Construction', 'ICT'];
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    // Set initial active tab based on user role
    if (user.role === 'student') {
      setActiveTab('view');
      fetchStudentSchedule();
    } else if (user.role === 'instructor') {
      setActiveTab('view');
      fetchInstructorSchedule();
    } else if (['departmentHead', 'registrar'].includes(user.role)) {
      setActiveTab('manage');
      fetchDepartmentSchedules();
      fetchCourses();
      fetchInstructors();
    } else {
      setActiveTab('view');
    }
  }, [user.role]);

  // Fetch functions
  const fetchCourses = async () => {
    try {
      const response = await fetch(`${API_BASE}/depthead/courses?department=${departmentFilter}&year=1&semester=1`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setCourses(data.data.courses || []);
      }
    } catch (err) {
      console.error('Failed to fetch courses');
    }
  };

  const fetchInstructors = async () => {
    try {
      // Updated to match backend: always returns all instructors
      const response = await fetch(`${API_BASE}/schedule/available-instructors`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        // Backend now returns data.data.instructors
        setInstructors(
          (data.data.instructors || []).map((inst: any) => ({
            _id: inst._id,
            name: `${inst.firstName} ${inst.fatherName}`,
            email: inst.email
          }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch instructors');
    }
  };

  const fetchAvailableRooms = async () => {
    try {
      const response = await fetch(`${API_BASE}/schedule/available-rooms?dayOfWeek=${scheduleForm.dayOfWeek}&startTime=${scheduleForm.startTime}&endTime=${scheduleForm.endTime}&academicYear=${scheduleForm.academicYear}&semester=${scheduleForm.semester}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        // If no rooms available, allow room selection to be optional
        setAvailableRooms(data.data.availableRooms.map((room: string) => ({ roomNumber: room })) || []);
      }
    } catch {
      // If error, allow room selection to be optional
      setAvailableRooms([]);
    }
  };

  const fetchStudentSchedule = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/schedule/student`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setStudentSchedule(data.data.scheduleByDay || {});
      }
    } catch (err) {
      console.error('Failed to fetch student schedule');
    } finally {
      setLoading(false);
    }
  };

  const fetchInstructorSchedule = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/schedule/instructor`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setInstructorSchedule(data.data.scheduleByDay || {});
      }
    } catch (err) {
      console.error('Failed to fetch instructor schedule');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentSchedules = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/schedule/department?department=${departmentFilter}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setDepartmentSchedules(data.data.scheduleByDay || {});
      }
    } catch (err) {
      console.error('Failed to fetch department schedules');
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduleStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/schedule/stats?department=${departmentFilter}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setScheduleStats(data.data || null);
      }
    } catch (err) {
      console.error('Failed to fetch schedule statistics');
    } finally {
      setLoading(false);
    }
  };

  // Form handlers
  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || token.trim() === '') {
      onError('Session expired or not logged in. Please log in to continue.');
      return;
    }
    setLoading(true);
    setShowConflictWarning(false);

    try {
      // Remove roomNumber if not selected (empty string or falsy)
      const payload = { ...scheduleForm };
      if (!payload.roomNumber || payload.roomNumber === '') {
        delete payload.roomNumber;
      }
      // Remove any other empty string fields that are optional
      Object.keys(payload).forEach(key => {
        if (payload[key] === '') {
          delete payload[key];
        }
      });
      const response = await fetch(`${API_BASE}/schedule/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Class schedule created successfully!');
        setScheduleForm({
          ...scheduleForm,
          courseId: '',
          instructorId: '',
          roomNumber: '',
          notes: ''
        });
        fetchDepartmentSchedules();
      } else {
        if (data.data?.instructorConflicts || data.data?.roomConflicts) {
          setShowConflictWarning(true);
          setConflictDetails(data.data);
        }
        onError(data.message || 'Failed to create schedule');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSchedule = async (scheduleId: string) => {
    setLoading(true);
    setShowConflictWarning(false);

    try {
      // Remove roomNumber if not selected (empty string or falsy)
      const payload = { ...scheduleForm };
      if (!payload.roomNumber || payload.roomNumber === '') {
        delete payload.roomNumber;
      }
      Object.keys(payload).forEach(key => {
        if (payload[key] === '') {
          delete payload[key];
        }
      });
      const response = await fetch(`${API_BASE}/schedule/${scheduleId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess('Class schedule updated successfully!');
        setEditingSchedule(null);
        fetchDepartmentSchedules();
      } else {
        if (data.data?.instructorConflicts || data.data?.roomConflicts) {
          setShowConflictWarning(true);
          setConflictDetails(data.data);
        }
        onError(data.message || 'Failed to update schedule');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/schedule/${scheduleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        onSuccess(data.data?.deactivated
          ? 'Schedule deactivated (attendance records exist)'
          : 'Schedule deleted successfully');
        fetchDepartmentSchedules();
      } else {
        onError(data.message || 'Failed to delete schedule');
      }
    } catch (err) {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Effect to fetch available instructors and rooms when time slot changes
  useEffect(() => {
    if (['departmentHead', 'registrar'].includes(user.role) &&
      scheduleForm.dayOfWeek && scheduleForm.startTime && scheduleForm.endTime) {
      fetchInstructors();
      fetchAvailableRooms();
    }
  }, [scheduleForm.dayOfWeek, scheduleForm.startTime, scheduleForm.endTime]);

  // Effect to fetch department schedules when filter changes
  useEffect(() => {
    if (['departmentHead', 'registrar'].includes(user.role)) {
      fetchDepartmentSchedules();
      fetchCourses();
    }
  }, [departmentFilter]);

  // Effect to fetch stats when tab changes
  useEffect(() => {
    if (activeTab === 'stats' && ['departmentHead', 'registrar'].includes(user.role)) {
      fetchScheduleStats();
    }
  }, [activeTab, departmentFilter]);

  // Helper functions
  const getTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 18; hour++) {
      for (const minute of ['00', '30']) {
        slots.push(`${hour.toString().padStart(2, '0')}:${minute}`);
      }
    }
    return slots;
  };

  const formatTimeRange = (startTime: string, endTime: string) => {
    return `${startTime} - ${endTime}`;
  };

  const getScheduleColor = (dayOfWeek: string) => {
    switch (dayOfWeek) {
      case 'Monday': return 'bg-blue-100 border-blue-200 text-blue-800';
      case 'Tuesday': return 'bg-green-100 border-green-200 text-green-800';
      case 'Wednesday': return 'bg-purple-100 border-purple-200 text-purple-800';
      case 'Thursday': return 'bg-yellow-100 border-yellow-200 text-yellow-800';
      case 'Friday': return 'bg-red-100 border-red-200 text-red-800';
      case 'Saturday': return 'bg-indigo-100 border-indigo-200 text-indigo-800';
      case 'Sunday': return 'bg-gray-100 border-gray-200 text-gray-800';
      default: return 'bg-gray-100 border-gray-200 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Class Scheduling Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Calendar className="h-6 w-6 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-900">Class Scheduling</h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6 overflow-x-auto">
          {user.role === 'student' && (
            <button
              onClick={() => setActiveTab('view')}
              className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'view'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <Calendar className="h-4 w-4 inline mr-2" />
              My Timetable
            </button>
          )}

          {user.role === 'instructor' && (
            <button
              onClick={() => setActiveTab('view')}
              className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'view'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <Calendar className="h-4 w-4 inline mr-2" />
              My Teaching Schedule
            </button>
          )}

          {['departmentHead', 'registrar'].includes(user.role) && (
            <>
              <button
                onClick={() => setActiveTab('create')}
                className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'create'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                <Plus className="h-4 w-4 inline mr-2" />
                Create Schedule
              </button>
              <button
                onClick={() => setActiveTab('manage')}
                className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'manage'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                <Edit className="h-4 w-4 inline mr-2" />
                Manage Schedules
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`flex-shrink-0 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${activeTab === 'stats'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                <BarChart3 className="h-4 w-4 inline mr-2" />
                Statistics
              </button>
            </>
          )}
        </div>

        {/* Student Timetable View */}
        {activeTab === 'view' && user.role === 'student' && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">My Weekly Timetable</h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            ) : Object.values(studentSchedule).some(day => (day as any[]).length > 0) ? (
              <div className="space-y-4">
                {daysOfWeek.map(day => (
                  <div key={day} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className={`px-4 py-3 ${getScheduleColor(day)}`}>
                      <h4 className="font-medium">{day}</h4>
                    </div>

                    {studentSchedule[day]?.length > 0 ? (
                      <div className="divide-y divide-gray-200">
                        {studentSchedule[day].map((slot: any) => (
                          <div key={slot._id} className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-gray-900">{slot.courseCode}</div>
                                <div className="text-sm text-gray-600">{slot.courseName}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium text-gray-900">{formatTimeRange(slot.startTime, slot.endTime)}</div>
                                <div className="text-sm text-gray-600">Room {slot.roomNumber}</div>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-purple-700">
                              <span className="font-medium">Instructor:</span> {
                                slot.instructor
                                  ? (typeof slot.instructor === 'object' && slot.instructor.name
                                    ? slot.instructor.name
                                    : typeof slot.instructor === 'string'
                                      ? slot.instructor
                                      : 'N/A')
                                  : 'N/A'
                              }
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        No classes scheduled
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No classes scheduled</h3>
                <p className="text-gray-600">
                  You don't have any classes scheduled for this semester.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Instructor Teaching Schedule */}
        {activeTab === 'view' && user.role === 'instructor' && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">My Teaching Schedule</h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            ) : Object.values(instructorSchedule).some(day => (day as any[]).length > 0) ? (
              <div className="space-y-4">
                {daysOfWeek.map(day => (
                  <div key={day} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className={`px-4 py-3 ${getScheduleColor(day)}`}>
                      <h4 className="font-medium">{day}</h4>
                    </div>

                    {instructorSchedule[day]?.length > 0 ? (
                      <div className="divide-y divide-gray-200">
                        {instructorSchedule[day].map((slot: any) => (
                          <div key={slot._id} className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-gray-900">{slot.courseCode}</div>
                                <div className="text-sm text-gray-600">{slot.courseName}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium text-gray-900">{formatTimeRange(slot.startTime, slot.endTime)}</div>
                                <div className="text-sm text-gray-600">Room {slot.roomNumber}</div>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                              <span className="font-medium">Department:</span> {slot.department}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        No classes scheduled
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No classes assigned</h3>
                <p className="text-gray-600">
                  You don't have any teaching assignments for this semester.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Create Schedule Form */}
        {activeTab === 'create' && ['departmentHead', 'registrar'].includes(user.role) && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Create New Class Schedule</h3>

            {showConflictWarning && conflictDetails && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-red-600 mr-3 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-800">Scheduling Conflict Detected</h4>
                    <p className="text-sm text-red-700 mt-1">
                      {conflictDetails.instructorConflicts && 'The selected instructor is already scheduled during this time slot.'}
                      {conflictDetails.roomConflicts && 'The selected room is already booked during this time slot.'}
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      Please select a different time slot, instructor, or room.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateSchedule} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department
                  </label>
                  <select
                    value={scheduleForm.department}
                    onChange={(e) => {
                      setScheduleForm({ ...scheduleForm, department: e.target.value });
                      setDepartmentFilter(e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={scheduleForm.academicYear}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, academicYear: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="YYYY-YYYY"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Semester
                  </label>
                  <select
                    value={scheduleForm.semester}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, semester: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Course
                </label>
                <select
                  value={scheduleForm.courseId}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, courseId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select a course</option>
                  {courses.map(course => (
                    <option key={course._id} value={course._id}>
                      {course.courseCode} - {course.courseName} ({course.credit} credits)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Day of Week
                  </label>
                  <select
                    value={scheduleForm.dayOfWeek}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, dayOfWeek: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {daysOfWeek.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time
                  </label>
                  <select
                    value={scheduleForm.startTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {getTimeSlots().map(time => (
                      <option key={`start-${time}`} value={time}>{time}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Time
                  </label>
                  <select
                    value={scheduleForm.endTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {getTimeSlots().filter(time => time > scheduleForm.startTime).map(time => (
                      <option key={`end-${time}`} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Instructor
                  </label>
                  <select
                    value={scheduleForm.instructorId}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, instructorId: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select an instructor</option>
                    {instructors.map(instructor => (
                      <option key={instructor._id} value={instructor._id}>
                        {instructor.name}
                      </option>
                    ))}
                  </select>
                  {instructors.length === 0 && (
                    <p className="text-xs text-yellow-600 mt-1">
                      No instructors available for this time slot. Try a different time.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Room (Optional)
                  </label>
                  <select
                    value={scheduleForm.roomNumber}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, roomNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">No room selected</option>
                    {availableRooms.map(room => (
                      <option key={room.roomNumber} value={room.roomNumber}>
                        Room {room.roomNumber}
                      </option>
                    ))}
                  </select>
                  {availableRooms.length === 0 && (
                    <p className="text-xs text-yellow-600 mt-1">
                      No rooms available for this time slot. Try a different time.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                  placeholder="Add any additional notes about this class schedule..."
                />
              </div>

              <button
                type="submit"
                disabled={loading || !scheduleForm.courseId || !scheduleForm.instructorId}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4" />
                )}
                <span>{loading ? 'Creating...' : 'Create Schedule'}</span>
              </button>
            </form>
          </div>
        )}

        {/* Manage Schedules */}
        {activeTab === 'manage' && ['departmentHead', 'registrar'].includes(user.role) && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Manage Department Schedules</h3>
              <div>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            ) : Object.values(departmentSchedules).some(day => (day as any[]).length > 0) ? (
              <div className="space-y-4">
                {daysOfWeek.map(day => (
                  <div key={day} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className={`px-4 py-3 ${getScheduleColor(day)}`}>
                      <h4 className="font-medium">{day}</h4>
                    </div>

                    {departmentSchedules[day]?.length > 0 ? (
                      <div className="divide-y divide-gray-200">
                        {departmentSchedules[day].map((slot: any) => (
                          <div key={slot._id} className="p-4">
                            {editingSchedule === slot._id ? (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Start Time
                                    </label>
                                    <select
                                      value={scheduleForm.startTime}
                                      onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                                    >
                                      {getTimeSlots().map(time => (
                                        <option key={`edit-start-${time}`} value={time}>{time}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      End Time
                                    </label>
                                    <select
                                      value={scheduleForm.endTime}
                                      onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                                    >
                                      {getTimeSlots().filter(time => time > scheduleForm.startTime).map(time => (
                                        <option key={`edit-end-${time}`} value={time}>{time}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Room
                                    </label>
                                    <select
                                      value={scheduleForm.roomNumber}
                                      onChange={(e) => setScheduleForm({ ...scheduleForm, roomNumber: e.target.value })}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                                    >
                                      <option value={scheduleForm.roomNumber}>Room {scheduleForm.roomNumber}</option>
                                      {availableRooms.map(room => (
                                        <option key={`edit-room-${room.roomNumber}`} value={room.roomNumber}>
                                          Room {room.roomNumber}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleUpdateSchedule(slot._id)}
                                    disabled={loading}
                                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-400 flex items-center space-x-1"
                                  >
                                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                    <span>Save</span>
                                  </button>
                                  <button
                                    onClick={() => setEditingSchedule(null)}
                                    className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 flex items-center space-x-1"
                                  >
                                    <X className="h-3 w-3" />
                                    <span>Cancel</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium text-gray-900">{slot.courseCode}</div>
                                  <div className="text-sm text-gray-600">{slot.courseName}</div>
                                  <div className="mt-1 text-xs text-gray-500">
                                    <span className="font-medium">Instructor:</span> {
                                      slot.instructor && slot.instructor.name
                                        ? slot.instructor.name
                                        : 'N/A'
                                    }
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium text-gray-900">{formatTimeRange(slot.startTime, slot.endTime)}</div>
                                  <div className="text-sm text-gray-600">Room {slot.roomNumber}</div>
                                  <div className="mt-1 flex space-x-2">
                                    <button
                                      onClick={() => {
                                        setEditingSchedule(slot._id);
                                        setScheduleForm({
                                          ...scheduleForm,
                                          courseId: slot.courseCode, // This is just for display
                                          instructorId: slot.instructor._id,
                                          dayOfWeek: day,
                                          startTime: slot.startTime,
                                          endTime: slot.endTime,
                                          roomNumber: slot.roomNumber
                                        });
                                      }}
                                      className="text-blue-600 hover:text-blue-800"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSchedule(slot._id)}
                                      className="text-red-600 hover:text-red-800"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        No classes scheduled on {day}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No schedules found</h3>
                <p className="text-gray-600">
                  No class schedules have been created for {departmentFilter} department yet.
                </p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 inline-flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Schedule</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Statistics */}
        {activeTab === 'stats' && ['departmentHead', 'registrar'].includes(user.role) && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Schedule Statistics</h3>
              <div>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            ) : scheduleStats ? (
              <div className="space-y-6">
                {/* Department Stats */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 mb-4">Department Overview</h4>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    {scheduleStats.departmentStats.map((dept: any) => (
                      <div key={dept.department} className="bg-purple-50 p-4 rounded-lg">
                        <div className="text-sm font-medium text-purple-700">{dept.department}</div>
                        <div className="text-2xl font-bold text-purple-900">{dept.totalClasses}</div>
                        <div className="text-xs text-purple-600 mt-1">
                          {dept.uniqueCourses} courses, {dept.uniqueInstructors} instructors
                        </div>
                      </div>
                    ))}
                  </div>

                  <h5 className="font-medium text-gray-800 mb-2">Classes by Day</h5>
                  <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                    {scheduleStats.departmentStats.flatMap((dept: any) =>
                      dept.dayStats.map((day: any) => (
                        <div key={`${dept.department}-${day.day}`} className={`p-3 rounded-lg ${getScheduleColor(day.day)}`}>
                          <div className="text-xs font-medium">{day.day}</div>
                          <div className="text-lg font-bold">{day.count}</div>
                          <div className="text-xs mt-1">
                            {day.courseCount} courses
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Room Utilization */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 mb-4">Room Utilization</h4>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {scheduleStats.roomUtilization.slice(0, 8).map((room: any) => (
                      <div key={room._id} className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-sm font-medium text-blue-700">Room {room._id}</div>
                        <div className="text-2xl font-bold text-blue-900">{room.count}</div>
                        <div className="text-xs text-blue-600 mt-1">
                          {room.days.length} days per week
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Instructor Load */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 mb-4">Instructor Teaching Load</h4>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Instructor
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Department
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Classes
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Courses
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Days
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {scheduleStats.instructorLoad.map((instructor: any) => (
                          <tr key={instructor._id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {instructor.instructorName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {instructor.department || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {instructor.count}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {instructor.courses.length}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {instructor.days.join(', ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No statistics available</h3>
                <p className="text-gray-600">
                  No class schedules have been created yet.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassScheduling;