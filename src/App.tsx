import React, { useState, useEffect } from 'react';
import { User, Shield, GraduationCap, LogIn, UserPlus, Eye, EyeOff, AlertCircle, CheckCircle, Loader2, Clock, Upload, FileText, X, Database, Download, Users, BookOpen, FileCheck, Calendar, GraduationCapIcon, MapPin, TrendingUp, Star, Settings, ClipboardCheck, Bell, CreditCard, Award, Building } from 'lucide-react';
import LoginForm from './components/LoginForm';
import SignupForm from './components/SignupForm';
import UserProfile from './components/UserProfile';
import RBACTesting from './components/RBACTesting';
import AdminPanel from './components/AdminPanel';
import StudentDashboard from './components/StudentDashboard';
import CourseManagement from './components/CourseManagement';
import GradeManagement from './components/GradeManagement';
import StudentGrades from './components/StudentGrades';
import PlacementManagement from './components/PlacementManagement';
import InstructorEvaluation from './components/InstructorEvaluation';
import PDFExportPanel from './components/PDFExportPanel';
import ExcelExportPanel from './components/ExcelExportPanel';
import ITAdminDashboard from './components/ITAdminDashboard';
import AttendanceTracking from './components/AttendanceTracking';
import ClassScheduling from './components/ClassScheduling';
import NotificationBell from './components/NotificationBell';
import NotificationsPage from './components/NotificationsPage';
import AdminNotifications from './components/AdminNotifications';
import GraduationStatus from './components/GraduationStatus';
import GraduationCommittee from './components/GraduationCommittee';
import ClearanceManagement from './components/ClearanceManagement';
import StudentIDCard from './components/StudentIDCard';
import IDCardManagement from './components/IDCardManagement';
import RegistrationPeriodManagement from './components/RegistrationPeriodManagement';
import { User as UserType, AuthResponse, ImportResult } from './types';

const API_BASE = 'http://localhost:5000/api';

