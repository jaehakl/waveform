import React, { useState, useEffect } from 'react';
import { Content, Panel, Tabs, Form, Input, InputNumber, Button, SelectPicker, Checkbox, Grid, Row, Col } from 'rsuite';
import { saveSetup, updateSetup, checkSession, getSetup, getInputVariables } from './api/api';
import Spreadsheet from './components/Spreadsheet';
import SetupList from './components/SetupList';
import { Experiment3D } from './components/experiment3D';
import { evalStructure } from './lib/structureToGeometry';
import './SetupEditor.less';

// Solver 옵션 정의
const SOLVER_OPTIONS = [
  { label: 'FDTD(Waveform)', value: 'FDTD:Waveform' },
  { label: 'FDTD(MEEP)', value: 'FDTD:MEEP' }
];

// InputVariables 섹션 정의 및 상태/세터 매핑
const SECTIONS = [
  { key: 'constants', title: 'Constants', type: 'form' },
  { key: 'settings', title: 'Settings', type: 'form' },
  { key: 'structures', title: 'Structures', type: 'sheet' },
  { key: 'components', title: 'Components', type: 'sheet' },
  { key: 'sources', title: 'Sources', type: 'sheet' },
  { key: 'detectors', title: 'Detectors', type: 'sheet' },
  { key: 'materials', title: 'Materials', type: 'sheet' },
  { key: 'material_sus', title: 'Material Susceptibility', type: 'sheet' }
];

