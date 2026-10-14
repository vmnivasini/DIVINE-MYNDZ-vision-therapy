/**
 * test_targetHistory.mjs — Unit tests for targetHistory.js
 *
 * Run with:   node test/test_targetHistory.mjs
 *
 * Tests cover:
 *   1. Empty buffer lookup returns null
 *   2. Single-sample lookup (exact match)
 *   3. Lookup before first sample returns null
 *   4. Lookup after last sample returns last (no extrapolation)
 *   5. Linear interpolation between two samples
 *   6. Interpolation at exact boundary timestamps
 *   7. Buffer overflow / bounded size
 *   8. Monotonicity enforcement (stale timestamps dropped)
 *   9. Gaze recording and getLatestGaze
 *  10. Diagnostics counters
 *  11. Reset clears everything
 *  12. Multi-sample binary search correctness
 *  13. Missing-sample counter increments
 */

import { createTargetHistory } from '../src/utils/targetHistory.js';

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

// ─── Test 1: Empty buffer ──────────────────────────────────────────────────
console.log('Test 1: Empty buffer lookup');
{
  const h = createTargetHistory();
  const result = h.lookupTarget(1000);
  assert(result === null, 'lookupTarget on empty buffer should return null');
}

// ─── Test 2: Single-sample exact match ─────────────────────────────────────
console.log('Test 2: Single-sample exact match');
{
  const h = createTargetHistory();
  h.recordTarget(100, 500, 300);
  const result = h.lookupTarget(100);
  assert(result !== null, 'should find the single sample');
  assert(result.x === 500, 'x should be 500');
  assert(result.y === 300, 'y should be 300');
  assert(result.exact === true, 'should be an exact match');
  assert(result.ageMs === 0, 'ageMs should be 0 for exact match');
}

// ─── Test 3: Lookup before first sample ────────────────────────────────────
console.log('Test 3: Lookup before first sample');
{
  const h = createTargetHistory();
  h.recordTarget(200, 100, 100);
  h.recordTarget(300, 200, 200);
  const result = h.lookupTarget(50);
  assert(result === null, 'lookup before all samples should return null');
}

// ─── Test 4: Lookup after last sample ──────────────────────────────────────
console.log('Test 4: Lookup after last sample (no extrapolation)');
{
  const h = createTargetHistory();
  h.recordTarget(100, 10, 20);
  h.recordTarget(200, 30, 40);
  const result = h.lookupTarget(500);
  assert(result !== null, 'should return last sample');
  assert(result.x === 30, 'x should be last sample x');
  assert(result.y === 40, 'y should be last sample y');
  assert(result.exact === false, 'should not be exact');
  assert(result.ageMs === 300, 'ageMs should be 300');
}

// ─── Test 5: Linear interpolation ──────────────────────────────────────────
console.log('Test 5: Linear interpolation between two samples');
{
  const h = createTargetHistory();
  h.recordTarget(100, 0,   0);
  h.recordTarget(200, 100, 200);
  // At t=150, midpoint: x=50, y=100
  const result = h.lookupTarget(150);
  assert(result !== null, 'should find interpolated position');
  assertApprox(result.x, 50, 0.01, 'interpolated x');
  assertApprox(result.y, 100, 0.01, 'interpolated y');
  assert(result.exact === false, 'should not be exact');

  // At t=125, quarter point: x=25, y=50
  const result2 = h.lookupTarget(125);
  assertApprox(result2.x, 25, 0.01, 'quarter-interpolated x');
  assertApprox(result2.y, 50, 0.01, 'quarter-interpolated y');
}

// ─── Test 6: Interpolation at exact boundary timestamps ────────────────────
console.log('Test 6: Exact boundary timestamps');
{
  const h = createTargetHistory();
  h.recordTarget(100, 10, 20);
  h.recordTarget(200, 30, 40);
  h.recordTarget(300, 50, 60);

  const r1 = h.lookupTarget(100);
  assert(r1.exact === true, 'first sample exact');
  assert(r1.x === 10, 'first sample x');

  const r3 = h.lookupTarget(300);
  // At the last sample boundary
  assert(r3.x === 50, 'last sample x');
}

// ─── Test 7: Buffer overflow ───────────────────────────────────────────────
console.log('Test 7: Buffer overflow / bounded size');
{
  const h = createTargetHistory();
  // Record more than MAX_TARGET_HISTORY (600) samples
  for (let i = 0; i < 700; i++) {
    h.recordTarget(i * 16, i, i * 2);
  }
  // Internal buffer should be capped at 600
  assert(h._targetSamples.length === 600, `buffer should be 600, got ${h._targetSamples.length}`);
  // Oldest should have been evicted; earliest remaining is sample index 100
  assert(h._targetSamples[0].t === 100 * 16, 'oldest sample should be at t=1600');
}

