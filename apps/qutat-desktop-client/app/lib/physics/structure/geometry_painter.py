# Copyright (C) 2023 Jaehak Lee
import numpy as np
import time

from PySide6.QtGui import *
from PySide6.QtWidgets import *
from PySide6.QtCore import *

from scipy.spatial.transform import Rotation as R
from PySide6.QtOpenGLWidgets import QOpenGLWidget

from OpenGL.GL import *
from OpenGL.GLU import *
from OpenGL.GLUT import *

import matform as mf

from . import State

class GeometryPainterWidget(QOpenGLWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Structure Preview")
        self.eye = np.array([5.0,5.0,5.0])
        self.setMouseTracking(True)
        self.space_pars = None
        self.geometries = {}
        self.dx = [0.01]*3
        self.cell_size = [1]*3


    def getAspectRatio(self):
        return self.parentWidget().width()/self.parentWidget().height()

    def setEye(self, eye):
        self.eye = eye
        self.update()

    def setViewingAxis(self, axis):
        if axis == "x":
            self.eye = np.array([10.0,0.0,0.0])
        elif axis == "y":
            self.eye = np.array([0.0,10.0,0.0])
        elif axis == "z":
            self.eye = np.array([0.001,0,10.0])
        else:
            self.eye = np.array([10.0,10.0,10.0])
        self.update()


    def mousePressEvent(self,e):
        if (e.buttons() & Qt.RightButton) or (e.buttons() & Qt.LeftButton):
            self.x0 = e.x()
            self.y0 = e.y()

    def mouseMoveEvent(self,e):
        if (e.buttons() & Qt.RightButton) or (e.buttons() & Qt.LeftButton):
            dphi = (e.x()-self.x0)*0.02
            dtheta = (e.y()-self.y0)*0.02
            if (e.buttons() & Qt.RightButton):         
                x = self.eye[0]
                y = self.eye[1]
                z = self.eye[2]
                r = (self.eye[:2]**2).sum()**0.5
                self.eye = R.from_euler('z',dphi).apply(self.eye)
                self.eye = R.from_euler('x',dtheta*y/r).apply(self.eye)
                self.eye = R.from_euler('y',dtheta*x/r).apply(self.eye)
                self.x0 = e.x()
                self.y0 = e.y()
            self.update()

    def wheelEvent(self,e):
        if e.angleDelta().y() > 0:
            self.eye *= 1/1.1
        elif e.angleDelta().y() < 0:
            self.eye *= 1.1
        self.update()

    def paintGL(self):
        glLoadIdentity()
        gluPerspective(5, self.getAspectRatio(), 0.1, 1000.0)
        gluLookAt(self.eye[0],self.eye[1],self.eye[2],
                    0,0,0,
                    0,0,1)
        glEnable(GL_DEPTH_TEST)
        glEnable(GL_BLEND);
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)
        glClearColor(1,1,1,1)
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)

        if self.space_pars != None:
            self.paint_space()
        for name, geometries in self.geometries.items():
            self.paint_geometry(geometries)
        glFlush()

    def screenShot(self, format="PNG"):
        buffer = QBuffer()
        buffer.open(QIODevice.ReadWrite)
        self.grabFramebuffer().save(buffer, format)
        return buffer.data()

    def show_space(self,space_pars):
        self.space_pars = space_pars
        if space_pars is not None:            
            self.dx = mf.parse_vectors(self.space_pars['dx'],3,1)[0]
            self.cell_size = mf.parse_vectors(self.space_pars['cell_size'],3,1)[0]
            self.grid_vertices = getGridVertices(self.cell_size, [dx*10 for dx in self.dx])
        self.update()

    def paint_space(self):
        paintBlockGrid(self.grid_vertices)

    def show_geometry(self, name, geometry_df):
        geometries = []
        for i in range(len(geometry_df)-1,-1,-1):
            unit = geometry_df[i]
            if 'component' not in unit:
                geometries.append(Region(unit,min_sizes=self.dx,max_sizes=self.cell_size))
            elif unit['component']=='sphere':
                geometries.append(Sphere(unit))
            elif unit['component']=='ellipsoid':
                geometries.append(Ellipsoid(unit))
            elif unit['component']=='cone':
                geometries.append(Cone(unit))
            elif unit['component']=='block':
                geometries.append(Block(unit,min_sizes=self.dx,max_sizes=self.cell_size))
            #elif unit['component']=='region_func':
            #    geometries.append(RegionFunc(unit, min_sizes=self.dx))
            elif unit['component']=='so_revol_func':
                geometries.append(SolRevolFunc(unit, min_sizes=self.dx))
            else:
                geometries.append(Region(unit,min_sizes=self.dx,max_sizes=self.cell_size))
        self.geometries[name] = geometries
        self.update()


    def paint_geometry(self, geometries):
        for geometry in geometries:
            geometry.paint()


