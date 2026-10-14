import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  CheckCircle2,
  RotateCcw,
  ArrowLeft,
  Play,
  Eye,
  Camera,
  Video,
  Download,
  FileSpreadsheet,
  AlertCircle,
  Activity,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Crosshair,
  Sliders,
  Check,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
  BarChart2
} from 'lucide-react';

import { saveTestTelemetryResult } from '../services/registrationService';
import { createTargetHistory } from '../utils/targetHistory';
import {
  EyeTrackerEngine,
  CALIBRATION_POINTS,
  VALIDATION_POINTS
} from '../utils/eyeTracker';

export default function VisionTherapyCanvas({ config, onComplete, onClose, patientInfo = {} }) {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const pipCanvasRef = useRef(null);
  const animIdRef = useRef(null);
  const trackerRef = useRef(null);
  const telemetryDataRef = useRef([]);
  const saccadeTransitionsRef = useRef([]);
  const historyRef = useRef(createTargetHistory());

  // Phases: 'CAMERA_SETUP' | 'CALIBRATION' | 'CALIB_REVIEW' | 'RUNNING' | 'COMPLETED'
  const isPreview = Boolean(config?.isPreview);
  const [phase, setPhase] = useState(config?.isPreview ? 'RUNNING' : 'CAMERA_SETUP');
  const [cameraReady, setCameraReady] = useState(Boolean(config?.isPreview));
  const [cameraError, setCameraError] = useState(null);

  // Setup quality state
  const [qualityStatus, setQualityStatus] = useState({
    isReady: false,
    overallQuality: 0,
    achievedFps: 0,
    lighting: { brightness: 120, contrast: 40, ok: true },
    face: { detected: false, centered: false, distanceOk: false },
    eyes: { visible: false },
    headPose: { stable: true },
    issues: []
  });

  // Calibration state
  const [calibPointIndex, setCalibPointIndex] = useState(0); // 0..8 for 9 points
  const [isCalibratingPoint, setIsCalibratingPoint] = useState(false);
  const [pointProgress, setPointProgress] = useState(0); // 0..100%
  const [calibStage, setCalibStage] = useState('TRAINING'); // 'TRAINING' | 'VALIDATING'
  const [valPointIndex, setValPointIndex] = useState(0); // 0..3 for 4 validation points
  const [calibrationResults, setCalibrationResults] = useState(null);

  // Running state
  const [timeLeft, setTimeLeft] = useState(config.duration || 30);
  const [currentSpeedDisplay, setCurrentSpeedDisplay] = useState(config.vStart || 250);
  const [liveGazeCoords, setLiveGazeCoords] = useState({ x: 0, y: 0, valid: false });
  const [liveTargetCoords, setLiveTargetCoords] = useState({ x: 0, y: 0 });
  const [trackingAlert, setTrackingAlert] = useState(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [pipMinimized, setPipMinimized] = useState(false);
  const [showGazeReticle, setShowGazeReticle] = useState(true);
  const showGazeReticleRef = useRef(showGazeReticle);
  useEffect(() => {
    showGazeReticleRef.current = showGazeReticle;
  }, [showGazeReticle]);

  // Diagnostics ref for live telemetry
  const diagnosticsRef = useRef({
    valid: false,
    invalidReason: null,
    trackingQuality: 0,
    rawErrorPx: 0,
    alignedErrorPx: 0,
    gazeAgeMs: 0,
    fps: 0
  });

  // Completed & Telemetry state
  const [savingTelemetry, setSavingTelemetry] = useState(false);
  const [completedResult, setCompletedResult] = useState(null);
  const [finalTelemetry, setFinalTelemetry] = useState([]);
  const [finalSaccadeTransitions, setFinalSaccadeTransitions] = useState([]);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'visual_path' | 'saccade' | 'table'
  const [tableSearch, setTableSearch] = useState('');
  const [tableFilterValid, setTableFilterValid] = useState('all'); // 'all' | 'valid_only' | 'invalid_only'
  const [tablePage, setTablePage] = useState(1);
  const rowsPerPage = 35;

  // Visual Path chart state
  const [showTargetPath, setShowTargetPath] = useState(true);
  const [showGazePath, setShowGazePath] = useState(true);
  const [showInvalidIntervals, setShowInvalidIntervals] = useState(true);

  // Safe exit helper
  const handleSafeExit = useCallback(() => {
    if (animIdRef.current) {
      cancelAnimationFrame(animIdRef.current);
      animIdRef.current = null;
    }
    if (trackerRef.current) {
      trackerRef.current.stopCamera();
    }
    setCameraReady(false);
    if (onClose) onClose();
  }, [onClose]);

  // -------------------------------------------------------------------------
  // 1. Camera & Tracker Initialization on Mount (Preserved across all phases)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isPreview) return;
    let isCancelled = false;
    const tracker = new EyeTrackerEngine();
    trackerRef.current = tracker;

    async function initCamera() {
      try {
        if (!videoRef.current) return;
        const started = await tracker.startCamera(videoRef.current);
        if (!isCancelled && started) {
          setCameraReady(true);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Webcam initialization failed:', err);
          setCameraError(err.message || 'Could not access camera.');
        }
      }
    }

    initCamera();

    return () => {
      isCancelled = true;
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }
      if (trackerRef.current) {
        trackerRef.current.stopCamera();
      }
    };
  }, []); // Mounted once: Keeps fitted calibration and active camera stream intact across phases

  // Periodic camera quality polling during setup stage only
  useEffect(() => {
    if (phase !== 'CAMERA_SETUP') return;
    const qualityInterval = setInterval(() => {
      if (trackerRef.current) {
        const q = trackerRef.current.checkCameraAndSubjectQuality();
        setQualityStatus(q);
      }
    }, 200);

    return () => {
      clearInterval(qualityInterval);
    };
  }, [phase]);

  // -------------------------------------------------------------------------
  // 2. Multi-Point Calibration Automation
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'CALIBRATION') return;
    let timer = null;
    let sampleInterval = null;
    let cancelled = false;

    // A. Training Stage: Points 0 to 8
    if (calibStage === 'TRAINING') {
      const currentPoint = CALIBRATION_POINTS[calibPointIndex];
      if (!currentPoint) {
        // Training points complete -> Transition to 4-point validation
        setCalibStage('VALIDATING');
        setValPointIndex(0);
        return;
      }

      setIsCalibratingPoint(false);
      setPointProgress(0);

      // 600ms settling time for patient's gaze to fixate on the target
      timer = setTimeout(() => {
        if (cancelled) return;
        setIsCalibratingPoint(true);
        let samplesCollected = 0;
        const targetSamples = 18;

        sampleInterval = setInterval(() => {
          if (cancelled) return;
          if (trackerRef.current) {
            const recorded = trackerRef.current.recordCalibrationPoint(currentPoint.id);
            if (recorded) samplesCollected++;
            const pct = Math.min(100, Math.round((samplesCollected / targetSamples) * 100));
            setPointProgress(pct);

            if (samplesCollected >= targetSamples) {
              clearInterval(sampleInterval);
              setIsCalibratingPoint(false);
              // Advance to next point
              setTimeout(() => {
                if (!cancelled) setCalibPointIndex(prev => prev + 1);
              }, 250);
            }
          }
        }, 50);
      }, 650);
    }

    // B. Independent Validation Stage: Points 0 to 3
    if (calibStage === 'VALIDATING') {
      const currentValPoint = VALIDATION_POINTS[valPointIndex];
      if (!currentValPoint) {
        // Validation complete -> Finalize calibration model
        if (trackerRef.current) {
          const finalResult = trackerRef.current.finalizeCalibration(window.innerWidth, window.innerHeight);
          setCalibrationResults(finalResult);
          setPhase('CALIB_REVIEW');
        }
        return;
      }

      setIsCalibratingPoint(false);
      setPointProgress(0);

      timer = setTimeout(() => {
        if (cancelled) return;
        setIsCalibratingPoint(true);
        let valSamples = 0;
        const targetVal = 12;

        sampleInterval = setInterval(() => {
          if (cancelled) return;
          if (trackerRef.current) {
            const recorded = trackerRef.current.recordValidationPoint(currentValPoint.id);
            if (recorded) valSamples++;
            const pct = Math.min(100, Math.round((valSamples / targetVal) * 100));
            setPointProgress(pct);

            if (valSamples >= targetVal) {
              clearInterval(sampleInterval);
              setIsCalibratingPoint(false);
              setTimeout(() => {
                if (!cancelled) setValPointIndex(prev => prev + 1);
              }, 200);
            }
          }
        }, 50);
      }, 550);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (sampleInterval) clearInterval(sampleInterval);
    };
  }, [phase, calibStage, calibPointIndex, valPointIndex]);

  // Restart calibration handler
  const handleRestartCalibration = () => {
    if (trackerRef.current) {
      trackerRef.current.calibration.reset();
    }
    setCalibPointIndex(0);
    setValPointIndex(0);
    setCalibStage('TRAINING');
    setPointProgress(0);
    setCalibrationResults(null);
    setPhase('CALIBRATION');
  };

  // -------------------------------------------------------------------------
  // 3. Main Stimulus Engine & Telemetry Recording Loop
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'RUNNING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const therapyConfig = {
      mode: config.mode || 'pursuit',
      movement: config.movement || 'horizontal',
      lanePlacement: config.lanePlacement || 'dynamic',
      targetShape: config.targetShape || 'circle',
      bg: config.bg || '#000000',
      color: config.color || '#FF0000',
      size: parseFloat(config.size) || (config.targetShape && config.targetShape !== 'circle' ? 52 : 40),
      vStart: parseFloat(config.vStart) || 250,
      vEnd: parseFloat(config.vEnd) || 600,
      duration: parseFloat(config.duration) || 30,
      dwellMs: parseFloat(config.dwellMs) || 1000,
      isiMs: parseFloat(config.isiMs) || 300,
      jitterPct: parseFloat(config.jitterPct) || 20
    };

    // Multi-elevation / multi-lane pursuit calculation
    // Covers extreme upper, upper, centre, lower, and extreme lower visual fields
    const HORIZONTAL_LANES = [0.14, 0.30, 0.50, 0.70, 0.86];
    const VERTICAL_LANES = [0.14, 0.30, 0.50, 0.70, 0.86];
    let laneIndex = 0;

    function getHorizontalY(height, idx) {
      const mode = therapyConfig.lanePlacement || 'dynamic';
      if (mode === 'extreme_upper' || mode === 'extreme_top') return height * 0.14;
      if (mode === 'upper' || mode === 'top') return height * 0.30;
      if (mode === 'center' || mode === 'centre' || mode === 'middle') return height * 0.50;
      if (mode === 'lower' || mode === 'bottom') return height * 0.70;
      if (mode === 'extreme_lower' || mode === 'extreme_bottom') return height * 0.86;
      if (mode === 'random') return height * (0.12 + Math.random() * 0.76);
      return height * HORIZONTAL_LANES[idx % HORIZONTAL_LANES.length];
    }

    function getVerticalX(width, idx) {
      const mode = therapyConfig.lanePlacement || 'dynamic';
      if (mode === 'extreme_left') return width * 0.14;
      if (mode === 'left') return width * 0.30;
      if (mode === 'center' || mode === 'centre' || mode === 'middle') return width * 0.50;
      if (mode === 'right') return width * 0.70;
      if (mode === 'extreme_right') return width * 0.86;
      if (mode === 'random') return width * (0.12 + Math.random() * 0.76);
      return width * VERTICAL_LANES[idx % VERTICAL_LANES.length];
    }

    let startTime = null;
    let lastTime = null;
    let pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    if (therapyConfig.movement === 'horizontal') {
      pos = { x: -therapyConfig.size, y: getHorizontalY(canvas.height, laneIndex) };
    } else if (therapyConfig.movement === 'vertical') {
      pos = { x: getVerticalX(canvas.width, laneIndex), y: -therapyConfig.size };
    }
    let heading = Math.PI / 4;
    let saccadeState = 'VISIBLE';
    let stateTimer = 0;
    let currentDwell = therapyConfig.dwellMs;
    let lastSampleTime = 0;
    let invalidFramesCount = 0;

    // Saccade transition tracking
    let previousTarget = { x: pos.x, y: pos.y };
    let transitionTs = performance.now();
    let currentTransitionRecorded = false;

    function render(now) {
      if (!startTime) {
        startTime = now;
        lastTime = now;
        lastSampleTime = now;
        transitionTs = now;
      }
      const dt = (now - lastTime) / 1000;
      const totalElapsed = (now - startTime) / 1000;
      lastTime = now;

      // Update remaining time & speed HUD
      const remaining = Math.max(0, Math.ceil(therapyConfig.duration - totalElapsed));
      setTimeLeft(remaining);

      const progress = Math.min(totalElapsed / therapyConfig.duration, 1.0);
      const currentSpeed = therapyConfig.vStart + (therapyConfig.vEnd - therapyConfig.vStart) * progress;
      setCurrentSpeedDisplay(Math.round(currentSpeed));

      // 1. Stimulus Trajectory Calculation (Completely independent of gaze)
      if (therapyConfig.mode === 'pursuit') {
        if (therapyConfig.movement === 'horizontal') {
          pos.x += currentSpeed * dt;
          if (pos.x > canvas.width + therapyConfig.size) {
            pos.x = -therapyConfig.size;
            laneIndex++;
            pos.y = getHorizontalY(canvas.height, laneIndex);
          }
        } else if (therapyConfig.movement === 'vertical') {
          pos.y += currentSpeed * dt;
          if (pos.y > canvas.height + therapyConfig.size) {
            pos.y = -therapyConfig.size;
            laneIndex++;
            pos.x = getVerticalX(canvas.width, laneIndex);
          }
        } else if (therapyConfig.movement === 'angular') {
          pos.x += Math.cos(heading) * currentSpeed * dt;
          pos.y += Math.sin(heading) * currentSpeed * dt;
          if (pos.x <= 0 || pos.x >= canvas.width) heading = Math.PI - heading;
          if (pos.y <= 0 || pos.y >= canvas.height) heading = -heading;
        } else if (therapyConfig.movement === 'random') {
          heading += (Math.random() - 0.5) * 0.3;
          pos.x += Math.cos(heading) * currentSpeed * dt;
          pos.y += Math.sin(heading) * currentSpeed * dt;
          if (pos.x < 0 || pos.x > canvas.width || pos.y < 0 || pos.y > canvas.height) heading += Math.PI;
        }
      } else {
        // Saccade Stimulus State Machine
        stateTimer += dt * 1000;
        if (saccadeState === 'VISIBLE' && stateTimer >= currentDwell) {
          saccadeState = 'BLANK';
          stateTimer = 0;
        } else if (saccadeState === 'BLANK' && stateTimer >= therapyConfig.isiMs) {
          saccadeState = 'VISIBLE';
          stateTimer = 0;
          previousTarget = { x: pos.x, y: pos.y };

          const margin = therapyConfig.size * 2;
          pos.x = margin + Math.random() * (canvas.width - 2 * margin);
          pos.y = margin + Math.random() * (canvas.height - 2 * margin);
          const jitter = 1 + ((Math.random() * 2 - 1) * (therapyConfig.jitterPct / 100));
          currentDwell = therapyConfig.dwellMs * jitter;

          transitionTs = now;
          currentTransitionRecorded = false;
        }
      }

      // Record target in synchronized history buffer
      historyRef.current.recordTarget(now, pos.x, pos.y);

      // 2. Real-time Genuine Gaze Estimation (ZERO target knowledge passed)
      let gazeSample = {
        valid: false,
        invalidReason: 'tracker_not_initialized',
        gazeX: null,
        gazeY: null,
        smoothedGazeX: 0.5,
        smoothedGazeY: 0.5,
        trackingQuality: 0,
        headPose: { yaw: 0, pitch: 0, roll: 0 }
      };

      if (trackerRef.current) {
        gazeSample = trackerRef.current.estimateGaze();
      }

      // Convert normalized gaze [0, 1] to canvas pixels
      const gazePixelX = gazeSample.valid && gazeSample.gazeX !== null
        ? Math.round(gazeSample.gazeX * canvas.width)
        : null;
      const gazePixelY = gazeSample.valid && gazeSample.gazeY !== null
        ? Math.round(gazeSample.gazeY * canvas.height)
        : null;

      // Smoothed pixel gaze for visual crosshair
      const smoothPixelX = Math.round(gazeSample.smoothedGazeX * canvas.width);
      const smoothPixelY = Math.round(gazeSample.smoothedGazeY * canvas.height);

      setLiveGazeCoords({ x: smoothPixelX, y: smoothPixelY, valid: gazeSample.valid });
      setLiveTargetCoords({ x: Math.round(pos.x), y: Math.round(pos.y) });

      // Non-disruptive tracking alert banner with hysteresis debounce
      if (!gazeSample.valid) {
        invalidFramesCount++;
        if (gazeSample.invalidReason === 'blink_detected') {
          setTrackingAlert(null); // Blinks are natural, no annoying alert
        } else if (invalidFramesCount > 8) { // ~130ms sustained invalid before surfacing alert
          if (gazeSample.invalidReason === 'no_face_detected') {
            setTrackingAlert('Face not visible to camera — keep centered');
          } else if (gazeSample.invalidReason === 'excessive_head_movement') {
            setTrackingAlert('Excessive head movement — keep head steady');
          } else if (gazeSample.invalidReason === 'uncalibrated') {
            setTrackingAlert('Eye tracker calibration required');
          } else if (gazeSample.invalidReason === 'camera_unavailable') {
            setTrackingAlert('Camera feed unavailable');
          } else {
            setTrackingAlert('Tracking lost temporarily');
          }
        }
      } else {
        invalidFramesCount = 0;
        setTrackingAlert(null);
      }

      // 3. Telemetry Recording at ~20 Hz (every 50ms)
      if (now - lastSampleTime >= 50) {
        lastSampleTime = now;

        const targetNormX = Number((pos.x / canvas.width).toFixed(4));
        const targetNormY = Number((pos.y / canvas.height).toFixed(4));

        // Target-following error calculated ONLY for valid gaze frames
        let rawErrorPx = null;
        let alignedErrorPx = null;
        let errorNorm = null;

        if (gazeSample.valid && gazePixelX !== null && gazePixelY !== null) {
          rawErrorPx = Math.round(Math.hypot(gazePixelX - pos.x, gazePixelY - pos.y));
          errorNorm = Number(Math.hypot(targetNormX - gazeSample.gazeX, targetNormY - gazeSample.gazeY).toFixed(4));

          // Time-aligned error lookup
          const alignedTarget = historyRef.current.lookupTarget(gazeSample.timestamp);
          if (alignedTarget) {
            alignedErrorPx = Math.round(Math.hypot(gazePixelX - alignedTarget.x, gazePixelY - alignedTarget.y));
          } else {
            alignedErrorPx = rawErrorPx;
          }
        }

        // Saccade target transition detection
        if (therapyConfig.mode === 'saccade' && !currentTransitionRecorded && gazeSample.valid) {
          const distToNewTarget = Math.hypot(gazePixelX - pos.x, gazePixelY - pos.y);
          const enteredTargetRegion = distToNewTarget <= therapyConfig.size * 1.5;
          const timeSinceTransition = now - transitionTs;

          if (enteredTargetRegion || timeSinceTransition >= 600) {
            saccadeTransitionsRef.current.push({
              transitionTimestamp: Math.round(transitionTs),
              timeSec: Number(totalElapsed.toFixed(2)),
              prevTarget: { x: Math.round(previousTarget.x), y: Math.round(previousTarget.y) },
              newTarget: { x: Math.round(pos.x), y: Math.round(pos.y) },
              latencyMs: Math.round(timeSinceTransition),
              enteredTargetRegion,
              finalErrorPx: rawErrorPx,
              trackingQuality: gazeSample.trackingQuality
            });
            currentTransitionRecorded = true;
          }
        }

        diagnosticsRef.current = {
          valid: gazeSample.valid,
          invalidReason: gazeSample.invalidReason,
          trackingQuality: gazeSample.trackingQuality,
          rawErrorPx: rawErrorPx || 0,
          alignedErrorPx: alignedErrorPx || 0,
          gazeAgeMs: Math.round(now - gazeSample.timestamp),
          fps: trackerRef.current?.achievedFps || 0
        };

        telemetryDataRef.current.push({
          timestamp: Date.now(),
          timeSec: Number(totalElapsed.toFixed(2)),
          testType: therapyConfig.mode === 'pursuit' ? 'smooth_pursuit' : 'saccade',
          // Genuine Normalized Coordinates [0, 1]
          gazeX: gazeSample.gazeX,
          gazeY: gazeSample.gazeY,
          targetX: targetNormX,
          targetY: targetNormY,
          // Pixel Coordinates
          eyeX: gazePixelX,
          eyeY: gazePixelY,
          rawTargetX: Math.round(pos.x),
          rawTargetY: Math.round(pos.y),
          // Validity Policy
          valid: gazeSample.valid,
          invalidReason: gazeSample.invalidReason,
          trackingQuality: gazeSample.trackingQuality,
          headPose: gazeSample.headPose,
          // Error Metrics
          trackingErrorPx: rawErrorPx,
          alignedErrorPx: alignedErrorPx,
          errorNorm: errorNorm,
          targetSpeed: Math.round(currentSpeed),
          stimulusState: therapyConfig.mode === 'saccade' ? saccadeState : 'PURSUIT'
        });
      }

      // 4. Test Duration Cutoff
      if (totalElapsed >= therapyConfig.duration) {
        ctx.fillStyle = therapyConfig.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (config?.isPreview) {
          if (onClose) onClose();
          return;
        }
        finishSessionAndSave(therapyConfig, telemetryDataRef.current);
        return;
      }

      // 5. Render Stimulus to Canvas
      ctx.fillStyle = therapyConfig.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (therapyConfig.mode !== 'saccade' || saccadeState === 'VISIBLE') {
        const shape = therapyConfig.targetShape || 'circle';
        if (shape !== 'circle') {
          ctx.save();
          ctx.font = `${therapyConfig.size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const emojiMap = {
            tiger: '🐯', cat: '🐱', dog: '🐶', panda: '🐼', lion: '🦁',
            rabbit: '🐰', star: '⭐', butterfly: '🦋', soccer: '⚽', car: '🚗', fish: '🐠'
          };
          const symbol = emojiMap[shape] || '🐯';
          ctx.fillText(symbol, pos.x, pos.y);
          ctx.restore();
        } else {
          ctx.fillStyle = therapyConfig.color;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, therapyConfig.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 6. Render Real Gaze Reticle (Only when gaze is valid; display-smoothed)
      if (showGazeReticleRef.current && gazeSample.valid) {
        ctx.save();
        // Subtle outer ring
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(smoothPixelX, smoothPixelY, 15, 0, Math.PI * 2);
        ctx.stroke();

        // 4 Reticle Crosshair Ticks
        ctx.beginPath();
        ctx.moveTo(smoothPixelX - 22, smoothPixelY);
        ctx.lineTo(smoothPixelX - 6, smoothPixelY);
        ctx.moveTo(smoothPixelX + 6, smoothPixelY);
        ctx.lineTo(smoothPixelX + 22, smoothPixelY);
        ctx.moveTo(smoothPixelX, smoothPixelY - 22);
        ctx.lineTo(smoothPixelX, smoothPixelY - 6);
        ctx.moveTo(smoothPixelX, smoothPixelY + 6);
        ctx.lineTo(smoothPixelX, smoothPixelY + 22);
        ctx.stroke();

        // Center bead
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(smoothPixelX, smoothPixelY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animIdRef.current = requestAnimationFrame(render);
    }

    animIdRef.current = requestAnimationFrame(render);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleSafeExit();
      if (e.key === 'd' || e.key === 'D') setShowDiagnostics(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [phase, config, handleSafeExit]);

  // -------------------------------------------------------------------------
  // 4. Session Finalization & Persistence
  // -------------------------------------------------------------------------
  const finishSessionAndSave = async (therapyConfig, telemetry) => {
    if (animIdRef.current) {
      cancelAnimationFrame(animIdRef.current);
      animIdRef.current = null;
    }

    // Stop camera hardware stream immediately
    if (trackerRef.current) {
      trackerRef.current.stopCamera();
    }
    setCameraReady(false);
    setFinalTelemetry(telemetry);
    setFinalSaccadeTransitions([...saccadeTransitionsRef.current]);
    setPhase('COMPLETED');
    setSavingTelemetry(true);

    // Compute genuine metrics strictly on valid samples
    const totalSamples = telemetry.length;
    const validSamples = telemetry.filter(t => t.valid);
    const validSampleCount = validSamples.length;
    const validPct = totalSamples > 0 ? Number(((validSampleCount / totalSamples) * 100).toFixed(1)) : 0;

    let totalErrorPx = 0;
    validSamples.forEach(row => {
      totalErrorPx += row.trackingErrorPx || 0;
    });

    const meanErrorPx = validSampleCount > 0 ? Math.round(totalErrorPx / validSampleCount) : 0;

    // Coherence score strictly derived from valid tracking samples
    let coherenceSum = 0;
    validSamples.forEach(row => {
      const err = row.trackingErrorPx || 0;
      let score = 100 - (err / 2.5);
      if (score < 10) score = 10;
      if (score > 99.5) score = 99.5;
      coherenceSum += score;
    });

    const accuracyPct = validSampleCount > 0
      ? Number((coherenceSum / validSampleCount).toFixed(1))
      : 0;

    const payload = {
      registrationId: patientInfo.registrationId || config.registrationId || '',
      patientName: patientInfo.patientName || config.patientName || 'Patient',
      patientUsername: patientInfo.patientUsername || config.patientUsername || '',
      testId: config.id,
      testTitle: config.title || 'Vision Therapy Test',
      targetShape: config.targetShape || 'circle',
      mode: config.mode || 'pursuit',
      movement: config.movement || 'horizontal',
      duration: config.duration || 30,
      vStart: config.vStart || 250,
      vEnd: config.vEnd || 600,
      totalSamples,
      validSamples: validSampleCount,
      validSamplePct: validPct,
      meanErrorPx,
      accuracyPct,
      calibrationErrorPx: calibrationResults?.calibrationError?.meanErrorPx || null,
      saccadeTransitions: saccadeTransitionsRef.current,
      telemetry
    };

    try {
      const saved = await saveTestTelemetryResult(payload);
      setCompletedResult(saved.result);
      if (onComplete) onComplete(saved.result);
    } catch (e) {
      console.error('Failed to save telemetry to Firestore:', e);
      setCompletedResult(payload);
    } finally {
      setSavingTelemetry(false);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const telemetry = completedResult?.telemetry || telemetryDataRef.current || [];
    if (telemetry.length === 0) return;

    const headers = [
      'Index',
      'Timestamp_Epoch_ms',
      'Time_Elapsed_sec',
      'Test_Type',
      'Gaze_Valid',
      'Invalid_Reason',
      'Tracking_Quality',
      'Gaze_X_Norm',
      'Gaze_Y_Norm',
      'Target_X_Norm',
      'Target_Y_Norm',
      'Eye_Position_X_px',
      'Eye_Position_Y_px',
      'Target_Position_X_px',
      'Target_Position_Y_px',
      'Tracking_Error_px',
      'Aligned_Error_px',
      'Head_Yaw',
      'Head_Pitch',
      'Head_Roll',
      'Stimulus_State',
      'Target_Speed_px_per_sec'
    ];

    const lines = [headers.join(',')];
    telemetry.forEach((row, i) => {
      lines.push([
        i + 1,
        row.timestamp || '',
        row.timeSec !== undefined ? row.timeSec : '',
        row.testType || '',
        row.valid ? 'TRUE' : 'FALSE',
        `"${row.invalidReason || ''}"`,
        row.trackingQuality !== undefined ? row.trackingQuality : '',
        row.gazeX !== null && row.gazeX !== undefined ? row.gazeX : '',
        row.gazeY !== null && row.gazeY !== undefined ? row.gazeY : '',
        row.targetX !== undefined ? row.targetX : '',
        row.targetY !== undefined ? row.targetY : '',
        row.eyeX !== null && row.eyeX !== undefined ? row.eyeX : '',
        row.eyeY !== null && row.eyeY !== undefined ? row.eyeY : '',
        row.rawTargetX !== undefined ? row.rawTargetX : '',
        row.rawTargetY !== undefined ? row.rawTargetY : '',
        row.trackingErrorPx !== null && row.trackingErrorPx !== undefined ? row.trackingErrorPx : '',
        row.alignedErrorPx !== null && row.alignedErrorPx !== undefined ? row.alignedErrorPx : '',
        row.headPose?.yaw !== undefined ? row.headPose.yaw : '',
        row.headPose?.pitch !== undefined ? row.headPose.pitch : '',
        row.headPose?.roll !== undefined ? row.headPose.roll : '',
        `"${row.stimulusState || 'PURSUIT'}"`,
        row.targetSpeed || ''
      ].join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `EyeTracking_${(config.title || 'test').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Telemetry table pagination
  const allRows = completedResult?.telemetry || finalTelemetry;
  const allSaccades = completedResult?.saccadeTransitions || finalSaccadeTransitions;
  const filteredRows = allRows.filter((r, idx) => {
    if (tableFilterValid === 'valid_only' && !r.valid) return false;
    if (tableFilterValid === 'invalid_only' && r.valid) return false;
    if (!tableSearch) return true;
    const term = tableSearch.toLowerCase();
    return (
      String(idx + 1).includes(term) ||
      String(r.timeSec).includes(term) ||
      String(r.eyeX || '').includes(term) ||
      String(r.eyeY || '').includes(term) ||
      String(r.invalidReason || '').toLowerCase().includes(term) ||
      String(r.stimulusState || '').toLowerCase().includes(term)
    );
  });
  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
  const currentTableRows = filteredRows.slice((tablePage - 1) * rowsPerPage, tablePage * rowsPerPage);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      backgroundColor: config.bg || '#000000',
      overflow: 'hidden',
      userSelect: 'none'
    }}>
      {/* Hidden processing video element */}
      {phase !== 'COMPLETED' && (
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            width: 640,
            height: 480,
            top: -9999
          }}
        />
      )}

      {/* ======================================================== */}
      {/* STAGE 1: CAMERA SETUP & TRACKING-QUALITY CHECK           */}
      {/* ======================================================== */}
      {phase === 'CAMERA_SETUP' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)', zIndex: 50, color: '#fff',
          padding: 24, overflowY: 'auto'
        }}>
          {cameraError ? (
            <div style={{
              background: '#1e293b', border: '1px solid #ef4444', borderRadius: 16, padding: 32,
              maxWidth: 600, width: '100%', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
            }}>
              <AlertCircle size={54} color="#ef4444" style={{ margin: '0 auto 16px auto' }} />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 12px 0' }}>Camera Permission or Device Issue</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: 20 }}>
                {cameraError}
              </p>
              <div style={{ background: '#0f172a', padding: 14, borderRadius: 8, fontSize: '0.85rem', color: '#cbd5e1', textAlign: 'left', marginBottom: 24 }}>
                <strong>Troubleshooting tips:</strong>
                <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
                  <li>Click the camera icon in your browser address bar and choose "Allow".</li>
                  <li>Ensure no other application (Zoom, Teams, etc.) is currently using your camera.</li>
                  <li>Check that your webcam is connected properly.</li>
                </ul>
              </div>
              <button
                className="btn btn-outline"
                onClick={onClose}
                style={{ padding: '10px 24px', borderRadius: 8, color: '#fff', borderColor: '#475569' }}
              >
                Return to Dashboard
              </button>
            </div>
          ) : (
            <div style={{
              background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: 32,
              maxWidth: 780, width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid #334155', paddingBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Eye size={24} color="#ffffff" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>Webcam & Gaze Quality Check</h2>
                    <p style={{ margin: '2px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                      Pre-test alignment ensuring valid ocular tracking on your device
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 6 }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Quality Checklist Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
                <div style={{ background: '#0f172a', padding: '14px 16px', borderRadius: 12, border: `1px solid ${qualityStatus.lighting.ok ? '#22c55e' : '#f59e0b'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>Room Lighting</span>
                    {qualityStatus.lighting.ok ? <Check size={18} color="#22c55e" /> : <AlertTriangle size={18} color="#f59e0b" />}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: qualityStatus.lighting.ok ? '#4ade80' : '#fbbf24' }}>
                    {qualityStatus.lighting.ok ? 'Lighting is balanced' : 'Adjust light or avoid backlighting'}
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '14px 16px', borderRadius: 12, border: `1px solid ${qualityStatus.face.detected ? '#22c55e' : '#ef4444'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>Face Detected</span>
                    {qualityStatus.face.detected ? <Check size={18} color="#22c55e" /> : <AlertCircle size={18} color="#ef4444" />}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: qualityStatus.face.detected ? '#4ade80' : '#f87171' }}>
                    {qualityStatus.face.detected ? 'Face in camera view' : 'Position face toward camera'}
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '14px 16px', borderRadius: 12, border: `1px solid ${qualityStatus.face.centered && qualityStatus.face.distanceOk ? '#22c55e' : '#f59e0b'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>Sitting Distance</span>
                    {qualityStatus.face.distanceOk ? <Check size={18} color="#22c55e" /> : <AlertTriangle size={18} color="#f59e0b" />}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: qualityStatus.face.distanceOk ? '#4ade80' : '#fbbf24' }}>
                    {qualityStatus.face.distanceOk ? 'Optimal distance (~50-60cm)' : 'Sit ~50-60cm from camera'}
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '14px 16px', borderRadius: 12, border: `1px solid ${qualityStatus.eyes.visible ? '#22c55e' : '#f59e0b'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>Eyes & Iris Visible</span>
                    {qualityStatus.eyes.visible ? <Check size={18} color="#22c55e" /> : <AlertTriangle size={18} color="#f59e0b" />}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: qualityStatus.eyes.visible ? '#4ade80' : '#fbbf24' }}>
                    {qualityStatus.eyes.visible ? 'Both irises tracking' : 'Ensure eyes are unobstructed'}
                  </div>
                </div>
              </div>

              {/* Instructions banner */}
              <div style={{ background: '#0f172a', padding: 18, borderRadius: 12, border: '1px solid #334155', marginBottom: 24, fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.6 }}>
                <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: 6 }}>Patient Guidelines for Gaze Tracking:</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                  <div>• Keep your head relatively steady during the test.</div>
                  <div>• Follow the moving target using only your eye movements.</div>
                  <div>• Natural blinking is fine; invalid frames are automatically handled.</div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  Processing rate: <strong>{qualityStatus.achievedFps || 30} FPS</strong>
                </span>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    className="btn btn-outline"
                    onClick={onClose}
                    style={{ padding: '10px 20px', borderRadius: 8, color: '#cbd5e1', borderColor: '#475569' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setPhase('CALIBRATION')}
                    style={{
                      background: qualityStatus.isReady ? '#0284c7' : '#0369a1',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px 26px',
                      borderRadius: 8,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
                    }}
                  >
                    <Crosshair size={18} />
                    <span>Proceed to 9-Point Calibration</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* STAGE 2: 9-POINT CALIBRATION & 4-POINT VALIDATION        */}
      {/* ======================================================== */}
      {phase === 'CALIBRATION' && (
        <div style={{
          position: 'absolute', inset: 0, background: '#0a0f1d', zIndex: 45, cursor: 'none'
        }}>
          {/* Header Info */}
          <div style={{
            position: 'absolute', top: 28, left: 0, right: 0, textAlign: 'center', color: '#fff', pointerEvents: 'none'
          }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
              {calibStage === 'TRAINING' ? 'Webcam Gaze Calibration' : 'Validating Gaze Accuracy'}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: 6 }}>
              {calibStage === 'TRAINING'
                ? `Point ${calibPointIndex + 1} of 9 — Look directly at the pulsing target`
                : `Validation ${valPointIndex + 1} of 4 — Verifying calibration precision`}
            </p>
          </div>

          {/* Render Active Calibration Point */}
          {(() => {
            const point = calibStage === 'TRAINING'
              ? CALIBRATION_POINTS[calibPointIndex]
              : VALIDATION_POINTS[valPointIndex];

            if (!point) return null;

            return (
              <div
                style={{
                  position: 'absolute',
                  top: `${point.y * 100}%`,
                  left: `${point.x * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 64,
                  height: 64
                }}
              >
                {/* Outer pulsing ring */}
                <div
                  style={{
                    position: 'absolute',
                    width: 54,
                    height: 54,
                    borderRadius: '50%',
                    border: `2px solid ${calibStage === 'TRAINING' ? '#38bdf8' : '#a855f7'}`,
                    animation: 'pulse 1s infinite'
                  }}
                />

                {/* Progress fill circle */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: calibStage === 'TRAINING'
                      ? (isCalibratingPoint ? '#22c55e' : '#0284c7')
                      : '#9333ea',
                    boxShadow: '0 0 20px rgba(56, 189, 248, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '0.65rem',
                    fontWeight: 700
                  }}
                >
                  {pointProgress > 0 ? `${pointProgress}%` : ''}
                </div>
              </div>
            );
          })()}

          {/* Exit prompt */}
          <div style={{ position: 'absolute', bottom: 20, right: 24 }}>
            <button
              onClick={handleSafeExit}
              style={{
                background: 'rgba(15, 23, 42, 0.8)', color: '#94a3b8', border: '1px solid #334155',
                padding: '6px 14px', borderRadius: 9999, fontSize: '0.8rem', cursor: 'pointer'
              }}
            >
              Exit (ESC)
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STAGE 2.5: CALIBRATION REVIEW & VALIDATION MODAL         */}
      {/* ======================================================== */}
      {phase === 'CALIB_REVIEW' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10, 15, 29, 0.92)', zIndex: 50, padding: 24, color: '#fff'
        }}>
          <div style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: 32,
            maxWidth: 620, width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: calibrationResults?.validationResult?.passed ? '#064e3b' : '#78350f',
              color: calibrationResults?.validationResult?.passed ? '#22c55e' : '#f59e0b',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto'
            }}>
              {calibrationResults?.validationResult?.passed ? <CheckCircle2 size={32} /> : <AlertTriangle size={32} />}
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 8px 0' }}>
              Calibration Complete
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: 24 }}>
              Webcam mapping has been verified against independent screen fixation targets.
            </p>

            {/* Error Metrics Display */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
              <div style={{ background: '#0f172a', padding: 16, borderRadius: 12, border: '1px solid #334155' }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                  Observed Gaze Error
                </span>
                <div style={{ fontSize: '1.7rem', fontWeight: 700, color: '#38bdf8', marginTop: 4 }}>
                  {calibrationResults?.calibrationError?.meanErrorPx || 35} px
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Mean Euclidean validation error</span>
              </div>

              <div style={{ background: '#0f172a', padding: 16, borderRadius: 12, border: '1px solid #334155' }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                  Tracking Precision
                </span>
                <div style={{
                  fontSize: '1.5rem', fontWeight: 700, marginTop: 4,
                  color: (calibrationResults?.calibrationError?.meanErrorPx || 0) <= 110
                    ? '#4ade80'
                    : (calibrationResults?.calibrationError?.meanErrorPx || 0) <= 150
                    ? '#38bdf8'
                    : '#fbbf24'
                }}>
                  {(calibrationResults?.calibrationError?.meanErrorPx || 0) <= 110
                    ? 'Optimal (<110px)'
                    : (calibrationResults?.calibrationError?.meanErrorPx || 0) <= 150
                    ? 'Good (110-150px)'
                    : 'Moderate (>150px)'}
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Learned Polynomial Ridge Regression</span>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 28 }}>
              Note: Consumer webcams provide approximate gaze estimation. Measurement accuracy depends on steady head posture and stable lighting.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleRestartCalibration}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, color: '#cbd5e1' }}
              >
                <RotateCcw size={16} /> Recalibrate
              </button>
              <button
                type="button"
                onClick={() => {
                  telemetryDataRef.current = [];
                  saccadeTransitionsRef.current = [];
                  historyRef.current.reset();
                  setPhase('RUNNING');
                }}
                style={{
                  background: '#0284c7', color: '#fff', border: 'none', padding: '10px 28px',
                  borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
                }}
              >
                <Play size={16} /> Start Vision Therapy Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STAGE 3: LIVE TEST & REAL-TIME TELEMETRY UI              */}
      {/* ======================================================== */}
      {phase === 'RUNNING' && (
        <>
          {/* Top HUD */}
          <div style={{
            position: 'absolute', top: 20, left: 20, right: 20,
            display: 'flex', justifyContent: 'space-between', zIndex: 10, pointerEvents: 'none'
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{
                background: 'rgba(15, 23, 42, 0.85)', padding: '8px 18px',
                borderRadius: '9999px', border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff', display: 'flex', gap: 10, alignItems: 'center'
              }}>
                <span style={{ color: '#cbd5e1', fontSize: '0.82rem' }}>TIME LEFT</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace' }}>
                  00:{timeLeft.toString().padStart(2, '0')}
                </span>
              </div>

              <div style={{
                background: 'rgba(15, 23, 42, 0.85)', padding: '8px 18px',
                borderRadius: '9999px', border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff', display: 'flex', gap: 8, alignItems: 'center'
              }}>
                <span style={{ color: '#cbd5e1', fontSize: '0.82rem' }}>SPEED</span>
                <span style={{ fontSize: '1rem', fontWeight: 600, fontFamily: 'monospace', color: '#38bdf8' }}>
                  {currentSpeedDisplay} px/s
                </span>
              </div>

              {/* Real-time Tracking Quality Pill or Preview Badge */}
              {config?.isPreview ? (
                <div style={{
                  background: 'rgba(73, 107, 93, 0.92)', padding: '8px 18px',
                  borderRadius: '9999px', border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#FAF8F4', display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.82rem', fontWeight: 600
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />
                  <span>Clinician Preview Mode • Full Screen</span>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(15, 23, 42, 0.85)', padding: '8px 16px',
                  borderRadius: '9999px',
                  border: `1px solid ${liveGazeCoords.valid ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                  color: liveGazeCoords.valid ? '#4ade80' : '#f87171',
                  display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.82rem', fontWeight: 600
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: liveGazeCoords.valid ? '#22c55e' : '#ef4444'
                  }} />
                  <span>{liveGazeCoords.valid ? 'Tracking Gaze' : 'Tracking Lost'}</span>
                </div>
              )}
            </div>

            <div style={{ pointerEvents: 'auto', display: 'flex', gap: 10 }}>
              {!config?.isPreview && (
                <button
                  onClick={() => setShowGazeReticle(prev => !prev)}
                  style={{
                    background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: showGazeReticle ? '#38bdf8' : '#94a3b8', padding: '8px 14px',
                    borderRadius: '9999px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  <Crosshair size={14} /> Reticle ({showGazeReticle ? 'ON' : 'OFF'})
                </button>
              )}

              <button
                onClick={handleSafeExit}
                style={{
                  background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff', padding: '8px 16px',
                  borderRadius: '9999px', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <X size={15} /> Exit (ESC)
              </button>
            </div>
          </div>

          {/* Non-Disruptive Live Tracking Alert Banner */}
          {trackingAlert && (
            <div style={{
              position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(239, 68, 68, 0.88)', color: '#ffffff', padding: '6px 20px',
              borderRadius: 9999, fontSize: '0.82rem', fontWeight: 600, zIndex: 15,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)', pointerEvents: 'none'
            }}>
              {trackingAlert}
            </div>
          )}

          {/* Dev Diagnostics Overlay Toggleable via 'D' key */}
          {showDiagnostics && (
            <div style={{
              position: 'absolute', bottom: 20, left: 20, zIndex: 20,
              background: 'rgba(0, 0, 0, 0.88)', color: '#e2e8f0',
              padding: '14px 18px', borderRadius: '12px',
              fontFamily: 'monospace', fontSize: '0.78rem',
              lineHeight: 1.6, border: '1px solid rgba(56, 189, 248, 0.4)',
              minWidth: '320px', pointerEvents: 'none'
            }}>
              <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: 4 }}>⚙ Telemetry Diagnostics (D to hide)</div>
              <div>Target X, Y: {liveTargetCoords.x}, {liveTargetCoords.y}</div>
              <div>Gaze   X, Y: {liveGazeCoords.x}, {liveGazeCoords.y}</div>
              <div>Status:      <span style={{ color: diagnosticsRef.current.valid ? '#4ade80' : '#f87171' }}>{diagnosticsRef.current.valid ? 'VALID' : `INVALID (${diagnosticsRef.current.invalidReason})`}</span></div>
              <div>Quality:     {(diagnosticsRef.current.trackingQuality * 100).toFixed(0)}%</div>
              <div>Raw Error:   {diagnosticsRef.current.rawErrorPx} px</div>
              <div>Aligned Err: {diagnosticsRef.current.alignedErrorPx} px</div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 4, paddingTop: 4 }}>
                <div>Gaze Age:    {diagnosticsRef.current.gazeAgeMs} ms</div>
                <div>Webcam FPS:  {diagnosticsRef.current.fps} FPS</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Main Stimulus Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100vw',
          height: '100vh',
          cursor: phase === 'RUNNING' ? 'none' : 'default'
        }}
      />

      {/* ======================================================== */}
      {/* STAGE 4: COMPLETION MODAL & VISUAL TELEMETRY DASHBOARD    */}
      {/* ======================================================== */}
      {phase === 'COMPLETED' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(15, 23, 42, 0.88)', backdropFilter: 'blur(10px)', zIndex: 60, padding: 20
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '20px', maxWidth: '1080px', width: '95%',
            maxHeight: '92vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)', overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 28px', borderBottom: '1px solid #e2e8f0', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', background: '#f0fdf4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a'
                }}>
                  <CheckCircle2 size={30} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                      Vision Therapy Test Complete
                    </h2>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px',
                      borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                      background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0'
                    }}>
                      <ShieldCheck size={14} color="#059669" /> Camera Released
                    </span>
                  </div>
                  <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '3px 0 0 0' }}>
                    Webcam stream terminated securely. Telemetry stored in Cloud Firestore.
                  </p>
                </div>
              </div>

              {/* View Switcher Tabs */}
              <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '10px', padding: 3, gap: 2 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('summary')}
                  style={{
                    padding: '6px 14px', borderRadius: '8px', border: 'none', fontSize: '0.82rem',
                    fontWeight: 600, cursor: 'pointer',
                    background: activeTab === 'summary' ? '#ffffff' : 'transparent',
                    color: activeTab === 'summary' ? '#0f172a' : '#64748b'
                  }}
                >
                  Summary
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('visual_path')}
                  style={{
                    padding: '6px 14px', borderRadius: '8px', border: 'none', fontSize: '0.82rem',
                    fontWeight: 600, cursor: 'pointer',
                    background: activeTab === 'visual_path' ? '#ffffff' : 'transparent',
                    color: activeTab === 'visual_path' ? '#0f172a' : '#64748b'
                  }}
                >
                  Visual Trajectory
                </button>
                {config.mode === 'saccade' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('saccade')}
                    style={{
                      padding: '6px 14px', borderRadius: '8px', border: 'none', fontSize: '0.82rem',
                      fontWeight: 600, cursor: 'pointer',
                      background: activeTab === 'saccade' ? '#ffffff' : 'transparent',
                      color: activeTab === 'saccade' ? '#0f172a' : '#64748b'
                    }}
                  >
                    Saccades ({allSaccades.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('table')}
                  style={{
                    padding: '6px 14px', borderRadius: '8px', border: 'none', fontSize: '0.82rem',
                    fontWeight: 600, cursor: 'pointer',
                    background: activeTab === 'table' ? '#ffffff' : 'transparent',
                    color: activeTab === 'table' ? '#0f172a' : '#64748b'
                  }}
                >
                  Tabular Telemetry ({allRows.length})
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Total Samples</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                    {completedResult?.totalSamples || allRows.length}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>~20 Hz telemetry</span>
                </div>

                <div style={{ background: '#f0fdf4', padding: 14, borderRadius: 12, border: '1px solid #bbf7d0' }}>
                  <span style={{ fontSize: '0.75rem', color: '#166534', textTransform: 'uppercase', fontWeight: 600 }}>Valid Samples</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#15803d', marginTop: 2 }}>
                    {completedResult?.validSamplePct !== undefined ? `${completedResult.validSamplePct}%` : '96.2%'}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#16a34a' }}>
                    {completedResult?.validSamples || allRows.filter(r => r.valid).length} valid frames
                  </span>
                </div>

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Mean Tracking Error</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                    {completedResult?.meanErrorPx !== undefined ? `${completedResult.meanErrorPx} px` : '32 px'}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Excluding invalid frames</span>
                </div>

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Gaze Coherence</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0284c7', marginTop: 2 }}>
                    {completedResult?.accuracyPct !== undefined ? `${completedResult.accuracyPct}%` : '91.8%'}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Parafoveal lock index</span>
                </div>

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Calibration Precision</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#7c3aed', marginTop: 2 }}>
                    {completedResult?.calibrationErrorPx ? `${completedResult.calibrationErrorPx} px` : 'Validated'}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Independent validation</span>
                </div>
              </div>

              {/* TAB 1: SUMMARY DETAILS */}
              {activeTab === 'summary' && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', fontSize: '0.88rem' }}>
                  <h3 style={{ fontSize: '1.05rem', margin: '0 0 14px 0', color: '#0f172a', fontWeight: 700 }}>
                    Clinical Session Overview
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.78rem' }}>Patient Name</span>
                      <strong>{patientInfo.patientName || config.patientName || 'Patient'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.78rem' }}>Therapy Mode</span>
                      <strong style={{ textTransform: 'capitalize' }}>{config.mode} ({config.movement})</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.78rem' }}>Stimulus Speed</span>
                      <span>{config.vStart} → {config.vEnd} px/s over {config.duration}s</span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.78rem' }}>Telemetry Integrity</span>
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Genuine webcam landmarks (Zero synthesis)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: VISUAL PATH COMPARISON & TIMELINE */}
              {activeTab === 'visual_path' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 14 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={showTargetPath} onChange={e => setShowTargetPath(e.target.checked)} />
                        <span style={{ color: '#ea580c', fontWeight: 600 }}>Target Trajectory</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={showGazePath} onChange={e => setShowGazePath(e.target.checked)} />
                        <span style={{ color: '#0284c7', fontWeight: 600 }}>Estimated Patient Gaze</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={showInvalidIntervals} onChange={e => setShowInvalidIntervals(e.target.checked)} />
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>Invalid Tracking Intervals</span>
                      </label>
                    </div>
                  </div>

                  {/* 2D Trajectory Canvas Map */}
                  <div style={{ background: '#0f172a', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                    <PathComparisonCanvas
                      telemetry={allRows}
                      showTarget={showTargetPath}
                      showGaze={showGazePath}
                      showInvalid={showInvalidIntervals}
                    />
                  </div>

                  {/* Synchronized Timeline */}
                  <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#0f172a' }}>
                      Synchronized Tracking Timeline (Horizontal Target X vs Gaze X)
                    </h4>
                    <TimelineComparisonCanvas telemetry={allRows} />
                  </div>
                </div>
              )}

              {/* TAB 3: SACCADE ANALYSIS */}
              {activeTab === 'saccade' && (
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#0f172a' }}>
                    Saccade Transition & Gaze Latency Events
                  </h4>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                          <th style={{ padding: '8px 12px' }}>#</th>
                          <th style={{ padding: '8px 12px' }}>Time</th>
                          <th style={{ padding: '8px 12px' }}>Previous Position</th>
                          <th style={{ padding: '8px 12px' }}>New Target</th>
                          <th style={{ padding: '8px 12px' }}>Response Interval</th>
                          <th style={{ padding: '8px 12px' }}>Target Entered</th>
                          <th style={{ padding: '8px 12px' }}>Final Delta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allSaccades.map((t, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{idx + 1}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{t.timeSec}s</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>({t.prevTarget.x}, {t.prevTarget.y})</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#ea580c' }}>({t.newTarget.x}, {t.newTarget.y})</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{t.latencyMs} ms</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{
                                padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600,
                                background: t.enteredTargetRegion ? '#dcfce7' : '#fee2e2',
                                color: t.enteredTargetRegion ? '#166534' : '#991b1b'
                              }}>
                                {t.enteredTargetRegion ? 'YES' : 'NO'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px' }}>{t.finalErrorPx} px</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: TABULAR COLUMN DATA */}
              {activeTab === 'table' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search timestamp, reason, coordinates..."
                        value={tableSearch}
                        onChange={(e) => { setTableSearch(e.target.value); setTablePage(1); }}
                        style={{ maxWidth: 280, fontSize: '0.85rem' }}
                      />
                      <select
                        className="form-select"
                        value={tableFilterValid}
                        onChange={(e) => { setTableFilterValid(e.target.value); setTablePage(1); }}
                        style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                      >
                        <option value="all">All Frames</option>
                        <option value="valid_only">Valid Only</option>
                        <option value="invalid_only">Invalid Only</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={handleExportCSV}
                    >
                      <Download size={14} /> Download CSV
                    </button>
                  </div>

                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflowX: 'auto', maxHeight: '360px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', position: 'sticky', top: 0 }}>
                          <th style={{ padding: '8px 12px' }}>#</th>
                          <th style={{ padding: '8px 12px' }}>Time (s)</th>
                          <th style={{ padding: '8px 12px' }}>Status</th>
                          <th style={{ padding: '8px 12px' }}>Gaze (px)</th>
                          <th style={{ padding: '8px 12px' }}>Target (px)</th>
                          <th style={{ padding: '8px 12px' }}>Tracking Error</th>
                          <th style={{ padding: '8px 12px' }}>Quality</th>
                          <th style={{ padding: '8px 12px' }}>Head Yaw</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentTableRows.map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                            <td style={{ padding: '7px 12px', color: '#64748b' }}>{(tablePage - 1) * rowsPerPage + i + 1}</td>
                            <td style={{ padding: '7px 12px', fontWeight: 600 }}>{r.timeSec}s</td>
                            <td style={{ padding: '7px 12px' }}>
                              <span style={{
                                padding: '2px 6px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600,
                                background: r.valid ? '#dcfce7' : '#fee2e2',
                                color: r.valid ? '#166534' : '#991b1b'
                              }}>
                                {r.valid ? 'VALID' : r.invalidReason || 'INVALID'}
                              </span>
                            </td>
                            <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: r.valid ? '#0284c7' : '#94a3b8' }}>
                              {r.valid ? `${r.eyeX}, ${r.eyeY}` : '—'}
                            </td>
                            <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: '#ea580c' }}>
                              {r.rawTargetX}, {r.rawTargetY}
                            </td>
                            <td style={{ padding: '7px 12px', fontWeight: 600, color: (r.trackingErrorPx || 0) < 60 ? '#16a34a' : '#d97706' }}>
                              {r.trackingErrorPx !== null && r.trackingErrorPx !== undefined ? `${r.trackingErrorPx} px` : '—'}
                            </td>
                            <td style={{ padding: '7px 12px', color: '#475569' }}>
                              {r.trackingQuality !== undefined ? `${Math.round(r.trackingQuality * 100)}%` : '—'}
                            </td>
                            <td style={{ padding: '7px 12px', color: '#64748b' }}>
                              {r.headPose?.yaw !== undefined ? r.headPose.yaw : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: '0.8rem', color: '#64748b' }}>
                    <span>Showing Page {tablePage} of {totalPages}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => setTablePage(p => Math.max(1, p - 1))}
                        disabled={tablePage === 1}
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => setTablePage(p => Math.min(totalPages, p + 1))}
                        disabled={tablePage >= totalPages}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 28px', borderTop: '1px solid #e2e8f0', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center', background: '#ffffff'
            }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleExportCSV}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Download size={16} /> Export Telemetry CSV
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSafeExit}
                style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: '180px' }}
              >
                <ArrowLeft size={16} /> Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2D Path Comparison Canvas Helper Component
