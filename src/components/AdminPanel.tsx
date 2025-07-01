import React, { useState } from 'react';
import { Database, Download, Users, Upload, X, Loader2 } from 'lucide-react';
import { ImportResult } from '../types';

interface AdminPanelProps {
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

const API_BASE = 'http://localhost:5000/api';

const AdminPanel: React.FC<AdminPanelProps> = ({ token, onError, onSuccess }) => {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<ImportResult | null>(null);
  const [showImportResults, setShowImportResults] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleExcelUpload = (file: File | null) => {
    if (file) {
      // Validate file type
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];

      if (!allowedTypes.includes(file.type)) {
        onError('Only Excel files (.xlsx, .xls) are allowed');
        return;
      }

      // Validate file size (50MB)
      if (file.size > 50 * 1024 * 1024) {
        onError('File size must be less than 50MB');
        return;
      }
    }

    setExcelFile(file);
  };

  const handleImportStudents = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!excelFile) {
      onError('Please select an Excel file to import');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('excelFile', excelFile);

      const response = await fetch(`${API_BASE}/admin/import-seniors`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data: ImportResult = await response.json();
      setImportResults(data);
      setShowImportResults(true);

      if (data.success) {
        onSuccess(data.message);
        setExcelFile(null);
      } else {
        onError(data.message);
      }
    } catch (err) {
      onError('Network error. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const getImportTemplate = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/import-template`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        // Create a downloadable template info
        const templateInfo = JSON.stringify(data.data, null, 2);
        const blob = new Blob([templateInfo], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'import-template-info.json';
        a.click();
        URL.revokeObjectURL(url);
        onSuccess('Template information downloaded!');
      } else {
        onError(data.message);
      }
    } catch (err) {
      onError('Failed to get template information');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Database className="h-6 w-6 text-purple-600" />
        <h2 className="text-xl font-semibold text-gray-900">Senior Students Import</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Import Form */}
        <div>
          <form onSubmit={handleImportStudents} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Excel File (.xlsx, .xls)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleExcelUpload(e.target.files?.[0] || null)}
                  className="hidden"
                  id="excelFile"
                />
                <label
                  htmlFor="excelFile"
                  className="flex-1 flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-purple-400 transition-colors duration-200"
                >
                  <Upload className="h-4 w-4 mr-2 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {excelFile ? excelFile.name : 'Choose Excel file'}
                  </span>
                </label>
                {excelFile && (
                  <button
                    type="button"
                    onClick={() => handleExcelUpload(null)}
                    className="p-1 text-red-600 hover:text-red-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={loading || !excelFile}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
                <span>{loading ? 'Importing...' : 'Import Students'}</span>
              </button>

              <button
                type="button"
                onClick={getImportTemplate}
                className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-md transition-colors duration-200 flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Template</span>
              </button>
            </div>
          </form>

          <div className="mt-4 bg-blue-50 p-4 rounded-md">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Required Columns:</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• firstName, fatherName, grandfatherName</li>
              <li>• department (Electrical, Manufacturing, Automotive)</li>
              <li>• year (2-5), semester (1-2), studentId (unique)</li>
              <li>• notes (optional)</li>
            </ul>
          </div>
        </div>

        {/* Import Results */}
        <div>
          {showImportResults && importResults && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Import Results</h3>
                <button
                  onClick={() => setShowImportResults(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {importResults.data?.summary && (
                <div className="bg-gray-50 p-4 rounded-md">
                  <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Total Rows: {importResults.data.summary.totalRows}</div>
                    <div>Processed: {importResults.data.summary.processed}</div>
                    <div className="text-green-600">Imported: {importResults.data.summary.imported}</div>
                    <div className="text-yellow-600">Duplicates: {importResults.data.summary.duplicates}</div>
                    <div className="text-red-600">Errors: {importResults.data.summary.errorCount}</div>
                  </div>
                </div>
              )}

              {importResults.data?.tempPasswords && importResults.data.tempPasswords.length > 0 && (
                <div className="bg-yellow-50 p-4 rounded-md">
                  <h4 className="font-medium text-yellow-900 mb-2">Temporary Passwords</h4>
                  <div className="space-y-1 text-xs font-mono">
                    {importResults.data.tempPasswords.map((item, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{item.studentId}</span>
                        <span>{item.tempPassword}</span>
                      </div>
                    ))}
                  </div>
                  {importResults.data.note && (
                    <p className="text-xs text-yellow-700 mt-2">{importResults.data.note}</p>
                  )}
                </div>
              )}

              {importResults.data?.errors && importResults.data.errors.length > 0 && (
                <div className="bg-red-50 p-4 rounded-md max-h-48 overflow-y-auto">
                  <h4 className="font-medium text-red-900 mb-2">Errors</h4>
                  <div className="space-y-1 text-xs text-red-800">
                    {importResults.data.errors.map((error, index) => (
                      <div key={index}>{error}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;