
import numpy as np

def snell_fresnel(
    D: np.ndarray,
    N: np.ndarray,
    n1: complex,
    n2: complex,
    return_polarized: bool = False,
):
    """
    입사광 D (단위벡터), 경계 법선 N (단위벡터, 매질1 -> 매질2 로 진행 시 cos_i = -dot(N,D) > 0 이 되도록 방향 설정),
    복소 굴절률 n1(입사측), n2(굴절측)을 받아
      - 반사 방향 R (실수 단위벡터)
      - 굴절 방향 T (실수 단위벡터, 전반사/비전파 모드면 None)
      - 무편광 반사율 R_s_ave
      - 무편광 투과율 T_s_ave   (에너지 비: Re(n2 cos_t)/Re(n1 cos_i) 가중 포함)
    를 반환합니다.

    주의:
      - 굴절 방향은 벡터형 Snell 공식을 복소 n 에 확장하여 얻은 T_vec의 실수부를 정규화한 근사값입니다.
        강흡수(金属) 등에서는 위상벡터와 포인팅 벡터의 방향이 다를 수 있습니다.
      - N 은 입사하는 쪽(매질1)에서 경계로 향하는 광선에 대해 cos_i = -dot(N, D) > 0 이 되도록 잡으세요.
    """
    D = np.asarray(D, dtype=float)
    N = np.asarray(N, dtype=float)

    # 단위화 (안전장치)
    D = D / np.linalg.norm(D)
    N = N / np.linalg.norm(N)

    # 입사각의 코사인 (양수 가정)
    cos_i = -np.dot(N, D)
    if cos_i < 0:
        # 법선 방향이 반대라면 뒤집어서 일관성 확보
        N = -N
        cos_i = -np.dot(N, D)

    # 반사 방향 (기하광선은 항상 실수)
    R_dir = D + 2 * cos_i * N  # D - 2(D·N)N, 여기서 D·N = -cos_i
    R_dir = R_dir / np.linalg.norm(R_dir)

    # 굴절쪽 코사인: cos_t = sqrt(1 - (n1/n2)^2 * (1 - cos_i^2))
    eta = n1 / n2
    sin2_i = max(0.0, 1.0 - cos_i**2)  # 수치안정
    cos_t = np.sqrt(1.0 - (eta**2) * sin2_i + 0j)  # 복소 허용

    # 복소 굴절 방향 벡터 (벡터형 스넬)
    # T_complex = eta * D + (eta * cos_i - cos_t) * N
    T_complex = eta * D + (eta * cos_i - cos_t) * N

    # 전파 가능 여부 판단: 굴절비(파워) 계산에 필요한 cos_t, cos_i
    # (Fresnel 계수는 복소 n, cos_t 로 계산)
    # s-편광, p-편광 진폭계수
    print(n1, n2, cos_i, cos_t)
    rs = (n1 * cos_i - n2 * cos_t) / (n1 * cos_i + n2 * cos_t)
    rp = (n2 * cos_i - n1 * cos_t) / (n2 * cos_i + n1 * cos_t)
    ts = (2 * n1 * cos_i) / (n1 * cos_i + n2 * cos_t)
    tp = (2 * n1 * cos_i) / (n2 * cos_i + n1 * cos_t)

    # 반사율/투과율 (무편광). 투과율은 에너지 흐름 비율 보정 포함.
    Rs = np.abs(rs)**2
    Rp = np.abs(rp)**2
    # 에너지(전력) 투과율: Ts = Re(n2 cos_t)/Re(n1 cos_i) * |ts|^2 (p-편광도 동일 보정)
    # cos_i 는 실수, n1,n2,cos_t 는 복소
    num_factor = np.real(n2 * cos_t)
    den_factor = np.real(n1 * cos_i)
    # 분모가 0 또는 매우 작으면 수치안정 처리
    if np.isclose(den_factor, 0.0):
        Ts = 0.0
        Tp = 0.0
    else:
        Ts = (num_factor / den_factor) * np.abs(ts)**2
        Tp = (num_factor / den_factor) * np.abs(tp)**2

    R_unpol = 0.5 * (Rs + Rp)
    T_unpol = 0.5 * (Ts + Tp)

    # 굴절 방향 벡터(실수) 구성:
    #   강흡수 매질에선 T_complex 가 복소 → 에너지 흐름은 Re(T_complex) 방향으로 근사
    #   만약 Re(T_complex)가 0에 가깝거나, Re(n2*cos_t) ≤ 0 이면 '전파 없음'으로 간주
    T_dir = None
    T_real = np.real(T_complex)
    if np.linalg.norm(T_real) > 1e-12 and np.real(n2 * cos_t) > 0:
        T_dir = T_real / np.linalg.norm(T_real)

    if return_polarized:
        return {
            "reflect_dir": R_dir,
            "refract_dir": T_dir,
            "R_unpolarized": float(np.real_if_close(R_unpol)),
            "T_unpolarized": float(np.real_if_close(T_unpol)),
            "Rs": float(np.real_if_close(Rs)),
            "Rp": float(np.real_if_close(Rp)),
            "Ts": float(np.real_if_close(Ts)),
            "Tp": float(np.real_if_close(Tp)),
        }
    else:
        return {
            "reflect_dir": R_dir,
            "refract_dir": T_dir,
            "R_unpolarized": float(np.real_if_close(R_unpol)),
            "T_unpolarized": float(np.real_if_close(T_unpol))
        }