// ===== src/utils/rothermel.js =====
import { fuelModelParams, universalParams } from './fuelModelParams';

/**
 * Compute Rothermel Rate of Spread (ROS) in meters per second
 * Based on Rothermel (1972) & Albini (1976) formulations
 * @param {object} cell    - FireCell containing fuelModel, moisture (%), slope (°)
 * @param {object} weather - { windSpeed: m/s, windDirection: ° }
 * @param {number} cellSize- Grid cell size in meters
 * @returns {number} ROS (m/s)
 */
export function computeRothermelROS(cell, weather, cellSize) {
  const modelIdx = cell.fuelModel;
  const params   = fuelModelParams[modelIdx];
  const { Se, ST, rho_p } = universalParams;

  // Convert moisture to fraction
  const Mf = Math.min(cell.moisture / 100, 1);
  const Mx = params.mExt / 100;

  // Fuel loading w0 in lb/ft^2: (t/ac -> lb/ft^2)
  const wo_t_ac   = params.w1 + params.w10 + params.w100 + params.wLive;
  const wo_lb_ft2 = wo_t_ac * (2000 / 43560);

  // Bulk density rho_b (lb/ft^3)
  const delta_ft = params.depth; // fuel depth in ft
  const rho_b   = wo_lb_ft2 / delta_ft;

  // Packing ratio beta
  const beta    = rho_b / rho_p;
  // Optimum packing ratio beta_op
  const sigma   = params.sigma;
  const beta_op = 3.348 * Math.pow(sigma, -0.8189);

  // Optimum reaction velocity (min^-1)
  const Gamma_max = Math.pow(sigma, 1.5) / (495 + 0.0594 * Math.pow(sigma, 1.5));
  // Exponent A
  const A = 133 * Math.pow(sigma, -0.7913);
  // Adjusted reaction velocity Gamma' (min^-1)
  const Gamma_p = Gamma_max * Math.pow(beta / beta_op, A) * Math.exp(A * (1 - beta / beta_op));

  // Net fuel load wn (lb/ft^2)
  const wn = wo_lb_ft2 / (1 + ST);

  // Moisture damping coefficient eta_M ([egusphere.copernicus.org](https://egusphere.copernicus.org/preprints/2024/egusphere-2024-1914/egusphere-2024-1914-manuscript-version2.pdf?utm_source=chatgpt.com))
  const rM    = Mf / Mx;
  const eta_M = 1 - 2.59 * rM + 5.11 * rM * rM - 3.52 * Math.pow(rM, 3);

  // Mineral damping coefficient eta_S
  const eta_S = Math.min(0.174 * Math.pow(Se, -0.19), 1);

  // Heat content h (Btu/lb)
  const h = params.h;
  // Reaction intensity IR (Btu/ft^2-min)
  const IR = Gamma_p * wn * h * eta_M * eta_S;

  // Propagating flux ratio xi ([escholarship.org](https://escholarship.org/content/qt4s73g79d/qt4s73g79d_noSplash_330cbf43bfe72b53b1fdd5ffbbbdfbf8.pdf?t=sf0mjo&utm_source=chatgpt.com))
  const xi = Math.exp((0.792 + 0.681 * Math.sqrt(sigma)) * (beta + 0.1))
           / (192 + 0.2595 * sigma);

  // Wind factor phi_w ([research.csiro.au](https://research.csiro.au/spark/resources/model-library/rothermel/?utm_source=chatgpt.com))
  const wind_ftpmin = weather.windSpeed * 196.85; // m/s -> ft/min
  const E = 0.715 * Math.exp(-0.000359 * sigma);
  const B = 0.02526 * Math.pow(sigma, 0.54);
  const C = 7.47 * Math.exp(-0.133 * Math.pow(sigma, 0.55));
  const phi_w = C * Math.pow(wind_ftpmin, B) * Math.pow(beta / beta_op, -E);

  // Slope factor phi_s ([research.csiro.au](https://research.csiro.au/spark/resources/model-library/rothermel/?utm_source=chatgpt.com))
  const slopeRad = cell.slope * Math.PI / 180;
  const tan_phi   = Math.tan(slopeRad);
  const phi_s     = 5.275 * Math.pow(beta, -0.3) * tan_phi * tan_phi;

  // Effective heating number epsilon (unitless)
  const epsilon = Math.exp(-138 / sigma);
  // Heat of preignition Qig (Btu/lb)
  const Qig = 250 + 1116 * Mf;

  // No-wind/no-slope ROS R0 (ft/min)
  const R0 = (IR * xi) / (rho_b * epsilon * Qig);
  // Final ROS with wind & slope (ft/min)
  const ros_ft_min = R0 * (1 + phi_w + phi_s);

  // Convert to m/s: 1 ft/min = 0.00508 m/s
  const ros = ros_ft_min * 0.00508;
  return Math.max(0, ros);
}