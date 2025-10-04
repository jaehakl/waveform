import numpy as np
import trimesh

# ---------------------------
# Utilities
# ---------------------------

def _revolve(profile_xy, angle=2*np.pi, sections=128, **kwargs):
    """
    profile_xy: (N, 2) array-like, columns = [radius (x), height (y=z)]
    angle: revolved angle (default 2π)
    sections: azimuthal samples
    """
    profile_xy = np.asanyarray(profile_xy, dtype=float)
    mesh = trimesh.creation.revolve(profile_xy, angle=angle, sections=sections)
    # revolve는 Trimesh를 반환
    return mesh

# ---------------------------
# 1) Paraboloid (컷된 회전체)
# ---------------------------

def create_paraboloid(
    focus_z: float,
    max_radius: float,
    max_height: float,
    n_profile: int = 50,
    sections: int = 32,
    cap: bool = True,
):
    """
    컷된 포물면 (회전축 z).
    포물선: z = r^2 / (4f)  (f = focus_z > 0)
    컷 조건: r <= max_radius, z <= max_height

    cap=True 이면, 림(r_lim, z_lim) -> (0, z_lim) 수평선분을 추가하고 revolve하여
    한 번에 디스크(뚜껑)까지 생성합니다.
    """
    if focus_z <= 0:
        raise ValueError("focus_z(초점 z)는 양수여야 합니다.")

    # r, z 컷 경계 일관화
    r_by_h = np.sqrt(4.0 * focus_z * max_height)
    r_lim = min(max_radius, r_by_h)
    z_lim = min(max_height, (r_lim ** 2) / (4.0 * focus_z))

    # 0 -> z_lim 까지 포물선 프로파일 (r(z) = sqrt(4 f z))
    z = np.linspace(0.0, z_lim, n_profile)
    r = np.sqrt(4.0 * focus_z * z)

    # 기본 프로파일: (r(z), z)
    profile = np.column_stack([r, z])

    if cap:
        # 림에서 축까지 수평선 하나 추가: (r_lim, z_lim) -> (0, z_lim)
        # 이 선분이 회전하며 디스크(뚜껑)를 형성
        profile = np.vstack([profile, [0.0, z_lim]])

    # 회전
    mesh = trimesh.creation.revolve(profile, angle=2*np.pi, sections=sections)

    # (선택) 경계/노멀 정리
    # trimesh.repair.fix_normals(mesh)
    # mesh.remove_degenerate_faces()

    return mesh


# ---------------------------
# 2) Ellipsoid of revolution (prolate/oblate)
# ---------------------------

def create_ellipsoid(F1_z, F2_z, minor_axis_length, subdivisions=4):
    """
    회전타원체(이심축 및 회전축: z), '볼륨-세이프' 구현.
    입력:
      - F1_z, F2_z: 두 초점의 z 좌표
      - minor_axis_length: 단축의 전체 길이(= 2b)  -> b = minor_axis_length/2
    구성:
      중심 zc = (F1_z + F2_z)/2
      초점거리 c = |F2_z - F1_z|/2
      b = minor_axis_length/2   (x,y 반지름)
      a = sqrt(b^2 + c^2)       (z 반지름)
    구현:
      1) icosphere 생성(폴 없음, 균일 삼각망)
      2) [b, b, a] 비등방 스케일 + zc 평행이동
      3) 리페어 루틴으로 볼륨/노멀 정리
    반환: trimesh.Trimesh (watertight volume)
    """
    b = float(minor_axis_length) / 2.0
    if b <= 0:
        raise ValueError("minor_axis_length(단축 길이)는 양수여야 합니다.")

    zc = 0.5 * (F1_z + F2_z)
    c  = 0.5 * abs(F2_z - F1_z)
    a  = float(np.sqrt(b*b + c*c))

    # 1) 폴이 없는 icosphere
    mesh = trimesh.creation.icosphere(subdivisions=subdivisions, radius=1.0)

    # 2) 비등방 스케일 후 평행이동 (먼저 스케일, 다음 평행이동)
    S = np.eye(4); S[0,0], S[1,1], S[2,2] = b, b, a
    T = np.eye(4); T[:3, 3] = [0.0, 0.0, zc]
    mesh.apply_transform(T @ S)

    # 3) 리페어: 노멀/중복/퇴화 정리 -> 볼륨 보장 강화
    mesh.remove_duplicate_faces()
    mesh.remove_degenerate_faces()
    mesh.merge_vertices()
    trimesh.repair.fix_normals(mesh)

    # (선택) 마지막 안전장치: 매우 극단적인 종횡비에선 분할을 올리면 유리
    if not mesh.is_volume:
        # subdivisions를 높이라고 메시지 남김
        raise RuntimeError("Ellipsoid is not recognized as a volume. "
                           "Try increasing 'subdivisions' (e.g., 5~6).")

    return mesh