function App() {
  const [user, setUser] = useState<UserType | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'admin'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [signupPeriodOpen, setSignupPeriodOpen] = useState(false);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }

    // Check if signup period is open
    checkSignupPeriod();
  }, []);

  const checkSignupPeriod = async () => {
    try {
      const response = await fetch(`${API_BASE}/registration-period/check?type=signup`);
      const data = await response.json();

      if (data.success) {
        setSignupPeriodOpen(data.data.isOpen);
      }
    } catch (err) {
      console.error('Failed to check signup period');
    }
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setSuccess('Logged out successfully');
  };

  const showError = (message: string) => {
    setError(message);
    setTimeout(() => setError(''), 5000);
  };

  const showSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(''), 5000);
  };

  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className=" p-4 rounded-full">
                  <img
                  src="/menschenLogo.png"
                  alt="ATTC College Logo"
                  className="h-14 w-14 object-contain rounded-full bg-white"
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">ATTC College Management System</h1>
                  <p className="text-gray-600">Welcome, {user.firstName} {user.fatherName}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <NotificationBell
                  user={user}
                  token={token!}
                  onError={showError}
                />
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>

          {/* Role-based Dashboard Tabs */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
            <div className="flex border-b overflow-x-auto">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'profile'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <User className="h-4 w-4 inline mr-2" />
                Profile
              </button>

              <button
                onClick={() => setActiveTab('notifications')}
                className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'notifications'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <Bell className="h-4 w-4 inline mr-2" />
                Notifications
              </button>

              {user.role === 'student' && (
                <>
                  <button
                    onClick={() => setActiveTab('registration')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'registration'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <BookOpen className="h-4 w-4 inline mr-2" />
                    Registration
                  </button>
                  <button
                    onClick={() => setActiveTab('grades')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'grades'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <TrendingUp className="h-4 w-4 inline mr-2" />
                    Grades
                  </button>
                  <button
                    onClick={() => setActiveTab('placement')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'placement'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <MapPin className="h-4 w-4 inline mr-2" />
                    Placement
                  </button>
                  <button
                    onClick={() => setActiveTab('evaluation')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'evaluation'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <Star className="h-4 w-4 inline mr-2" />
                    Evaluations
                  </button>
                  <button
                    onClick={() => setActiveTab('attendance')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'attendance'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <ClipboardCheck className="h-4 w-4 inline mr-2" />
                    Attendance
                  </button>
                  <button
                    onClick={() => setActiveTab('schedule')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'schedule'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <Calendar className="h-4 w-4 inline mr-2" />
                    Timetable
                  </button>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'documents'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <FileText className="h-4 w-4 inline mr-2" />
                    Documents
                  </button>
                  <button
                    onClick={() => setActiveTab('graduation')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'graduation'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <Award className="h-4 w-4 inline mr-2" />
                    Graduation
                  </button>
                  <button
                    onClick={() => setActiveTab('id-card')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'id-card'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <CreditCard className="h-4 w-4 inline mr-2" />
                    ID Card
                  </button>
                </>
              )}

              {user.role === 'instructor' && (
                <>
                  <button
                    onClick={() => setActiveTab('grades')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'grades'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <GraduationCapIcon className="h-4 w-4 inline mr-2" />
                    Grade Management
                  </button>
                  <button
                    onClick={() => setActiveTab('attendance')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'attendance'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <ClipboardCheck className="h-4 w-4 inline mr-2" />
                    Attendance
                  </button>
                  <button
                    onClick={() => setActiveTab('schedule')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'schedule'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <Calendar className="h-4 w-4 inline mr-2" />
                    Teaching Schedule
                  </button>
                  <button
                    onClick={() => setActiveTab('evaluation')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'evaluation'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <Star className="h-4 w-4 inline mr-2" />
                    My Evaluations
                  </button>
                </>
              )}

              {user.role === 'departmentHead' && (
                <>
                  <button
                    onClick={() => setActiveTab('courses')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'courses'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <BookOpen className="h-4 w-4 inline mr-2" />
                    Courses
                  </button>
                  <button
                    onClick={() => setActiveTab('schedule')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'schedule'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <Calendar className="h-4 w-4 inline mr-2" />
                    Class Scheduling
                  </button>
                  <button
                    onClick={() => setActiveTab('grades')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'grades'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <GraduationCapIcon className="h-4 w-4 inline mr-2" />
                    Grades
                  </button>
                  <button
                    onClick={() => setActiveTab('attendance')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'attendance'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <ClipboardCheck className="h-4 w-4 inline mr-2" />
                    Attendance
                  </button>
                  <button
                    onClick={() => setActiveTab('placement')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'placement'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <MapPin className="h-4 w-4 inline mr-2" />
                    Placement
                  </button>
                  <button
                    onClick={() => setActiveTab('evaluation')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'evaluation'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <Star className="h-4 w-4 inline mr-2" />
                    Evaluations
                  </button>
                  <button
                    onClick={() => setActiveTab('admin-notifications')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'admin-notifications'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <Bell className="h-4 w-4 inline mr-2" />
                    Send Notifications
                  </button>
                </>
              )}

              {['registrar', 'placementCommittee'].includes(user.role) && (
                <>
                  <button
                    onClick={() => setActiveTab('schedule')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'schedule'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <Calendar className="h-4 w-4 inline mr-2" />
                    Class Scheduling
                  </button>
                  <button
                    onClick={() => setActiveTab('placement')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'placement'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <MapPin className="h-4 w-4 inline mr-2" />
                    Placement
                  </button>
                  <button
                    onClick={() => setActiveTab('attendance')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'attendance'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <ClipboardCheck className="h-4 w-4 inline mr-2" />
                    Attendance
                  </button>
                  <button
                    onClick={() => setActiveTab('evaluation')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'evaluation'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <Star className="h-4 w-4 inline mr-2" />
                    Evaluations
                  </button>
                  {user.role === 'registrar' && (
                    <>
                      <button
                        onClick={() => setActiveTab('exports')}
                        className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'exports'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        <Download className="h-4 w-4 inline mr-2" />
                        Export Tools
                      </button>
                      <button
                        onClick={() => setActiveTab('clearance')}
                        className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'clearance'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        <Building className="h-4 w-4 inline mr-2" />
                        Clearance
                      </button>
                      <button
                        onClick={() => setActiveTab('id-management')}
                        className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'id-management'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        <CreditCard className="h-4 w-4 inline mr-2" />
                        ID Management
                      </button>
                      <button
                        onClick={() => setActiveTab('admin-notifications')}
                        className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'admin-notifications'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        <Bell className="h-4 w-4 inline mr-2" />
                        Send Notifications
                      </button>
                      <button
                        onClick={() => setActiveTab('registration-periods')}
                        className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'registration-periods'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        <Clock className="h-4 w-4 inline mr-2" />
                        Reg. Periods
                      </button>
                    </>
                  )}
                </>
              )}

              {user.role === 'graduationCommittee' && (
                <>
                  <button
                    onClick={() => setActiveTab('graduation-committee')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'graduation-committee'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <Award className="h-4 w-4 inline mr-2" />
                    Graduation Committee
                  </button>
                </>
              )}

              {user.role === 'president' && (
                <>
                  <button
                    onClick={() => setActiveTab('evaluation')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'evaluation'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <Star className="h-4 w-4 inline mr-2" />
                    Evaluation Reports
                  </button>
                  <button
                    onClick={() => setActiveTab('attendance')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'attendance'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <ClipboardCheck className="h-4 w-4 inline mr-2" />
                    Attendance Reports
                  </button>
                  <button
                    onClick={() => setActiveTab('schedule')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'schedule'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <Calendar className="h-4 w-4 inline mr-2" />
                    Class Schedules
                  </button>
                  <button
                    onClick={() => setActiveTab('admin-notifications')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'admin-notifications'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <Bell className="h-4 w-4 inline mr-2" />
                    Send Notifications
                  </button>
                </>
              )}

              {user.role === 'itAdmin' && (
                <>
                  <button
                    onClick={() => setActiveTab('itadmin')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'itadmin'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <Settings className="h-4 w-4 inline mr-2" />
                    IT Administration
                  </button>
                  <button
                    onClick={() => setActiveTab('admin')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'admin'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <Database className="h-4 w-4 inline mr-2" />
                    Data Import
                  </button>
                  <button
                    onClick={() => setActiveTab('exports')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'exports'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <Download className="h-4 w-4 inline mr-2" />
                    Export Tools
                  </button>
                  <button
                    onClick={() => setActiveTab('id-management')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'id-management'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <CreditCard className="h-4 w-4 inline mr-2" />
                    ID Management
                  </button>
                  <button
                    onClick={() => setActiveTab('admin-notifications')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'admin-notifications'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <Bell className="h-4 w-4 inline mr-2" />
                    Send Notifications
                  </button>
                  <button
                    onClick={() => setActiveTab('registration-periods')}
                    className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'registration-periods'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <Clock className="h-4 w-4 inline mr-2" />
                    Reg. Periods
                  </button>
                </>
              )}

              <button
                onClick={() => setActiveTab('testing')}
                className={`flex-shrink-0 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'testing'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <Shield className="h-4 w-4 inline mr-2" />
                RBAC Testing
              </button>
            </div>

            <div className="p-6">
              {/* Error/Success Messages */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center">
                    <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                    <span className="text-red-800 text-sm">{error}</span>
                  </div>
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                    <span className="text-green-800 text-sm">{success}</span>
                  </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <UserProfile user={user} />
              )}

              {activeTab === 'notifications' && (
                <NotificationsPage
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'admin-notifications' && (
                <AdminNotifications
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'registration' && user.role === 'student' && (
                <StudentDashboard
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'grades' && user.role === 'student' && (
                <StudentGrades
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'grades' && ['instructor', 'departmentHead'].includes(user.role) && (
                <GradeManagement
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'placement' && (
                <PlacementManagement
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'evaluation' && (
                <InstructorEvaluation
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'attendance' && (
                <AttendanceTracking
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'schedule' && (
                <ClassScheduling
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'documents' && user.role === 'student' && (
                <PDFExportPanel
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'exports' && ['registrar', 'itAdmin'].includes(user.role) && (
                <ExcelExportPanel
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'courses' && user.role === 'departmentHead' && (
                <CourseManagement
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'itadmin' && user.role === 'itAdmin' && (
                <ITAdminDashboard
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'admin' && user.role === 'itAdmin' && (
                <AdminPanel
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'graduation' && user.role === 'student' && (
                <GraduationStatus
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'graduation-committee' && user.role === 'graduationCommittee' && (
                <GraduationCommittee
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'clearance' && user.role === 'registrar' && (
                <ClearanceManagement
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'id-card' && user.role === 'student' && (
                <StudentIDCard
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'id-management' && ['itAdmin', 'registrar'].includes(user.role) && (
                <IDCardManagement
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'registration-periods' && ['itAdmin', 'registrar'].includes(user.role) && (
                <RegistrationPeriodManagement
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}

              {activeTab === 'testing' && (
                <RBACTesting
                  user={user}
                  token={token!}
                  onError={showError}
                  onSuccess={showSuccess}
                />
              )}
            </div>
          </div>

          {/* Success Message */}
          {success && (
            <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-md shadow-lg z-50">
              {success}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="fixed bottom-4 right-4 bg-red-600 text-white px-6 py-3 rounded-md shadow-lg z-50">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
            <div className="w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-4">
            <img
              src="/menschenLogo.png"
              alt="ATTC College Logo"
              className="h-20 w-20 object-contain rounded-full"
            />
            </div>
          <h1 className="text-3xl font-bold text-gray-900">ATTC College</h1>
          <p className="text-gray-600 mt-2">Academic and Registrar Management System</p>
        </div>

        {/* Auth Form */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'login'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              <LogIn className="h-4 w-4 inline mr-2" />
              Login
            </button>
            {signupPeriodOpen && (
              <button
                onClick={() => setActiveTab('signup')}
                className={`flex-1 py-3 px-4 text-center font-medium transition-colors duration-200 ${activeTab === 'signup'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <UserPlus className="h-4 w-4 inline mr-2" />
                Freshman Registration
              </button>
            )}
          </div>

          <div className="p-6">
            {/* Error/Success Messages */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center">
                  <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                  <span className="text-red-800 text-sm">{error}</span>
                </div>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                  <span className="text-green-800 text-sm">{success}</span>
                </div>
              </div>
            )}

            {/* Login Form */}
            {activeTab === 'login' && (
              <LoginForm
                onLogin={(userData, userToken) => {
                  setUser(userData);
                  setToken(userToken);
                  localStorage.setItem('token', userToken);
                  localStorage.setItem('user', JSON.stringify(userData));
                  showSuccess('Login successful!');
                }}
                onError={showError}
                loading={loading}
                setLoading={setLoading}
              />
            )}

            {/* Signup Form */}
            {activeTab === 'signup' && signupPeriodOpen && (
              <SignupForm
                onSuccess={() => {
                  showSuccess('Registration successful! Please login with your institutional email.');
                  setActiveTab('login');
                }}
                onError={showError}
                loading={loading}
                setLoading={setLoading}
              />
            )}

            {/* Signup Closed Message */}
            {activeTab === 'signup' && !signupPeriodOpen && (
              <div className="py-8 text-center">
                <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Registration is Closed</h3>
                <p className="text-gray-600 mb-4">
                  Freshman registration is currently closed. Please contact the registrar's office for assistance.
                </p>
                <button
                  onClick={() => setActiveTab('login')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
                >
                  Back to Login
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Information Panel */}
        {/* <div className="mt-6 bg-white rounded-lg shadow-md p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">System Information</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <p><strong>Freshman Registration:</strong> Self-registration with institutional email generation</p>
            <p><strong>Senior Students:</strong> Imported by IT Admin from Excel files</p>
            <p><strong>Staff Access:</strong> Role-based permissions (Student, Instructor, Department Head, Registrar, IT Admin, President)</p>
            <p><strong>Email Format:</strong> firstInitial + fatherInitial + @attc.edu.et (e.g., jD@attc.edu.et)</p>
            <p><strong>NEW:</strong> Digital Student ID Cards with QR Verification, Graduation Management, Clearance System</p>
          </div>
        </div> */}
      </div>
    </div>
  );
}

export default App;