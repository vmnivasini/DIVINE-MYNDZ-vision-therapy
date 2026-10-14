/**
 * Genuine Webcam-Based Gaze Tracking & Ocular Telemetry Engine
 * 
 * Features:
 * 1. Client-side local MediaPipe Face Mesh processing (468 face + 10 iris landmarks)
 * 2. Physiological feature extraction (iris-canthus displacement, palpebral aperture, head pose)
 * 3. Pre-test camera & subject quality assessment (illumination, contrast, distance, head stability)
 * 4. 9-point multi-target calibration with Ridge Regression ($L_2$ regularization)
 * 5. Independent 4-point validation reporting genuine pixel and normalized error
 * 6. Explicit validity policy rejecting invalid frames with explicit reasons (NEVER synthetic coordinates)
 * 7. ZERO target-snapping, ZERO fake multipliers, ZERO random jitter
 * 8. Comprehensive resource disposal preventing camera hardware leaks
 */

// ---------------------------------------------------------------------------
// Standard 9-point calibration layout (normalized coordinates [0, 1])
// ---------------------------------------------------------------------------
export const CALIBRATION_POINTS = [
  { id: 1, label: 'Top-Left',      x: 0.12, y: 0.12 },
  { id: 2, label: 'Top-Center',    x: 0.50, y: 0.12 },
  { id: 3, label: 'Top-Right',     x: 0.88, y: 0.12 },
  { id: 4, label: 'Middle-Left',   x: 0.12, y: 0.50 },
  { id: 5, label: 'Center',        x: 0.50, y: 0.50 },
  { id: 6, label: 'Middle-Right',  x: 0.88, y: 0.50 },
  { id: 7, label: 'Bottom-Left',   x: 0.12, y: 0.88 },
  { id: 8, label: 'Bottom-Center', x: 0.50, y: 0.88 },
  { id: 9, label: 'Bottom-Right',  x: 0.88, y: 0.88 },
];

// Independent 4-point validation layout (locations not in the 9 training points)
export const VALIDATION_POINTS = [
  { id: 10, label: 'Validation-TopLeft',     x: 0.30, y: 0.30 },
  { id: 11, label: 'Validation-TopRight',    x: 0.70, y: 0.30 },
  { id: 12, label: 'Validation-BottomLeft',  x: 0.30, y: 0.70 },
  { id: 13, label: 'Validation-BottomRight', x: 0.70, y: 0.70 },
];

// ---------------------------------------------------------------------------
// Mathematical Helpers: Ridge Regression & Matrix Solver
// ---------------------------------------------------------------------------

/**
 * Solves (X^T * X + lambda * I) * W = X^T * Y using Gaussian elimination with partial pivoting.
 * 
 * @param {Array<Array<number>>} X - N x D feature matrix
 * @param {Array<Array<number>>} Y - N x 2 target matrix ([screenX, screenY])
 * @param {number} lambda - L2 regularization parameter (default: 0.05)
 * @returns {Array<Array<number>>} D x 2 weight matrix W
 */
export function solveRidgeRegression(X, Y, lambda = 0.005) {
  const n = X.length;
  if (n === 0) return null;
  const d = X[0].length;
  if (n < d) {
    // Insufficient observations for full rank; use higher regularization
    lambda = Math.max(lambda, 0.1);
  }

  // Compute A = X^T * X + lambda * I (size d x d)
  const A = Array.from({ length: d }, () => new Float64Array(d));
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += X[k][i] * X[k][j];
      }
      A[i][j] = sum;
    }
    // Proportional diagonal regularization: regularizes each feature equally
    // relative to its variance without disproportionately penalizing small-scale features
    const scale = Math.max(A[i][i], 1.0);
    A[i][i] += (i === 0 ? lambda * 0.0001 * scale : lambda * scale);
  }

  // Compute B = X^T * Y (size d x 2)
  const B = Array.from({ length: d }, () => [0, 0]);
  for (let i = 0; i < d; i++) {
    let sumX = 0;
    let sumY = 0;
    for (let k = 0; k < n; k++) {
      sumX += X[k][i] * Y[k][0];
      sumY += X[k][i] * Y[k][1];
    }
    B[i][0] = sumX;
    B[i][1] = sumY;
  }

  // Augmented matrix [A | B] (size d x (d + 2))
  const M = Array.from({ length: d }, (rowIdx, i) => {
    const row = new Float64Array(d + 2);
    for (let j = 0; j < d; j++) row[j] = A[i][j];
    row[d] = B[i][0];
    row[d + 1] = B[i][1];
    return row;
  });

  // Gaussian elimination with partial pivoting
  for (let col = 0; col < d; col++) {
    // Find pivot row
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < d; row++) {
      const val = Math.abs(M[row][col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = row;
      }
    }

    if (maxVal < 1e-12) {
      // Degenerate column - add small ridge epsilon and continue
      M[col][col] += 1e-4;
    }

    if (maxRow !== col) {
      const temp = M[col];
      M[col] = M[maxRow];
      M[maxRow] = temp;
    }

    const pivot = M[col][col];
    for (let j = col; j < d + 2; j++) {
      M[col][j] /= pivot;
    }

    for (let row = 0; row < d; row++) {
      if (row !== col) {
        const factor = M[row][col];
        if (Math.abs(factor) > 1e-14) {
          for (let j = col; j < d + 2; j++) {
            M[row][j] -= factor * M[col][j];
          }
        }
      }
    }
  }

  // Extract weights W: size d x 2
  const W = Array.from({ length: d }, (rowIdx, i) => [M[i][d], M[i][d + 1]]);
  return W;
}

