import React, { useState } from 'react';
import { Shield, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { User, TestResult } from '../types';

interface RBACTestingProps {
  user: User;
  token: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

const API_BASE = 'http://localhost:5000/api';

const RBACTesting: React.FC<RBACTestingProps> = ({ user, token, onError, onSuccess }) => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);

  const testRoute = async (endpoint: string, expectedStatus: number = 200): Promise<TestResult> => {
    try {
      const response = await fetch(`${API_BASE}/test/${endpoint}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      const data = await response.json();

      return {
        endpoint,
        status: response.status,
        expectedStatus,
        success: response.status === expectedStatus,
        data,
        timestamp: new Date().toLocaleTimeString()
      };
    } catch (err) {
      return {
        endpoint,
        status: 0,
        expectedStatus,
        success: false,
        data: { message: 'Network error' },
        timestamp: new Date().toLocaleTimeString()
      };
    }
  };

  const runTests = async () => {
    setLoading(true);
    const tests = [
      { endpoint: 'info', expected: 200 },
      { endpoint: 'protected', expected: token ? 200 : 401 },
      { endpoint: 'student-only', expected: token && user?.role === 'student' ? 200 : (token ? 403 : 401) },
      { endpoint: 'admin-only', expected: token && user?.role === 'itAdmin' ? 200 : (token ? 403 : 401) },
      { endpoint: 'staff-only', expected: token && ['departmentHead', 'registrar', 'itAdmin', 'president'].includes(user?.role || '') ? 200 : (token ? 403 : 401) }
    ];

    const results = [];
    for (const test of tests) {
      const result = await testRoute(test.endpoint, test.expected);
      results.push(result);
    }

    setTestResults(results);
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Shield className="h-6 w-6 text-green-600" />
          <h2 className="text-xl font-semibold text-gray-900">RBAC Testing</h2>
        </div>
        <button
          onClick={runTests}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
          <span>{loading ? 'Testing...' : 'Run Tests'}</span>
        </button>
      </div>

      {testResults.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {testResults.map((result, index) => (
            <div
              key={index}
              className={`p-3 rounded-md border ${result.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {result.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-medium">/api/test/{result.endpoint}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${result.success
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                    }`}>
                    {result.status}
                  </span>
                  <span className="text-xs text-gray-500">{result.timestamp}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-1">{result.data.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RBACTesting;