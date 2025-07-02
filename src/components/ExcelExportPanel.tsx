import React, { useState } from 'react';
import { Download, FileSpreadsheet, Users, AlertTriangle, BarChart3, Loader2 } from 'lucide-react';
import { User } from '../types';

interface ExcelExportPanelProps {
  user: User;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

const API_BASE = 'http://localhost:5000/api';

const ExcelExportPanel: React.FC<ExcelExportPanelProps> = ({ user, token, onError, onSuccess }) => {
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [filters, setFilters] = useState({
    academicYear: '',
    semester: '',
    department: ''
  });

  const departments = ['Freshman', 'Electrical', 'Manufacturing', 'Automotive', 'Construction', 'ICT'];
  const currentYear = new Date().getFullYear();
  const academicYears = [
    `${currentYear}-${currentYear + 1}`,
    `${currentYear - 1}-${currentYear}`,
    `${currentYear - 2}-${currentYear - 1}`
  ];

  const handleExport = async (endpoint: string, filename: string, type: string, includeFilters = true) => {
    setLoading(prev => ({ ...prev, [type]: true }));

    try {
      let url = `${API_BASE}${endpoint}`;

      if (includeFilters) {
        const params = new URLSearchParams();
        if (filters.academicYear) params.append('academicYear', filters.academicYear);
        if (filters.semester) params.append('semester', filters.semester);
        if (filters.department) params.append('department', filters.department);

        if (params.toString()) {
          url += `?${params.toString()}`;
        }
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Export failed');
      }

      // Create blob and download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      onSuccess(`${type} exported successfully!`);

    } catch (error) {
      onError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const exportGrades = () => {
    const filename = `grades_${filters.academicYear || 'all'}_${filters.semester || 'all'}_${filters.department || 'all'}.xlsx`;
    handleExport('/excel/registrar/export-grades', filename, 'grades');
  };

  const exportProbationList = () => {
    const filename = `probation_list_${filters.academicYear || new Date().getFullYear()}.xlsx`;
    handleExport('/excel/registrar/export-probation', filename, 'probation', false);
  };

  const exportDismissedList = () => {
    const filename = `dismissed_students_${filters.academicYear || new Date().getFullYear()}.xlsx`;
    handleExport('/excel/registrar/export-dismissed', filename, 'dismissed', false);
  };

  const exportEvaluations = () => {
    const filename = `evaluations_${filters.academicYear || 'all'}_${filters.department || 'all'}.xlsx`;
    handleExport('/excel/registrar/export-evaluations', filename, 'evaluations');
  };

  const exportAcademicReport = () => {
    const filename = `academic_report_${filters.academicYear || new Date().getFullYear()}.xlsx`;
    handleExport('/excel/registrar/export-academic-report', filename, 'academic-report', false);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-3 mb-6">
        <FileSpreadsheet className="h-6 w-6 text-green-600" />
        <h2 className="text-xl font-semibold text-gray-900">Excel Export Tools</h2>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Export Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
            <select
              value={filters.academicYear}
              onChange={(e) => setFilters(prev => ({ ...prev, academicYear: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Years</option>
              {academicYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
            <select
              value={filters.semester}
              onChange={(e) => setFilters(prev => ({ ...prev, semester: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Semesters</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
            <select
              value={filters.department}
              onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="space-y-4">
        {/* Final Grades Export */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-medium text-gray-900">Final Grades Report</h3>
                <p className="text-sm text-gray-600">
                  Export all finalized grades with detailed breakdown and statistics
                </p>
              </div>
            </div>
            <button
              onClick={exportGrades}
              disabled={loading['grades']}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
            >
              {loading['grades'] ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{loading['grades'] ? 'Exporting...' : 'Export Grades'}</span>
            </button>
          </div>
        </div>

        {/* Probation List Export */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <h3 className="font-medium text-gray-900">Probation List</h3>
                <p className="text-sm text-gray-600">
                  Export list of students on academic probation (CGPA &lt; 2.0)
                </p>
              </div>
            </div>
            <button
              onClick={exportProbationList}
              disabled={loading['probation']}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
            >
              {loading['probation'] ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{loading['probation'] ? 'Exporting...' : 'Export Probation'}</span>
            </button>
          </div>
        </div>

        {/* Dismissed Students Export */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <h3 className="font-medium text-gray-900">Dismissed Students</h3>
                <p className="text-sm text-gray-600">
                  Export list of academically dismissed students (CGPA &lt; 1.0)
                </p>
              </div>
            </div>
            <button
              onClick={exportDismissedList}
              disabled={loading['dismissed']}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
            >
              {loading['dismissed'] ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{loading['dismissed'] ? 'Exporting...' : 'Export Dismissed'}</span>
            </button>
          </div>
        </div>

        {/* Evaluation Reports Export */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Users className="h-5 w-5 text-purple-600" />
              <div>
                <h3 className="font-medium text-gray-900">Evaluation Reports</h3>
                <p className="text-sm text-gray-600">
                  Export instructor evaluation data with detailed analytics
                </p>
              </div>
            </div>
            <button
              onClick={exportEvaluations}
              disabled={loading['evaluations']}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
            >
              {loading['evaluations'] ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{loading['evaluations'] ? 'Exporting...' : 'Export Evaluations'}</span>
            </button>
          </div>
        </div>

        {/* Comprehensive Academic Report */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              <div>
                <h3 className="font-medium text-gray-900">Comprehensive Academic Report</h3>
                <p className="text-sm text-gray-600">
                  Export complete academic overview with all student data and statistics
                </p>
              </div>
            </div>
            <button
              onClick={exportAcademicReport}
              disabled={loading['academic-report']}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
            >
              {loading['academic-report'] ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{loading['academic-report'] ? 'Exporting...' : 'Export Report'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-green-50 border border-green-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-green-900 mb-2">Export Information:</h4>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• All exports include comprehensive data with proper formatting</li>
          <li>• Files are generated with timestamps and filter information</li>
          <li>• Excel files include multiple sheets with summaries and details</li>
          <li>• Color coding and conditional formatting applied for easy analysis</li>
          <li>• All sensitive data is properly anonymized where required</li>
        </ul>
      </div>
    </div>
  );
};

export default ExcelExportPanel;