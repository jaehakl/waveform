// @ts-nocheck
import * as React from 'react';
import GeometryPainter from 'lib/qutat3d/3d/geometry_painter';
//import { GeometryPainter } from 'qutat-3d';
import { writeVectors, parseVectors } from 'core/dataType/textExpression';
//import { GeometryPainter } from 'qutat-3d/3d/geometry_painter';
import { Grid, Checkbox} from '@mui/material';
import materialColorLib from '/../data/material_color.json' assert { type: "json" };

export class Experiment3D extends React.Component {

  render(){
    const { id, setupData, width, height } = this.props
    
    const cell_size = parseVectors(setupData._settings.cell_size)[0]
    const dx = setupData._settings.dx

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


    var geometries = []    

    if (this.state.showSource) {
      setupData.sources.forEach((source, index) => {
        var geometry = {}
        geometry.component = "block"
        var [pos, size] = posSize(source)
        geometry.pos = pos
        geometry.size = size
        geometry.rotations = [],
        geometry.props = [[1,0,0],[0,1,0],[0,0,1]]
        geometry.lineColor = 0xff0000
        geometry.areaColor = 0xff0000
        geometry.opacity = 0.5
        geometry.paintingLine = true
        geometry.paintingArea = true
        geometries.push(geometry)
      })
    }


    setupData.structure_evaluated.forEach((structure, index) => {
      var geometry = {}
      geometry.component = structure.component
      var [pos, size] = posSize(structure)
      geometry.pos = pos
      geometry.size = size
      geometry.rotations = parseVectors(structure.rotation, 4)
      geometry.props = parseVectors(structure.props)
      geometry.lineColor = 0x999999
      geometry.areaColor = 0x999999
      geometry.opacity = 0.5
      geometry.paintingLine = true
      geometry.paintingArea = true
      geometries.push(geometry)      
    })

    if (this.state.showDetector) {

      setupData.detectors.forEach((detector, index) => {
        var geometry = {}
        geometry.component = "block"
        var [pos, size] = posSize(detector)
        geometry.pos = pos
        geometry.size = size  
        geometry.rotations = [],
        geometry.props = [[1,0,0],[0,1,0],[0,0,1]]
        geometry.lineColor = 0x00ffff
        geometry.areaColor = 0x00ffff
        geometry.opacity = 0.5
        geometry.paintingLine = true
        geometry.paintingArea = true
        geometries.push(geometry)
      })
    }

    return (
      <Grid>
        <Checkbox checked={this.state.showSource} 
          onChange={(event)=>{this.setState({showSource:event.target.checked})}}/> Source
        <Checkbox checked={this.state.showDetector} 
          onChange={(event)=>{this.setState({showDetector:event.target.checked})}}/> Detector
        <GeometryPainter id={id} 
          geometries = {geometries}
          backgroundColor = {0xffffff}
          width={width} height={height}/>
      </Grid>
    )
  }

  
  constructor(props) {
    super(props);
    this.state = {
      showStructure: true,
      showSource: true,
      showDetector: true,
    };      
  }
}

Experiment3D.defaultProps = {
  width : 320,
  height : 180
}

