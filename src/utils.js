export const MINUTE = 60000;
export const HOUR = 3600000;

export function roundToNearestMinute(date, minutes) {
  const ms = MINUTE * minutes;

  return new Date(Math.floor(Date.parse(date) / ms) * ms);
}

export function inTriangle(point, triangle) {
  const cx = point[0],
    cy = point[1],
    t0 = triangle[0],
    t1 = triangle[1],
    t2 = triangle[2],
    v0x = t2[0] - t0[0],
    v0y = t2[1] - t0[1],
    v1x = t1[0] - t0[0],
    v1y = t1[1] - t0[1],
    v2x = cx - t0[0],
    v2y = cy - t0[1],
    dot00 = v0x * v0x + v0y * v0y,
    dot01 = v0x * v1x + v0y * v1y,
    dot02 = v0x * v2x + v0y * v2y,
    dot11 = v1x * v1x + v1y * v1y,
    dot12 = v1x * v2x + v1y * v2y;

  const b = dot00 * dot11 - dot01 * dot01,
    inv = b === 0 ? 0 : 1 / b,
    u = (dot11 * dot02 - dot01 * dot12) * inv,
    v = (dot00 * dot12 - dot01 * dot02) * inv;

  return u >= 0 && v >= 0 && u + v < 1;
}

export function baryCentricWeights(point, triangle) {
  const cx = point[0],
    cy = point[1],
    t0 = triangle[0],
    t1 = triangle[1],
    t2 = triangle[2];

  const w1 =
    ((t1[1] - t2[1]) * (cx - t2[0]) + (t2[0] - t1[0]) * (cy - t2[1])) /
    ((t1[1] - t2[1]) * (t0[0] - t2[0]) + (t2[0] - t1[0]) * (t0[1] - t2[1]));

  const w2 =
    ((t2[1] - t0[1]) * (cx - t2[0]) + (t0[0] - t2[0]) * (cy - t2[1])) /
    ((t1[1] - t2[1]) * (t0[0] - t2[0]) + (t2[0] - t1[0]) * (t0[1] - t2[1]));

  const w3 = 1 - w1 - w2;

  return [w1, w2, w3];
}
