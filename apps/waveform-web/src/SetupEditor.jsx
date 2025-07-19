import React, { useState, useEffect } from 'react';
import { Content, Panel, Tabs, Form, Input, InputNumber, Button, SelectPicker, Checkbox, Grid, Row, Col } from 'rsuite';
import { saveSetup, updateSetup, checkSession, getSetup } from './api/api';
import Spreadsheet from './components/Spreadsheet';
import SetupList from './components/SetupList';
import { GeometryPainter } from "./lib/qutat3d/3d/geometry_painter";
import { Experiment3D } from './components/experiment3D';
import structuresData from '../input_variables/structures.json';
import componentsData from '../input_variables/components.json';
import sourcesData from '../input_variables/sources.json';
import detectorsData from '../input_variables/detectors.json';
import settingsData from '../input_variables/settings.json';
import constantsData from '../input_variables/constants.json';
import materialsData from '../input_variables/materials.json';
import materialSusData from '../input_variables/material_sus.json';
import { evalStructure } from './lib/structureToGeometry';
import './SetupEditor.less';

// 각 JSON 파일에서 데이터 추출
const structuresColumnNames = Object.keys(structuresData.columns);
const structuresRowOptions = structuresData.options;
const structuresInitialData = structuresData.init_values;

const componentsColumnNames = Object.keys(componentsData.columns);
const componentsRowOptions = componentsData.options;
const componentsInitialData = componentsData.init_values;

const sourcesColumnNames = Object.keys(sourcesData.columns);
const sourcesRowOptions = sourcesData.options;
const sourcesInitialData = sourcesData.init_values;

const detectorsColumnNames = Object.keys(detectorsData.columns);
const detectorsRowOptions = detectorsData.options;
const detectorsInitialData = detectorsData.init_values;

const materialsColumnNames = Object.keys(materialsData.columns);
const materialsRowOptions = materialsData.options;
const materialsInitialData = materialsData.init_values;

const materialSusColumnNames = Object.keys(materialSusData.columns);
const materialSusRowOptions = materialSusData.options;
const materialSusInitialData = materialSusData.init_values;

// settings 데이터에서 초기값 추출 (다른 JSON들과 유사한 방식)
const settingsKeys = settingsData.keys;
const settingsInitialData = {};
Object.keys(settingsKeys).forEach(key => {
  settingsInitialData[key] = settingsData.keys[key].default_value;
});

// constants 데이터에서 초기값 추출 (다른 JSON들과 유사한 방식)
const constantsKeys = constantsData.keys;
const constantsInitialData = {};
Object.keys(constantsKeys).forEach(key => {
  constantsInitialData[key] = constantsData.keys[key].default_value;
});

// Solver 옵션 정의
const solverOptions = [
  { label: 'FDTD', value: 'fdtd' },
  { label: 'FEM', value: 'fem' },
  { label: 'BEM', value: 'bem' },
  { label: 'Analytical', value: 'analytical' }
];

