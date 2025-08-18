import axios from 'axios';

// axios 기본 설정 (쿠키 포함)
axios.defaults.withCredentials = true;

// === Auth ===
export const login = (name, password) => axios.post('http://localhost:8000/auth/login/', { name, password });
export const checkSession = () => axios.get('http://localhost:8000/auth/check-session/');
export const logout = () => axios.get('http://localhost:8000/auth/logout/');

// === Setup ===
export const saveSetup = (setupData) => axios.post('http://localhost:8000/setup/save/', setupData);
export const updateSetup = (setupId, setupData) => axios.put(`http://localhost:8000/setup/${setupId}`, setupData);
export const getSetup = (setupId) => axios.get(`http://localhost:8000/setup/${setupId}`);
export const getSetupList = () => axios.get('http://localhost:8000/setup/list/');
export const deleteSetup = (setupId) => axios.delete(`http://localhost:8000/setup/${setupId}`);

// === Input Variables ===
export const getInputVariables = () => axios.get('http://localhost:8000/input-variables/');