// ─── Test 8: Monotonicity enforcement ──────────────────────────────────────
console.log('Test 8: Monotonicity enforcement');
{
  const h = createTargetHistory();
  h.recordTarget(100, 10, 10);
  h.recordTarget(200, 20, 20);
  h.recordTarget(150, 15, 15); // Out of order — should be dropped
  h.recordTarget(200, 25, 25); // Duplicate timestamp — should be dropped
  assert(h._targetSamples.length === 2, `should have 2 samples, got ${h._targetSamples.length}`);
  assert(h._targetSamples[1].x === 20, 'second sample should be unchanged');
}

// ─── Test 9: Gaze recording ───────────────────────────────────────────────
console.log('Test 9: Gaze recording and getLatestGaze');
{
  const h = createTargetHistory();
  assert(h.getLatestGaze() === null, 'no gaze before recording');
  h.recordGaze(100, 50, 60);
  h.recordGaze(200, 70, 80);
  const latest = h.getLatestGaze();
  assert(latest !== null, 'should have latest gaze');
  assert(latest.t === 200, 'latest gaze timestamp');
  assert(latest.x === 70, 'latest gaze x');
  assert(latest.y === 80, 'latest gaze y');
}

// ─── Test 10: Diagnostics ──────────────────────────────────────────────────
console.log('Test 10: Diagnostics counters');
{
  const h = createTargetHistory();
  h.recordTarget(100, 0, 0);
  h.recordTarget(200, 100, 100);
  h.recordGaze(150, 50, 50);

  h.lookupTarget(150); // valid lookup
  h.lookupTarget(50);  // before buffer — missed
  h.lookupTarget(50);  // another miss

  const d = h.getDiagnostics();
  assert(d.targetBufferSize === 2, 'target buffer size');
  assert(d.gazeBufferSize === 1, 'gaze buffer size');
  assert(d.totalLookups === 3, 'total lookups');
  assert(d.missedLookups === 2, 'missed lookups');
}

// ─── Test 11: Reset ────────────────────────────────────────────────────────
console.log('Test 11: Reset clears everything');
{
  const h = createTargetHistory();
  h.recordTarget(100, 10, 10);
  h.recordGaze(100, 20, 20);
  h.lookupTarget(50); // miss
  h.reset();
  assert(h._targetSamples.length === 0, 'target buffer cleared');
  assert(h._gazeSamples.length === 0, 'gaze buffer cleared');
  const d = h.getDiagnostics();
  assert(d.totalLookups === 0, 'counters reset');
  assert(d.missedLookups === 0, 'missed counter reset');
}

// ─── Test 12: Multi-sample binary search ───────────────────────────────────
console.log('Test 12: Multi-sample binary search correctness');
{
  const h = createTargetHistory();
  // Create 20 evenly spaced samples: t=0,100,200,...,1900
  for (let i = 0; i < 20; i++) {
    h.recordTarget(i * 100, i * 10, i * 5);
  }

  // Lookup t=550 should interpolate between sample[5] (t=500,x=50,y=25) and sample[6] (t=600,x=60,y=30)
  const r = h.lookupTarget(550);
  assertApprox(r.x, 55, 0.01, 'binary search interpolated x at t=550');
  assertApprox(r.y, 27.5, 0.01, 'binary search interpolated y at t=550');

  // Lookup at exact sample[10] (t=1000, x=100, y=50)
  const r2 = h.lookupTarget(1000);
  assert(r2.x === 100, 'exact lookup x at sample 10');
  assert(r2.y === 50, 'exact lookup y at sample 10');
}

// ─── Test 13: Missing-sample counter ───────────────────────────────────────
console.log('Test 13: Missing-sample counter with empty buffer');
{
  const h = createTargetHistory();
  h.lookupTarget(100);
  h.lookupTarget(200);
  const d = h.getDiagnostics();
  assert(d.missedLookups === 2, 'two lookups on empty buffer = 2 misses');
  assert(d.totalLookups === 2, 'two total lookups');
}

// ─── Summary ───────────────────────────────────────────────────────────────
console.log(`\n═══ Target History Tests: ${passed} passed, ${failed} failed ═══`);
if (failed > 0) {
  process.exit(1);
}
