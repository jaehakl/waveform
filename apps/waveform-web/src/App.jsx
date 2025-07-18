import React from 'react';
import { Container } from 'rsuite';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import SetupEditor from './SetupEditor';

import 'rsuite/dist/rsuite.min.css';
import "./App.less";

function App() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="app-container">
      <Navbar />
      <Container className="main-container">
        <SetupEditor />
      </Container>
    </div>
  );
}

export default App;





