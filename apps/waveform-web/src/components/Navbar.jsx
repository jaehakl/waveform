import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import LoginForm from './LoginForm';
import './Navbar.less';

const Navbar = () => {
  const { user, isAuthenticated, logout, loading } = useAuth();
  const { themeMode, toggleTheme, isDark } = useTheme();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = async () => {
    await logout();
    setShowDropdown(false);
  };

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <>
      <nav className="navbar">
        <div>
          <strong className="brand">
            Waveform
          </strong>
        </div>
        
        <div className="navbar-right" ref={dropdownRef}>
          {/* 테마 전환 버튼 */}
          <button 
            className="theme-toggle-button"
            onClick={toggleTheme}
            title={isDark ? '밝은 모드로 전환' : '어두운 모드로 전환'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          {isAuthenticated ? (
            <>
              <div 
                className="user-dropdown-trigger"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <span>{user.name}</span>
                <span className="dropdown-arrow">▼</span>
              </div>
              
              {showDropdown && (
                <div className="user-dropdown-menu">
                  <div className="user-info">
                    <div className="user-name">{user.name}</div>
                    <div className="user-email">
                      {user.email || '이메일 없음'}
                    </div>
                    <div className="user-grade">
                      등급: {user.grade}
                    </div>
                  </div>
                  <button
                    className="logout-button"
                    onClick={handleLogout}
                    disabled={loading}
                  >
                    {loading ? '로그아웃 중...' : '로그아웃'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div 
                className="login-button"
                onClick={() => setShowLoginModal(!showLoginModal)}
              >
                로그인
              </div>
              
              {showLoginModal && (
                <div className="login-dropdown">
                  <div className="login-header">
                    <h4>로그인</h4>
                    <button 
                      className="close-button"
                      onClick={() => setShowLoginModal(false)}
                    >
                      ×
                    </button>
                  </div>
                  
                  <LoginForm onClose={() => setShowLoginModal(false)} />
                </div>
              )}
            </>
          )}
        </div>
      </nav>
    </>
  );
};

export default Navbar; 