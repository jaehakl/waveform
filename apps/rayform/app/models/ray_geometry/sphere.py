from typing import List, Dict, Tuple
import math

Vec3 = Tuple[float, float, float]

def _dot(a: Vec3, b: Vec3) -> float:
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]

def _add(a: Vec3, b: Vec3) -> Vec3:
    return (a[0]+b[0], a[1]+b[1], a[2]+b[2])

def _scale(s: float, v: Vec3) -> Vec3:
    return (s*v[0], s*v[1], s*v[2])

def _norm(v: Vec3) -> float:
    return math.sqrt(_dot(v, v))

def _normalize(v: Vec3, eps: float = 1e-12) -> Vec3:
    n = _norm(v)
    if n < eps:
        return (0.0, 0.0, 0.0)
    inv = 1.0 / n
    return (v[0]*inv, v[1]*inv, v[2]*inv)



class SphereRay:
    def is_inside(point: Vec3, r: float) -> bool:
        return _norm(point) < r

    def intersect(
        origin: Vec3,
        direction: Vec3,
        r: float,
        t_min: float = 0.0,
        t_max: float = float("inf"),
        eps: float = 1e-9,
    ) -> List[Dict[str, object]]:
        """
        Ray-sphere intersections for a sphere centered at (0,0,0) with radius r.

        Returns a list (sorted by distance) of dicts:
        { "point": Vec3, "distance": float, "normal": Vec3, "t": float }

        - Only intersections with t in [t_min, t_max] are returned (default: t>=0).
        - 'distance' is the Euclidean distance along the ray from origin to the point.
        """
        # Quadratic: |o + t d|^2 = r^2  =>  (d·d)t^2 + 2(o·d)t + (o·o - r^2) = 0
        o = origin
        d = direction

        a = _dot(d, d)                # ||d||^2
        if a < eps:                   # Degenerate ray direction
            return []

        b = 2.0 * _dot(o, d)
        c = _dot(o, o) - r*r

        disc = b*b - 4.0*a*c
        if disc < -eps:
            return []                 # No real roots
        if abs(disc) < eps:
            disc = 0.0                # Tangent (one root, counted once)

        sqrt_disc = math.sqrt(disc) if disc >= 0.0 else 0.0

        inv_2a = 1.0 / (2.0 * a)
        t1 = (-b - sqrt_disc) * inv_2a
        t2 = (-b + sqrt_disc) * inv_2a

        # Collect valid t in range
        ts: List[float] = []
        for t in (t1, t2):
            if t_min - eps <= t <= t_max + eps:
                ts.append(t)

        # Remove duplicates for the tangent case
        if len(ts) == 2 and abs(ts[0] - ts[1]) < 1e-12:
            ts = [ts[0]]

        # Filter to forward ray by default (t_min defaults to 0.0)
        # Sort by t (near → far)
        ts = [t for t in ts if t >= t_min - eps]
        ts.sort()

        if not ts:
            return []

        dir_len = math.sqrt(a)  # ||d||
        results: List[Dict[str, object]] = []
        for t in ts:
            p = _add(o, _scale(t, d))            # intersection point
            distance = max(0.0, t * dir_len)     # distance along the ray
            n = _normalize(p)                    # outward normal (for sphere at origin)
            results.append({
                "point": (float(p[0]), float(p[1]), float(p[2])),
                "distance": float(distance),
                "normal": (float(n[0]), float(n[1]), float(n[2])),
                "t": float(t),
            })

        # Sort by true distance (robust if direction isn't unit)
        results.sort(key=lambda x: x["distance"])
        return results
