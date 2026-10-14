const fs = require('fs');
const path = 'c:/Users/NIVASINI/OneDrive/Desktop/eyehospital/src/components/VisionTherapyCanvas.jsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Replace import
code = code.replace("import { EyeTrackerEngine } from '../utils/eyeTracker';", "import webgazer from 'webgazer';");

// 2. Add calibration state
code = code.replace(
  "const [phase, setPhase] = useState('CALIBRATION');",
  "const [phase, setPhase] = useState('WEBCAM_INIT');\n  const [calibrationClicks, setCalibrationClicks] = useState({});\n  const lastGazeRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });"
);

// 3. Replace tracker setup
const setupOld = /\s*\/\/ Initialize camera and eye tracker engine on mount[\s\S]*?\}, \[\]\);/g;
const setupNew = `
  // Initialize WebGazer on mount
  useEffect(() => {
    let isCancelled = false;

    async function setupWebGazer() {
      try {
        await webgazer.setRegression('ridge')
          .setGazeListener((data, elapsedTime) => {
            if (data == null) return;
            // Update latest gaze coords in a ref so the render loop can read it synchronously
            lastGazeRef.current = { x: data.x, y: data.y };
          })
          .begin();

        webgazer.showVideoPreview(true)
                .showPredictionPoints(true)
                .applyVideoCoordinates();

        if (!isCancelled) {
          setCameraReady(true);
          setPhase('CALIBRATING');
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('WebGazer setup failed:', err);
          setCameraError(err.message);
        }
      }
    }

    setupWebGazer();

    return () => {
      isCancelled = true;
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }
      try {
        webgazer.end();
      } catch (e) {}
    };
  }, []);`;

code = code.replace(setupOld, setupNew);

// 4. Remove startAlignmentCheck and startTestSession, replace with 9-point click handler
const alignmentOldRegex = /\/\*\*[\s\S]*?startTestSession \= \(\) \=\> \{[\s\S]*?setPhase\('RUNNING'\);\n  \};/g;
const calibrationNew = `
  const calibrationPoints = [
    { id: 1, top: '10%', left: '10%' },
    { id: 2, top: '10%', left: '50%' },
    { id: 3, top: '10%', left: '90%' },
    { id: 4, top: '50%', left: '10%' },
    { id: 5, top: '50%', left: '50%' },
    { id: 6, top: '50%', left: '90%' },
    { id: 7, top: '90%', left: '10%' },
    { id: 8, top: '90%', left: '50%' },
    { id: 9, top: '90%', left: '90%' },
  ];

  const handleCalibrationClick = (id) => {
    setCalibrationClicks(prev => {
      const newClicks = { ...prev, [id]: (prev[id] || 0) + 1 };
      
      // Check if all 9 points clicked at least 3 times
      let allDone = true;
      for (let i = 1; i <= 9; i++) {
        if ((newClicks[i] || 0) < 3) allDone = false;
      }
      
      if (allDone) {
        // Hide WebGazer UI elements during the actual test
        webgazer.showVideoPreview(false).showPredictionPoints(false);
        telemetryDataRef.current = [];
        setPhase('RUNNING');
      }
      
      return newClicks;
    });
  };`;

code = code.replace(alignmentOldRegex, calibrationNew);

// 5. Update render loop gaze fetching
const gazeFetchOldRegex = /\s*let currentGaze = \{ eyeX: Math\.round\(pos\.x\), eyeY: Math\.round\(pos\.y\), leftEye: \{ x: 0, y: 0 \}, rightEye: \{ x: 0, y: 0 \} \};\s*if \(trackerRef\.current\) \{\s*currentGaze = trackerRef\.current\.trackCurrentGaze\(\{ x: pos\.x, y: pos\.y \}, true\);\s*\}/g;

const gazeFetchNew = `      let currentGaze = { 
        eyeX: Math.round(lastGazeRef.current.x), 
        eyeY: Math.round(lastGazeRef.current.y), 
        leftEye: { x: 0, y: 0 }, 
        rightEye: { x: 0, y: 0 } 
      };`;

