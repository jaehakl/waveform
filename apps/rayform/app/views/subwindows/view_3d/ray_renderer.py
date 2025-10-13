from __future__ import annotations

from typing import Optional, Tuple

import numpy as np

from PySide6.QtGui import QVector3D
from PySide6.QtOpenGL import (
    QOpenGLBuffer,
    QOpenGLShader,
    QOpenGLShaderProgram,
    QOpenGLVertexArrayObject,
)


GL_FLOAT = 0x1406
GL_LINES = 0x0001
GL_DEPTH_TEST = 0x0B71


class RayRenderer:
    def __init__(self) -> None:
        self._vao: Optional[QOpenGLVertexArrayObject] = None
        self._vbo: Optional[QOpenGLBuffer] = None
        self._shader_program: Optional[QOpenGLShaderProgram] = None
        self._vertex_count: int = 0
        self._vertices_cache: Optional[np.ndarray] = None

    # Lifecycle
    def initialize_gl(self, parent) -> None:
        self._vao = QOpenGLVertexArrayObject(parent)
        self._vao.create()
        self._vbo = QOpenGLBuffer(QOpenGLBuffer.VertexBuffer)
        self._vbo.create()

    def compile_shaders(self, parent) -> None:
        program = QOpenGLShaderProgram(parent)
        line_vertex_source = """
            #version 330 core
            layout(location=0) in vec3 aPos;
            uniform mat4 uMVP;
            void main(){
                gl_Position = uMVP * vec4(aPos, 1.0);
            }
        """
        line_fragment_source = """
            #version 330 core
            out vec4 FragColor;
            uniform vec3 uColor;
            void main(){
                FragColor = vec4(uColor, 1.0);
            }
        """
        if not program.addShaderFromSourceCode(QOpenGLShader.Vertex, line_vertex_source):
            raise RuntimeError(f"Failed to compile line vertex shader: {program.log()}")
        if not program.addShaderFromSourceCode(QOpenGLShader.Fragment, line_fragment_source):
            raise RuntimeError(f"Failed to compile line fragment shader: {program.log()}")
        if not program.link():
            raise RuntimeError(f"Failed to link line shader program: {program.log()}")
        self._shader_program = program

    # Data build/upload
    def refresh_from_workspace(self, app_vm, workspace: str) -> None:
        workspace_data = app_vm.get_workspace_data(workspace)
        if workspace_data is None or not hasattr(workspace_data, "rays"):
            self._vertices_cache = np.zeros((0, 3), dtype=np.float32)
            return

        segments: list[list[float]] = []
        for ray in getattr(workspace_data, "rays", []) or []:
            try:
                o = np.asarray(ray.origin, dtype=np.float32).reshape(3)
                d = np.asarray(ray.direction, dtype=np.float32).reshape(3)
                length = float(getattr(ray, "length", 0.0))
                norm = float(np.linalg.norm(d))
                if norm < 1e-6 or length <= 0.0:
                    continue
                dir_unit = d / norm
                p1 = o
                p2 = o + dir_unit * length
                segments.append(p1.tolist())
                segments.append(p2.tolist())
            except Exception:
                continue

        if not segments:
            self._vertices_cache = np.zeros((0, 3), dtype=np.float32)
            return
        self._vertices_cache = np.asarray(segments, dtype=np.float32)

    def upload_to_gpu(self, parent) -> None:
        if self._vao is None or self._vbo is None or self._shader_program is None:
            self._vertex_count = 0
            return

        vertices = self._vertices_cache
        if vertices is None or vertices.size == 0:
            self._vertex_count = 0
            return

        parent.makeCurrent()
        self._vao.bind()
        self._vbo.bind()
        self._vbo.setUsagePattern(QOpenGLBuffer.DynamicDraw)
        data = vertices.astype(np.float32)
        self._vbo.allocate(data.tobytes(), data.nbytes)

        self._shader_program.bind()
        self._shader_program.enableAttributeArray(0)
        self._shader_program.setAttributeBuffer(0, GL_FLOAT, 0, 3, 0)
        self._shader_program.release()

        self._vao.release()
        self._vbo.release()

        self._vertex_count = int(vertices.shape[0])

    def draw(self, functions, mvp, color: Tuple[float, float, float] = (1.0, 0.0, 0.0)) -> None:
        if self._shader_program is None or self._vao is None or self._vertex_count <= 0:
            return
        
        # 깊이 테스트를 비활성화하여 ray가 geometry 뒤에서도 보이도록 함
        functions.glDisable(GL_DEPTH_TEST)
        
        self._shader_program.bind()
        self._shader_program.setUniformValue("uMVP", mvp)
        self._shader_program.setUniformValue("uColor", QVector3D(*[float(c) for c in color]))
        self._vao.bind()
        try:
            functions.glLineWidth(2)
        except Exception:
            pass
        functions.glDrawArrays(GL_LINES, 0, self._vertex_count)
        self._vao.release()
        self._shader_program.release()
        
        # 깊이 테스트를 다시 활성화
        functions.glEnable(GL_DEPTH_TEST)

    def bounds(self) -> Tuple[np.ndarray, np.ndarray]:
        if self._vertices_cache is None or self._vertices_cache.size == 0:
            z = np.zeros((3,), dtype=np.float32)
            return z.copy(), z.copy()
        return self._vertices_cache.min(axis=0), self._vertices_cache.max(axis=0)

    def cleanup(self, parent) -> None:
        parent.makeCurrent()
        if self._vao is not None:
            self._vao.destroy()
            self._vao = None
        if self._vbo is not None:
            self._vbo.destroy()
            self._vbo = None
        if self._shader_program is not None:
            self._shader_program.release()
            self._shader_program = None
        parent.doneCurrent()


