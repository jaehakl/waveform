from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional, Tuple
from shiboken6 import VoidPtr

import numpy as np

from PySide6.QtGui import QMatrix4x4
from PySide6.QtOpenGL import (
    QOpenGLBuffer,
    QOpenGLShader,
    QOpenGLShaderProgram,
    QOpenGLVertexArrayObject,
)

from views.utils.cgs_to_mesh import eval_forest, clean_weld


# OpenGL enums
GL_TRIANGLES = 0x0004
GL_UNSIGNED_INT = 0x1405
GL_FLOAT = 0x1406


@dataclass
class MeshData:
    vertices: np.ndarray
    faces: np.ndarray

    @classmethod
    def empty(cls) -> "MeshData":
        return cls(
            np.zeros((0, 3), dtype=np.float32),
            np.zeros((0, 3), dtype=np.uint32),
        )

    @property
    def vertex_count(self) -> int:
        return int(self.vertices.shape[0])

    @property
    def face_count(self) -> int:
        return int(self.faces.shape[0])

    @property
    def is_empty(self) -> bool:
        return self.vertex_count == 0 or self.face_count == 0

    def bounds(self) -> Tuple[np.ndarray, np.ndarray]:
        if self.is_empty:
            return (
                np.array([-1.0, -1.0, -1.0], dtype=np.float32),
                np.array([1.0, 1.0, 1.0], dtype=np.float32),
            )
        return self.vertices.min(axis=0), self.vertices.max(axis=0)


