import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Message } from 'rsuite';
import { useAuth } from '../contexts/AuthContext';
import './LoginForm.less';

const LoginForm = ({ onClose }) => {
  const { login, loading, error, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({ name: '', password: '' });

  // 로그인 성공 시 드롭다운 닫기
  useEffect(() => {
    if (isAuthenticated) {
      onClose();
      setFormData({ name: '', password: '' });
    }
  }, [isAuthenticated, onClose]);

  const handleSubmit = async () => {
    const success = await login(formData.name, formData.password);
    if (success) {
      setFormData({ name: '', password: '' });
    }
  };

  return (
    <div className="login-form">
      {error && <Message type="error" className="error-message">{error}</Message>}
      
      <Form fluid>
        <Form.Group className="form-group">
          <Form.ControlLabel>사용자명</Form.ControlLabel>
          <Input 
            value={formData.name}
            onChange={(value) => setFormData({...formData, name: value})}
            placeholder="사용자명 입력"
            autoFocus
          />
        </Form.Group>
        <Form.Group className="form-group">
          <Form.ControlLabel>비밀번호</Form.ControlLabel>
          <Input 
            type="password"
            value={formData.password}
            onChange={(value) => setFormData({...formData, password: value})}
            placeholder="비밀번호 입력"
            onPressEnter={handleSubmit}
          />
        </Form.Group>
        <Form.Group className="form-group">
          <Button 
            appearance="primary" 
            onClick={handleSubmit}
            loading={loading}
            disabled={!formData.name || !formData.password}
            className="login-submit-button"
          >
            로그인
          </Button>
        </Form.Group>
      </Form>
    </div>
  );
};

export default LoginForm; 