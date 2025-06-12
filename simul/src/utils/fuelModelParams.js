// ===== src/utils/fuelModelParams.js =====
// Anderson 13 fuel models parameters (units: tons/acre for fuel loading, ft for depth, % for moisture extinction,
//    1/ft for surface-area-to-volume ratio, Btu/lb for heat content)
export const fuelModelParams = {
    1: { w1:0.74, w10:0.00, w100:0.00, wLive:0.00, depth:1.0, mExt:12, sigma:3500, h:8000 },
    2: { w1:2.00, w10:1.00, w100:0.50, wLive:0.50, depth:1.0, mExt:15, sigma:2500, h:8000 },
    3: { w1:3.01, w10:0.00, w100:0.00, wLive:0.00, depth:2.5, mExt:25, sigma:1500, h:8000 },
    4: { w1:5.01, w10:4.01, w100:2.00, wLive:5.01, depth:6.0, mExt:20, sigma:1000, h:8000 },
    5: { w1:1.00, w10:0.50, w100:0.00, wLive:2.00, depth:2.0, mExt:20, sigma:3000, h:8000 },
    6: { w1:1.50, w10:2.50, w100:2.00, wLive:0.00, depth:2.5, mExt:25, sigma:2000, h:8000 },
    7: { w1:1.13, w10:1.87, w100:1.50, wLive:0.37, depth:2.5, mExt:40, sigma:800,  h:8000 },
    8: { w1:1.50, w10:1.00, w100:2.50, wLive:0.00, depth:0.2, mExt:30, sigma:1500, h:8000 },
    9: { w1:2.92, w10:4.10, w100:0.15, wLive:0.00, depth:0.2, mExt:25, sigma:2500, h:8000 },
   10: { w1:3.01, w10:2.00, w100:5.01, wLive:2.00, depth:1.0, mExt:25, sigma:2000, h:8000 },
   11: { w1:1.50, w10:4.51, w100:5.51, wLive:0.00, depth:1.0, mExt:15, sigma:1200, h:8000 },
   12: { w1:4.01, w10:14.03, w100:16.53, wLive:0.00, depth:2.3, mExt:20, sigma:1100, h:8000 },
   13: { w1:7.01, w10:23.04, w100:28.05, wLive:0.00, depth:3.0, mExt:25, sigma:900,  h:8000 }
  };
  
  // Universal parameters (constant across models)
  export const universalParams = {
    Se: 0.01,    // effective mineral content (lb silica-free minerals / lb ovendry wood)
    ST: 0.0555, // total mineral content (lb minerals / lb ovendry wood)
    rho_p: 32   // fuel particle density (lb/ft^3)
  };

  export const FIRE_STATES = {
    UNBURNED:   0,
    IGNITING:   1,
    ACTIVE:     2,
    DECLINING:  3,
    BURNED_OUT: 4
  };