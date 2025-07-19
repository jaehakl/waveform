// @ts-nocheck
import * as React from 'react';
import { GeometryPainter } from '../lib/qutat3d/3d/geometry_painter';
import { writeVectors, parseVectors } from '../lib/textExpression';
import { Grid, Checkbox} from 'rsuite';
import { useTheme } from '../contexts/ThemeContext';
import './experiment3D.less';

// 함수형 컴포넌트로 변경하여 useTheme 훅 사용
export function Experiment3D(props) {
  const { id, setupData, width, height } = props;
  const { isDark, isBright, themeMode } = useTheme();
  const [state, setState] = React.useState({
    showStructure: true,
    showSource: true,
    showDetector: true,
  });

  var cell_size = [1,1,1]
  var dx = 0.01

  if (setupData.settings) {
    cell_size = parseVectors(setupData.settings.cell_size)[0]
    dx = setupData.settings.dx
  }

  function posSize(geometry){
    var pos = parseVectors(geometry.position)[0]
    var size = parseVectors(geometry.size)[0]
    for (var i=0; i<3; i++){
      if (size[i] < 0) {
        pos[i] = 0;
        size[i] = cell_size[i]
      }
    }
    return [pos, size]
  }

  // 테마에 따른 색상 설정
  const getThemeColors = () => {
    if (isDark) {
      return {
        source: {
          lineColor: 0xff6b6b,    // 밝은 빨간색
          areaColor: 0xff6b6b
        },
        detector: {
          lineColor: 0x4ecdc4,    // 밝은 청록색
          areaColor: 0x4ecdc4
        },
        structure: {
          lineColor: 0xffffff,    // 흰색 선
          areaColor: 0x404040     // 어두운 회색 영역
        }
      };
    } else {
      return {
        source: {
          lineColor: 0xff4444,    // 진한 빨간색
          areaColor: 0xff4444
        },
        detector: {
          lineColor: 0x00bcd4,    // 진한 청록색
          areaColor: 0x00bcd4
        },
        structure: {
          lineColor: 0x000000,    // 검은색 선
          areaColor: 0xe8eaed     // 밝은 회색 영역
        }
      };
    }
  };

  const themeColors = getThemeColors();
  var geometries = []    
  
  if (setupData.sources) {
    if (state.showSource) {
      setupData.sources.forEach((source, index) => {
        var geometry = {}
        geometry.component = "block"
        var [pos, size] = posSize(source)
        geometry.pos = pos
        geometry.size = size
        geometry.rotations = [],
        geometry.props = [[1,0,0],[0,1,0],[0,0,1]]
        geometry.lineColor = themeColors.source.lineColor
        geometry.areaColor = themeColors.source.areaColor
        geometry.opacity = 0.5
        geometry.paintingLine = true
        geometry.paintingArea = true
        geometries.push(geometry)
      })
    }
  }

  if (setupData.structureEvaluated) {
  setupData.structureEvaluated.forEach((structure, index) => {
      var geometry = {}
      geometry.component = structure.component
      var [pos, size] = posSize(structure)
      geometry.pos = pos
      geometry.size = size
      geometry.rotations = parseVectors(structure.rotation, 4)
      geometry.props = parseVectors(structure.props)
      geometry.lineColor = themeColors.structure.lineColor
      geometry.areaColor = themeColors.structure.areaColor
      geometry.opacity = 0.5
      geometry.paintingLine = true
      geometry.paintingArea = true
      geometries.push(geometry)      
    })
  }
  
  if (setupData.detectors) {
    if (state.showDetector) {
      setupData.detectors.forEach((detector, index) => {
        var geometry = {}
        geometry.component = "block"
        var [pos, size] = posSize(detector)
        geometry.pos = pos
        geometry.size = size  
        geometry.rotations = [],
        geometry.props = [[1,0,0],[0,1,0],[0,0,1]]
        geometry.lineColor = themeColors.detector.lineColor
        geometry.areaColor = themeColors.detector.areaColor
        geometry.opacity = 0.5
        geometry.paintingLine = true
        geometry.paintingArea = true
        geometries.push(geometry)
      })
    }
  }

  // 테마에 따른 배경색 설정
  const getBackgroundColor = () => {
    if (isDark) {
      return 0x1a1a1a; // Dark mode 배경색
    } else {
      return 0xffffff; // Bright mode 배경색
    }
  };

  // 테마별로 다른 렌더링
  if (isDark) {
    // Dark Mode 렌더링
    return (
      <Grid className="experiment-3d">
        <div className="checkbox-controls">
          <Checkbox 
            checked={state.showSource} 
            onChange={()=>{setState({...state, showSource:!state.showSource})}}
            className="checkbox-item"
          /> 
          Source
          <Checkbox 
            checked={state.showDetector} 
            onChange={()=>{setState({...state, showDetector:!state.showDetector})}}
            className="checkbox-item"
          /> 
          Detector
        </div>
        <div className="container" style={{ width: `${width + 20}px` }}>
          <div className="geometry-painter" style={{ width: `${width}px`, height: `${height}px` }}>
            <GeometryPainter id={id} 
              geometries = {geometries}
              backgroundColor = {getBackgroundColor()}
              width={width} height={height}/>
          </div>
        </div>
      </Grid>
    );
  } else {
    // Bright Mode 렌더링
    return (
      <Grid className="experiment-3d">
        <div className="checkbox-controls">
          <Checkbox 
            checked={state.showSource} 
            onChange={()=>{setState({...state, showSource:!state.showSource})}}
            className="checkbox-item"
          /> 
          Source
          <Checkbox 
            checked={state.showDetector} 
            onChange={()=>{setState({...state, showDetector:!state.showDetector})}}
            className="checkbox-item"
          /> 
          Detector
        </div>
        <div className="container" style={{ width: `${width + 20}px` }}>
          <div className="geometry-painter" style={{ width: `${width}px`, height: `${height}px` }}>
            <GeometryPainter id={id} 
              geometries = {geometries}
              backgroundColor = {getBackgroundColor()}
              width={width} height={height}/>
          </div>
        </div>
      </Grid>
    );
  }
}

Experiment3D.defaultProps = {
  width : 320,
  height : 180
}

