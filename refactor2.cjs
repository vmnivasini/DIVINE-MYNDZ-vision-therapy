const fs = require('fs');
const path = 'c:/Users/NIVASINI/OneDrive/Desktop/eyehospital/src/components/VisionTherapyCanvas.jsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// Find start and end indices
const startIdx = lines.findIndex(l => l.includes('{/* STAGE 1: EYE DETECTION & ALIGNMENT PREPARATION MODAL     */}'));
const endIdx = lines.findIndex(l => l.includes('{/* Main Stimulus Canvas */}'));

if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
  const newJSX = `{/* ======================================================== */}
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
      )}`;

  // Delete from `startIdx - 1` (to catch the equal signs above it) up to `endIdx - 1`
  lines.splice(startIdx - 1, endIdx - (startIdx - 1), newJSX);
  fs.writeFileSync(path, lines.join('\n'));
  console.log("Replaced lines successfully");
} else {
  console.error("Could not find start or end indices");
  console.log({ startIdx, endIdx });
}