class Geometry():
    def __init__(self, geo_unit, min_sizes=[],max_sizes=[]):
        self.geo_unit = geo_unit
        self.min_sizes = min_sizes
        self.max_sizes = max_sizes

    def pos(self):
        return mf.parse_vectors(self.geo_unit['position'],3,1)[0]

    def rotation(self):
        if 'rotation' in self.geo_unit:
            return mf.parse_vectors(self.geo_unit['rotation'],4)
        else:
            return []

    def size(self):
        sizes = mf.parse_vectors(self.geo_unit['size'],3,1)[0]
        for i in range(len(self.max_sizes)):
            if sizes[i] > self.max_sizes[i]:
                sizes[i] = self.max_sizes[i] 
            elif sizes[i] < 0:
                sizes[i] = self.max_sizes[i]
        for i in range(len(self.min_sizes)):
            if sizes[i] < self.min_sizes[i]:
                sizes[i] = self.min_sizes[i]
        return sizes
    
    def material(self):
        if 'material' in self.geo_unit:
            return mf.parse_vectors(self.geo_unit['material'],3,1)[0][0]

    def rgba(self):
        if 'color' in self.geo_unit:
            return mf.parse_vectors(self.geo_unit['color'],4,1)[0]
        elif self.material() in State().material_color.keys():
            return State().material_color[self.material()]        
        else:
            return (0.5,0.5,0.5,0.5)

    def props(self):
        if 'props' in self.geo_unit:
            return mf.parse_vectors(self.geo_unit['props'],3,3)
    
    def paint(self):        
        painter = MoveablePainter(self.func_paint)
        #painter.move(self.pos())
        painter.move(self.pos()).rotate_in_seq(self.rotation())
        painter.draw()

    def func_paint(self):
        pass


class Sphere(Geometry):
    def func_paint(self):
        r = self.size()[0]
        paintWithQuad(gluSphere, r, 10, 10, rgba=self.rgba(), style=GL_TRIANGLES)
        paintWithQuad(gluSphere, r, 10, 10)


class Block(Geometry):
    def __init__(self, geo_unit, min_sizes=[],max_sizes=[]):
        super().__init__(geo_unit, min_sizes, max_sizes)
        plane_vertices, line_vertices = getBlockVertices(self.size(), self.props())
        self.plane_vertices = plane_vertices
        self.line_vertices = line_vertices

    def func_paint(self):
        paintBlockPlanes(self.plane_vertices, rgba=self.rgba())
        paintBlockEdges(self.line_vertices)

class Region(Block):
    def props(self):
        return [[1,0,0],[0,1,0],[0,0,1]]


class RotatingHeadGeometry(Geometry):
    def paint(self):
        painter = MoveablePainter(self.func_paint)
        painter.move(self.pos()).rotate_in_seq(self.rotation())
        painter.draw()


class Ellipsoid(RotatingHeadGeometry):
    def paint(self):        
        painter = MoveablePainter(self.func_paint)
        painter.move(self.pos()).rotate_in_seq(self.rotation()).scale(self.size())
        painter.draw()

    def func_paint(self):
        paintWithQuad(gluSphere, 1, 10, 10, rgba=self.rgba(), style=GL_TRIANGLES)
        paintWithQuad(gluSphere, 1, 10, 10)


class Cone(RotatingHeadGeometry):
    def func_paint(self):
        r, r2, h = self.size()
        paintWithQuad(self.paintCone, r, r2, h, rgba=self.rgba(), style=GL_TRIANGLES)
        paintWithQuad(self.paintCone, r, r2, h)

    def paintCone(self, quad, r,r2, h):
        glTranslate(0, 0, -0.5*h)
        gluCylinder(quad, r, r2, h, 12, 1)
        gluDisk(quad, 0, r, 24, 1)
        glTranslate(0, 0, h)
        gluDisk(quad, 0, r2, 24, 1)
        glTranslate(0, 0, -0.5*h)


