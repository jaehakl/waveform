from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional, Tuple

import numpy as np
from shiboken6 import VoidPtr

from PySide6.QtCore import Qt, QPoint, QSize, Signal, QSignalBlocker
from PySide6.QtGui import QMatrix4x4, QVector3D, QOpenGLContext
from PySide6.QtOpenGL import (
    QOpenGLBuffer,
    QOpenGLShader,
    QOpenGLShaderProgram,
    QOpenGLVertexArrayObject,
)
from PySide6.QtOpenGLWidgets import QOpenGLWidget
from PySide6.QtWidgets import (
    QMdiSubWindow,
    QVBoxLayout,
    QWidget,
    QPushButton,
    QHBoxLayout,
    QLabel,
    QSlider,
    QDoubleSpinBox,
)

from viewmodels.application import ApplicationViewModel
from models.services.bake_3d_mesh import eval_forest, clean_weld


# --- OpenGL enums -----------------------------------------------------------
GL_COLOR_BUFFER_BIT = 0x00004000
GL_DEPTH_BUFFER_BIT = 0x00000100
GL_DEPTH_TEST = 0x0B71
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


class CGS3DViewer(QOpenGLWidget):
    """Render CGS constructive geometry as shaded OpenGL meshes."""

    mesh_updated = Signal(int, int)
    camera_changed = Signal(float, float, float)

    def __init__(self, app_vm: ApplicationViewModel, workspace: str, parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self._app_vm = app_vm
        self._workspace = workspace

        # GPU objects (created when the GL context becomes available)
        self._vao: Optional[QOpenGLVertexArrayObject] = None
        self._vbo: Optional[QOpenGLBuffer] = None
        self._ibo: Optional[QOpenGLBuffer] = None
        self._shader_program: Optional[QOpenGLShaderProgram] = None
        self._index_count: int = 0

        # Cached mesh state
        self._mesh_data: MeshData = MeshData.empty()
        self._mesh_center = QVector3D(0.0, 0.0, 0.0)
        self._mesh_radius: float = 1.0

        # Camera parameters
        self._camera_distance: float = 6.0
        self._camera_yaw: float = 45.0
        self._camera_pitch: float = 30.0
        self._camera_target = QVector3D(0.0, 0.0, 0.0)
        self._camera_distance_min: float = 0.5
        self._camera_distance_max: float = 250.0

        # Interaction state
        self._wireframe_mode: bool = False
        self._mouse_pressed: bool = False
        self._last_mouse_pos = QPoint()

        # Lighting/material configuration
        self._light_position = QVector3D(2.0, 3.0, 2.0)
        self._eye_position = QVector3D(0.0, 0.0, 6.0)
        self._material_diffuse = QVector3D(0.7, 0.7, 0.7)
        self._material_specular = QVector3D(0.2, 0.2, 0.2)
        self._shininess: float = 32.0

        self.setFocusPolicy(Qt.ClickFocus)

    # -- lifecycle ---------------------------------------------------------
    def initializeGL(self) -> None:
        context = QOpenGLContext.currentContext()
        if context is None:
            return

        self._create_gl_objects()
        self._compile_shaders()
        self.refresh_mesh(upload_only=False)

    def paintGL(self) -> None:
        context = QOpenGLContext.currentContext()
        if context is None:
            return

        functions = context.functions()
        functions.glViewport(0, 0, self.width(), self.height())
        functions.glEnable(GL_DEPTH_TEST)
        functions.glClearColor(0.18, 0.18, 0.18, 1.0)
        functions.glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)

        if self._shader_program is None or self._vao is None or self._mesh_data.is_empty:
            return

        self._shader_program.bind()

        mvp = self._calculate_mvp_matrix()
        model = QMatrix4x4()
        normal = model.normalMatrix()

        self._shader_program.setUniformValue("uMVP", mvp)
        self._shader_program.setUniformValue("uM", model)
        self._shader_program.setUniformValue("uN", normal)
        self._shader_program.setUniformValue("uLight", self._light_position)
        self._shader_program.setUniformValue("uEye", self._eye_position)
        self._shader_program.setUniformValue("kd", self._material_diffuse)
        self._shader_program.setUniformValue("ks", self._material_specular)
        self._set_uniform_float("shininess", self._shininess)
        self._set_uniform_float("uWireframe", 1.0 if self._wireframe_mode else 0.0)

        self._vao.bind()
        functions.glDrawElements(GL_TRIANGLES, self._index_count, GL_UNSIGNED_INT, VoidPtr(0))
        self._vao.release()

        self._shader_program.release()

    def resizeGL(self, width: int, height: int) -> None:
        context = QOpenGLContext.currentContext()
        if context is None:
            return
        context.functions().glViewport(0, 0, width, max(height, 1))

    def sizeHint(self) -> QSize:
        return QSize(800, 600)

    # -- public API --------------------------------------------------------
    def refresh_mesh(self, upload_only: bool = False) -> None:
        if not upload_only:
            self._mesh_data = self._build_mesh_from_workspace()
            self._update_camera_target()

        if (
            self._vao is None
            or self._vbo is None
            or self._ibo is None
            or self._shader_program is None
        ):
            self.mesh_updated.emit(self._mesh_data.vertex_count, self._mesh_data.face_count)
            self.update()
            return

        self._upload_mesh_to_gpu()
        self.mesh_updated.emit(self._mesh_data.vertex_count, self._mesh_data.face_count)
        self.update()

    def set_wireframe_mode(self, enabled: bool) -> None:
        self._wireframe_mode = enabled
        self.update()

    def reset_camera(self) -> None:
        distance = max(3.0, self._mesh_radius * 2.5)
        self._camera_target = self._mesh_center
        previous_yaw = float(self._camera_yaw)
        previous_pitch = float(self._camera_pitch)
        previous_distance = float(self._camera_distance)
        self.set_camera_angles(45.0, 25.0)
        self.set_camera_distance(distance)
        if (
            np.isclose(previous_yaw, 45.0, atol=1e-4)
            and np.isclose(previous_pitch, 25.0, atol=1e-4)
            and np.isclose(previous_distance, distance, atol=1e-4)
        ):
            self._emit_camera_changed()
        self.update()

    def set_workspace(self, workspace: str) -> None:
        if workspace == self._workspace:
            return
        self._workspace = workspace
        self.refresh_mesh(upload_only=False)

    def camera_parameters(self) -> Tuple[float, float, float]:
        return (self._camera_distance, self._camera_yaw, self._camera_pitch)

    def camera_distance_limits(self) -> Tuple[float, float]:
        return (self._camera_distance_min, self._camera_distance_max)

    def set_camera_distance(self, distance: float) -> None:
        distance = float(np.clip(distance, self._camera_distance_min, self._camera_distance_max))
        if np.isclose(distance, self._camera_distance, atol=1e-4):
            return
        self._camera_distance = distance
        self.update()
        self._emit_camera_changed()

    def adjust_camera_distance(self, scale: float) -> None:
        if scale <= 0.0:
            return
        self.set_camera_distance(self._camera_distance * scale)

    def set_camera_angles(self, yaw: float, pitch: float) -> None:
        normalized_yaw = self._normalize_yaw(float(yaw))
        clamped_pitch = float(np.clip(pitch, -85.0, 85.0))
        if (
            np.isclose(normalized_yaw, self._camera_yaw, atol=1e-4)
            and np.isclose(clamped_pitch, self._camera_pitch, atol=1e-4)
        ):
            return
        self._camera_yaw = normalized_yaw
        self._camera_pitch = clamped_pitch
        self.update()
        self._emit_camera_changed()

    def adjust_camera_angles(self, delta_yaw: float, delta_pitch: float) -> None:
        self.set_camera_angles(self._camera_yaw + delta_yaw, self._camera_pitch + delta_pitch)


    def _normalize_yaw(self, yaw: float) -> float:
        wrapped = (float(yaw) + 180.0) % 360.0 - 180.0
        return 180.0 if np.isclose(wrapped, -180.0, atol=1e-4) else wrapped

    def _emit_camera_changed(self) -> None:
        self.camera_changed.emit(self._camera_distance, self._camera_yaw, self._camera_pitch)

    # -- interaction -------------------------------------------------------
    def mousePressEvent(self, event) -> None:
        if event.button() == Qt.LeftButton:
            self._mouse_pressed = True
            self._last_mouse_pos = event.position().toPoint()
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event) -> None:
        if self._mouse_pressed:
            current_pos = event.position().toPoint()
            delta = current_pos - self._last_mouse_pos
            self._last_mouse_pos = current_pos

            self.adjust_camera_angles(delta.x() * 0.3, delta.y() * 0.3)
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event) -> None:
        if event.button() == Qt.LeftButton:
            self._mouse_pressed = False
        super().mouseReleaseEvent(event)

    def wheelEvent(self, event) -> None:
        steps = event.angleDelta().y() / 120.0
        if steps != 0:
            scale = pow(0.9, steps)
            self.adjust_camera_distance(scale)
        super().wheelEvent(event)

    def keyPressEvent(self, event) -> None:
        if event.key() == Qt.Key_R:
            self.reset_camera()
        elif event.key() == Qt.Key_W:
            self.set_wireframe_mode(not self._wireframe_mode)
        elif event.key() == Qt.Key_F:
            self.refresh_mesh(upload_only=False)
        else:
            super().keyPressEvent(event)

    # -- internals ---------------------------------------------------------
    def _create_gl_objects(self) -> None:
        self._vao = QOpenGLVertexArrayObject(self)
        self._vao.create()

        self._vbo = QOpenGLBuffer(QOpenGLBuffer.VertexBuffer)
        self._vbo.create()

        self._ibo = QOpenGLBuffer(QOpenGLBuffer.IndexBuffer)
        self._ibo.create()

    def _compile_shaders(self) -> None:
        program = QOpenGLShaderProgram(self)

        shader_dir = os.path.dirname(__file__)
        vertex_path = os.path.join(shader_dir, "shaders", "vertex.glsl")
        fragment_path = os.path.join(shader_dir, "shaders", "fragment.glsl")

        vertex_source = self._load_shader_source(vertex_path, fallback="""
            #version 330 core
            layout(location=0) in vec3 aPos;
            layout(location=1) in vec3 aNormal;
            uniform mat4 uMVP, uM, uN;
            out vec3 vN;
            out vec3 vPos;
            void main(){
                vPos = (uM * vec4(aPos, 1.0)).xyz;
                vN = mat3(uN) * aNormal;
                gl_Position = uMVP * vec4(aPos, 1.0);
            }
        """)

        fragment_source = self._load_shader_source(fragment_path, fallback="""
            #version 330 core
            in vec3 vN;
            in vec3 vPos;
            out vec4 FragColor;
            uniform vec3 uLight, uEye, kd, ks;
            uniform float shininess;
            uniform float uWireframe;
            void main(){
                if (uWireframe > 0.5){
                    FragColor = vec4(0.9, 0.9, 0.9, 1.0);
                    return;
                }
                vec3 N = normalize(vN);
                vec3 L = normalize(uLight - vPos);
                vec3 V = normalize(uEye - vPos);
                vec3 R = reflect(-L, N);
                float diff = max(dot(N, L), 0.0);
                float spec = pow(max(dot(R, V), 0.0), shininess);
                FragColor = vec4(kd * diff + ks * spec, 1.0);
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

    def _set_uniform_float(self, name: str, value: float) -> None:
        if self._shader_program is None:
            return
        location = self._shader_program.uniformLocation(name)
        if location != -1:
            self._shader_program.setUniformValue(location, float(value))

    def _build_mesh_from_workspace(self) -> MeshData:
        workspace_data = self._app_vm.get_workspace_data(self._workspace)
        if (
            workspace_data is None
            or not workspace_data.cgs_tree
            or len(workspace_data.cgs_tree) == 0
        ):
            return MeshData.empty()

        try:
            cgs_payload = workspace_data.cgs_tree.to_serializable()
            raw_vertices, raw_faces = eval_forest(cgs_payload)
            clean_vertices, clean_faces = clean_weld(raw_vertices, raw_faces)
        except Exception as exc:
            print(f"CGS3DViewer: failed to bake mesh for '{self._workspace}': {exc}")
            return MeshData.empty()

        vertices = np.asarray(clean_vertices, dtype=np.float32)
        faces = np.asarray(clean_faces, dtype=np.uint32)

        if vertices.ndim != 2 or vertices.shape[1] != 3:
            return MeshData.empty()
        if faces.ndim != 2 or faces.shape[1] != 3:
            return MeshData.empty()

        return MeshData(vertices, faces)

    def _upload_mesh_to_gpu(self) -> None:
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

        self.makeCurrent()
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

    def _calculate_mvp_matrix(self) -> QMatrix4x4:
        projection = QMatrix4x4()
        aspect = self.width() / float(max(self.height(), 1))
        projection.perspective(45.0, aspect, 0.1, 1000.0)

        view = QMatrix4x4()
        view.translate(0.0, 0.0, -self._camera_distance)
        view.rotate(self._camera_pitch, 1.0, 0.0, 0.0)
        view.rotate(self._camera_yaw, 0.0, 1.0, 0.0)
        view.translate(-self._camera_target)

        eye_matrix = view.inverted()[0]
        self._eye_position = eye_matrix.map(QVector3D(0.0, 0.0, 0.0))
        self._light_position = QVector3D(self._eye_position)

        return projection * view

    def _update_camera_target(self) -> None:
        bounds_min, bounds_max = self._mesh_data.bounds()
        center = (bounds_min + bounds_max) * 0.5
        radius = float(np.linalg.norm(bounds_max - bounds_min)) * 0.5
        radius = max(radius, 1.0)

        self._mesh_center = QVector3D(float(center[0]), float(center[1]), float(center[2]))
        self._mesh_radius = radius
        self._camera_target = self._mesh_center
        self.set_camera_distance(max(3.0, radius * 2.5))

    def cleanup(self) -> None:
        self.makeCurrent()
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
        self.doneCurrent()

    def closeEvent(self, event) -> None:
        try:
            self.cleanup()
        finally:
            super().closeEvent(event)


class CGS3DViewerWindow(QMdiSubWindow):
    """MDI subwindow wrapper around the CGS3DViewer widget."""

    def __init__(self, app_vm: ApplicationViewModel, workspace: str, parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self._app_vm = app_vm
        self._workspace = workspace

        self._viewer = CGS3DViewer(app_vm, workspace, self)
        self._info_label = QLabel("Vertices: 0 | Faces: 0", self)
        self._wireframe_button = QPushButton("Wireframe", self)
        self._wireframe_button.setCheckable(True)
        self._zoom_slider_scale: int = 100
        self._zoom_slider: Optional[QSlider] = None
        self._yaw_spin: Optional[QDoubleSpinBox] = None
        self._pitch_spin: Optional[QDoubleSpinBox] = None

        self._build_ui()
        self._connect_signals()

        self.setAttribute(Qt.WA_DeleteOnClose)
        self.setWindowTitle(f"3D Viewer - {workspace}")
        self.resize(900, 640)

    def _build_ui(self) -> None:
        container = QWidget(self)
        layout = QVBoxLayout(container)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(4)

        controls = QHBoxLayout()
        controls.setSpacing(6)

        reset_button = QPushButton("Reset Camera", self)
        reset_button.clicked.connect(self._viewer.reset_camera)
        controls.addWidget(reset_button)

        self._wireframe_button.clicked.connect(self._on_toggle_wireframe)
        controls.addWidget(self._wireframe_button)

        refresh_button = QPushButton("Refresh Mesh", self)
        refresh_button.clicked.connect(self._viewer.refresh_mesh)
        controls.addWidget(refresh_button)

        zoom_label = QLabel("Zoom", self)
        controls.addWidget(zoom_label)

        min_dist, max_dist = self._viewer.camera_distance_limits()
        self._zoom_slider = QSlider(Qt.Horizontal, self)
        self._zoom_slider.setRange(
            int(min_dist * self._zoom_slider_scale),
            int(max_dist * self._zoom_slider_scale),
        )
        self._zoom_slider.setPageStep(50)
        self._zoom_slider.setSingleStep(1)
        self._zoom_slider.setFixedWidth(140)
        self._zoom_slider.setToolTip("Zoom in/out")
        self._zoom_slider.valueChanged.connect(self._on_zoom_slider_changed)
        controls.addWidget(self._zoom_slider)

        yaw_label = QLabel("Yaw", self)
        controls.addWidget(yaw_label)

        self._yaw_spin = QDoubleSpinBox(self)
        self._yaw_spin.setRange(-180.0, 180.0)
        self._yaw_spin.setDecimals(1)
        self._yaw_spin.setSingleStep(5.0)
        self._yaw_spin.setToolTip("Horizontal orbit")
        self._yaw_spin.valueChanged.connect(self._on_yaw_spin_changed)
        controls.addWidget(self._yaw_spin)

        pitch_label = QLabel("Pitch", self)
        controls.addWidget(pitch_label)

        self._pitch_spin = QDoubleSpinBox(self)
        self._pitch_spin.setRange(-85.0, 85.0)
        self._pitch_spin.setDecimals(1)
        self._pitch_spin.setSingleStep(5.0)
        self._pitch_spin.setToolTip("Vertical orbit")
        self._pitch_spin.valueChanged.connect(self._on_pitch_spin_changed)
        controls.addWidget(self._pitch_spin)

        controls.addWidget(self._info_label)
        controls.addStretch(1)

        self._sync_camera_controls(*self._viewer.camera_parameters())
        layout.addLayout(controls)
        layout.addWidget(self._viewer)

        self.setWidget(container)

    def _connect_signals(self) -> None:
        self._viewer.mesh_updated.connect(self._update_stats)
        self._viewer.camera_changed.connect(self._on_viewer_camera_changed)
        self._app_vm.cgs_tree_changed.connect(self._on_cgs_tree_changed)

    def _disconnect_signals(self) -> None:
        try:
            self._viewer.mesh_updated.disconnect(self._update_stats)
        except Exception:
            pass
        try:
            self._viewer.camera_changed.disconnect(self._on_viewer_camera_changed)
        except Exception:
            pass
        try:
            self._app_vm.cgs_tree_changed.disconnect(self._on_cgs_tree_changed)
        except Exception:
            pass

    def _update_stats(self, vertices: int, faces: int) -> None:
        self._info_label.setText(f"Vertices: {vertices} | Faces: {faces}")

    def _on_zoom_slider_changed(self, value: int) -> None:
        if self._zoom_slider is None:
            return
        distance = value / float(self._zoom_slider_scale)
        self._viewer.set_camera_distance(distance)

    def _on_yaw_spin_changed(self, value: float) -> None:
        if self._pitch_spin is None:
            return
        self._viewer.set_camera_angles(value, self._pitch_spin.value())

    def _on_pitch_spin_changed(self, value: float) -> None:
        if self._yaw_spin is None:
            return
        self._viewer.set_camera_angles(self._yaw_spin.value(), value)

    def _on_viewer_camera_changed(self, distance: float, yaw: float, pitch: float) -> None:
        self._sync_camera_controls(distance, yaw, pitch)

    def _sync_camera_controls(self, distance: float, yaw: float, pitch: float) -> None:
        if self._zoom_slider is None or self._yaw_spin is None or self._pitch_spin is None:
            return
        slider_value = int(round(distance * self._zoom_slider_scale))
        slider_value = min(max(slider_value, self._zoom_slider.minimum()), self._zoom_slider.maximum())
        with QSignalBlocker(self._zoom_slider):
            self._zoom_slider.setValue(slider_value)
        with QSignalBlocker(self._yaw_spin):
            self._yaw_spin.setValue(yaw)
        with QSignalBlocker(self._pitch_spin):
            self._pitch_spin.setValue(pitch)

    def _on_toggle_wireframe(self) -> None:
        self._viewer.set_wireframe_mode(self._wireframe_button.isChecked())

    def _on_cgs_tree_changed(self, workspace: str, _tree) -> None:
        if workspace != self._workspace:
            return
        self._viewer.refresh_mesh(upload_only=False)

    def set_workspace(self, workspace: str) -> None:
        if workspace == self._workspace:
            return
        self._workspace = workspace
        self.setWindowTitle(f"3D Viewer - {workspace}")
        self._viewer.set_workspace(workspace)
        self._viewer.refresh_mesh(upload_only=False)

    def closeEvent(self, event) -> None:
        self._disconnect_signals()
        super().closeEvent(event)



