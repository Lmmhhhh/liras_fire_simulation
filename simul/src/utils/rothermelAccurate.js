// src/utils/rothermelAccurate.js
// Rothermel (1972) 화재 확산 모델의 정확한 구현

// 연료 모델 파라미터 (Rothermel 1972, Anderson 1982)
export const FUEL_MODEL_PARAMS = {
    // Model 1: Short grass (1 ft)
    1: {
      w0: 0.034,      // Oven-dry fuel load (lb/ft²)
      sigma: 3500,    // Surface area-to-volume ratio (1/ft)
      h: 8000,        // Heat content (BTU/lb)
      delta: 0.4,     // Fuel bed depth (ft)
      mx_dead: 0.12,  // Moisture of extinction (fraction)
      rho_p: 32,      // Oven-dry particle density (lb/ft³)
      ST: 0.0555,     // Total mineral content (fraction)
      Se: 0.01,       // Effective mineral content (fraction)
    },
    // Model 2: Timber (grass and understory)
    2: {
      w0: 0.092,
      sigma: 3000,
      h: 8000,
      delta: 1.0,
      mx_dead: 0.15,
      rho_p: 32,
      ST: 0.0555,
      Se: 0.01,
    },
    // Model 3: Tall grass (2.5 ft)
    3: {
      w0: 0.138,
      sigma: 1500,
      h: 8000,
      delta: 2.5,
      mx_dead: 0.25,
      rho_p: 32,
      ST: 0.0555,
      Se: 0.01,
    },
    // Model 4: Chaparral (6 ft)
    4: {
      w0: 0.230,
      sigma: 2000,
      h: 8000,
      delta: 6.0,
      mx_dead: 0.20,
      rho_p: 32,
      ST: 0.0555,
      Se: 0.01,
    },
    // ... 추가 모델들
  };
  
  /**
   * Rothermel 화재 확산 속도 계산
   * @param {Object} fuel - 연료 파라미터
   * @param {number} moisture - 연료 수분 함량 (fraction)
   * @param {number} windSpeed - 풍속 (ft/min)
   * @param {number} slope - 경사 (radians)
   * @returns {number} - 확산 속도 (ft/min)
   */
  export function calculateRothermelROS(fuel, moisture, windSpeed, slope) {
    // 1. 최적 반응 속도 (Optimum reaction velocity)
    const sigma_prime = sigma_prime_f(fuel.sigma);
    const Gamma_prime_max = sigma_prime ** 1.5 / (495 + 0.0594 * sigma_prime ** 1.5);
    
    // 2. 충진율 (Packing ratio)
    const beta = fuel.w0 / (fuel.delta * fuel.rho_p);
    const beta_op = 3.348 * fuel.sigma ** -0.8189; // Optimum packing ratio
    
    // 3. 반응 강도 (Reaction intensity)
    const A = 133 * fuel.sigma ** -0.7913;
    const Gamma_prime = Gamma_prime_max * (beta / beta_op) ** A * Math.exp(A * (1 - beta / beta_op));
    
    // 4. 수분 감쇠 계수 (Moisture damping)
    const eta_M = moistureDampingCoefficient(moisture, fuel.mx_dead);
    
    // 5. 미네랄 감쇠 계수 (Mineral damping)
    const eta_S = 0.174 * fuel.Se ** -0.19;
    
    // 6. 반응 강도 (BTU/ft²/min)
    const I_R = Gamma_prime * fuel.w0 * fuel.h * eta_M * eta_S;
    
    // 7. 전파 플럭스 비율 (Propagating flux ratio)
    const xi = Math.exp((0.792 + 0.681 * fuel.sigma ** 0.5) * (beta + 0.1)) / 
               (192 + 0.2595 * fuel.sigma);
    
    // 8. 바람 계수 (Wind coefficient)
    const phi_W = windCoefficient(windSpeed, fuel.sigma, beta);
    
    // 9. 경사 계수 (Slope coefficient)
    const phi_S = slopeCoefficient(slope, beta);
    
    // 10. 유효 가열 수 (Effective heating number)
    const epsilon = Math.exp(-138 / fuel.sigma);
    
    // 11. 열 흡수량 (Heat of preignition)
    const Q_ig = 250 + 1116 * moisture; // BTU/lb
    
    // 12. 벌크 밀도 (Bulk density)
    const rho_b = fuel.w0 / fuel.delta;
    
    // 13. 최종 확산 속도 (ft/min)
    const R = (I_R * xi * (1 + phi_W + phi_S)) / (rho_b * epsilon * Q_ig);
    
    return R;
  }
  
  /**
   * 수분 감쇠 계수 계산
   */
  function moistureDampingCoefficient(moisture, mx) {
    const rm = Math.min(moisture / mx, 1.0);
    
    if (rm >= 1.0) return 0;
    
    return 1 - 2.59 * rm + 5.11 * rm ** 2 - 3.52 * rm ** 3;
  }
  
  /**
   * 바람 계수 계산
   */
  function windCoefficient(windSpeed, sigma, beta) {
    const C = 7.47 * Math.exp(-0.133 * sigma ** 0.55);
    const B = 0.02526 * sigma ** 0.54;
    const E = 0.715 * Math.exp(-3.59e-4 * sigma);
    
    const beta_op = 3.348 * sigma ** -0.8189;
    const ratio = beta / beta_op;
    
    return C * (windSpeed ** B) * (ratio ** -E);
  }
  
  /**
   * 경사 계수 계산
   */
  function slopeCoefficient(slope, beta) {
    const tan_slope = Math.tan(slope);
    return 5.275 * beta ** -0.3 * tan_slope ** 2;
  }
  
  /**
   * 타원형 화재 확산 모델 (Anderson 1983)
   */
  export function ellipticalFireSpread(headROS, windSpeed, elapsed) {
    // Length-to-width ratio
    const LWR = windSpeed > 0 
      ? 0.936 * Math.exp(0.2566 * windSpeed) + 0.461 * Math.exp(-0.1548 * windSpeed) - 0.397
      : 1.0;
    
    // Backing and flanking ROS
    const backingROS = headROS / LWR;
    const flankingROS = headROS / Math.sqrt(LWR);
    
    // 타원 매개변수
    const a = headROS * elapsed;      // 장축 반경
    const b = flankingROS * elapsed;  // 단축 반경
    const c = Math.sqrt(a ** 2 - b ** 2); // 초점 거리
    
    return {
      a,           // 전방 확산 거리
      b,           // 측면 확산 거리
      c,           // 초점 거리
      backingROS,  // 후방 확산 속도
      flankingROS, // 측면 확산 속도
      LWR          // 길이-폭 비율
    };
  }
  
  /**
   * 특정 각도에서의 확산 거리 계산
   */
  export function spreadDistanceAtAngle(ellipse, angle) {
    const { a, b } = ellipse;
    const cosTheta = Math.cos(angle);
    const sinTheta = Math.sin(angle);
    
    // 타원 방정식
    const r = (a * b) / Math.sqrt(b ** 2 * cosTheta ** 2 + a ** 2 * sinTheta ** 2);
    
    return r;
  }
  
  /**
   * Van Wagner 수관화 전이 모델 (1977)
   */
  export function crownFireInitiation(surfaceIntensity, foliarMoisture, canopyBaseHeight) {
    // Critical surface fire intensity (kW/m)
    // I_0 = (C * h * (FMC)^n)^(3/2)
    const C = 0.01;      // 상수
    const h = canopyBaseHeight * 100; // m to cm
    const n = 1.0;       // 지수
    const FMC = foliarMoisture * 100; // fraction to percent
    
    const criticalIntensity = Math.pow(C * h * Math.pow(FMC, n), 1.5);
    
    return {
      willTransition: surfaceIntensity > criticalIntensity,
      criticalIntensity,
      surfaceIntensity
    };
  }
  
  /**
   * 화재 강도 계산 (Byram 1959)
   */
  export function firelineIntensity(ROS, fuelLoad, heatYield = 18000) {
    // I = H * w * R
    // I: fireline intensity (kW/m)
    // H: heat yield (kJ/kg)
    // w: available fuel load (kg/m²)
    // R: rate of spread (m/s)
    
    const R_ms = ROS * 0.00508; // ft/min to m/s
    const w_kgm2 = fuelLoad * 4.88243; // lb/ft² to kg/m²
    
    return heatYield * w_kgm2 * R_ms;
  }
  
  /**
   * 점화원(Spotting) 거리 계산 (Albini 1979)
   */
  export function spottingDistance(firelineIntensity, windSpeed, canopyHeight) {
    // Maximum spotting distance (m)
    // Based on empirical relationships
    
    if (firelineIntensity < 1000) return 0; // 낮은 강도는 점화원 없음
    
    const windSpeed_ms = windSpeed * 0.00508; // ft/min to m/s
    
    // Albini의 경험식 (단순화)
    const z = canopyHeight;
    const maxDistance = 0.5 * Math.sqrt(firelineIntensity) * windSpeed_ms * Math.log(z / 0.3);
    
    return Math.max(0, maxDistance);
  }
  
  /**
   * 연료 수분 평형 (Nelson 2000)
   */
  export function equilibriumMoisture(temperature, relativeHumidity) {
    // EMC = Equilibrium Moisture Content
    const T = temperature; // Celsius
    const RH = relativeHumidity / 100; // fraction
    
    // Nelson dead fuel moisture model
    const W = 330 + 0.452 * T + 0.00415 * T ** 2;
    const K = 0.424 * (1 - RH) + 0.0694 * Math.sqrt(RH) + 0.000056 * T ** 2 * Math.sqrt(RH);
    const EMC = 1.28 * W * K / (1 + W * K);
    
    return EMC / 100; // percent to fraction
  }
  
  // Helper functions
  function sigma_prime_f(sigma) {
    return sigma; // 이미 1/ft 단위라고 가정
  }
  
  /**
   * 미터법 입력을 받아 미터법 출력을 반환하는 래퍼 함수
   */
  export function calculateRothermelROSMetric(fuelModelNumber, moistureFraction, windSpeed_ms, slopeDegrees) {
    const fuelParams = FUEL_MODEL_PARAMS[fuelModelNumber] || FUEL_MODEL_PARAMS[1];
    const windSpeed_ftmin = windSpeed_ms * 196.85;
    const slopeRad = slopeDegrees * Math.PI / 180;
    
    const ros_ftmin = calculateRothermelROS(fuelParams, moistureFraction, windSpeed_ftmin, slopeRad);
    
    return {
      ros_ms: ros_ftmin * 0.00508,
      ros_mhr: ros_ftmin * 0.3048 * 60,
      ros_kmhr: ros_ftmin * 0.018288
    };
  }