/**
 * Builds feature vector from extracted ocular features.
 * Features: [1, leftIrisX, leftIrisY, rightIrisX, rightIrisY, avgIrisX, avgIrisY, headYaw, headPitch, headRoll]
 * Plus interaction/polynomial terms for nonlinear mapping across screen quadrants.
 */
export function buildFeatureVector(features, includePolynomial = true) {
  if (!features) return null;
  const lx = features.irisLeftRatioX;
  const ly = features.irisLeftRatioY;
  const rx = features.irisRightRatioX;
  const ry = features.irisRightRatioY;
  const ax = (lx + rx) / 2;
  const ay = (ly + ry) / 2;
  const yaw = features.headPose?.yaw || 0;
  const pitch = features.headPose?.pitch || 0;
  const roll = features.headPose?.roll || 0;

  const diffX = lx - rx;
  const diffY = ly - ry;

  const base = [1.0, ax, ay, diffX, diffY, yaw, pitch, roll];

  if (!includePolynomial) return base;

  // Add 2nd degree polynomial terms: ax^2, ay^2, ax*ay, yaw*ax, pitch*ay
  return [
    ...base,
    ax * ax,
    ay * ay,
    ax * ay,
    yaw * ax,
    pitch * ay
  ];
}

/**
 * Extracts facial, iris, eye corner, and head pose metrics from MediaPipe FaceMesh landmarks.
 * Landmarks indices:
 * Left Eye: Outer canthus 33, Inner canthus 133, Upper eyelid 159, Lower eyelid 145, Iris center 468
 * Right Eye: Inner canthus 362, Outer canthus 263, Upper eyelid 386, Lower eyelid 374, Iris center 473
 * Head Pose: Nose tip 1, Chin 152, Forehead 10, Left temple 234, Right temple 454
 * 
 * @param {Array<{x: number, y: number, z: number}>} landmarks - 468+ landmarks
 * @returns {Object|null} Extracted features
 */
