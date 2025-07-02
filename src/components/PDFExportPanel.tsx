import React, { useState } from 'react';
import { Download, FileText, GraduationCap, Loader2, Calendar, FileCheck } from 'lucide-react';
import { User } from '../types';

interface PDFExportPanelProps {
  user: User;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

const API_BASE = 'http://localhost:5000/api';

const PDFExportPanel: React.FC<PDFExportPanelProps> = ({ user, token, onError, onSuccess }) => {
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});

  const handleDownload = async (endpoint: string, filename: string, type: string) => {
    setLoading(prev => ({ ...prev, [type]: true }));

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Download failed');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      onSuccess(`${type} downloaded successfully!`);

    } catch (error) {
      onError(error instanceof Error ? error.message : 'Download failed');
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const downloadRegistrationSlip = async (registrationId: string) => {
    await handleDownload(
      `/pdf/student/registration-slip/${registrationId}`,
      `registration-slip-${registrationId}.pdf`,
      'registration-slip'
    );
  };

  const downloadTranscript = async () => {
    await handleDownload(
      '/transcript/download',
      `${user.firstName}_${user.fatherName}_transcript.pdf`,
      'transcript'
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-3 mb-6">
        <FileText className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">PDF Documents</h2>
      </div>

      <div className="space-y-4">
        {/* Registration Slip */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Calendar className="h-5 w-5 text-green-600" />
              <div>
                <h3 className="font-medium text-gray-900">Registration Slip</h3>
                <p className="text-sm text-gray-600">
                  Download your current semester registration slip
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                // This would need the registration ID - you'd get this from props or state
                // For now, showing the concept
                onError('Please select a registration from your registration history to download the slip');
              }}
              disabled={loading['registration-slip']}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
            >
              {loading['registration-slip'] ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{loading['registration-slip'] ? 'Generating...' : 'Download'}</span>
            </button>
          </div>
        </div>

        {/* Official Transcript */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <GraduationCap className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-medium text-gray-900">Official Transcript</h3>
                <p className="text-sm text-gray-600">
                  Download your complete academic transcript with all finalized grades
                </p>
              </div>
            </div>
            <button
              onClick={downloadTranscript}
              disabled={loading['transcript']}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
            >
              {loading['transcript'] ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{loading['transcript'] ? 'Generating...' : 'Download'}</span>
            </button>
          </div>
        </div>

        {/* Grade Report */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileCheck className="h-5 w-5 text-purple-600" />
              <div>
                <h3 className="font-medium text-gray-900">Semester Grade Report</h3>
                <p className="text-sm text-gray-600">
                  Download your current semester grade report
                </p>
              </div>
            </div>
            <button
              onClick={() => onSuccess('Grade report feature coming soon!')}
              disabled={loading['grade-report']}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
            >
              {loading['grade-report'] ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{loading['grade-report'] ? 'Generating...' : 'Download'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Important Notes:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• PDF documents are generated in real-time with current data</li>
          <li>• Official transcripts include only finalized grades</li>
          <li>• Registration slips are available for all completed registrations</li>
          <li>• Documents are formatted for official use and printing</li>
          <li>• Each document contains security features to prevent tampering</li>
        </ul>
      </div>
    </div>
  );
};

export default PDFExportPanel;