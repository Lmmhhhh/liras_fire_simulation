// src/utils/terrain.js
export function computeSlope(elevation, cellSize) {
    const rows = elevation.length;
    const cols = elevation[0].length;
    return (i, j) => {
      const dzdx = (
        (elevation[i][Math.min(j+1, cols-1)] - elevation[i][Math.max(j-1, 0)])
      ) / (2 * cellSize);
      const dzdy = (
        (elevation[Math.min(i+1, rows-1)][j] - elevation[Math.max(i-1, 0)][j])
      ) / (2 * cellSize);
      return Math.atan(Math.hypot(dzdx, dzdy)) * (180/Math.PI);  // degree
    };
  }