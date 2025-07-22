import React, { useState, useRef } from 'react';
import axios from 'axios';

interface Grade {
  studentId: string;
  studentName: string;
  courseCode: string;
  courseName: string;
  midtermMark: number;
  continuousMark: number;
  finalExamMark: number;
  totalMark: number;
}

interface UploadResponse {
  success: boolean;
  message: string;
  data: {
    totalProcessed: number;
    successCount: number;
    updateCount: number;
    createCount: number;
    grades: Grade[];
    errors: string[];
  };
  summary: {
    totalRows: number;
    validRows: number;
    successRate: number;
  };
}

interface GradeUploadFormProps {
  courseId: string;
  courseCode?: string;
  courseName?: string;
  academicYear?: string;
  semester?: number;
}

const GradeUploadForm: React.FC<GradeUploadFormProps> = ({ 
  courseId, 
  courseCode, 
  courseName, 
  academicYear = new Date().getFullYear().toString(),
  semester = 1 
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      const validExtensions = ['.xlsx', '.xls'];
      
      const isValidType = validTypes.includes(selectedFile.type) || 
                         validExtensions.some(ext => selectedFile.name.toLowerCase().endsWith(ext));
      
      if (!isValidType) {
        alert('Please select a valid Excel file (.xlsx or .xls)');
        return;
      }

      // Validate file size (5MB limit)
      if (selectedFile.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }

      setFile(selectedFile);
      setUploadResponse(null);
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloadLoading(true);
    try {
      const response = await axios.get(`/api/grades/template/${courseId}`, {
        params: { academicYear, semester },
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `grades_template_${courseCode || 'course'}_${academicYear}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Download error:', error);
      alert('Failed to download template. Please try again.');
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setUploadProgress(0);
    setUploadResponse(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('courseId', courseId);
    formData.append('academicYear', academicYear);
    formData.append('semester', semester.toString());

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await axios.post<UploadResponse>('/api/grades/upload', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 90) / progressEvent.total);
            setUploadProgress(progress);
          }
        }
      });

      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadResponse(response.data);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setFile(null);

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setUploadResponse(null);
      }, 5000);

    } catch (error: any) {
      console.error('Upload error:', error);
      const errorMessage = error.response?.data?.message || 'Upload failed. Please try again.';
      setUploadResponse({
        success: false,
        message: errorMessage,
        data: { totalProcessed: 0, successCount: 0, updateCount: 0, createCount: 0, grades: [], errors: [errorMessage] },
        summary: { totalRows: 0, validRows: 0, successRate: 0 }
      });
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleReset = () => {
    setFile(null);
    setUploadResponse(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Excel Grade Upload</h2>
        <p className="text-gray-600">
          Upload grades for {courseCode} - {courseName} ({academicYear}, Semester {semester})
        </p>
      </div>

      {/* Download Template Section */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">Step 1: Download Template</h3>
        <p className="text-blue-700 mb-3">
          Download the Excel template with pre-filled student information for this course.
        </p>
        <button
          onClick={handleDownloadTemplate}
          disabled={downloadLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          {downloadLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Downloading...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Excel Template
            </>
          )}
        </button>
      </div>

      {/* Upload Section */}
      <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
        <h3 className="text-lg font-semibold text-green-800 mb-2">Step 2: Upload Grades</h3>
        <p className="text-green-700 mb-3">
          Fill in the grades in the template and upload the completed Excel file.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Excel File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Only .xlsx and .xls files are allowed. Maximum size: 5MB
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !file}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Grades
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Reset
            </button>
          </div>
        </form>

        {/* Progress Bar */}
        {loading && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Results Section */}
      {uploadResponse && (
        <div className={`p-4 rounded-lg border ${
          uploadResponse.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <h3 className={`text-lg font-semibold mb-3 ${
            uploadResponse.success ? 'text-green-800' : 'text-red-800'
          }`}>
            {uploadResponse.success ? 'Upload Successful!' : 'Upload Failed'}
          </h3>
          
          <p className={`mb-4 ${
            uploadResponse.success ? 'text-green-700' : 'text-red-700'
          }`}>
            {uploadResponse.message}
          </p>

          {uploadResponse.success && uploadResponse.data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-blue-600">{uploadResponse.data.totalProcessed}</div>
                <div className="text-sm text-gray-600">Total Processed</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-green-600">{uploadResponse.data.successCount}</div>
                <div className="text-sm text-gray-600">Successfully Saved</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-orange-600">{uploadResponse.data.updateCount}</div>
                <div className="text-sm text-gray-600">Updated</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-purple-600">{uploadResponse.data.createCount}</div>
                <div className="text-sm text-gray-600">Created</div>
              </div>
            </div>
          )}

          {/* Success Rate */}
          {uploadResponse.success && uploadResponse.summary && (
            <div className="mb-4 p-3 bg-white rounded-lg border">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Success Rate:</span>
                <span className="text-lg font-bold text-green-600">
                  {uploadResponse.summary.successRate}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${uploadResponse.summary.successRate}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Errors */}
          {uploadResponse.data.errors && uploadResponse.data.errors.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-red-800 mb-2">
                Errors ({uploadResponse.data.errors.length}):
              </h4>
              <div className="max-h-40 overflow-y-auto bg-white rounded-lg border p-3">
                <ul className="text-sm text-red-700 space-y-1">
                  {uploadResponse.data.errors.slice(0, 10).map((error, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-red-500 mt-1">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                  {uploadResponse.data.errors.length > 10 && (
                    <li className="text-gray-500 italic">
                      ... and {uploadResponse.data.errors.length - 10} more errors
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Preview of Uploaded Grades */}
          {uploadResponse.success && uploadResponse.data.grades && uploadResponse.data.grades.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">
                Preview of Uploaded Grades:
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Student ID
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Student Name
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Midterm
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Continuous
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Final
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {uploadResponse.data.grades.map((grade, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-900">{grade.studentId}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{grade.studentName}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{grade.midtermMark}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{grade.continuousMark}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{grade.finalExamMark}</td>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900">{grade.totalMark}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {uploadResponse.data.grades.length < uploadResponse.data.successCount && (
                <p className="text-xs text-gray-500 mt-2">
                  Showing first {uploadResponse.data.grades.length} of {uploadResponse.data.successCount} grades
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">Instructions</h3>
        <ul className="text-yellow-700 text-sm space-y-1">
          <li>• Download the template and fill in the grades for each student</li>
          <li>• Midterm marks: 0-30 points</li>
          <li>• Continuous marks: 0-30 points</li>
          <li>• Final exam marks: 0-40 points</li>
          <li>• Total marks will be calculated automatically</li>
          <li>• Do not modify the Student ID or Course ID columns</li>
          <li>• Save the file as .xlsx format before uploading</li>
        </ul>
      </div>
    </div>
  );
};

export default GradeUploadForm;