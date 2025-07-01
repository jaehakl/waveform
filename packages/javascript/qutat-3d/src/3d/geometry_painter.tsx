// @ts-nocheck
import { isNumber } from 'mathjs';
import * as React from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';

export default class GeometryPainter extends React.Component {

  constructor(props) {
    super(props);  

    this.child = React.createRef();
    this.state = {
      renderer: null,
      camera: null            
    };      
  }

  componentDidMount() {        
    if (!this.child.current.hasChildNodes()) {
      const fov = 100;
      const aspect = 1/1;  // the canvas default
      const near = 0.1;
      const far = 1000;
      const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
      
      camera.position.set(5, 0, 0);
      camera.up.set(0, -1, 0);

      const renderer = new THREE.WebGLRenderer();
      renderer.setSize( this.props.width, this.props.height );    

      this.setState({renderer:renderer, camera:camera});

      const canvas = renderer.domElement
      this.child.current.appendChild(canvas);         

      new OrbitControls(camera, canvas);
    }  
  }

  render(){
    if (typeof document !== "undefined") {

      const scene = new THREE.Scene();  
      scene.background = new THREE.Color(this.props.backgroundColor);

      const { geometries } = this.props;

      geometries.map((unit) => {
        if (unit.component === 'sphere'){
          return new Sphere(scene, unit).paint()
        } else if (unit.component === 'ellipsoid'){
          return new Ellipsoid(scene, unit).paint()
        } else if (unit.component === 'cone'){
          return new Cylinder(scene, unit).paint()
        } else if (unit.component === 'block'){
          return new Block(scene, unit).paint()
        } else if (unit.component === 'line'){
          return new Line(scene, unit).paint()
        } else if (unit.component === 'lens'){
          return new Lens(scene, unit).paint()
        } else {
          return new Block(scene, unit).paint()
        }
      });          
      requestAnimationFrame(()=>{this._update(scene)});
    }      

    return (
        <>
          <div ref={this.child}></div>
        </>
    )
  }


  _update(scene) {
    if (resizeRendererToDisplaySize(this.state.renderer)) {
      const canvas = this.state.renderer.domElement;
      
      this.setState({camera: {...this.state.camera, 
        aspect: canvas.clientWidth / canvas.clientHeight}});

      this.state.camera.updateProjectionMatrix();
    }
    this.state.renderer.render(scene, this.state.camera);
    requestAnimationFrame(()=>{this._update(scene)});
  }

}

function resizeRendererToDisplaySize(renderer) {
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const needResize = canvas.width !== width || canvas.height !== height;
  if (needResize) {
    renderer.setSize(width, height, false);
  }
  return needResize;
}


GeometryPainter.defaultProps = {
  width : 640,
  height : 640,
  backgroundColor : '#456789',
  geometries: [
    {
      component: 'lens',
      pos: [0,0,0],
      size: [2,1,1],
      rotations: [[1,1,1,0]],
      props: [[2,0.5,0.1,0,0,0],[-100,0,0,0,0,0]],
      lineColor: 0x000000,
      areaColor: 0x0000aa,
      opacity: 0.5,
      paintingLine: true,
      paintingArea: true
    },
    {
      component: 'line',
      pos: [0,0,0],
      size: [0,0,1],
      rotations: [[1,1,1,0]],
      props: [],
      lineColor: 0xff0000,
      areaColor: 0x0000aa,
      opacity: 0.5,
      paintingLine: true,
      paintingArea: true
    },
    {
      component: 'line',
      pos: [0.1,0,0],
      size: [-0.1,0,0],
      rotations: [[1,1,1,0]],
      props: [],
      lineColor: 0x000000,
      areaColor: 0x0000aa,
      opacity: 0.5,
      paintingLine: true,
      paintingArea: true
    }
  ],

}


class Geometry {
  constructor(scene, unit){
    this.scene = scene
    this.pos = unit.pos
    this.size = unit.size
    this.rotations = unit.rotations
    this.props = unit.props
    this.lineColor = unit.lineColor //0x000000
    this.areaColor = unit.areaColor //0x0000ff
    this.opacity = unit.opacity //0.5
    this.paintingLine = unit.paintingLine //false
    this.paintingArea = unit.paintingArea //true
  }