class GeometryRenderer:
    def __init__(self) -> None:
        self._vao: Optional[QOpenGLVertexArrayObject] = None
        self._vbo: Optional[QOpenGLBuffer] = None
        self._ibo: Optional[QOpenGLBuffer] = None
        self._shader_program: Optional[QOpenGLShaderProgram] = None
        self._index_count: int = 0
        self._mesh_data: MeshData = MeshData.empty()

    # Lifecycle
    def initialize_gl(self, parent) -> None:
        self._vao = QOpenGLVertexArrayObject(parent)
        self._vao.create()
        self._vbo = QOpenGLBuffer(QOpenGLBuffer.VertexBuffer)
        self._vbo.create()
        self._ibo = QOpenGLBuffer(QOpenGLBuffer.IndexBuffer)
        self._ibo.create()

    def compile_shaders(self, parent) -> None:
        program = QOpenGLShaderProgram(parent)

        shader_dir = os.path.dirname(__file__)
        vertex_path = os.path.join(shader_dir, "shaders", "vertex.glsl")
        fragment_path = os.path.join(shader_dir, "shaders", "fragment.glsl")

        vertex_source = self._load_shader_source(vertex_path, fallback="""
            #version 330 core
            layout(location=0) in vec3 aPos;
            layout(location=1) in vec3 aNormal;
            uniform mat4 uMVP;
            uniform mat4 uM;
            uniform mat3 uN;
            out vec3 vN;
            out vec3 vPos;
            void main(){
                vPos = (uM * vec4(aPos, 1.0)).xyz;
                vN = normalize(uN * aNormal);
                gl_Position = uMVP * vec4(aPos, 1.0);
            }
        """)

        fragment_source = self._load_shader_source(fragment_path, fallback="""
            #version 330 core
            in vec3 vN;
            in vec3 vPos;
            out vec4 FragColor;
            uniform vec3 uLight, uEye, ka, kd, ks;
            uniform float shininess;
            uniform float uWireframe;
            void main(){
                if (uWireframe > 0.5){
                    FragColor = vec4(0.1, 0.1, 0.5, 0.35);
                    return;
                }
                vec3 N = normalize(vN);
                vec3 L = normalize(uLight - vPos);
                float diff = max(dot(N, L), 0.0);
                vec3 V = normalize(uEye - vPos);
                vec3 R = reflect(-L, N);
                float spec = diff > 0.0 ? pow(max(dot(R, V), 0.1), shininess) : 0.0;
                vec3 ambient = ka;
                vec3 color = ambient + kd * diff + ks * spec;
                FragColor = vec4(color, 0.35);
            }
        """)

        if not program.addShaderFromSourceCode(QOpenGLShader.Vertex, vertex_source):
            raise RuntimeError(f"Failed to compile vertex shader: {program.log()}")
        if not program.addShaderFromSourceCode(QOpenGLShader.Fragment, fragment_source):
            raise RuntimeError(f"Failed to compile fragment shader: {program.log()}")
        if not program.link():
            raise RuntimeError(f"Failed to link shader program: {program.log()}")

        self._shader_program = program

    def _load_shader_source(self, path: str, fallback: str) -> str:
        try:
            with open(path, "r", encoding="utf-8") as handle:
                return handle.read()
        except FileNotFoundError:
            return fallback

    # Data build/upload
    def refresh_from_workspace(self, app_vm, workspace: str) -> None:
        workspace_data = app_vm.get_workspace_data(workspace)
        if (
            workspace_data is None
            or not workspace_data.cgs_tree
            or len(workspace_data.cgs_tree) == 0
        ):
            self._mesh_data = MeshData.empty()
            return

        try:
            cgs_payload = workspace_data.cgs_tree
            raw_vertices, raw_faces = eval_forest(cgs_payload)
            clean_vertices, clean_faces = clean_weld(raw_vertices, raw_faces)
        except Exception:
            self._mesh_data = MeshData.empty()
            return

        vertices = np.asarray(clean_vertices, dtype=np.float32)
        faces = np.asarray(clean_faces, dtype=np.uint32)

        if vertices.ndim != 2 or vertices.shape[1] != 3:
            self._mesh_data = MeshData.empty()
            return
        if faces.ndim != 2 or faces.shape[1] != 3:
            self._mesh_data = MeshData.empty()
            return

        self._mesh_data = MeshData(vertices, faces)

    def upload_to_gpu(self, parent) -> None:
        if (
            self._mesh_data.is_empty
            or self._vao is None
            or self._vbo is None
            or self._ibo is None
            or self._shader_program is None
        ):
            self._index_count = 0
            return

        vertices = self._mesh_data.vertices
        faces = self._mesh_data.faces.astype(np.uint32)

        normals = self._compute_vertex_normals(vertices, faces)
        interleaved = np.hstack((vertices, normals)).astype(np.float32)
        stride = interleaved.shape[1] * 4

        parent.makeCurrent()
        self._vao.bind()

        self._vbo.bind()
        self._vbo.setUsagePattern(QOpenGLBuffer.StaticDraw)
        self._vbo.allocate(interleaved.tobytes(), interleaved.nbytes)

        self._ibo.bind()
        indices = faces.reshape(-1)
        self._ibo.setUsagePattern(QOpenGLBuffer.StaticDraw)
        self._ibo.allocate(indices.tobytes(), indices.nbytes)

        self._shader_program.bind()
        self._shader_program.enableAttributeArray(0)
        self._shader_program.setAttributeBuffer(0, GL_FLOAT, 0, 3, stride)
        self._shader_program.enableAttributeArray(1)
        self._shader_program.setAttributeBuffer(1, GL_FLOAT, 12, 3, stride)
        self._shader_program.release()

        self._vao.release()
        self._vbo.release()
        self._ibo.release()

        self._index_count = int(indices.size)

    def draw(self, functions, mvp, light, eye, ka, kd, ks, shininess: float, wireframe: bool) -> None:
        if self._shader_program is None or self._vao is None or self._mesh_data.is_empty:
            return

        self._shader_program.bind()

        model = QMatrix4x4()
        normal = model.normalMatrix()

        self._shader_program.setUniformValue("uMVP", mvp)
        self._shader_program.setUniformValue("uM", model)
        self._shader_program.setUniformValue("uN", normal)
        self._shader_program.setUniformValue("uLight", light)
        self._shader_program.setUniformValue("uEye", eye)
        self._shader_program.setUniformValue("ka", ka)
        self._shader_program.setUniformValue("kd", kd)
        self._shader_program.setUniformValue("ks", ks)
        self._set_uniform_float("shininess", float(shininess))
        self._set_uniform_float("uWireframe", 1.0 if wireframe else 0.0)

        self._vao.bind()
        functions.glDrawElements(GL_TRIANGLES, self._index_count, GL_UNSIGNED_INT, VoidPtr(0))
        self._vao.release()

        self._shader_program.release()

    def _set_uniform_float(self, name: str, value: float) -> None:
        if self._shader_program is None:
            return
        location = self._shader_program.uniformLocation(name)
        if location != -1:
            self._shader_program.setUniformValue(location, float(value))

    def _compute_vertex_normals(self, vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
        normals = np.zeros_like(vertices, dtype=np.float32)
        for tri in faces:
            v0, v1, v2 = vertices[tri]
            edge1 = v1 - v0
            edge2 = v2 - v0
            face_normal = np.cross(edge1, edge2)
            length = np.linalg.norm(face_normal)
            if length > 1e-6:
                face_normal /= length
            normals[tri] += face_normal

        lengths = np.linalg.norm(normals, axis=1)
        lengths[lengths < 1e-6] = 1.0
        normals /= lengths[:, np.newaxis]
        return normals

    # Queries
    def mesh_counts(self) -> tuple[int, int]:
        return (self._mesh_data.vertex_count, self._mesh_data.face_count)

    def bounds(self) -> Tuple[np.ndarray, np.ndarray]:
        return self._mesh_data.bounds()

    # Cleanup
    def cleanup(self, parent) -> None:
        parent.makeCurrent()
        if self._vao is not None:
            self._vao.destroy()
            self._vao = None
        if self._vbo is not None:
            self._vbo.destroy()
            self._vbo = None
        if self._ibo is not None:
            self._ibo.destroy()
            self._ibo = None
        if self._shader_program is not None:
            self._shader_program.release()
            self._shader_program = None
        parent.doneCurrent()


