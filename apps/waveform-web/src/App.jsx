import React, { useState } from 'react';
import { Container, Grid, Row, Col } from 'rsuite';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import SetupEditor from './SetupEditor';
import SetupList from './components/SetupList';

import 'rsuite/dist/rsuite.min.css';
import "./App.less";

function App() {
  const { user, isAuthenticated } = useAuth();
  const [selectedSetup, setSelectedSetup] = useState(null);

  const handleSetupSelect = (setup) => {
    setSelectedSetup(setup);
  };

  const handleNewSetup = () => {
    setSelectedSetup(null);
  };

  return (
    <div className="app-container">
      <Navbar />
      <Container className="main-container">
        <Grid fluid>
          <Row>
            <Col xs={24} md={6} style={{ paddingRight: '10px' }}>
              <SetupList 
                onSetupSelect={handleSetupSelect}
                onNewSetup={handleNewSetup}
              />
            </Col>
            <Col xs={24} md={18} style={{ paddingLeft: '10px' }}>
              <SetupEditor selectedSetup={selectedSetup} />
            </Col>
          </Row>
        </Grid>
      </Container>
    </div>
  );
}

export default App;





