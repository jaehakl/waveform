import axios from 'axios';

// axios 기본 설정 (쿠키 포함)
axios.defaults.withCredentials = true;

// === Auth ===
export const login = (name, password) => axios.post('http://localhost:8000/auth/login/', { name, password });
export const checkSession = () => axios.get('http://localhost:8000/auth/check-session/');
export const logout = () => axios.get('http://localhost:8000/auth/logout/');