function SetupEditor() {
  const [selectedSetup, setSelectedSetup] = useState(null);
  const [activeTab, setActiveTab] = useState('constants');
  const [setupListKey, setSetupListKey] = useState(0); // SetupList 강제 새로고침용
  
  // Input Variables 데이터 상태
  const [inputVariablesData, setInputVariablesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);
  
  // InputVariables 데이터를 하나의 state로 관리 (SECTIONS에서 자동 생성)
  const [inputData, setInputData] = useState(
    SECTIONS.reduce((acc, section) => ({ ...acc, [section.key]: {} }), {})
  );
  
  const [structureEvaluated, setStructureEvaluated] = useState(null);

  // Setup 정보 및 인증 상태
  const [setupInfo, setSetupInfo] = useState({
    title: '',
    solver: 'FDTD:Waveform',
    public: false,
    description: ''
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 섹션별 데이터 설정을 위한 공통 setter 생성기
  const getSectionSetter = (sectionKey) => (nextData) => {
    setInputData((prev) => ({ ...prev, [sectionKey]: nextData }));
  };

  // Input Variables 데이터 로드
  useEffect(() => {
    const loadInputVariables = async () => {
      try {
        setLoading(true);
        const response = await getInputVariables();
        const data = response.data;
        setInputVariablesData(data);
        setBackendAvailable(true);
        
        // 각 탭별 초기 데이터 설정 (루프 처리, 단일 state로 설정)
        const nextInputData = { ...inputData };
        SECTIONS.forEach(({ key }) => {
          const section = data[key];
          nextInputData[key] = section && !section.error ? (section.initialData || {}) : {};
        });
        setInputData(nextInputData);
        
        // 에러가 있는 경우 콘솔에 출력
        Object.keys(data).forEach(key => {
          if (data[key] && data[key].error) {
            console.error(`Error in ${key}:`, data[key].error);
          }
        });
        
      } catch (error) {
        console.error('Input Variables 로드 중 오류:', error);
        console.log('백엔드 서버에 연결할 수 없어 input-variables를 설정하지 않습니다.');
        setBackendAvailable(false);
        setInputVariablesData(null);
      } finally {
        setLoading(false);
      }
    };

    loadInputVariables();
  }, []);

  // Setup 선택 핸들러
  const handleSetupSelect = (setup) => {
    setSelectedSetup(setup);
  };

  // 새 Setup 생성 핸들러
  const handleNewSetup = () => {
    setSelectedSetup(null);
  };

  // 구조 재생성 함수
  const regenerateStructure = () => {
    const structure = inputData.structures;
    const components = inputData.components;
    const [entityList, arrayDicts] = evalStructure(structure, components);
    setStructureEvaluated(entityList);
  };

  useEffect(() => {
    regenerateStructure();
  }, [inputData.structures, inputData.components]);

  // 로그인 상태 확인
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const response = await checkSession();
        setIsLoggedIn(true);
      } catch (error) {
        setIsLoggedIn(false);
      }
    };
    checkLoginStatus();
  }, []);

  // 선택된 Setup 로드
  useEffect(() => {
    const loadSelectedSetup = async () => {
      if (!selectedSetup) {
        // 새 Setup인 경우 초기값으로 리셋
        setSetupInfo({
          title: '',
          solver: 'FDTD:Waveform',
          public: false,
          description: ''
        });
        return;
      }

      try {
        const response = await getSetup(selectedSetup.id);
        if (response.data.success) {
          const setup = response.data.setup;
          
          // Setup 정보 설정
          setSetupInfo({
            title: setup.title,
            solver: setup.solver,
            public: setup.public === true, // 명시적으로 boolean으로 변환
            description: setup.description || ''
          });

          // Setup 데이터 로드 (루프 처리, 단일 state로 설정)
          const setupData = setup.setup_data;
          if (setupData) {
            setInputData((prev) => {
              const updated = { ...prev };
              SECTIONS.forEach(({ key }) => {
                if (key in setupData) {
                  updated[key] = setupData[key];
                }
              });
              return updated;
            });
          }
        } else {
          alert(response.data.message || 'Setup을 불러오는데 실패했습니다.');
        }
      } catch (error) {
        console.error('Setup 로드 중 오류:', error);
        alert('Setup을 불러오는데 실패했습니다.');
      }
    };

    loadSelectedSetup();
  }, [selectedSetup]);

  // 시트 타입 섹션 onDataChange 핸들러 매핑 (공통 setter 사용)
  const onDataChangeHandlers = SECTIONS
    .filter((s) => s.type === 'sheet')
    .reduce((acc, s) => ({ ...acc, [s.key]: getSectionSetter(s.key) }), {});

  // Setup 정보 변경 핸들러
  const handleSetupInfoChange = (field, value) => {
    setSetupInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Setup 저장 함수 (기존 Setup 업데이트 또는 새 Setup 생성)
  const handleSaveSetup = async () => {
    if (!isLoggedIn) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!setupInfo.title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }

    // 저장 전 확인 메시지
    const action = selectedSetup ? '업데이트' : '저장';
    const confirmMessage = selectedSetup 
      ? `"${selectedSetup.title}" Setup을 ${action}하시겠습니까?`
      : `새 Setup을 ${action}하시겠습니까?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setIsSaving(true);
    try {
      const allData = {
        ...inputData,
        structureEvaluated: structureEvaluated
      };

      const setupData = {
        title: setupInfo.title,
        solver: setupInfo.solver,
        public: setupInfo.public,
        description: setupInfo.description,
        setup_data: allData
      };

      let response;
      if (selectedSetup) {
        // 기존 Setup 업데이트
        response = await updateSetup(selectedSetup.id, setupData);
      } else {
        // 새 Setup 생성
        response = await saveSetup(setupData);
      }
      
      if (response.data.success) {
        console.log('저장된 Setup ID:', response.data.setup_id);
        
        // SetupList 새로고침
        setSetupListKey(prev => prev + 1);
        
        // 저장된 Setup을 선택 상태로 설정
        const savedSetup = {
          id: response.data.setup_id,
          title: setupInfo.title,
          solver: setupInfo.solver,
          public: setupInfo.public,
          description: setupInfo.description,
          created_at: new Date().toISOString()
        };
        setSelectedSetup(savedSetup);
      } else {
        alert(response.data.message || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Setup 저장 중 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // Setup을 새로 저장하는 함수 (Save As)
  const handleSaveAsSetup = async () => {
    if (!isLoggedIn) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!setupInfo.title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }

    // 저장 전 확인 메시지
    const confirmMessage = `새 Setup을 저장하시겠습니까?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setIsSaving(true);
    try {
      const allData = {
        ...inputData,
        structureEvaluated: structureEvaluated
      };

      const setupData = {
        title: setupInfo.title,
        solver: setupInfo.solver,
        public: setupInfo.public,
        description: setupInfo.description,
        setup_data: allData
      };

      // 항상 새 Setup 생성
      const response = await saveSetup(setupData);
      
      if (response.data.success) {
        console.log('저장된 Setup ID:', response.data.setup_id);
        
        // SetupList 새로고침
        setSetupListKey(prev => prev + 1);
        
        // 저장된 Setup을 선택 상태로 설정
        const savedSetup = {
          id: response.data.setup_id,
          title: setupInfo.title,
          solver: setupInfo.solver,
          public: setupInfo.public,
          description: setupInfo.description,
          created_at: new Date().toISOString()
        };
        setSelectedSetup(savedSetup);
      } else {
        alert(response.data.message || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Setup 저장 중 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 모든 데이터를 취합하여 console.log로 출력하는 함수
  const logAllData = () => {
    const allData = {
      ...inputData,
      structureEvaluated: structureEvaluated
    };
    
    console.log('=== 모든 Setup 데이터 ===');
    console.log(allData);
    console.log('=== JSON 형태로 출력 ===');
    console.log(JSON.stringify(allData, null, 2));
  };

  // Form 필드 렌더링 함수
  const renderFormField = (key, fieldConfig, currentData, onChangeHandler) => {
    const { dtype, title, default_value, type } = fieldConfig;
    
    if (type === 'vector') {
      return (
        <Form.Group key={key}>
          <Form.ControlLabel>{title}</Form.ControlLabel>
          <Input 
            value={currentData[key] || default_value}
            onChange={(value) => {
              const newData = { ...currentData, [key]: value };
              onChangeHandler(newData);
            }}
            placeholder={default_value}
          />
        </Form.Group>
      );
    } else if (dtype === 'float' || type === 'float') {
      return (
        <Form.Group key={key}>
          <Form.ControlLabel>{title}</Form.ControlLabel>
          <InputNumber 
            value={parseFloat(currentData[key]) || parseFloat(default_value)}
            onChange={(value) => {
              const newData = { ...currentData, [key]: value };
              onChangeHandler(newData);
            }}
            step={0.01}
            className="input-number"
          />
        </Form.Group>
      );
    } else if (dtype === 'int') {
      return (
        <Form.Group key={key}>
          <Form.ControlLabel>{title}</Form.ControlLabel>
          <InputNumber 
            value={parseInt(currentData[key]) || parseInt(default_value)}
            onChange={(value) => {
              const newData = { ...currentData, [key]: value };
              onChangeHandler(newData);
            }}
            step={1}
            className="input-number"
          />
        </Form.Group>
      );
    } else {
      return (
        <Form.Group key={key}>
          <Form.ControlLabel>{title}</Form.ControlLabel>
          <Input 
            value={currentData[key] || default_value}
            onChange={(value) => {
              const newData = { ...currentData, [key]: value };
              onChangeHandler(newData);
            }}
            placeholder={default_value}
          />
        </Form.Group>
      );
    }
  };

  // 로딩 중일 때 표시
  if (loading) {
    return (
      <Content className="setup-editor">
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <p>설정 데이터를 불러오는 중...</p>
        </div>
      </Content>
    );
  }

  // 백엔드가 사용 불가능한 경우 표시
  if (!backendAvailable) {
    return (
      <Content className="setup-editor">
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <div style={{ 
            backgroundColor: '#f8d7da', 
            color: '#721c24', 
            padding: '20px', 
            borderRadius: '4px',
            border: '1px solid #f5c6cb',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            <h3>백엔드 서버 연결 실패</h3>
            <p>백엔드 서버에 연결할 수 없어 input-variables를 설정할 수 없습니다.</p>
            <p>다음 사항을 확인해주세요:</p>
            <ul style={{ textAlign: 'left', display: 'inline-block' }}>
              <li>백엔드 서버가 실행 중인지 확인</li>
              <li>서버 주소가 올바른지 확인 (http://localhost:8000)</li>
              <li>네트워크 연결 상태 확인</li>
            </ul>
            <p style={{ marginTop: '20px' }}>
              <strong>백엔드 서버를 실행한 후 페이지를 새로고침해주세요.</strong>
            </p>
          </div>
        </div>
      </Content>
    );
  }

  return (
    <Content className="setup-editor">
      <Grid fluid>
        <Row>
          <Col xs={24} md={6} className="setup-list-container">
            <SetupList 
              key={setupListKey}
              refreshKey={setupListKey}
              onSetupSelect={handleSetupSelect}
              onNewSetup={handleNewSetup}
            />
          </Col>
          <Col xs={24} md={18} className="editor-container">
            <Panel header="Setup 편집기">        
        <div className="experiment-3d-container">
          <div>
            <Experiment3D id="experiment3D" setupData={{
              structureEvaluated: structureEvaluated,
              sources: inputData.sources,
              detectors: inputData.detectors,
              settings: inputData.settings,
              constants: inputData.constants
            }} width={800} height={500}/>
          </div>
          <div>
            <Button 
              appearance="primary" 
              color="blue"
              onClick={regenerateStructure}
              size="sm"
              className="regenerate-button"
            >
              구조 재생성
            </Button>
          </div>
        </div>
        
        <div className="tabs-container">
          <Tabs activeKey={activeTab} onSelect={setActiveTab}>
            {SECTIONS.map((section) => (
              <Tabs.Tab eventKey={section.key} title={section.title} key={section.key}>
                <div className={section.type === 'form' ? 'tab-content' : 'spreadsheet-tab-content'}>
                  {section.type === 'form' ? (
                    <Form fluid>
                      {inputVariablesData?.[section.key]?.keys &&
                        Object.keys(inputVariablesData[section.key].keys).map((key) =>
                          renderFormField(
                            key,
                            inputVariablesData[section.key].keys[key],
                            inputData[section.key],
                            getSectionSetter(section.key)
                          )
                        )}
                    </Form>
                  ) : (
                    inputVariablesData?.[section.key] && (
                      <Spreadsheet
                        initialData={inputData[section.key]}
                        rowOptions={inputVariablesData[section.key].rowOptions}
                        columnNames={inputVariablesData[section.key].columnNames}
                        rows={0}
                        cols={(inputVariablesData[section.key].columnNames || []).length}
                        width={800}
                        height={400}
                        onDataChange={onDataChangeHandlers[section.key]}
                      />
                    )
                  )}
                </div>
              </Tabs.Tab>
            ))}
          </Tabs>
        </div>            
        {/* Setup 정보 입력 폼 */}
        <div className="setup-info-container">
          <h4 className="setup-info-title">Setup 정보</h4>
          <Form fluid>
            <Row>
              <Col xs={24} md={8}>
                <Form.Group className="form-group">
                  <Form.ControlLabel>제목 *</Form.ControlLabel>
                  <Input 
                    value={setupInfo.title}
                    onChange={(value) => handleSetupInfoChange('title', value)}
                    placeholder="Setup 제목을 입력하세요"
                    size="sm"
                  />
                </Form.Group>
              </Col>
              <Col xs={24} md={6}>
                <Form.Group className="form-group">
                  <Form.ControlLabel>Solver</Form.ControlLabel>
                  <SelectPicker
                    data={SOLVER_OPTIONS}
                    value={setupInfo.solver}
                    onChange={(value) => handleSetupInfoChange('solver', value)}
                    size="sm"
                    className="select-picker"
                  />
                </Form.Group>
              </Col>
              <Col xs={24} md={4}>
                <Form.Group className="form-group checkbox-group">
                  <Checkbox
                    checked={Boolean(setupInfo.public)}
                    onChange={(value, checked) => {
                      console.log('Checkbox changed:', checked); // 디버깅용
                      setSetupInfo(prev => ({
                        ...prev,
                        public: checked
                      }));
                    }}
                  >
                    공개
                  </Checkbox>
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="form-group">
              <Form.ControlLabel>설명</Form.ControlLabel>
              <Input
                as="textarea"
                value={setupInfo.description}
                onChange={(value) => handleSetupInfoChange('description', value)}
                placeholder="Setup에 대한 설명을 입력하세요"
                rows={2}
                size="sm"
              />
            </Form.Group>
          </Form>
        </div>
                 <div className="save-buttons-container">
           <Button 
             appearance="primary" 
             color="green"
             onClick={handleSaveSetup}
             disabled={!isLoggedIn || isSaving}
             loading={isSaving}
           >
             {isSaving ? '저장 중...' : 'Save'}
           </Button>
           <Button 
             appearance="ghost" 
             color="blue"
             onClick={handleSaveAsSetup}
             disabled={!isLoggedIn || isSaving}
             loading={isSaving}
           >
             {isSaving ? '저장 중...' : 'Save As'}
           </Button>
           {!isLoggedIn && (
             <span className="login-notice">
               저장하려면 로그인이 필요합니다.
             </span>
           )}
         </div>

            </Panel>
          </Col>
        </Row>
      </Grid>          
    </Content>
  );
}

export default SetupEditor; 