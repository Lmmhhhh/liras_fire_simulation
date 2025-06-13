// src/utils/rothermel.js
import { fuelModelParams, universalParams } from './fuelModelParams';

export function computeRothermelROS(cell, weather, cellSize) {
  const modelIdx = cell.fuelModel;
  
  // 연료 모델이 없거나 0이면 확산 없음
  if (!modelIdx || modelIdx === 0) {
    return 0;
  }
  
  const params = fuelModelParams[modelIdx];
  
  // 지원되지 않는 연료 모델 처리
  if (!params) {
    console.warn(`지원되지 않는 연료 모델: ${modelIdx}, 기본값(2) 사용`);
    return computeRothermelROS({ ...cell, fuelModel: 2 }, weather, cellSize);
  }
  
  const { Se, ST, rho_p } = universalParams;

  // Convert moisture to fraction
  const Mf = Math.min(cell.moisture / 100, 1);
  const Mx = params.mExt / 100;

  // 수분이 소멸점에 너무 가까우면 문제가 됨
  if (Mf >= Mx * 0.95) {
    console.log(`수분이 소멸점에 근접: ${cell.moisture}% / ${params.mExt}%`);
    return 0.05; // 최소 ROS 반환
  }

  // Fuel loading w0 in lb/ft^2
  const wo_t_ac = params.w1 + params.w10 + params.w100 + params.wLive;
  const wo_lb_ft2 = wo_t_ac * (2000 / 43560);

  // 연료 하중이 0이면 확산 없음
  if (wo_lb_ft2 === 0) {
    return 0;
  }

  // Bulk density rho_b (lb/ft^3)
  const delta_ft = params.depth;
  const rho_b = wo_lb_ft2 / delta_ft;

  // Packing ratio beta
  const beta = rho_b / rho_p;
  // Optimum packing ratio beta_op
  const sigma = params.sigma;
  const beta_op = 3.348 * Math.pow(sigma, -0.8189);

  // Optimum reaction velocity (min^-1)
  const Gamma_max = Math.pow(sigma, 1.5) / (495 + 0.0594 * Math.pow(sigma, 1.5));
  // Exponent A
  const A = 133 * Math.pow(sigma, -0.7913);
  // Adjusted reaction velocity Gamma' (min^-1)
  const Gamma_p = Gamma_max * Math.pow(beta / beta_op, A) * Math.exp(A * (1 - beta / beta_op));

  // Net fuel load wn (lb/ft^2)
  const wn = wo_lb_ft2 / (1 + ST);

  // Moisture damping coefficient eta_M (개선된 계산)
  const rM = Mf / Mx;
  // 원래 공식이 너무 급격하게 감소하므로 조정
  const eta_M = Math.max(0.1, 1 - 2.59 * rM + 5.11 * rM * rM - 3.52 * Math.pow(rM, 3));

  // Mineral damping coefficient eta_S
  const eta_S = Math.min(0.174 * Math.pow(Se, -0.19), 1);

  // Heat content h (Btu/lb)
  const h = params.h;
  // Reaction intensity IR (Btu/ft^2-min)
  const IR = Gamma_p * wn * h * eta_M * eta_S;

  // Propagating flux ratio xi
  const xi = Math.exp((0.792 + 0.681 * Math.sqrt(sigma)) * (beta + 0.1))
           / (192 + 0.2595 * sigma);

  // Wind factor phi_w (개선: 낮은 풍속에서도 효과 있도록)
  const wind_ftpmin = Math.max(weather.windSpeed * 196.85, 0); // m/s -> ft/min
  const E = 0.715 * Math.exp(-0.000359 * sigma);
  const B = 0.02526 * Math.pow(sigma, 0.54);
  const C = 7.47 * Math.exp(-0.133 * Math.pow(sigma, 0.55));
  
  // 바람 효과 계산 (최소값 보장)
  let phi_w = 0;
  if (wind_ftpmin > 0) {
    phi_w = C * Math.pow(wind_ftpmin, B) * Math.pow(beta / beta_op, -E);
    // 바람이 있으면 최소 효과 보장
    phi_w = Math.max(phi_w, wind_ftpmin / 500);
  }

  // Slope factor phi_s
  const slopeRad = (cell.slope || 0) * Math.PI / 180;
  const tan_phi = Math.tan(slopeRad);
  const phi_s = 5.275 * Math.pow(beta, -0.3) * tan_phi * tan_phi;

  // Effective heating number epsilon
  const epsilon = Math.exp(-138 / sigma);
  // Heat of preignition Qig (Btu/lb)
  const Qig = 250 + 1116 * Mf;

  // No-wind/no-slope ROS R0 (ft/min)
  const R0 = (IR * xi) / (rho_b * epsilon * Qig);
  
  // R0가 0이면 디버깅
  if (R0 === 0 || isNaN(R0)) {
    console.warn('R0 계산 오류:', {
      IR, xi, rho_b, epsilon, Qig,
      연료모델: modelIdx,
      수분: cell.moisture
    });
    return 0.05; // 최소 ROS
  }
  
  // Final ROS with wind & slope (ft/min)
  const ros_ft_min = R0 * (1 + phi_w + phi_s);

  // Convert to m/s: 1 ft/min = 0.00508 m/s
  let ros = ros_ft_min * 0.00508;
  
  // 최소 ROS 보장 (연료가 있는 경우) - 증가된 최소값
  if (ros < 0.1 && modelIdx !== 0) {
    console.log(`ROS가 너무 낮음 (${ros.toFixed(3)} m/s), 최소값 0.1 m/s 적용`);
    ros = 0.1;
  }
  
  return Math.max(0, ros);
}