code = code.replace(gazeFetchOldRegex, gazeFetchNew);

// 6. Replace Phase Render (JSX)
const renderPhaseOldRegex = /\{\/\* ======================================================== \*\/\s*\{\/\* STAGE 1: CALIBRATION & ALIGNMENT OVERLAY         \*\/[\s\S]*?\{\/\* Main Stimulus Canvas \*\/\}/g;

const renderPhaseNew = `{/* ======================================================== */}
      {/* STAGE 1: WEBCAM INIT & ERROR OVERLAY                     */}
      {/* ======================================================== */}
      {phase === 'WEBCAM_INIT' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(15, 23, 42, 0.95)', zIndex: 50, color: '#fff', flexDirection: 'column', gap: 15
        }}>
          {cameraError ? (
            <>
              <AlertCircle size={48} color="#ef4444" />
              <h2 style={{ margin: 0 }}>Camera Error</h2>
              <p style={{ color: '#94a3b8' }}>{cameraError}</p>
              <button className="btn btn-primary" onClick={onClose}>Exit</button>
            </>
          ) : (
            <>
              <div className="spinner-border text-primary" role="status" style={{ width: 40, height: 40 }} />
              <h2>Initializing WebGazer...</h2>
              <p style={{ color: '#94a3b8' }}>Please allow camera access and keep your face well-lit.</p>
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* STAGE 1.5: 9-POINT CALIBRATION                           */}
      {/* ======================================================== */}
      {phase === 'CALIBRATING' && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.8)', zIndex: 40
        }}>
          <div style={{ position: 'absolute', top: 30, width: '100%', textAlign: 'center', color: '#fff' }}>
            <h2 style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>WebGazer Calibration</h2>
            <p>Please look at each dot and <strong>click it 3 times</strong>.</p>
          </div>
          {calibrationPoints.map(p => {
            const c = calibrationClicks[p.id] || 0;
            if (c >= 3) return null;
            return (
              <button
                key={p.id}
                onClick={() => handleCalibrationClick(p.id)}
                style={{
                  position: 'absolute',
                  top: p.top, left: p.left,
                  transform: 'translate(-50%, -50%)',
                  width: 32, height: 32,
                  borderRadius: '50%',
                  background: c === 0 ? '#ef4444' : c === 1 ? '#f59e0b' : '#22c55e',
                  border: '2px solid #fff',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              />
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* STAGE 2: LIVE STIMULUS & TELEMETRY UI                    */}
      {/* ======================================================== */}
      {phase === 'RUNNING' && (
        <>
          {/* Top HUD */}
          <div style={{
            position: 'absolute', top: 20, left: 20, right: 20,
            display: 'flex', justifyContent: 'space-between', zIndex: 10
          }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{
                background: 'rgba(15, 23, 42, 0.85)', padding: '10px 20px',
                borderRadius: '9999px', border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff', display: 'flex', gap: 12, alignItems: 'center'
              }}>
                <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>TIME LEFT</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace' }}>
                  00:{timeLeft.toString().padStart(2, '0')}
                </span>
              </div>
            </div>
            <div>
              <button
                onClick={handleSafeExit}
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff', padding: '8px 16px',
                  borderRadius: '9999px', cursor: 'pointer',
                  fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <X size={16} /> Exit (ESC)
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Stimulus Canvas */}`;

code = code.replace(renderPhaseOldRegex, renderPhaseNew);

// 7. safe exit cleanup
const safeExitOld = /\s*if \(trackerRef\.current\) \{\s*trackerRef\.current\.stopCamera\(\);\s*\}/g;
const safeExitNew = `    try {
      webgazer.end();
    } catch(e) {}`;

code = code.replace(safeExitOld, safeExitNew);

fs.writeFileSync(path, code);
console.log("Refactoring complete");