class SolRevolFunc(Geometry):
    def __init__(self, geo_unit, min_sizes=[],max_sizes=[]):
        super().__init__(geo_unit, min_sizes, max_sizes)

        h = self.size()[0]
        rot_func_str = self.props()[0][0]

        resolution = min_sizes[0]
        n_phi = 24

        size = self.size()
        props = self.props()

        z = np.arange(0,h+resolution,resolution)
        r = np.array(abs(eval(rot_func_str)))
        phi = np.linspace(0,2*np.pi,n_phi+1)
        Rad, Phi = np.meshgrid(r,phi)

        Px = Rad*np.cos(Phi)
        Py = Rad*np.sin(Phi)
        pz = z - 0.5*h

        vertices = []
        for i, pz_i in enumerate(pz):
            i_vertices = []
            for j in range(n_phi+1):
                i_vertices.append([Px[j,i],Py[j,i],pz_i])
            vertices.append(i_vertices)
                
        vertices_2 = []
        for i in range(len(vertices)-1):
            for j in range(n_phi+1):
                for k in range(2):
                    vertices_2.append(vertices[i+k][j])
            
        self.z = z
        self.r = r
        self.vertices = np.array(vertices_2, dtype=np.float32)


    def func_paint(self):
        glColor4f(*self.rgba())

        h = self.size()[0]
        rot_func_str = self.props()[0][0]

        resolution = 0.01
        n_phi = 24

        z = self.z
        r = self.r
        vertices = self.vertices

        # 배열을 바인딩
        glEnableClientState(GL_VERTEX_ARRAY)        
        # 정점 데이터를 GPU에 전달
        glVertexPointer(3, GL_FLOAT, 0, vertices)        
        # 배열을 한 번에 그림 (GL_TRIANGLES, GL_QUADS 등으로 원하는 형태 변경 가능)
        glDrawArrays(GL_QUAD_STRIP, 0, len(vertices))        

        glDisableClientState(GL_VERTEX_ARRAY)


        def paintSides(quad):
            glTranslate(0, 0, z[0]-0.5*h)
            gluDisk(quad, 0, r[0], 24, 1)
            glTranslate(0, 0, h)
            gluDisk(quad, 0, r[-1], 24, 1)
            glTranslate(0, 0, -0.5*h)
        paintWithQuad(paintSides, rgba=self.rgba(), style=GL_TRIANGLES)

'''
class RegionFunc(Geometry):
    def func_paint(self):
        self.drawRegionFunc(self.props())
        vertices = getBlockVertices(self.size(), [[1,0,0],[0,1,0],[0,0,1]])
        paintBlockPlanes(vertices, rgba=self.rgba())
        paintBlockEdges(vertices)

    def drawRegionFunc(self, mat_functions):
        def sin(theta):
            return np.sin(theta)
        def cos(theta):
            return np.cos(theta)
        def exp(x):
            return np.exp(x)

        lx, ly, lz = self.size()

        resolution = max(self.min_sizes[0], (lx*ly*lz)**(1/3)/10)
        pixel_vetices = getBlockVertices([resolution]*3, [[1,0,0],[0,1,0],[0,0,1]])
        def paint_pixel():
            glBegin(GL_TRIANGLES)
            for edge in getBlockPlaneEdges():
                for vertex in edge:
                    glVertex3fv(pixel_vetices[vertex])
            glEnd()

        for x in np.arange(-lx/2,lx/2,resolution):
            for y in np.arange(-ly/2,ly/2,resolution):
                for z in np.arange(-lz/2,lz/2,resolution):
                    for i, mat_func in enumerate(mat_functions):
                        if type(mat_func[0]) == str:
                            if eval(mat_func[0]) < 0:
                                glColor3f(i%2,i%3,i%4)
                                MoveablePainter(paint_pixel).move((x,y,z)).draw()
                    else:
                        pass
'''

class MoveablePainter():
    def __init__(self, *functions):
        self.functions = functions
        self.history = []

    def move(self, pos=(0,0,0)):
        self.history.append(["move",pos])
        if pos != (0,0,0): glTranslate(*pos)
        return self

    def rotate(self, angle=0, axis=(0,0,1)):
        self.history.append(["rotate",angle,axis])
        if angle != 0:
            glRotated(angle,*axis)
        return self

    def rotate_in_seq(self, rotation_list):
        dummy = self
        for rotation in rotation_list[::-1]:
            axis = rotation[:-1]
            angle = rotation[-1]
            dummy = dummy.rotate(angle, axis)
        return self

    def scale(self, scale=(1,1,1)):
        self.history.append(["scale",scale])
        if scale != (1,1,1): glScale(*scale)
        return self

    def draw(self):
        for func in self.functions:
            func()
        self.reset()

    def reset(self):
        for action in self.history[::-1]:
            if action[0] == "move":
                glTranslate(-action[1][0],-action[1][1],-action[1][2])
            elif action[0] == "rotate":
                glRotated(-action[1],*action[2])
            elif action[0] == "scale":
                glScale(1/action[1][0],1/action[1][1],1/action[1][2])
            else:
                pass
        self.history = []



def paintWithQuad(paint_func, *args, rgba=(0,0,0,1), style=GLU_LINE):
    glColor4f(*rgba)    
    quad = gluNewQuadric()
    gluQuadricDrawStyle(quad,style)
    paint_func(quad, *args)
    gluDeleteQuadric(quad)


