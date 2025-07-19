import React from 'react';
import { Container, CustomProvider } from 'rsuite';
import { useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import Navbar from './components/Navbar';
import SetupEditor from './SetupEditor';

import 'rsuite/dist/rsuite.min.css';
import "./App.less";

function AppContent() {
  const { user, isAuthenticated } = useAuth();
  const { rsuiteTheme } = useTheme();

  return (
    <CustomProvider theme={rsuiteTheme}>
      <div className="app-container">
        <Navbar />
        <Container className="main-container">
          <SetupEditor />
        </Container>
      </div>
    </CustomProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;