  paint(){
    if (this.paintingArea){    
      var area_texture = new THREE.MeshBasicMaterial( { color: this.areaColor } );
      area_texture.transparent = true
      area_texture.opacity = this.opacity
      this.addMesh(this.geometry(), area_texture , this.pos, this.rotations)
    }
    if (this.paintingLine){
      var line_texture = new THREE.MeshBasicMaterial( { color: this.lineColor, wireframe:true} );
      this.addMesh(this.geometry(), line_texture , this.pos, this.rotations)
    }
  }

  rotateMesh(mesh, rotations){
    rotations.map((rotation)=>{
      let norm_rot_axis = (rotation[0]**2+rotation[1]**2+rotation[2]**2)**0.5
      let rot_angle = rotation[3]      
      if (rot_angle !== 'undefined' && norm_rot_axis !== 0){
        mesh.rotateOnAxis(new THREE.Vector3(rotation[0]/norm_rot_axis,rotation[1]/norm_rot_axis,rotation[2]/norm_rot_axis), rot_angle*Math.PI/180)
      }
      return 0
    })
  }

  geometry(){
    //const [ r, r2, h ] = this.size
    //return new THREE.CylinderGeometry(r, r, h, 32);
  }

  addMesh(geometry, texture , pos, rotations){
    var mesh = new THREE.Mesh(geometry, texture );
    mesh.position.set(pos[0],pos[1],pos[2])
    this.rotateMesh(mesh, [[1,0,0,90]])    
    this.rotateMesh(mesh, rotations)
    this.scene.add(mesh);  
  }
}


class Sphere extends Geometry {
  geometry(){
    const [ r ] = this.size
    return new THREE.SphereGeometry(r, 32);
  }
}


class Cylinder extends Geometry {
  geometry(){
    var [ r, r2, h ] = this.size
    if ( !isNumber(r2) ){
      r2 = r
    }
    return new THREE.CylinderGeometry(r2, r, h, 32);
  }

  addMesh(geometry, texture , pos, rotations){
    const mesh = new THREE.Mesh(geometry, texture);
    this.rotateMesh(mesh, rotations)
    this.rotateMesh(mesh, [[1,0,0,90]])
    mesh.position.set(pos[0],pos[1],pos[2])

    this.scene.add(mesh);  
  }
}



class Ellipsoid extends Geometry {
  geometry(){
    const [ a, b, c ] = this.size
    const geometry = new THREE.SphereGeometry(1.0, 32);
    geometry.scale(a,b,c)
    return geometry
  }
}

class Block extends Geometry {
  vertices(){
    const [ a, b, c ] = this.size
    const [ x1, y1, z1 ] = this.props[0]
    const [ x2, y2, z2 ] = this.props[1]
    const [ x3, y3, z3 ] = this.props[2]
  
    const a1x = x1/(x1**2+y1**2+z1**2)**0.5
    const a1y = y1/(x1**2+y1**2+z1**2)**0.5
    const a1z = z1/(x1**2+y1**2+z1**2)**0.5
    const a2x = x2/(x2**2+y2**2+z2**2)**0.5
    const a2y = y2/(x2**2+y2**2+z2**2)**0.5
    const a2z = z2/(x2**2+y2**2+z2**2)**0.5
    const a3x = x3/(x3**2+y3**2+z3**2)**0.5
    const a3y = y3/(x3**2+y3**2+z3**2)**0.5
    const a3z = z3/(x3**2+y3**2+z3**2)**0.5
    
    const vertices = {}
    for (let i = 0; i < 8; i++) {
      vertices[i] = [
        (-0.5+Math.floor((i%2)))*a*a1x+(-0.5+Math.floor((i%4)/2))*b*a2x+(-0.5+Math.floor((i%8)/4))*c*a3x,
        (-0.5+Math.floor((i%2)))*a*a1y+(-0.5+Math.floor((i%4)/2))*b*a2y+(-0.5+Math.floor((i%8)/4))*c*a3y,
        (-0.5+Math.floor((i%2)))*a*a1z+(-0.5+Math.floor((i%4)/2))*b*a2z+(-0.5+Math.floor((i%8)/4))*c*a3z
      ]
    }
    return vertices
  }