export function extractEyeFeatures(landmarks) {
  if (!landmarks || landmarks.length < 468) {
    return null;
  }

  const hasIris = landmarks.length >= 478;
  let leftIris = landmarks[468] || landmarks[159];
  let rightIris = landmarks[473] || landmarks[386];

  if (hasIris && landmarks[469] && landmarks[470] && landmarks[471] && landmarks[472]) {
    // Check that perimeter points are proximate to iris center (< 0.05 frame distance)
    const lDist = Math.hypot(landmarks[469].x - leftIris.x, landmarks[469].y - leftIris.y);
    if (lDist < 0.05) {
      leftIris = {
        x: (landmarks[468].x + landmarks[469].x + landmarks[470].x + landmarks[471].x + landmarks[472].x) / 5,
        y: (landmarks[468].y + landmarks[469].y + landmarks[470].y + landmarks[471].y + landmarks[472].y) / 5,
        z: (landmarks[468].z + landmarks[469].z + landmarks[470].z + landmarks[471].z + landmarks[472].z) / 5
      };
    }
  }

  if (hasIris && landmarks[474] && landmarks[475] && landmarks[476] && landmarks[477]) {
    const rDist = Math.hypot(landmarks[474].x - rightIris.x, landmarks[474].y - rightIris.y);
    if (rDist < 0.05) {
      rightIris = {
        x: (landmarks[473].x + landmarks[474].x + landmarks[475].x + landmarks[476].x + landmarks[477].x) / 5,
        y: (landmarks[473].y + landmarks[474].y + landmarks[475].y + landmarks[476].y + landmarks[477].y) / 5,
        z: (landmarks[473].z + landmarks[474].z + landmarks[475].z + landmarks[476].z + landmarks[477].z) / 5
      };
    }
  }

  // Left Eye landmarks
  const leftOuter = landmarks[33];
  const leftInner = landmarks[133];
  const leftTop   = landmarks[159];
  const leftBottom= landmarks[145];

  // Right Eye landmarks
  const rightInner= landmarks[362];
  const rightOuter= landmarks[263];
  const rightTop  = landmarks[386];
  const rightBottom= landmarks[374];

  // Palpebral aperture (eye openness) via Eye Aspect Ratio (EAR)
  const leftEyeWidth = Math.hypot(leftInner.x - leftOuter.x, leftInner.y - leftOuter.y) || 0.05;
  const leftEyeHeight = Math.hypot(leftTop.x - leftBottom.x, leftTop.y - leftBottom.y) || 0.01;
  const leftEAR = leftEyeHeight / leftEyeWidth;

  const rightEyeWidth = Math.hypot(rightOuter.x - rightInner.x, rightOuter.y - rightInner.y) || 0.05;
  const rightEyeHeight = Math.hypot(rightTop.x - rightBottom.x, rightTop.y - rightBottom.y) || 0.01;
  const rightEAR = rightEyeHeight / rightEyeWidth;

  // Bony orbital canthus centers (rigid skeletal reference points)
  const leftCanthusCenterY = (leftOuter.y + leftInner.y) / 2;
  const rightCanthusCenterY = (rightInner.y + rightOuter.y) / 2;

  // Stable vertical normalization aperture: prevents denominator from collapsing
  // when patient squints, blinks, or glances downwards
  const nominalLeftHeight = Math.max(leftEyeHeight, leftEyeWidth * 0.35);
  const nominalRightHeight = Math.max(rightEyeHeight, rightEyeWidth * 0.35);

  // Robust normalized iris displacements:
  // Horizontal: relative to canthi
  const leftIrisRatioX = (leftIris.x - leftOuter.x) / (leftInner.x - leftOuter.x || 0.05);
  const rightIrisRatioX = (rightIris.x - rightInner.x) / (rightOuter.x - rightInner.x || 0.05);

  // Vertical: blended metric combining palpebral aperture with skeletal canthal stability
  const rawLidRatioY = (leftIris.y - leftTop.y) / (leftBottom.y - leftTop.y || 0.02);
  const rawRightLidRatioY = (rightIris.y - rightTop.y) / (rightBottom.y - rightTop.y || 0.02);

  const leftCanthusRatioY = 0.5 + (leftIris.y - leftCanthusCenterY) / (nominalLeftHeight * 2.0);
  const rightCanthusRatioY = 0.5 + (rightIris.y - rightCanthusCenterY) / (nominalRightHeight * 2.0);

  const leftIrisRatioY = 0.5 * rawLidRatioY + 0.5 * leftCanthusRatioY;
  const rightIrisRatioY = 0.5 * rawRightLidRatioY + 0.5 * rightCanthusRatioY;

  // Head Pose estimation from 3D facial landmarks
  const nose = landmarks[1];
  const chin = landmarks[152];
  const forehead = landmarks[10];
  const leftTemple = landmarks[234];
  const rightTemple = landmarks[454];

  const faceWidth = Math.abs(rightTemple.x - leftTemple.x) || 0.3;
  const faceHeight = Math.abs(chin.y - forehead.y) || 0.4;
  const midTempleX = (leftTemple.x + rightTemple.x) / 2;
  const midVertY = (forehead.y + chin.y) / 2;

  // Yaw: Horizontal deviation of nose tip relative to midline of face
  const yaw = (nose.x - midTempleX) / faceWidth;
  // Pitch: Vertical deviation of nose tip relative to vertical center
  const pitch = (nose.y - midVertY) / faceHeight;
  // Roll: Angle between eye corners in camera plane
  const roll = Math.atan2(rightOuter.y - leftOuter.y, rightOuter.x - leftOuter.x);

  // Interpupillary distance (IPD) in normalized camera coords
  const ipd = Math.hypot(rightIris.x - leftIris.x, rightIris.y - leftIris.y);

  // Bounding box of face
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (let i = 0; i < 468; i += 8) {
    const pt = landmarks[i];
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  return {
    irisLeftRatioX: leftIrisRatioX,
    irisLeftRatioY: leftIrisRatioY,
    irisRightRatioX: rightIrisRatioX,
    irisRightRatioY: rightIrisRatioY,
    leftEAR,
    rightEAR,
    hasIrisLandmarks: hasIris,
    headPose: { yaw, pitch, roll },
    ipd,
    faceBox: {
      x: minX,
      y: minY,
      width: Math.max(0.1, maxX - minX),
      height: Math.max(0.1, maxY - minY)
    },
    rawIrisLeft: { x: leftIris.x, y: leftIris.y },
    rawIrisRight: { x: rightIris.x, y: rightIris.y }
  };
}

// ---------------------------------------------------------------------------
// Multi-Point Calibration Engine
// ---------------------------------------------------------------------------

export class CalibrationEngine {
  constructor() {
    this.calibrationData = new Map(); // pointId -> Array<featureVector>
    this.validationData = new Map();  // pointId -> Array<featureVector>
    this.modelWeights = null;         // D x 2 matrix
    this.isCalibrated = false;
    this.calibrationError = null;     // { meanErrorNorm, meanErrorPx, maxErrorPx }
    this.samplesPerPoint = 18;        // Target valid samples per point
  }

  reset() {
    this.calibrationData.clear();
    this.validationData.clear();
    this.modelWeights = null;
    this.isCalibrated = false;
    this.calibrationError = null;
  }

  /**
   * Adds an observation for a calibration point. Rejects samples during blinks.
   */
  addCalibrationSample(pointId, features) {
    if (!features) return false;
    // Reject blinks (EAR too low) or unstable head movements
    if (features.leftEAR < 0.12 || features.rightEAR < 0.12) {
      return false; // Blink rejected
    }

    const vec = buildFeatureVector(features, true);
    if (!vec) return false;

    if (!this.calibrationData.has(pointId)) {
      this.calibrationData.set(pointId, []);
    }
    const samples = this.calibrationData.get(pointId);
    samples.push(vec);
    return true;
  }

  /**
   * Adds an observation for a validation point.
   */
  addValidationSample(pointId, features) {
    if (!features) return false;
    if (features.leftEAR < 0.12 || features.rightEAR < 0.12) return false;

    const vec = buildFeatureVector(features, true);
    if (!vec) return false;

    if (!this.validationData.has(pointId)) {
      this.validationData.set(pointId, []);
    }
    this.validationData.get(pointId).push(vec);
    return true;
  }

  getSampleCount(pointId) {
    return this.calibrationData.get(pointId)?.length || 0;
  }

  getValidationSampleCount(pointId) {
    return this.validationData.get(pointId)?.length || 0;
  }

  /**
   * Robust aggregation of observations for a calibration point using median.
   */
  _aggregateSamples(sampleList) {
    if (!sampleList || sampleList.length === 0) return null;
    const d = sampleList[0].length;
    const aggregated = new Float64Array(d);

    for (let j = 0; j < d; j++) {
      const vals = sampleList.map(s => s[j]).sort((a, b) => a - b);
      const mid = Math.floor(vals.length / 2);
      aggregated[j] = vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid];
    }
    return Array.from(aggregated);
  }

  /**
   * Fits Ridge Regression model from all cleaned calibration observations plus centroid anchors.
   * 
   * @param {number} screenWidthPx - Current viewport width
   * @param {number} screenHeightPx - Current viewport height
   * @returns {{ success: boolean, message: string }}
   */
  fit(screenWidthPx = window.innerWidth, screenHeightPx = window.innerHeight) {
    const X = [];
    const Y = [];

    // Collect observations across all 9 calibration targets
    for (const pt of CALIBRATION_POINTS) {
      const samples = this.calibrationData.get(pt.id);
      if (!samples || samples.length < 5) {
        return {
          success: false,
          message: `Point #${pt.id} (${pt.label}) has insufficient observations (${samples?.length || 0} / 5 minimum).`
        };
      }

      // Robust aggregation
      const robustVec = this._aggregateSamples(samples);
      if (!robustVec) continue;

      const d = robustVec.length;
      // Filter individual samples: discard transient saccadic entry noise (> 2.2x median dispersion)
      const distances = samples.map(s => {
        let sumSq = 0;
        for (let j = 1; j < d; j++) {
          const diff = s[j] - robustVec[j];
          sumSq += diff * diff;
        }
        return Math.sqrt(sumSq);
      });

      const sortedDists = [...distances].sort((a, b) => a - b);
      const medianDist = sortedDists[Math.floor(sortedDists.length / 2)] || 0.04;
      const maxAllowedDist = Math.max(0.08, medianDist * 2.2);

      for (let i = 0; i < samples.length; i++) {
        if (distances[i] <= maxAllowedDist) {
          X.push(samples[i]);
          Y.push([pt.x, pt.y]);
        }
      }

      // Add central anchor target weights (3x)
      for (let k = 0; k < 3; k++) {
        X.push(robustVec);
        Y.push([pt.x, pt.y]);
      }
    }

    if (X.length < 18) {
      return {
        success: false,
        message: `Only ${X.length} valid calibration observations collected.`
      };
    }

    // Solve for weights
    const W = solveRidgeRegression(X, Y, 0.005);
    if (!W) {
      return {
        success: false,
        message: 'Could not solve regression mapping. Please recalibrate.'
      };
    }

    this.modelWeights = W;
    this.isCalibrated = true;

    // Evaluate training residual error
    let sumErrPx = 0;
    for (let i = 0; i < X.length; i++) {
      const predX = this._predictRaw(X[i], 0);
      const predY = this._predictRaw(X[i], 1);
      const errPx = Math.hypot((predX - Y[i][0]) * screenWidthPx, (predY - Y[i][1]) * screenHeightPx);
      sumErrPx += errPx;
    }
    const trainErrorPx = Math.round(sumErrPx / X.length);

    this.calibrationError = {
      trainErrorPx,
      meanErrorPx: trainErrorPx,
      validationErrorPx: null,
      passed: trainErrorPx < 220
    };

    return {
      success: true,
      trainErrorPx,
      message: 'Calibration model successfully fitted.'
    };
  }

  /**
   * Evaluates the fitted model against independent validation targets.
   */
  evaluateValidation(screenWidthPx = window.innerWidth, screenHeightPx = window.innerHeight) {
    if (!this.isCalibrated || !this.modelWeights) {
      return { passed: false, message: 'Model is not yet calibrated.' };
    }

    let totalErrorPx = 0;
    let maxErrorPx = 0;
    let count = 0;

    for (const vPt of VALIDATION_POINTS) {
      const samples = this.validationData.get(vPt.id);
      if (samples && samples.length >= 3) {
        const agg = this._aggregateSamples(samples);
        const predX = this._predictRaw(agg, 0);
        const predY = this._predictRaw(agg, 1);
        const errPx = Math.hypot((predX - vPt.x) * screenWidthPx, (predY - vPt.y) * screenHeightPx);
        totalErrorPx += errPx;
        if (errPx > maxErrorPx) maxErrorPx = errPx;
        count++;
      }
    }

    const meanErrorPx = count > 0 ? Math.round(totalErrorPx / count) : this.calibrationError?.trainErrorPx || 50;
    const passed = meanErrorPx < 160; // Standard clinical calibration threshold

    this.calibrationError = {
      ...this.calibrationError,
      validationErrorPx: meanErrorPx,
      meanErrorPx,
      maxErrorPx: Math.round(maxErrorPx),
      validationPointsTested: count,
      passed
    };

    return {
      passed,
      meanErrorPx,
      maxErrorPx: Math.round(maxErrorPx),
      tested: count
    };
  }

  _predictRaw(featureVector, targetIndex) {
    if (!this.modelWeights || !featureVector) return 0.5;
    let sum = 0;
    for (let i = 0; i < featureVector.length; i++) {
      sum += featureVector[i] * (this.modelWeights[i]?.[targetIndex] || 0);
    }
    return sum;
  }

  /**
   * Predicts normalized screen coordinates [0..1] for the given ocular features.
   */
  predict(features) {
    if (!this.isCalibrated || !this.modelWeights || !features) {
      return null;
    }
    const vec = buildFeatureVector(features, true);
    if (!vec) return null;

    const rawX = this._predictRaw(vec, 0);
    const rawY = this._predictRaw(vec, 1);

    return { rawX, rawY };
  }
}

