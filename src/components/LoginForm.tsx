import React, { useState } from 'react';
import { LogIn, Eye, EyeOff, Loader2 } from 'lucide-react';
import { User, AuthResponse } from '../types';

interface LoginFormProps {
  onLogin: (user: User, token: string) => void;
  onError: (message: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

const API_BASE = 'http://localhost:5000/api';

const LoginForm: React.FC<LoginFormProps> = ({ onLogin, onError, loading, setLoading }) => {
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginForm),
      });

      const data: AuthResponse = await response.json();

      if (data.success && data.data) {
        onLogin(data.data.user, data.data.token);
        setLoginForm({ email: '', password: '' });
      } else {
        onError(data.message || 'Login failed');
      }
    } catch (err) {
      onError('Network error. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Institutional Email
        </label>
        <input
          type="email"
          required
          value={loginForm.email}
          onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="jD@attc.edu.et"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center space-x-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="h-4 w-4" />
        )}
        <span>{loading ? 'Signing in...' : 'Sign In'}</span>
      </button>
    </form>
  );
};

export default LoginForm;