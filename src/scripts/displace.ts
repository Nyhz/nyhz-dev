export type Vec3 = [number, number, number];

export function repel(point: Vec3, pointer: Vec3, radius: number, strength: number): Vec3 {
  const dx = point[0] - pointer[0];
  const dy = point[1] - pointer[1];
  const dz = point[2] - pointer[2];
  const dist = Math.hypot(dx, dy, dz);
  if (dist >= radius || dist === 0) return [0, 0, 0];
  const falloff = (1 - dist / radius) * strength;
  return [(dx / dist) * falloff, (dy / dist) * falloff, (dz / dist) * falloff];
}