  geometry_triangle(){
    var vertices = this.vertices()
    var edges = [[0,1,2],[3,2,1],[4,6,5],[7,5,6],
    [4,5,0],[1,0,5],[6,2,7],[3,7,2],
    [6,4,2],[0,2,4],[7,3,5],[1,5,3]]
    var points = [];
    for (let i = 0; i < 12; i++) {
      points.push(new THREE.Vector3(vertices[edges[i][0]][0],vertices[edges[i][0]][1],vertices[edges[i][0]][2]))
      points.push(new THREE.Vector3(vertices[edges[i][1]][0],vertices[edges[i][1]][1],vertices[edges[i][1]][2]))
      points.push(new THREE.Vector3(vertices[edges[i][2]][0],vertices[edges[i][2]][1],vertices[edges[i][2]][2]))
    }
    var geometry = new THREE.BufferGeometry().setFromPoints( points );
    return geometry
  }

  paint(){
    const pos = this.pos
    if (this.paintingArea) {
      var texture = new THREE.MeshBasicMaterial( { color: this.areaColor } );
      texture.transparent = true
      texture.opacity = this.opacity
      var area_mesh = new THREE.Mesh( this.geometry_triangle(), texture );
      this.rotateMesh(area_mesh, this.rotations)
      area_mesh.position.set(pos[0],pos[1],pos[2])
      this.scene.add( area_mesh );  
    }

    if (this.paintingLine){
      var vertices = this.vertices()
      var edges = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]]
      texture = new THREE.MeshBasicMaterial( { color: this.lineColor } );    
      for (let i = 0; i < 12; i++) {
        var points = [];
        points.push(new THREE.Vector3(vertices[edges[i][0]][0],vertices[edges[i][0]][1],vertices[edges[i][0]][2]))
        points.push(new THREE.Vector3(vertices[edges[i][1]][0],vertices[edges[i][1]][1],vertices[edges[i][1]][2]))
        var geometry = new THREE.BufferGeometry().setFromPoints( points );
        var line_mesh = new THREE.Line( geometry, texture );
        this.rotateMesh(line_mesh, this.rotations)
        line_mesh.position.set(pos[0],pos[1],pos[2])
        this.scene.add( line_mesh );  
      }  
    }
  }
}

class Lens extends Geometry {

  lens_height(r_aperture, R, K, a4, a6, a8, a10){
    var r = r_aperture
    var z = r**2/(R*(1+(1-(1+K)*(r/R)**2)**0.5))
    z = z + a4*r**4 + a6*r**6 + a8*r**8 + a10*r**10
    return z
  }

  asphere_z(R, K, a4, a6, a8, a10, x, y){
    var rsqr = x**2+y**2
    var r = rsqr**0.5
    var z = rsqr/(R*(1+(1-(1+K)*(r/R)**2)**0.5))
    z = z + a4*r**4 + a6*r**6 + a8*r**8 + a10*r**10
    return z
  }




  
  asphere_surface(direction, n_r, n_theta, z_offset, r_aperture, R, K, a4, a6, a8, a10){
    var vertices = []
    for (let i = 0; i < n_r; i++) {
      vertices.push([])
      for (let j = 0; j < n_theta; j++) {
        let theta = 2*Math.PI*j/n_theta
        let r = r_aperture*(1-i/n_r)
        let x = r*Math.cos(theta)
        let y = r*Math.sin(theta)
        let z = this.asphere_z(R, K, a4, a6, a8, a10, x, y)+z_offset
        vertices[i].push([x,y,z])
      }
    }

    var points = [];
    for (let i = 0; i < n_r-1; i++) {
      for (let j = 0; j < n_theta; j++) {
        if (direction === 1){
            points.push(new THREE.Vector3(...vertices[i+1][j]))
            points.push(new THREE.Vector3(...vertices[i][j]))
            points.push(new THREE.Vector3(...vertices[i][(j+1)%n_theta]))
            points.push(new THREE.Vector3(...vertices[i+1][j]))
            points.push(new THREE.Vector3(...vertices[i][(j+1)%n_theta]))
            points.push(new THREE.Vector3(...vertices[i+1][(j+1)%n_theta]))
        } else {
            points.push(new THREE.Vector3(...vertices[i+1][j]))
            points.push(new THREE.Vector3(...vertices[i][(j+1)%n_theta]))
            points.push(new THREE.Vector3(...vertices[i][j]))
            points.push(new THREE.Vector3(...vertices[i+1][j]))
            points.push(new THREE.Vector3(...vertices[i+1][(j+1)%n_theta]))
            points.push(new THREE.Vector3(...vertices[i][(j+1)%n_theta]))
        }
     }
    }
    for (let j = 0; j < n_theta; j++) {  
      if (direction === 1) {
        points.push(new THREE.Vector3(0,0,z_offset))
        points.push(new THREE.Vector3(...vertices[n_r-1][j]))
        points.push(new THREE.Vector3(...vertices[n_r-1][(j+1)%n_theta]))
      } else {
        points.push(new THREE.Vector3(0,0,z_offset))
        points.push(new THREE.Vector3(...vertices[n_r-1][(j+1)%n_theta]))
        points.push(new THREE.Vector3(...vertices[n_r-1][j]))
      }
    }
    return points
  }


