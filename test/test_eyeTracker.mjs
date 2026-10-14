/**
 * test_eyeTracker.mjs — Comprehensive unit tests for EyeTrackerEngine mathematical modules:
 * - Ridge Regression solver
 * - Feature vector construction
 * - Facial landmark feature extraction & EAR blink detection
 * - Head pose calculation (yaw, pitch, roll)
 * - 9-point calibration & 4-point validation engine
 * - Validity policy & error calculations
 *
 * Run with: node test/test_eyeTracker.mjs
 */

import {
  solveRidgeRegression,
  buildFeatureVector,
  extractEyeFeatures,
  CalibrationEngine,
  CALIBRATION_POINTS,
  VALIDATION_POINTS
} from '../src/utils/eyeTracker.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function assertApprox(actual, expected, tolerance, message) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (ok) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message} (expected ~${expected}, got ${actual})`);
  }
}

console.log('--- Test Group 1: Ridge Regression Solver ---');
{
  // Test 1.1: 2D linear mapping: Y = X * W where W = [[0.2, 0.1], [2.0, -1.0]]
  // X = [1, x1]
  const X = [
    [1, 0.0],
    [1, 0.25],
    [1, 0.50],
    [1, 0.75],
    [1, 1.0]
  ];
  const trueW = [
    [0.2, 0.1],
    [2.0, -1.0]
  ];
  const Y = X.map(row => [
    row[0] * trueW[0][0] + row[1] * trueW[1][0],
    row[0] * trueW[0][1] + row[1] * trueW[1][1]
  ]);

  const W = solveRidgeRegression(X, Y, 0.0001);
  assert(W !== null, 'Ridge regression should return weight matrix');
  assert(W.length === 2 && W[0].length === 2, 'Weight matrix dimension should be 2x2');
  assertApprox(W[0][0], 0.2, 0.02, 'Bias for target 0 should be ~0.2');
  assertApprox(W[1][0], 2.0, 0.02, 'Slope for target 0 should be ~2.0');
  assertApprox(W[0][1], 0.1, 0.02, 'Bias for target 1 should be ~0.1');
  assertApprox(W[1][1], -1.0, 0.02, 'Slope for target 1 should be ~-1.0');
}

{
  // Test 1.2: Degenerate collinear data should not throw (regularization stability)
  const X_collinear = [
    [1, 0.5, 0.5],
    [1, 0.5, 0.5],
    [1, 0.5, 0.5]
  ];
  const Y = [[0.1, 0.2], [0.1, 0.2], [0.1, 0.2]];
  const W_reg = solveRidgeRegression(X_collinear, Y, 0.1);
  assert(W_reg !== null, 'Collinear system with ridge regularization should solve without crashing');
}

console.log('--- Test Group 2: Feature Vector Construction ---');
{
  const mockFeatures = {
    irisLeftRatioX: 0.45,
    irisLeftRatioY: 0.55,
    irisRightRatioX: 0.48,
    irisRightRatioY: 0.52,
    headPose: { yaw: 0.02, pitch: -0.01, roll: 0.00 }
  };

  const vecNoPoly = buildFeatureVector(mockFeatures, false);
  assert(vecNoPoly.length === 8, `Linear feature vector length should be 8, got ${vecNoPoly.length}`);
  assert(vecNoPoly[0] === 1.0, 'Index 0 should be constant bias 1.0');
  assertApprox(vecNoPoly[1], 0.465, 0.001, 'Index 1 should be avg iris ratio X (0.45+0.48)/2');

  const vecPoly = buildFeatureVector(mockFeatures, true);
  assert(vecPoly.length === 13, `Polynomial feature vector length should be 13, got ${vecPoly.length}`);
}

