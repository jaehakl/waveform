import React, { useState, useEffect } from 'react';
import { Content, Panel, Tabs, Form, Input, InputNumber } from 'rsuite';
import Spreadsheet from './components/Spreadsheet';
import { GeometryPainter } from "./lib/qutat3d/3d/geometry_painter";
import { Experiment3D } from './lib/experiment3D';
import structuresData from '../input_variables/structures.json';
import componentsData from '../input_variables/components.json';
import sourcesData from '../input_variables/sources.json';
import detectorsData from '../input_variables/detectors.json';
import settingsData from '../input_variables/settings.json';
import constantsData from '../input_variables/constants.json';
import { evalStructure } from './lib/structureToGeometry';

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

function SetupEditor() {
  const [activeTab, setActiveTab] = useState('constants');
  
  // 각 탭별 데이터 상태
  const [structuresData, setStructuresData] = useState(structuresInitialData);
  const [componentsData, setComponentsData] = useState(componentsInitialData);
  const [sourcesData, setSourcesData] = useState(matrixToDictList(sourcesInitialData, sourcesColumnNames));
  const [detectorsData, setDetectorsData] = useState(matrixToDictList(detectorsInitialData, detectorsColumnNames));
  const [settingsData, setSettingsData] = useState(settingsInitialData);
  const [constantsData, setConstantsData] = useState(constantsInitialData);
  
  const [structureEvaluated, setStructureEvaluated] = useState([]);

  useEffect(() => {
    const structure = matrixToDictList(structuresData, structuresColumnNames);
    const components = matrixToDictList(componentsData, componentsColumnNames);
    const [entityList, arrayDicts] = evalStructure(structure, components);
    setStructureEvaluated(entityList);
  }, [structuresData, componentsData]);

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

  // 각 탭별 데이터 변경 핸들러
  const handleSourcesChange = (data) => {
    setSourcesData(matrixToDictList(data, sourcesColumnNames));
    // sources 데이터 변경 시 필요한 로직 추가
  };

  const handleDetectorsChange = (data) => {
    setDetectorsData(matrixToDictList(data, detectorsColumnNames));
    // detectors 데이터 변경 시 필요한 로직 추가
  };

  const handleSettingsChange = (formData) => {
    setSettingsData(formData);
    // settings 데이터 변경 시 필요한 로직 추가
  };

  const handleConstantsChange = (formData) => {
    setConstantsData(formData);
    // constants 데이터 변경 시 필요한 로직 추가
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
            style={{ width: '100%' }}
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
            style={{ width: '100%' }}
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
    <Content>
      <Panel header="Setup 편집기">
        <div style={{ marginTop: '20px' }}>
         <h4>3D 지오메트리</h4>
         <Experiment3D id="experiment3D" setupData={{"structureEvaluated" : structureEvaluated, "sources" : sourcesData, "detectors" : detectorsData, "settings" : settingsData, "constants" : constantsData}} width={800} height={500}/>
         </div>
        
        <div style={{ marginBottom: '20px' }}>
          <Tabs activeKey={activeTab} onSelect={setActiveTab}>
            <Tabs.Tab eventKey="constants" title="Constants">
              <div style={{ padding: '20px 0' }}>
                <Form fluid>
                  {Object.keys(constantsKeys).map(key =>            
                    renderFormField(key, constantsKeys[key], constantsData, handleConstantsChange)                  
                  )}
                </Form>
              </div>
            </Tabs.Tab>
            
            <Tabs.Tab eventKey="settings" title="Settings">
              <div style={{ padding: '20px 0' }}>
                <Form fluid>
                  {Object.keys(settingsKeys).map(key =>            
                    renderFormField(key, settingsKeys[key], settingsData, handleSettingsChange)                  
                  )}
                </Form>
              </div>
            </Tabs.Tab>
            
            <Tabs.Tab eventKey="structures" title="Structures">
              <div style={{ padding: '20px 0' }}>
                <Spreadsheet 
                  initialData={structuresInitialData}
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
              <div style={{ padding: '20px 0' }}>
                <Spreadsheet 
                  initialData={componentsInitialData}
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
              <div style={{ padding: '20px 0' }}>
                <Spreadsheet 
                  initialData={sourcesInitialData}
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
              <div style={{ padding: '20px 0' }}>
                <Spreadsheet 
                  initialData={detectorsInitialData}
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
          </Tabs>
        </div>            
      </Panel>          
    </Content>
  );
}

export default SetupEditor; 