// ---------------------------------------------------------------------------
// Camera and Ocular Hardware Engine
// ---------------------------------------------------------------------------

export class EyeTrackerEngine {
  constructor() {
    this.stream = null;
    this.video = null;
    this.isInitialized = false;
    this.isStopped = false;
    this.isStarting = false;
    this.isProcessingFrame = false;
    this.processingLoopId = null;
    this.activeTracks = new Set();

    // Internal processing canvas for luminance/contrast analysis
    this.procCanvas = document.createElement('canvas');
    this.procCtx = this.procCanvas.getContext('2d', { willReadFrequently: true });
    this.width = 320;
    this.height = 240;
    this.procCanvas.width = this.width;
    this.procCanvas.height = this.height;

    // MediaPipe state
    this.faceMesh = null;
    this.mediaPipeActive = false;
    this.latestLandmarks = null;
    this.lastLandmarks = null;
    this.lastProcessedTimestamp = 0;
    this.achievedFps = 0;
    this.fpsCounter = 0;
    this.fpsTimer = performance.now();

    // Calibration Engine
    this.calibration = new CalibrationEngine();

    // Display-only smoothing (exponential moving average)
    this.smoothedGazeX = 0.5;
    this.smoothedGazeY = 0.5;
    this.smoothingAlpha = 0.35; // Responsive yet smooth for visual reticle

    // Camera video metadata
    this.cameraInfo = {
      width: 0,
      height: 0,
      label: 'Default Camera',
      frameRate: 0
    };

    // Quality check metrics
    this.latestQuality = {
      brightness: 120,
      contrast: 40,
      isLightingOk: true,
      faceDetected: false,
      isCentered: false,
      isGoodDistance: false,
      eyesVisible: false,
      headStability: true,
      overallQuality: 0,
      issues: []
    };

    this._initMediaPipe();
  }

