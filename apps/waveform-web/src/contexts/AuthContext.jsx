import React, { createContext, useContext, useState, useEffect } from 'react';
import { login, checkSession, logout } from '../api/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 페이지 로드시 사용자 상태 확인
  useEffect(() => {
    checkUserStatus();
  }, []);

  const checkUserStatus = async () => {
    try {
      const response = await checkSession();
      setUser(response.data.user);
      setError('');
    } catch (err) {
      setUser(null);
      setError('');
    }
  };

  const handleLogin = async (name, password) => {
    if (!name || !password) {
      setError('사용자명과 비밀번호를 입력해주세요.');
      return false;
    }

    setLoading(true);
    setError('');

    try {
      await login(name, password);
      await checkUserStatus();
      return true;
    } catch (err) {
      setError(err.response?.data?.detail || '로그인에 실패했습니다.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      setUser(null);
      setError('');
    } catch (err) {
      setError('로그아웃 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const auth = {
    user,
    loading,
    error,
    login: handleLogin,
    logout: handleLogout,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 