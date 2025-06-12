// ===== src/utils/rothermel.test.js =====
import { computeRothermelROS } from './rothermel';

describe('computeRothermelROS', () => {
  const cellSample = {
    fuelModel: 1,
    moisture: 5,   // %
    slope: 10      // degrees
  };
  const weatherSample = {
    windSpeed: 2,         // m/s
    windDirection: 0      // degrees (not used in current formula)
  };
  const cellSize = 30;    // meters

  test('returns non-negative value for typical inputs', () => {
    const ros = computeRothermelROS(cellSample, weatherSample, cellSize);
    expect(typeof ros).toBe('number');
    expect(ros).toBeGreaterThanOrEqual(0);
  });

  test('higher wind speed increases ROS', () => {
    const rosLow = computeRothermelROS(cellSample, { windSpeed: 1, windDirection: 0 }, cellSize);
    const rosHigh = computeRothermelROS(cellSample, { windSpeed: 5, windDirection: 0 }, cellSize);
    expect(rosHigh).toBeGreaterThan(rosLow);
  });

  test('higher moisture decreases ROS', () => {
    const rosDry = computeRothermelROS({ ...cellSample, moisture: 2 }, weatherSample, cellSize);
    const rosWet = computeRothermelROS({ ...cellSample, moisture: 20 }, weatherSample, cellSize);
    expect(rosWet).toBeLessThan(rosDry);
  });
});