  cylinder(n_theta, z_offset, r0, r1, h){
    var vertices = []
    for (let i = 0; i < 2; i++) {
      vertices.push([])
      for (let j = 0; j < n_theta; j++) {
        let theta = 2*Math.PI*j/n_theta
        let x = (r0+(r1-r0)*i)*Math.cos(theta)
        let y = (r0+(r1-r0)*i)*Math.sin(theta)
        vertices[i].push([x,y,z_offset+h*i])
      }
    }

    var points = [];
    for (let i = 0; i < 1; i++) {
      for (let j = 0; j < n_theta; j++) {
            points.push(new THREE.Vector3(...vertices[i+1][j]))
            points.push(new THREE.Vector3(...vertices[i][j]))
            points.push(new THREE.Vector3(...vertices[i][(j+1)%n_theta]))
            points.push(new THREE.Vector3(...vertices[i+1][j]))
            points.push(new THREE.Vector3(...vertices[i][(j+1)%n_theta]))
            points.push(new THREE.Vector3(...vertices[i+1][(j+1)%n_theta]))
        }
    }
    return points
  }

  paint(){
    var pos = this.pos
    var [ r0, r1, h ] = this.size
    var n_r = 16
    var n_theta = 16

    var texture = new THREE.MeshBasicMaterial( { color: this.areaColor } );
    texture.transparent = true
    texture.opacity = this.opacity

    var lens_height_0 = this.lens_height(r0,...this.props[0])
    var points_0 = this.asphere_surface(-1, n_r, n_theta, -lens_height_0, r0, ...this.props[0])

    var lens_height_1 = this.lens_height(r1,...this.props[1])
    var points_1 = this.asphere_surface(1, n_r, n_theta, h-lens_height_1, r1, ...this.props[1])
    var points_h = this.cylinder(n_theta, 0, r0, r1, h)

    var points = points_0.concat(points_h).concat(points_1)

    var geometry = new THREE.BufferGeometry().setFromPoints( points );
    var area_mesh = new THREE.Mesh( geometry, texture );  
    this.rotateMesh(area_mesh, this.rotations)
    area_mesh.position.set(pos[0],pos[1],pos[2])
    this.scene.add( area_mesh );
  }

}


class Line extends Geometry {
  geometry(){
    const [ x0, y0, z0 ] = this.pos
    const [ xl, yl, zl ] = this.size
    const points = [];
    points.push(new THREE.Vector3(x0,y0,z0))
    points.push(new THREE.Vector3(x0+xl,y0+yl,z0+zl))    

    var geometry = new THREE.BufferGeometry().setFromPoints( points );

    var line_texture = new THREE.MeshBasicMaterial( { color: this.lineColor } );
    var line_mesh = new THREE.Line( geometry, line_texture );
    this.rotateMesh(line_mesh, this.rotations)
    //line_mesh.position.set(x0, y0, z0)
    this.scene.add( line_mesh );  

  }
}