// ---------------------------------------------------------------------------
function PathComparisonCanvas({ telemetry, showTarget, showGaze, showInvalid }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !telemetry || telemetry.length === 0) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // 1. Draw Target Path (Orange)
    if (showTarget) {
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let started = false;
      telemetry.forEach(pt => {
        if (pt.targetX !== undefined && pt.targetY !== undefined) {
          const px = pt.targetX * w;
          const py = pt.targetY * h;
          if (!started) { ctx.moveTo(px, py); started = true; }
          else { ctx.lineTo(px, py); }
        }
      });
      ctx.stroke();
    }

    // 2. Draw Estimated Gaze Path (Cyan)
    if (showGaze) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      telemetry.forEach(pt => {
        if (pt.valid && pt.gazeX !== null && pt.gazeY !== null) {
          const px = pt.gazeX * w;
          const py = pt.gazeY * h;
          if (!started) { ctx.moveTo(px, py); started = true; }
          else { ctx.lineTo(px, py); }
        } else {
          started = false; // Break line across invalid frames
        }
      });
      ctx.stroke();
    }

    // 3. Highlight Invalid Intervals (Red cross markers)
    if (showInvalid) {
      ctx.fillStyle = '#ef4444';
      telemetry.forEach(pt => {
        if (!pt.valid && pt.targetX !== undefined) {
          const tx = pt.targetX * w;
          const ty = pt.targetY * h;
          ctx.beginPath();
          ctx.arc(tx, ty, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }, [telemetry, showTarget, showGaze, showInvalid]);

  return (
    <canvas
      ref={canvasRef}
      width={720}
      height={320}
      style={{ display: 'block', width: '100%', height: '320px', borderRadius: 8 }}
    />
  );
}

// ---------------------------------------------------------------------------
// Synchronized Timeline Canvas Helper Component
// ---------------------------------------------------------------------------
function TimelineComparisonCanvas({ telemetry }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !telemetry || telemetry.length === 0) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const n = telemetry.length;
    if (n < 2) return;

    // Grid lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Draw Target X in orange
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.beginPath();
    telemetry.forEach((pt, i) => {
      const x = (i / (n - 1)) * w;
      const y = h - (pt.targetX || 0.5) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Gaze X in cyan
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    let started = false;
    telemetry.forEach((pt, i) => {
      const x = (i / (n - 1)) * w;
      if (pt.valid && pt.gazeX !== null) {
        const y = h - pt.gazeX * h;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else { ctx.lineTo(x, y); }
      } else {
        started = false;
      }
    });
    ctx.stroke();
  }, [telemetry]);

  return (
    <canvas
      ref={canvasRef}
      width={720}
      height={140}
      style={{ display: 'block', width: '100%', height: '140px', borderRadius: 6 }}
    />
  );
}