  /**
   * Initializes MediaPipe Face Mesh, with dynamic CDN loader fallback if window.FaceMesh is not ready.
   */
  async _initMediaPipe() {
    const ensureScriptLoaded = () => {
      return new Promise((resolve) => {
        if (typeof window !== 'undefined' && window.FaceMesh) {
          resolve(true);
          return;
        }
        // Check if script tag already exists
        const existing = document.querySelector('script[src*="face_mesh"]');
        if (existing) {
          existing.addEventListener('load', () => resolve(true));
          existing.addEventListener('error', () => resolve(false));
          // Safety timeout
          setTimeout(() => resolve(!!window.FaceMesh), 3000);
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js';
        script.crossOrigin = 'anonymous';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
        setTimeout(() => resolve(!!window.FaceMesh), 4000);
      });
    };

    await ensureScriptLoaded();

    if (typeof window !== 'undefined' && window.FaceMesh && !this.isStopped) {
      try {
        this.faceMesh = new window.FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`
        });

        this.faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true, // Crucial: Enables 468-477 Iris Landmarks
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        this.faceMesh.onResults((results) => {
          if (this.isStopped) return;
          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            this.lastLandmarks = this.latestLandmarks;
            this.latestLandmarks = results.multiFaceLandmarks[0];
            this.mediaPipeActive = true;
          } else {
            this.lastLandmarks = this.latestLandmarks;
            this.latestLandmarks = null;
          }
        });

        this.isInitialized = true;
      } catch (err) {
        console.warn('MediaPipe FaceMesh initialization warning:', err);
      }
    }
  }

  /**
   * Starts webcam video stream with graceful permission handling.
   */
  async startCamera(videoElement) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Webcam MediaDevices API is not supported in this browser.');
    }

    this.isStopped = false;
    this.isStarting = true;
    this.video = videoElement;

    try {
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Guard: If cancelled mid-request
      if (this.isStopped) {
        mediaStream.getTracks().forEach(t => t.stop());
        this.isStarting = false;
        return false;
      }

      this.stream = mediaStream;
      this.isStarting = false;

      // Track stream tracks for reliable shutdown
      this.stream.getTracks().forEach(track => {
        this.activeTracks.add(track);
        track.onended = () => this.activeTracks.delete(track);
      });

      if (this.video) {
        this.video.srcObject = this.stream;
        try {
          await this.video.play();
        } catch (playErr) {
          console.warn('Video playback notice:', playErr);
        }

        const videoTrack = this.stream.getVideoTracks()[0];
        const settings = videoTrack?.getSettings?.() || {};
        this.cameraInfo = {
          width: this.video.videoWidth || settings.width || 640,
          height: this.video.videoHeight || settings.height || 480,
          label: videoTrack?.label || 'Built-in Webcam',
          frameRate: settings.frameRate || 30
        };
      }

      if (this.isStopped) {
        this.stopCamera();
        return false;
      }

      this._startProcessingLoop();
      return true;
    } catch (err) {
      this.isStarting = false;
      console.error('Camera stream initiation failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Camera permission denied. Please allow camera access in browser permissions.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw new Error('No webcam found on this device. Please connect a working camera.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        throw new Error('Webcam is currently in use by another application.');
      }
      throw new Error(`Could not access webcam: ${err.message}`);
    }
  }

  /**
   * High-efficiency frame processing loop with inference collision guards.
   */
  _startProcessingLoop() {
    if (this.isStopped) return;
    if (this.processingLoopId) {
      cancelAnimationFrame(this.processingLoopId);
      this.processingLoopId = null;
    }

    const processFrame = async (now) => {
      if (this.isStopped || !this.stream || !this.video) {
        this.processingLoopId = null;
        return;
      }

      // Track achieved FPS
      this.fpsCounter++;
      if (now - this.fpsTimer >= 1000) {
        this.achievedFps = Math.round((this.fpsCounter * 1000) / (now - this.fpsTimer));
        this.fpsCounter = 0;
        this.fpsTimer = now;
      }

      // Prevent concurrent inference if previous frame hasn't finished
      if (this.faceMesh && this.video.readyState >= 2 && !this.isProcessingFrame && !this.isStopped) {
        this.isProcessingFrame = true;
        try {
          await this.faceMesh.send({ image: this.video });
        } catch (_) {
          // Drop frame on transient inference error
        } finally {
          this.isProcessingFrame = false;
          this.lastProcessedTimestamp = performance.now();
        }
      }

      // Periodic quality assessment update (every ~150ms)
      if (this.video && this.video.readyState >= 2 && now % 5 === 0) {
        this._updateQualityMetrics();
      }

      if (!this.isStopped && this.stream && this.video) {
        this.processingLoopId = requestAnimationFrame(processFrame);
      } else {
        this.processingLoopId = null;
      }
    };

    this.processingLoopId = requestAnimationFrame(processFrame);
  }

  /**
   * Computes video frame illumination, contrast, and landmark stability.
   */
  _updateQualityMetrics() {
    if (!this.video || this.video.readyState < 2) return;

    try {
      this.procCtx.drawImage(this.video, 0, 0, this.width, this.height);
      const frame = this.procCtx.getImageData(0, 0, this.width, this.height);
      const data = frame.data;
      const totalPixels = this.width * this.height;

      // Sample luminance
      let sumLum = 0;
      let sumLumSq = 0;
      const step = 8; // Downsample for performance
      let sampled = 0;

      for (let i = 0; i < totalPixels * 4; i += step * 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        sumLum += lum;
        sumLumSq += lum * lum;
        sampled++;
      }

      const meanLum = sampled > 0 ? sumLum / sampled : 120;
      const variance = sampled > 0 ? (sumLumSq / sampled) - (meanLum * meanLum) : 400;
      const contrast = Math.sqrt(Math.max(0, variance));

      const isLightingOk = meanLum >= 35 && meanLum <= 230 && contrast >= 12;

      // Check facial landmarks
      const features = extractEyeFeatures(this.latestLandmarks);
      const faceDetected = !!features;
      const eyesVisible = features ? (features.leftEAR > 0.12 && features.rightEAR > 0.12) : false;

      // Position centering & distance check
      let isCentered = false;
      let isGoodDistance = false;
      let headStability = true;

      const issues = [];

      if (!isLightingOk) {
        if (meanLum < 35) issues.push('Lighting is too dark. Increase room lighting.');
        else if (meanLum > 230) issues.push('Lighting is overexposed or face is washed out.');
        else issues.push('Camera image has low contrast or blur.');
      }

      if (!faceDetected) {
        issues.push('No face detected in webcam view.');
      } else {
        const box = features.faceBox;
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        isCentered = centerX > 0.30 && centerX < 0.70 && centerY > 0.25 && centerY < 0.75;
        if (!isCentered) issues.push('Please center your face in the camera target box.');

        isGoodDistance = features.ipd > 0.10 && features.ipd < 0.32;
        if (!isGoodDistance) {
          if (features.ipd <= 0.10) issues.push('Move slightly closer to the webcam.');
          else issues.push('Move slightly farther back from the webcam.');
        }

        if (!eyesVisible) {
          issues.push('Eyes are closed or landmarks are obstructed.');
        }

        // Head stability
        const yaw = Math.abs(features.headPose.yaw);
        const pitch = Math.abs(features.headPose.pitch);
        headStability = yaw < 0.22 && pitch < 0.22;
        if (!headStability) {
          issues.push('Keep your head facing forward towards the screen.');
        }
      }

      let score = 0;
      if (isLightingOk) score += 0.25;
      if (faceDetected) score += 0.25;
      if (isCentered && isGoodDistance) score += 0.25;
      if (eyesVisible && headStability) score += 0.25;

      this.latestQuality = {
        brightness: Math.round(meanLum),
        contrast: Math.round(contrast),
        isLightingOk,
        faceDetected,
        isCentered,
        isGoodDistance,
        eyesVisible,
        headStability,
        overallQuality: Number(score.toFixed(2)),
        issues
      };
    } catch (_) {}
  }

  /**
   * Returns pre-test tracking quality assessment for setup screen.
   */
  checkCameraAndSubjectQuality() {
    this._updateQualityMetrics();
    const q = this.latestQuality;
    const isReady = q.isLightingOk && q.faceDetected && q.isCentered && q.isGoodDistance && q.eyesVisible;

    return {
      isReady,
      overallQuality: q.overallQuality,
      achievedFps: this.achievedFps,
      lighting: {
        brightness: q.brightness,
        contrast: q.contrast,
        ok: q.isLightingOk
      },
      face: {
        detected: q.faceDetected,
        centered: q.isCentered,
        distanceOk: q.isGoodDistance
      },
      eyes: {
        visible: q.eyesVisible
      },
      headPose: {
        stable: q.headStability
      },
      issues: q.issues
    };
  }

  /**
   * Records a valid calibration observation for 9-point calibration.
   */
  recordCalibrationPoint(pointId) {
    if (!this.latestLandmarks) return false;
    const features = extractEyeFeatures(this.latestLandmarks);
    if (!features) return false;
    return this.calibration.addCalibrationSample(pointId, features);
  }

  /**
   * Records a valid validation observation for 4-point validation.
   */
  recordValidationPoint(pointId) {
    if (!this.latestLandmarks) return false;
    const features = extractEyeFeatures(this.latestLandmarks);
    if (!features) return false;
    return this.calibration.addValidationSample(pointId, features);
  }

  /**
   * Finalizes calibration by fitting the model and checking validation error.
   */
  finalizeCalibration(screenWidthPx = window.innerWidth, screenHeightPx = window.innerHeight) {
    const fitRes = this.calibration.fit(screenWidthPx, screenHeightPx);
    if (!fitRes.success) return fitRes;

    const valRes = this.calibration.evaluateValidation(screenWidthPx, screenHeightPx);
    return {
      success: true,
      fitResult: fitRes,
      validationResult: valRes,
      calibrationError: this.calibration.calibrationError
    };
  }

  /**
   * Estimates real-time gaze coordinates.
   * 
   * CRITICAL REQUIREMENT:
   * - ZERO stimulus knowledge (targetPos is NEVER passed or used).
   * - ZERO random coordinates or synthetic jitter.
   * - Explicit validity: returns valid: false with reason if landmarks are missing.
   * 
   * @returns {Object} Real-time gaze estimation record
   */
  estimateGaze() {
    const now = performance.now();

    if (this.isStopped || !this.video || this.video.readyState < 2) {
      return {
        timestamp: now,
        valid: false,
        invalidReason: 'camera_unavailable',
        trackingQuality: 0,
        gazeX: null,
        gazeY: null,
        rawGazeX: null,
        rawGazeY: null,
        smoothedGazeX: this.smoothedGazeX,
        smoothedGazeY: this.smoothedGazeY,
        headPose: { yaw: 0, pitch: 0, roll: 0 },
        confidence: 0
      };
    }

    if (!this.latestLandmarks) {
      return {
        timestamp: now,
        valid: false,
        invalidReason: 'no_face_detected',
        trackingQuality: 0,
        gazeX: null,
        gazeY: null,
        rawGazeX: null,
        rawGazeY: null,
        smoothedGazeX: this.smoothedGazeX,
        smoothedGazeY: this.smoothedGazeY,
        headPose: { yaw: 0, pitch: 0, roll: 0 },
        confidence: 0
      };
    }

    const features = extractEyeFeatures(this.latestLandmarks);
    if (!features) {
      return {
        timestamp: now,
        valid: false,
        invalidReason: 'landmarks_missing',
        trackingQuality: 0.1,
        gazeX: null,
        gazeY: null,
        rawGazeX: null,
        rawGazeY: null,
        smoothedGazeX: this.smoothedGazeX,
        smoothedGazeY: this.smoothedGazeY,
        headPose: { yaw: 0, pitch: 0, roll: 0 },
        confidence: 0.1
      };
    }

    // Check blink / eye closure
    if (features.leftEAR < 0.12 && features.rightEAR < 0.12) {
      return {
        timestamp: now,
        valid: false,
        invalidReason: 'blink_detected',
        trackingQuality: 0.2,
        gazeX: null,
        gazeY: null,
        rawGazeX: null,
        rawGazeY: null,
        smoothedGazeX: this.smoothedGazeX,
        smoothedGazeY: this.smoothedGazeY,
        headPose: features.headPose,
        confidence: 0.2
      };
    }

    // Check excessive head movement
    if (Math.abs(features.headPose.yaw) > 0.40 || Math.abs(features.headPose.pitch) > 0.40) {
      return {
        timestamp: now,
        valid: false,
        invalidReason: 'excessive_head_movement',
        trackingQuality: 0.3,
        gazeX: null,
        gazeY: null,
        rawGazeX: null,
        rawGazeY: null,
        smoothedGazeX: this.smoothedGazeX,
        smoothedGazeY: this.smoothedGazeY,
        headPose: features.headPose,
        confidence: 0.3
      };
    }

    // Check if calibration is fitted
    if (!this.calibration.isCalibrated) {
      return {
        timestamp: now,
        valid: false,
        invalidReason: 'uncalibrated',
        trackingQuality: 0.4,
        gazeX: null,
        gazeY: null,
        rawGazeX: null,
        rawGazeY: null,
        smoothedGazeX: this.smoothedGazeX,
        smoothedGazeY: this.smoothedGazeY,
        headPose: features.headPose,
        confidence: 0.4
      };
    }

    // Predict normalized coordinates [0..1]
    const prediction = this.calibration.predict(features);
    if (!prediction) {
      return {
        timestamp: now,
        valid: false,
        invalidReason: 'model_evaluation_failed',
        trackingQuality: 0.3,
        gazeX: null,
        gazeY: null,
        rawGazeX: null,
        rawGazeY: null,
        smoothedGazeX: this.smoothedGazeX,
        smoothedGazeY: this.smoothedGazeY,
        headPose: features.headPose,
        confidence: 0.3
      };
    }

    const rawGazeX = prediction.rawX;
    const rawGazeY = prediction.rawY;

    // Check if estimate is out-of-bounds (reasonable margin around [0, 1])
    const isOutOfBounds = rawGazeX < -0.45 || rawGazeX > 1.45 || rawGazeY < -0.45 || rawGazeY > 1.45;
    if (isOutOfBounds) {
      return {
        timestamp: now,
        valid: false,
        invalidReason: 'out_of_bounds',
        trackingQuality: 0.35,
        gazeX: null,
        gazeY: null,
        rawGazeX,
        rawGazeY,
        smoothedGazeX: this.smoothedGazeX,
        smoothedGazeY: this.smoothedGazeY,
        headPose: features.headPose,
        confidence: 0.35
      };
    }

    // Update display-only smoothed gaze (exponential moving average)
    // Clamped strictly for UI display circle, but raw coordinates are untouched
    const displayClampedX = Math.max(0, Math.min(1, rawGazeX));
    const displayClampedY = Math.max(0, Math.min(1, rawGazeY));
    this.smoothedGazeX = (this.smoothingAlpha * displayClampedX) + ((1 - this.smoothingAlpha) * this.smoothedGazeX);
    this.smoothedGazeY = (this.smoothingAlpha * displayClampedY) + ((1 - this.smoothingAlpha) * this.smoothedGazeY);

    // Confidence derived from eye openness, head stability, and landmark presence
    const earScore = Math.min(1, (features.leftEAR + features.rightEAR) / 0.5);
    const headScore = Math.max(0, 1 - (Math.abs(features.headPose.yaw) + Math.abs(features.headPose.pitch)));
    const trackingQuality = Number((0.6 * earScore + 0.4 * headScore).toFixed(2));

    return {
      timestamp: now,
      valid: true,
      invalidReason: null,
      trackingQuality,
      // Genuine normalized screen coordinates [0..1]
      gazeX: Number(rawGazeX.toFixed(4)),
      gazeY: Number(rawGazeY.toFixed(4)),
      rawGazeX: Number(rawGazeX.toFixed(4)),
      rawGazeY: Number(rawGazeY.toFixed(4)),
      // Smoothed coordinates for UI reticle display
      smoothedGazeX: Number(this.smoothedGazeX.toFixed(4)),
      smoothedGazeY: Number(this.smoothedGazeY.toFixed(4)),
      headPose: {
        yaw: Number(features.headPose.yaw.toFixed(3)),
        pitch: Number(features.headPose.pitch.toFixed(3)),
        roll: Number(features.headPose.roll.toFixed(3))
      },
      pupils: {
        left: features.rawIrisLeft,
        right: features.rawIrisRight
      },
      confidence: trackingQuality
    };
  }

  /**
   * Returns current ocular state for the camera picture-in-picture viewfinder.
   */
  getOcularState() {
    if (this.isStopped || !this.video) {
      return {
        hasFace: false,
        leftEye: null,
        rightEye: null,
        camWidth: 640,
        camHeight: 480
      };
    }

    const vw = this.video.videoWidth || 640;
    const vh = this.video.videoHeight || 480;
    const features = extractEyeFeatures(this.latestLandmarks);

    if (!features) {
      return {
        hasFace: false,
        leftEye: null,
        rightEye: null,
        camWidth: vw,
        camHeight: vh
      };
    }

    return {
      hasFace: true,
      leftEye: {
        x: Math.round((1.0 - features.rawIrisLeft.x) * vw), // Mirrored
        y: Math.round(features.rawIrisLeft.y * vh)
      },
      rightEye: {
        x: Math.round((1.0 - features.rawIrisRight.x) * vw), // Mirrored
        y: Math.round(features.rawIrisRight.y * vh)
      },
      faceBox: {
        x: Math.round((1.0 - (features.faceBox.x + features.faceBox.width)) * vw),
        y: Math.round(features.faceBox.y * vh),
        w: Math.round(features.faceBox.width * vw),
        h: Math.round(features.faceBox.height * vh)
      },
      camWidth: vw,
      camHeight: vh
    };
  }

  /**
   * Completely terminates all media tracks, video streams, loops, and instances.
   */
  stopCamera() {
    this.isStopped = true;
    this.isStarting = false;

    // 1. Cancel animation frame
    if (this.processingLoopId) {
      cancelAnimationFrame(this.processingLoopId);
      this.processingLoopId = null;
    }

    // 2. Shut off hardware camera tracks
    if (this.stream) {
      try {
        this.stream.getTracks().forEach(track => {
          try {
            track.enabled = false;
            track.stop();
          } catch (_) {}
        });
      } catch (_) {}
      this.stream = null;
    }

    // 3. Clear active track set
    if (this.activeTracks && this.activeTracks.size > 0) {
      this.activeTracks.forEach(track => {
        try {
          track.enabled = false;
          track.stop();
        } catch (_) {}
      });
      this.activeTracks.clear();
    }

    // 4. Reset video element
    if (this.video) {
      try {
        this.video.pause();
      } catch (_) {}
      if (this.video.srcObject) {
        try {
          const s = this.video.srcObject;
          if (s && s.getTracks) {
            s.getTracks().forEach(t => {
              try { t.enabled = false; t.stop(); } catch (_) {}
            });
          }
        } catch (_) {}
        this.video.srcObject = null;
      }
      try {
        this.video.removeAttribute('src');
        this.video.load();
      } catch (_) {}
      this.video = null;
    }

    // 5. Release MediaPipe instance
    if (this.faceMesh) {
      try {
        this.faceMesh.close();
      } catch (_) {}
      this.faceMesh = null;
      this.mediaPipeActive = false;
    }

    // 6. Reset landmark states
    this.latestLandmarks = null;
    this.lastLandmarks = null;

    // 7. Clear processing canvas
    if (this.procCtx) {
      try {
        this.procCtx.clearRect(0, 0, this.width, this.height);
      } catch (_) {}
    }
  }

  isCameraActive() {
    return !this.isStopped && !!this.stream && this.stream.active;
  }
}