console.log('--- Test Group 3: Facial Landmark Feature Extraction ---');
{
  // Generate 478 mock landmarks
  const mockLandmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));

  // Set Left Eye: Outer 33=(0.3, 0.4), Inner 133=(0.4, 0.4), Top 159=(0.35, 0.38), Bottom 145=(0.35, 0.42), Iris 468=(0.35, 0.40)
  mockLandmarks[33] = { x: 0.3, y: 0.4, z: 0 };
  mockLandmarks[133] = { x: 0.4, y: 0.4, z: 0 };
  mockLandmarks[159] = { x: 0.35, y: 0.38, z: 0 };
  mockLandmarks[145] = { x: 0.35, y: 0.42, z: 0 };
  mockLandmarks[468] = { x: 0.35, y: 0.40, z: 0 };

  // Set Right Eye: Inner 362=(0.6, 0.4), Outer 263=(0.7, 0.4), Top 386=(0.65, 0.38), Bottom 374=(0.65, 0.42), Iris 473=(0.65, 0.40)
  mockLandmarks[362] = { x: 0.6, y: 0.4, z: 0 };
  mockLandmarks[263] = { x: 0.7, y: 0.4, z: 0 };
  mockLandmarks[386] = { x: 0.65, y: 0.38, z: 0 };
  mockLandmarks[374] = { x: 0.65, y: 0.42, z: 0 };
  mockLandmarks[473] = { x: 0.65, y: 0.40, z: 0 };

  // Head pose landmarks: Nose 1, Chin 152, Forehead 10, Left temple 234, Right temple 454
  mockLandmarks[1] = { x: 0.5, y: 0.45, z: 0 };
  mockLandmarks[152] = { x: 0.5, y: 0.75, z: 0 };
  mockLandmarks[10] = { x: 0.5, y: 0.15, z: 0 };
  mockLandmarks[234] = { x: 0.25, y: 0.45, z: 0 };
  mockLandmarks[454] = { x: 0.75, y: 0.45, z: 0 };

  const extracted = extractEyeFeatures(mockLandmarks);
  assert(extracted !== null, 'extractEyeFeatures should extract valid object');
  assertApprox(extracted.irisLeftRatioX, 0.5, 0.05, 'Left iris centered horizontally ratio ~0.5');
  assertApprox(extracted.irisLeftRatioY, 0.5, 0.05, 'Left iris centered vertically ratio ~0.5');
  assertApprox(extracted.irisRightRatioX, 0.5, 0.05, 'Right iris centered horizontally ratio ~0.5');
  assertApprox(extracted.irisRightRatioY, 0.5, 0.05, 'Right iris centered vertically ratio ~0.5');
  assert(extracted.leftEAR > 0.2, `Left EAR should be open, got ${extracted.leftEAR}`);
  assert(extracted.rightEAR > 0.2, `Right EAR should be open, got ${extracted.rightEAR}`);
  assertApprox(extracted.headPose.yaw, 0.0, 0.05, 'Nose at midpoint gives yaw ~0.0');
}

console.log('--- Test Group 4: Blink Detection via Palpebral Aperture ---');
{
  const closedEyeLandmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  // Top and bottom eyelid touching (y difference ~ 0)
  closedEyeLandmarks[33] = { x: 0.3, y: 0.4, z: 0 };
  closedEyeLandmarks[133] = { x: 0.4, y: 0.4, z: 0 };
  closedEyeLandmarks[159] = { x: 0.35, y: 0.401, z: 0 };
  closedEyeLandmarks[145] = { x: 0.35, y: 0.402, z: 0 }; // Height is 0.001, Width is 0.1 -> EAR = 0.01

  closedEyeLandmarks[362] = { x: 0.6, y: 0.4, z: 0 };
  closedEyeLandmarks[263] = { x: 0.7, y: 0.4, z: 0 };
  closedEyeLandmarks[386] = { x: 0.65, y: 0.401, z: 0 };
  closedEyeLandmarks[374] = { x: 0.65, y: 0.402, z: 0 };

  const closedExtracted = extractEyeFeatures(closedEyeLandmarks);
  assert(closedExtracted.leftEAR < 0.10, `Closed eye EAR should be < 0.10, got ${closedExtracted.leftEAR}`);
  assert(closedExtracted.rightEAR < 0.10, `Closed eye EAR should be < 0.10, got ${closedExtracted.rightEAR}`);
}

