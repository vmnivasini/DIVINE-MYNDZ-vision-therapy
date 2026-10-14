/**
 * targetHistory.js — Timestamped Target & Gaze History for Eye-Tracking Telemetry
 *
 * This module records the target's position at every animation frame and every
 * gaze sample from WebGazer, each stamped with performance.now() (a monotonic
 * clock unaffected by wall-clock adjustments).
 *
 * When a telemetry row is recorded, the module looks up where the target was
 * at the gaze sample's timestamp (interpolating between the two nearest target
 * frames) so that processing delay inside WebGazer does not inflate the
 * reported tracking error.
 *
 * IMPORTANT LIMITATIONS (documented, not hidden):
 *   - WebGazer's gaze-listener callback fires when the prediction is COMPLETE,
 *     not when the webcam frame was captured.  The callback timestamp therefore
 *     includes an unknown amount of internal processing time (typically 30-150 ms
 *     depending on device).  This module cannot remove that internal latency
 *     because WebGazer 3.3.0 does not expose a per-frame capture timestamp.
 *   - The "elapsedTime" parameter from setGazeListener is milliseconds since
 *     webgazer.begin() — it is the prediction-completion time, not the
 *     camera-capture time.
 *   - The time-aligned lookup eliminates the *additional* delay between
 *     WebGazer's callback and the next animation frame that reads lastGazeRef.
 *     That secondary delay can be 0-16 ms and is fully correctable.
 *   - A future improvement could cross-correlate the gaze and target signals
 *     to estimate the total pipeline latency, but that estimate would need to
 *     be clearly labelled and never silently subtracted from clinical scores.
 */

// ─── Configuration ───────────────────────────────────────────────────────────
const MAX_TARGET_HISTORY = 600;   // ~10 s at 60 fps
const MAX_GAZE_HISTORY   = 600;   // ~10 s at 60 fps

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Creates a new, isolated history tracker.  Call once per test session.
 *
 * @returns {Object} history API
 */
export function createTargetHistory() {
  /** @type {{ t: number, x: number, y: number }[]} */
  const targetSamples = [];

  /** @type {{ t: number, x: number, y: number }[]} */
  const gazeSamples = [];

  /** diagnostic counters */
  let missedLookups = 0;
  let totalLookups  = 0;

  // ── Recording ────────────────────────────────────────────────────────────

  /**
   * Record the target's current position.
   * Call this every animation frame, passing the rAF timestamp.
   *
   * @param {number} t  - performance.now() or the rAF `now` parameter
   * @param {number} x  - target screen-X in pixels
   * @param {number} y  - target screen-Y in pixels
   */
  function recordTarget(t, x, y) {
    // Enforce monotonicity: drop stale or duplicate timestamps
    if (targetSamples.length > 0 && t <= targetSamples[targetSamples.length - 1].t) {
      return;
    }
    targetSamples.push({ t, x, y });
    if (targetSamples.length > MAX_TARGET_HISTORY) {
      targetSamples.shift();
    }
  }

  /**
   * Record a gaze sample from WebGazer's callback.
   *
   * @param {number} t  - performance.now() captured inside the gaze listener
   * @param {number} x  - predicted gaze screen-X
   * @param {number} y  - predicted gaze screen-Y
   */
  function recordGaze(t, x, y) {
    gazeSamples.push({ t, x, y });
    if (gazeSamples.length > MAX_GAZE_HISTORY) {
      gazeSamples.shift();
    }
  }

  // ── Lookup ───────────────────────────────────────────────────────────────

  /**
   * Look up the target's position at time `t` by linearly interpolating
   * between the two nearest recorded target frames.
   *
   * Returns `null` if the history is empty or `t` is before all samples.
   *
   * @param {number} t  - timestamp to look up
   * @returns {{ x: number, y: number, exact: boolean, ageMs: number } | null}
   *   `exact` — true if `t` matched a recorded frame exactly
   *   `ageMs` — how far `t` is from the nearest target sample (0 if exact)
   */
  function lookupTarget(t) {
    totalLookups++;

    if (targetSamples.length === 0) {
      missedLookups++;
      return null;
    }

    const first = targetSamples[0];
    const last  = targetSamples[targetSamples.length - 1];

    // Before all recorded history
    if (t < first.t) {
      missedLookups++;
      return null;
    }

    // At or after the latest sample — use the latest (no extrapolation)
    if (t >= last.t) {
      return { x: last.x, y: last.y, exact: t === last.t, ageMs: t - last.t };
    }

    // Binary search for the two surrounding samples
    let lo = 0;
    let hi = targetSamples.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >>> 1;
      if (targetSamples[mid].t <= t) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    const a = targetSamples[lo];
    const b = targetSamples[hi];

    // Exact match
    if (t === a.t) return { x: a.x, y: a.y, exact: true, ageMs: 0 };
    if (t === b.t) return { x: b.x, y: b.y, exact: true, ageMs: 0 };

    // Linear interpolation
    const span = b.t - a.t;
    const frac = (t - a.t) / span;
    return {
      x: a.x + (b.x - a.x) * frac,
      y: a.y + (b.y - a.y) * frac,
      exact: false,
      ageMs: 0
    };
  }

  /**
   * Get the latest recorded gaze sample, or null.
   * @returns {{ t: number, x: number, y: number } | null}
   */
  function getLatestGaze() {
    return gazeSamples.length > 0 ? gazeSamples[gazeSamples.length - 1] : null;
  }

  // ── Diagnostics ──────────────────────────────────────────────────────────

  /**
   * Return diagnostic counters for the current session.
   */
  function getDiagnostics() {
    return {
      targetBufferSize: targetSamples.length,
      gazeBufferSize:   gazeSamples.length,
      totalLookups,
      missedLookups,
      oldestTargetAge: targetSamples.length > 0
        ? performance.now() - targetSamples[0].t
        : null,
    };
  }

  /**
   * Clear all buffers.  Call when starting a new test.
   */
  function reset() {
    targetSamples.length = 0;
    gazeSamples.length   = 0;
    missedLookups = 0;
    totalLookups  = 0;
  }

  return {
    recordTarget,
    recordGaze,
    lookupTarget,
    getLatestGaze,
    getDiagnostics,
    reset,
    // Expose for testing only
    _targetSamples: targetSamples,
    _gazeSamples:   gazeSamples,
  };
}