# ---------------------------
# 3) Cone (원추대: frustum)
# ---------------------------

def create_cone(upper_radius, height, lower_radius, sections=128):
    """
    원추대(상단 z=height, 하단 z=0)
    입력:
      - upper_radius: 위쪽 반지름 (z=height)
      - lower_radius: 아래쪽 반지름 (z=0)
      - height: 높이 (>0)
    반환: 끝면이 막힌(상/하단 cap 포함) 고체 메쉬
    구현: 라인 루프 (0,0)→(rl,0)→(ru,h)→(0,h)→(0,0)을 회전시켜 솔리드
    """
    if height <= 0:
        raise ValueError("height는 양수여야 합니다.")
    if upper_radius < 0 or lower_radius < 0:
        raise ValueError("반지름은 음수가 될 수 없습니다.")

    # 닫힌 단면 다각형을 구성 (원점-하단-상단-원점)
    profile = np.array([
        [0.0,       0.0],
        [lower_radius, 0.0],
        [upper_radius, height],
        [0.0,       height],
        [0.0,       0.0]
    ], dtype=float)

    mesh = _revolve(profile, angle=2*np.pi, sections=sections)
    return mesh

# ---------------------------
# 4) Sphere, Box, Torus (trimesh.creation 사용)
# ---------------------------
def create_sphere(radius=1.0,subdiv=4):
    return trimesh.creation.icosphere(subdivisions=subdiv, radius=radius)


def create_box(extents=(1.0, 1.0, 1.0), transform=None):
    """
    extents: (x, y, z) 전체 길이
    """
    return trimesh.creation.box(extents=extents, transform=transform)

def create_torus(major_radius=1.0, minor_radius=0.25, major_sections=64, minor_sections=128):
    """
    major_radius: 토러스 중심 원의 반지름 (R)
    minor_radius: 튜브 반지름 (r)
    sections: 튜브 둘레 분할
    segments: 큰 원 둘레 분할
    """
    return trimesh.creation.torus(major_radius=major_radius,
                                  minor_radius=minor_radius,
                                  major_sections=major_sections,
                                  minor_sections=minor_sections)

# ---------------------------
# Dispatcher (optional)
# ---------------------------

def create_shape(kind, **kwargs) -> tuple[np.ndarray, np.ndarray]:
    """
    kind: 'paraboloid' | 'ellipsoid' | 'cone' | 'box' | 'torus'
    kwargs는 각 생성 함수의 인자와 동일 키 사용
    """
    kind = kind.lower()
    size = kwargs.get('size', [1,1,1])
    if kind == 'paraboloid':
        mesh = create_paraboloid(focus_z=size[0], max_radius=size[1], max_height=size[2])
    elif kind == 'ellipsoid':
        mesh = create_ellipsoid(F1_z=size[0], F2_z=size[1], minor_axis_length=size[2])
    elif kind == 'cone':
        mesh = create_cone(upper_radius=size[0], height=size[1], lower_radius=size[2])
    elif kind == 'sphere':
        mesh = create_sphere(radius=size[0])
    elif kind == 'box':
        mesh = create_box(extents=size)
    elif kind == 'torus':
        mesh = create_torus(major_radius=size[0], minor_radius=size[1])
    else:
        raise ValueError(f"Unknown kind: {kind}")
    return np.asarray(mesh.vertices, dtype=np.float64), np.asarray(mesh.faces, dtype=np.int32)