console.log('--- Test Group 5: 9-Point Calibration and Validation Lifecycle ---');
{
  const calib = new CalibrationEngine();
  assert(calib.isCalibrated === false, 'Initially uncalibrated');

  // Populate synthetic samples for all 9 calibration points
  // Target position linearly shifts iris position: irisRatioX ~ target.x * 0.4 + 0.3, irisRatioY ~ target.y * 0.4 + 0.3
  for (const pt of CALIBRATION_POINTS) {
    for (let sample = 0; sample < 10; sample++) {
      const mockFeatures = {
        irisLeftRatioX: pt.x * 0.4 + 0.3 + (sample - 5) * 0.002,
        irisLeftRatioY: pt.y * 0.4 + 0.3 + (sample - 5) * 0.002,
        irisRightRatioX: pt.x * 0.4 + 0.3 + (sample - 5) * 0.002,
        irisRightRatioY: pt.y * 0.4 + 0.3 + (sample - 5) * 0.002,
        leftEAR: 0.35,
        rightEAR: 0.35,
        headPose: { yaw: 0.01, pitch: -0.01, roll: 0.0 }
      };
      const added = calib.addCalibrationSample(pt.id, mockFeatures);
      assert(added === true, `Sample ${sample} for point ${pt.id} should be accepted`);
    }
  }

  // Populate independent validation samples
  for (const vPt of VALIDATION_POINTS) {
    for (let s = 0; s < 5; s++) {
      const mockValFeatures = {
        irisLeftRatioX: vPt.x * 0.4 + 0.3,
        irisLeftRatioY: vPt.y * 0.4 + 0.3,
        irisRightRatioX: vPt.x * 0.4 + 0.3,
        irisRightRatioY: vPt.y * 0.4 + 0.3,
        leftEAR: 0.35,
        rightEAR: 0.35,
        headPose: { yaw: 0.01, pitch: -0.01, roll: 0.0 }
      };
      calib.addValidationSample(vPt.id, mockValFeatures);
    }
  }

  // Fit calibration
  const fitResult = calib.fit(1920, 1080);
  assert(fitResult.success === true, `Fitting should succeed: ${fitResult.message}`);
  assert(calib.isCalibrated === true, 'isCalibrated should now be true');

  // Evaluate on independent validation targets
  const valResult = calib.evaluateValidation(1920, 1080);
  assert(valResult.passed === true, 'Validation check should pass for accurate calibration');
  assert(valResult.meanErrorPx < 80, `Validation mean error should be small, got ${valResult.meanErrorPx}px`);

  // Test prediction at screen center (target (0.5, 0.5) -> iris ratio (0.5*0.4 + 0.3 = 0.5))
  const centerFeatures = {
    irisLeftRatioX: 0.50,
    irisLeftRatioY: 0.50,
    irisRightRatioX: 0.50,
    irisRightRatioY: 0.50,
    headPose: { yaw: 0.01, pitch: -0.01, roll: 0.0 }
  };
  const pred = calib.predict(centerFeatures);
  assert(pred !== null, 'Predict should return coordinates');
  assertApprox(pred.rawX, 0.50, 0.06, 'Predicted X at center should be ~0.50');
  assertApprox(pred.rawY, 0.50, 0.06, 'Predicted Y at center should be ~0.50');
}

console.log('--- Test Group 6: Target-Following Error Calculation Excluding Invalid Frames ---');
{
  const samples = [
    { valid: true, gazeX: 0.50, gazeY: 0.50, targetX: 0.52, targetY: 0.50 },
    { valid: false, gazeX: null, gazeY: null, targetX: 0.60, targetY: 0.50, invalidReason: 'blink' },
    { valid: true, gazeX: 0.55, gazeY: 0.51, targetX: 0.55, targetY: 0.50 },
    { valid: false, gazeX: null, gazeY: null, targetX: 0.70, targetY: 0.50, invalidReason: 'no_face' },
  ];

  const validSamples = samples.filter(s => s.valid);
  assert(validSamples.length === 2, 'Should filter out invalid samples from error metric');

  let totalErrorNorm = 0;
  validSamples.forEach(s => {
    const err = Math.hypot(s.targetX - s.gazeX, s.targetY - s.gazeY);
    totalErrorNorm += err;
  });
  const meanErrorNorm = totalErrorNorm / validSamples.length;
  assertApprox(meanErrorNorm, 0.015, 0.005, 'Mean normalized error calculated strictly on valid samples');
}

console.log(`\n═══ Eye Tracker Unit Tests: ${passed} passed, ${failed} failed ═══`);
if (failed > 0) {
  process.exit(1);
}