def getBlockVertices(size, axis):
    dx, dy, dz = size
    a0x, a0y, a0z = (np.array(axis[0])/np.linalg.norm(axis[0]))
    a1x, a1y, a1z = (np.array(axis[1])/np.linalg.norm(axis[1]))
    a2x, a2y, a2z = (np.array(axis[2])/np.linalg.norm(axis[2]))
    points = [((-0.5+int((i%2)))*dx*a0x+(-0.5+int((i%4)/2))*dy*a1x+(-0.5+int((i%8)/4))*dz*a2x,
                (-0.5+int((i%2)))*dx*a0y+(-0.5+int((i%4)/2))*dy*a1y+(-0.5+int((i%8)/4))*dz*a2y,
                (-0.5+int((i%2)))*dx*a0z+(-0.5+int((i%4)/2))*dy*a1z+(-0.5+int((i%8)/4))*dz*a2z) for i in range(8)]

    plane_vertices = []
    for edge in getBlockPlaneEdges():
        for vertex in edge:
            plane_vertices.append(points[vertex])
    
    line_vertices = []
    for edge in getBlockLineEdges():
        for vertex in edge:
            line_vertices.append(points[vertex])

    return plane_vertices, line_vertices


def getGridVertices(size, dx):

    vertices = []
    xWidth, yWidth, zWidth = size
    t = max(xWidth,yWidth,zWidth)

    for i in range(int(xWidth/dx[0])+1):
        x = -0.5*xWidth + i*dx[0]
        for y in [-0.5*yWidth,0.5*yWidth]:
            for z in [-0.5*zWidth,0.5*zWidth]:
                vertices.append((x,max(-0.5*yWidth,y-t),z))
                vertices.append((x,min(0.5*yWidth,y+t),z))
                vertices.append((x,y,max(-0.5*zWidth,z-t)))
                vertices.append((x,y,min(0.5*zWidth,z+t)))

    for i in range(int(yWidth/dx[1])+1):
        y = -0.5*yWidth + i*dx[1]
        for z in [-0.5*zWidth,0.5*zWidth]:
            for x in [-0.5*xWidth,0.5*xWidth]:
                vertices.append((max(-0.5*xWidth,x-t),y,z))
                vertices.append((min(0.5*xWidth,x+t),y,z))
                vertices.append((x,y,max(-0.5*zWidth,z-t)))
                vertices.append((x,y,min(0.5*zWidth,z+t)))

    for i in range(int(zWidth/dx[2])+1):
        z = -0.5*zWidth + i*dx[2]
        for x in [-0.5*xWidth,0.5*xWidth]:
            for y in [-0.5*yWidth,0.5*yWidth]:
                vertices.append((x,max(-0.5*yWidth,y-t),z))
                vertices.append((x,min(0.5*yWidth,y+t),z))
                vertices.append((max(-0.5*xWidth,x-t),y,z))
                vertices.append((min(0.5*xWidth,x+t),y,z))        
    return vertices


def getBlockPlaneEdges():
    return [(0,1,2),(3,2,1),(4,5,6),(7,6,5),
            (4,5,0),(1,0,5),(6,7,2),(3,2,7),
            (6,4,2),(0,2,4),(7,5,3),(1,3,5)]

def getBlockLineEdges():
    return [(0,1),(2,3),(4,5),(6,7),(0,2),(1,3),(4,6),(5,7),(0,4),(1,5),(2,6),(3,7)]

def paintBlockPlanes(vertices, rgba=(0.5,0.5,0.5,0.5)):
    glColor4f(*rgba)    

    glEnableClientState(GL_VERTEX_ARRAY)        
    glVertexPointer(3, GL_FLOAT, 0, vertices)        
    glDrawArrays(GL_TRIANGLES, 0, len(vertices))        
    glDisableClientState(GL_VERTEX_ARRAY)


def paintBlockEdges(vertices, rgba=(0,0,0,1)):        
    glColor4f(*rgba)    

    glEnableClientState(GL_VERTEX_ARRAY)        
    glVertexPointer(3, GL_FLOAT, 0, vertices)        
    glDrawArrays(GL_TRIANGLES, 0, len(vertices))        
    glDisableClientState(GL_VERTEX_ARRAY)


def paintBlockGrid(vertices, rgba=(0,0,0,1)):
    glColor4f(*rgba)    
    glEnableClientState(GL_VERTEX_ARRAY)        
    glVertexPointer(3, GL_FLOAT, 0, vertices)        
    glDrawArrays(GL_LINES, 0, len(vertices))        
    glDisableClientState(GL_VERTEX_ARRAY)
    #glBegin(GL_LINES)
    #for vertex in vertices:
    #    glVertex3fv(vertex)
    #glEnd()