function SetupEditor() {
  const [selectedSetup, setSelectedSetup] = useState(null);
  const [activeTab, setActiveTab] = useState('constants');
  const [setupListKey, setSetupListKey] = useState(0); // SetupList 강제 새로고침용
  
  // 각 탭별 데이터 상태
  const [structuresData, setStructuresData] = useState(structuresInitialData);
  const [componentsData, setComponentsData] = useState(componentsInitialData);
  const [sourcesData, setSourcesData] = useState(matrixToDictList(sourcesInitialData, sourcesColumnNames));
  const [detectorsData, setDetectorsData] = useState(matrixToDictList(detectorsInitialData, detectorsColumnNames));
  const [materialsData, setMaterialsData] = useState(materialsInitialData);
  const [materialSusData, setMaterialSusData] = useState(materialSusInitialData);
  const [settingsData, setSettingsData] = useState(settingsInitialData);
  const [constantsData, setConstantsData] = useState(constantsInitialData);
  
  const [structureEvaluated, setStructureEvaluated] = useState([]);

  // Setup 정보 및 인증 상태
  const [setupInfo, setSetupInfo] = useState({
    title: '',
    solver: 'fdtd',
    public: false,
    description: ''
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
    const structure = matrixToDictList(structuresData, structuresColumnNames);
    const components = matrixToDictList(componentsData, componentsColumnNames);
    const [entityList, arrayDicts] = evalStructure(structure, components);
    setStructureEvaluated(entityList);
  };

  useEffect(() => {
    regenerateStructure();
  }, [structuresData, componentsData]);

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
          solver: 'fdtd',
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

          // Setup 데이터 로드
          const setupData = setup.setup_data;
          if (setupData) {
            if (setupData.constants) setConstantsData(setupData.constants);
            if (setupData.settings) setSettingsData(setupData.settings);
            if (setupData.structures) {
              // 딕셔너리 리스트를 매트릭스로 변환
              const structuresMatrix = setupData.structures.map(row => 
                structuresColumnNames.map(col => row[col] || '')
              );
              setStructuresData(structuresMatrix);
            }
            if (setupData.components) {
              const componentsMatrix = setupData.components.map(row => 
                componentsColumnNames.map(col => row[col] || '')
              );
              setComponentsData(componentsMatrix);
            }
            if (setupData.sources) setSourcesData(setupData.sources);
            if (setupData.detectors) setDetectorsData(setupData.detectors);
            if (setupData.materials) {
              const materialsMatrix = setupData.materials.map(row => 
                materialsColumnNames.map(col => row[col] || '')
              );
              setMaterialsData(materialsMatrix);
            }
            if (setupData.material_sus) {
              const materialSusMatrix = setupData.material_sus.map(row => 
                materialSusColumnNames.map(col => row[col] || '')
              );
              setMaterialSusData(materialSusMatrix);
            }
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

  function matrixToDictList(matrix, columnNames) {
    const dictList = [];
    for (let i = 0; i < matrix.length; i++) {
      let row = {};
      for (let j = 0; j < columnNames.length; j++) {
        row[columnNames[j]] = matrix[i][j];
      }
      dictList.push(row);
    }
    return dictList;
  }

  function dictListToMatrix(dictList, columnNames) {
    if (!dictList || dictList.length === 0) {
      return [];
    }
    return dictList.map(row => 
      columnNames.map(col => row[col] || '')
    );
  }

  // 각 탭별 데이터 변경 핸들러
  const handleSourcesChange = (data) => {
    setSourcesData(matrixToDictList(data, sourcesColumnNames));
    // sources 데이터 변경 시 필요한 로직 추가
  };

  const handleDetectorsChange = (data) => {
    setDetectorsData(matrixToDictList(data, detectorsColumnNames));
    // detectors 데이터 변경 시 필요한 로직 추가
  };

  const handleMaterialsChange = (data) => {
    setMaterialsData(data);
    // materials 데이터 변경 시 필요한 로직 추가
  };

  const handleMaterialSusChange = (data) => {
    setMaterialSusData(data);
    // material_sus 데이터 변경 시 필요한 로직 추가
  };

  const handleSettingsChange = (formData) => {
    setSettingsData(formData);
    // settings 데이터 변경 시 필요한 로직 추가
  };

  const handleConstantsChange = (formData) => {
    setConstantsData(formData);
    // constants 데이터 변경 시 필요한 로직 추가
  };

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
        constants: constantsData,
        settings: settingsData,
        structures: matrixToDictList(structuresData, structuresColumnNames),
        components: matrixToDictList(componentsData, componentsColumnNames),
        sources: sourcesData,
        detectors: detectorsData,
        materials: matrixToDictList(materialsData, materialsColumnNames),
        material_sus: matrixToDictList(materialSusData, materialSusColumnNames),
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
        constants: constantsData,
        settings: settingsData,
        structures: matrixToDictList(structuresData, structuresColumnNames),
        components: matrixToDictList(componentsData, componentsColumnNames),
        sources: sourcesData,
        detectors: detectorsData,
        materials: matrixToDictList(materialsData, materialsColumnNames),
        material_sus: matrixToDictList(materialSusData, materialSusColumnNames),
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
      constants: constantsData,
      settings: settingsData,
      structures: matrixToDictList(structuresData, structuresColumnNames),
      components: matrixToDictList(componentsData, componentsColumnNames),
      sources: sourcesData,
      detectors: detectorsData,
      materials: matrixToDictList(materialsData, materialsColumnNames),
      material_sus: matrixToDictList(materialSusData, materialSusColumnNames),
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
            <Experiment3D id="experiment3D" setupData={{"structureEvaluated" : structureEvaluated, "sources" : sourcesData, "detectors" : detectorsData, "settings" : settingsData, "constants" : constantsData}} width={800} height={500}/>
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
            <Tabs.Tab eventKey="constants" title="Constants">
              <div className="tab-content">
                <Form fluid>
                  {Object.keys(constantsKeys).map(key =>            
                    renderFormField(key, constantsKeys[key], constantsData, handleConstantsChange)                  
                  )}
                </Form>
              </div>
            </Tabs.Tab>
            
            <Tabs.Tab eventKey="settings" title="Settings">
              <div className="tab-content">
                <Form fluid>
                  {Object.keys(settingsKeys).map(key =>            
                    renderFormField(key, settingsKeys[key], settingsData, handleSettingsChange)                  
                  )}
                </Form>
              </div>
            </Tabs.Tab>
            
            <Tabs.Tab eventKey="structures" title="Structures">
              <div className="spreadsheet-tab-content">
                <Spreadsheet 
                  initialData={structuresData}
                  rowOptions={structuresRowOptions}
                  columnNames={structuresColumnNames}
                  rows={0} 
                  cols={structuresColumnNames.length} 
                  width={800} 
                  height={400}
                  onDataChange={setStructuresData}
                />
              </div>
            </Tabs.Tab>
            
            <Tabs.Tab eventKey="components" title="Components">
              <div className="spreadsheet-tab-content">
                <Spreadsheet 
                  initialData={componentsData}
                  rowOptions={componentsRowOptions}
                  columnNames={componentsColumnNames}
                  rows={0} 
                  cols={componentsColumnNames.length} 
                  width={800} 
                  height={400}
                  onDataChange={setComponentsData}
                />
              </div>
            </Tabs.Tab>
            
            <Tabs.Tab eventKey="sources" title="Sources">
              <div className="spreadsheet-tab-content">
                <Spreadsheet 
                  initialData={dictListToMatrix(sourcesData, sourcesColumnNames)}
                  rowOptions={sourcesRowOptions}
                  columnNames={sourcesColumnNames}
                  rows={0} 
                  cols={sourcesColumnNames.length} 
                  width={800} 
                  height={400}
                  onDataChange={handleSourcesChange}
                />
              </div>
            </Tabs.Tab>
            
            <Tabs.Tab eventKey="detectors" title="Detectors">
              <div className="spreadsheet-tab-content">
                <Spreadsheet 
                  initialData={dictListToMatrix(detectorsData, detectorsColumnNames)}
                  rowOptions={detectorsRowOptions}
                  columnNames={detectorsColumnNames}
                  rows={0} 
                  cols={detectorsColumnNames.length} 
                  width={800} 
                  height={400}
                  onDataChange={handleDetectorsChange}
                />
              </div>
            </Tabs.Tab>
            
            <Tabs.Tab eventKey="materials" title="Materials">
              <div className="spreadsheet-tab-content">
                <Spreadsheet 
                  initialData={materialsData}
                  rowOptions={materialsRowOptions}
                  columnNames={materialsColumnNames}
                  rows={0} 
                  cols={materialsColumnNames.length} 
                  width={800} 
                  height={400}
                  onDataChange={handleMaterialsChange}
                />
              </div>
            </Tabs.Tab>
            
            <Tabs.Tab eventKey="material_sus" title="Material Susceptibility">
              <div className="spreadsheet-tab-content">
                <Spreadsheet 
                  initialData={materialSusData}
                  rowOptions={materialSusRowOptions}
                  columnNames={materialSusColumnNames}
                  rows={0} 
                  cols={materialSusColumnNames.length} 
                  width={800} 
                  height={400}
                  onDataChange={handleMaterialSusChange}
                />
              </div>
            </Tabs.Tab>
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
                    data={solverOptions}
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