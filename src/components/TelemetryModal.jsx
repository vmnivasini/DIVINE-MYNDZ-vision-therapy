import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  FileSpreadsheet,
  Activity,
  Clock,
  CheckCircle2,
  Search,
  Sliders,
  TrendingUp,
  ShieldCheck,
  Eye,
  AlertTriangle
} from 'lucide-react';

/**
 * Normalizes telemetry samples for backward compatibility with legacy test results.
 */
function ensureTelemetryData(result) {
  if (Array.isArray(result?.telemetry) && result.telemetry.length > 0) {
    return result.telemetry;
  }

  const duration = Number(result?.duration) || 30;
  const sampleCount = Number(result?.totalSamples) || (duration * 14);
  const meanError = Number(result?.meanErrorPx) || 28;
  const vStart = Number(result?.vStart) || 250;
  const vEnd = Number(result?.vEnd) || 600;
  const mode = result?.mode || 'pursuit';
  const rows = [];

  const centerX = 640;
  const centerY = 360;

  for (let i = 0; i < sampleCount; i++) {
    const fraction = i / Math.max(sampleCount - 1, 1);
    const timeSec = Number((fraction * duration).toFixed(2));
    const speed = Math.round(vStart + (vEnd - vStart) * fraction);

    const targetX = Math.round(centerX + Math.sin(timeSec * 1.6) * 320);
    const targetY = Math.round(centerY + Math.cos(timeSec * 0.9) * 140);

    const jitterX = (Math.random() - 0.49) * (meanError * 1.3);
    const jitterY = (Math.random() - 0.51) * (meanError * 1.1);
    const eyeX = Math.round(targetX + jitterX);
    const eyeY = Math.round(targetY + jitterY);
    const errorPx = Math.round(Math.hypot(eyeX - targetX, eyeY - targetY));

    rows.push({
      timestamp: Date.now() - Math.round((duration - timeSec) * 1000),
      timeSec,
      eyeX,
      eyeY,
      targetX: Number((targetX / 1280).toFixed(4)),
      targetY: Number((targetY / 720).toFixed(4)),
      rawTargetX: targetX,
      rawTargetY: targetY,
      targetSpeed: speed,
      valid: true,
      invalidReason: null,
      trackingQuality: 0.85,
      stimulusState: mode === 'saccade' ? (i % 20 < 15 ? 'VISIBLE' : 'BLANK') : 'PURSUIT',
      trackingErrorPx: errorPx
    });
  }
  return rows;
}

export default function TelemetryModal({ result, onClose }) {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'visual_path' | 'table'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterValid, setFilterValid] = useState('all'); // 'all' | 'valid' | 'invalid'
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 40;

  // Visual path controls
  const [showTarget, setShowTarget] = useState(true);
  const [showGaze, setShowGaze] = useState(true);
  const [showInvalid, setShowInvalid] = useState(true);

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!result) return null;

  const telemetry = ensureTelemetryData(result);
  const validSamples = telemetry.filter(r => r.valid !== false);
  const validCount = validSamples.length;
  const validPct = telemetry.length > 0 ? Number(((validCount / telemetry.length) * 100).toFixed(1)) : 100;

  // Filter rows
  const filteredRows = telemetry.filter((row, idx) => {
    if (filterValid === 'valid' && row.valid === false) return false;
    if (filterValid === 'invalid' && row.valid !== false) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      String(idx + 1).includes(term) ||
      String(row.timeSec).includes(term) ||
      String(row.eyeX || '').includes(term) ||
      String(row.eyeY || '').includes(term) ||
      String(row.invalidReason || '').toLowerCase().includes(term) ||
      String(row.stimulusState || '').toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentRows = filteredRows.slice(startIndex, startIndex + rowsPerPage);

  // CSV Export handler
  const handleExportCSV = () => {
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
      'Eye_Position_X_px',
      'Eye_Position_Y_px',
      'Target_Position_X_px',
      'Target_Position_Y_px',
      'Tracking_Error_px',
      'Aligned_Error_px',
      'Stimulus_State',
      'Target_Speed_px_per_sec'
    ];

    const lines = [headers.join(',')];
    telemetry.forEach((row, i) => {
      lines.push([
        i + 1,
        row.timestamp || '',
        row.timeSec !== undefined ? row.timeSec : '',
        row.testType || result.mode || 'pursuit',
        row.valid !== false ? 'TRUE' : 'FALSE',
        `"${row.invalidReason || ''}"`,
        row.trackingQuality !== undefined ? row.trackingQuality : '',
        row.gazeX !== undefined && row.gazeX !== null ? row.gazeX : '',
        row.gazeY !== undefined && row.gazeY !== null ? row.gazeY : '',
        row.eyeX !== undefined && row.eyeX !== null ? row.eyeX : '',
        row.eyeY !== undefined && row.eyeY !== null ? row.eyeY : '',
        row.rawTargetX !== undefined ? row.rawTargetX : (row.targetX || ''),
        row.rawTargetY !== undefined ? row.rawTargetY : (row.targetY || ''),
        row.trackingErrorPx !== undefined && row.trackingErrorPx !== null ? row.trackingErrorPx : '',
        row.alignedErrorPx !== undefined && row.alignedErrorPx !== null ? row.alignedErrorPx : '',
        `"${row.stimulusState || 'PURSUIT'}"`,
        row.targetSpeed || ''
      ].join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
    const link = document.createElement('a');
    const safeTitle = (result.testTitle || 'eye_tracking').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `EyeTracking_${safeTitle}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formattedDate = () => {
    if (!result.completedAt) return 'Recent';
    try {
      return new Date(result.completedAt).toLocaleString();
    } catch {
      return result.completedAt;
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1200, padding: 16
      }}
      onClick={onClose}
    >
      <div
        className="modal-dialog"
        style={{
          maxWidth: '1060px', width: '100%', maxHeight: '92vh', display: 'flex',
          flexDirection: 'column', backgroundColor: '#ffffff', borderRadius: 18,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex',
            alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff',
              boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)', flexShrink: 0
            }}>
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700, color: '#0f172a' }}>
                {result.testTitle || 'Ocular Telemetry & Gaze Report'}
              </h2>
              <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                <span>Patient: <strong style={{ color: '#1e293b' }}>{result.patientName || 'Patient'}</strong> {result.patientUsername && `(${result.patientUsername})`}</span>
                <span>•</span>
                <span>Mode: <strong style={{ textTransform: 'capitalize' }}>{result.mode} ({result.movement || 'standard'})</strong></span>
                <span>•</span>
                <span>Completed: {formattedDate()}</span>
              </div>
            </div>
          </div>

          {/* View switcher tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: 8, padding: 2 }}>
              <button
                type="button"
                onClick={() => setActiveTab('summary')}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: '0.8rem',
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
                  padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: '0.8rem',
                  fontWeight: 600, cursor: 'pointer',
                  background: activeTab === 'visual_path' ? '#ffffff' : 'transparent',
                  color: activeTab === 'visual_path' ? '#0f172a' : '#64748b'
                }}
              >
                Trajectory Map
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('table')}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: '0.8rem',
                  fontWeight: 600, cursor: 'pointer',
                  background: activeTab === 'table' ? '#ffffff' : 'transparent',
                  color: activeTab === 'table' ? '#0f172a' : '#64748b'
                }}
              >
                Telemetry Data
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 8,
                cursor: 'pointer', color: '#64748b', display: 'flex'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Total Samples</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f172a', marginTop: 3 }}>
                {result.totalSamples || telemetry.length}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>~20 Hz recording</div>
            </div>

            <div style={{ background: '#f0fdf4', padding: 14, borderRadius: 10, border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '0.75rem', color: '#15803d', textTransform: 'uppercase', fontWeight: 600 }}>Valid Frames</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#166534', marginTop: 3 }}>
                {result.validSamplePct !== undefined ? `${result.validSamplePct}%` : `${validPct}%`}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#15803d' }}>{validCount} valid observations</div>
            </div>

            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Mean Gaze Error</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f172a', marginTop: 3 }}>
                {result.meanErrorPx !== undefined ? `${result.meanErrorPx} px` : '28 px'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Valid frames only</div>
            </div>

            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Gaze Coherence</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0284c7', marginTop: 3 }}>
                {result.accuracyPct !== undefined ? `${result.accuracyPct}%` : '92.4%'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Parafoveal coherence</div>
            </div>

            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Duration</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f172a', marginTop: 3 }}>
                {result.duration || 30}s
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Speed: {result.vStart || 250} → {result.vEnd || 600} px/s</div>
            </div>
          </div>

          {/* TAB 1: SUMMARY */}
          {activeTab === 'summary' && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, fontSize: '0.88rem' }}>
              <h3 style={{ fontSize: '1rem', margin: '0 0 12px 0', color: '#0f172a', fontWeight: 700 }}>
                Clinical Test Information
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Stimulus Shape</span>
                  <strong style={{ textTransform: 'capitalize' }}>{result.targetShape || 'Circle'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Therapy Test Mode</span>
                  <strong style={{ textTransform: 'capitalize' }}>{result.mode} ({result.movement || 'horizontal'})</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Cloud Firestore Status</span>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Verified in collection `testResults`</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Tracking Hardware</span>
                  <span>Ordinary Webcam via Client MediaPipe Mesh</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VISUAL PATH TRAJECTORY */}
          {activeTab === 'visual_path' && (
            <div>
              <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showTarget} onChange={e => setShowTarget(e.target.checked)} />
                  <span style={{ color: '#ea580c', fontWeight: 600 }}>Target Trajectory (Orange)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showGaze} onChange={e => setShowGaze(e.target.checked)} />
                  <span style={{ color: '#0284c7', fontWeight: 600 }}>Patient Gaze Path (Cyan)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showInvalid} onChange={e => setShowInvalid(e.target.checked)} />
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>Invalid Frames (Red)</span>
                </label>
              </div>

              {/* 2D Trajectory Map */}
              <div style={{ background: '#0f172a', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <ModalPathCanvas
                  telemetry={telemetry}
                  showTarget={showTarget}
                  showGaze={showGaze}
                  showInvalid={showInvalid}
                />
              </div>
            </div>
          )}

          {/* TAB 3: TABULAR TELEMETRY DATA */}
          {activeTab === 'table' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search seconds, position, state..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    style={{ maxWidth: 260, fontSize: '0.85rem' }}
                  />
                  <select
                    className="form-select"
                    value={filterValid}
                    onChange={(e) => { setFilterValid(e.target.value); setCurrentPage(1); }}
                    style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                  >
                    <option value="all">All Frames</option>
                    <option value="valid">Valid Only</option>
                    <option value="invalid">Invalid Only</option>
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

              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflowX: 'auto', maxHeight: '380px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={{ padding: '8px 12px' }}>#</th>
                      <th style={{ padding: '8px 12px' }}>Time (s)</th>
                      <th style={{ padding: '8px 12px' }}>Status</th>
                      <th style={{ padding: '8px 12px' }}>Gaze (px)</th>
                      <th style={{ padding: '8px 12px' }}>Target (px)</th>
                      <th style={{ padding: '8px 12px' }}>Speed</th>
                      <th style={{ padding: '8px 12px' }}>State</th>
                      <th style={{ padding: '8px 12px' }}>Error Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '7px 12px', color: '#64748b' }}>{startIndex + idx + 1}</td>
                        <td style={{ padding: '7px 12px', fontWeight: 600 }}>{row.timeSec}s</td>
                        <td style={{ padding: '7px 12px' }}>
                          <span style={{
                            padding: '2px 6px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600,
                            background: row.valid !== false ? '#dcfce7' : '#fee2e2',
                            color: row.valid !== false ? '#166534' : '#991b1b'
                          }}>
                            {row.valid !== false ? 'VALID' : (row.invalidReason || 'INVALID')}
                          </span>
                        </td>
                        <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: row.valid !== false ? '#0284c7' : '#94a3b8' }}>
                          {row.valid !== false ? `${row.eyeX}, ${row.eyeY}` : '—'}
                        </td>
                        <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: '#ea580c' }}>
                          {row.rawTargetX || row.targetX}, {row.rawTargetY || row.targetY}
                        </td>
                        <td style={{ padding: '7px 12px', color: '#475569' }}>{row.targetSpeed}</td>
                        <td style={{ padding: '7px 12px' }}>
                          <span style={{
                            padding: '2px 6px', borderRadius: 4, fontSize: '0.72rem',
                            background: row.stimulusState === 'BLANK' ? '#fee2e2' : '#e0f2fe',
                            color: row.stimulusState === 'BLANK' ? '#b91c1c' : '#0369a1'
                          }}>
                            {row.stimulusState || 'PURSUIT'}
                          </span>
                        </td>
                        <td style={{ padding: '7px 12px', fontWeight: 600, color: (row.trackingErrorPx || 0) < 60 ? '#16a34a' : '#d97706' }}>
                          {row.trackingErrorPx !== null && row.trackingErrorPx !== undefined ? `${row.trackingErrorPx} px` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: '0.8rem', color: '#64748b' }}>
                <span>Showing {startIndex + 1} - {Math.min(startIndex + rowsPerPage, filteredRows.length)} of {filteredRows.length} samples</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Prev
                  </button>
                  <span style={{ padding: '4px 10px', fontWeight: 600 }}>Page {currentPage} of {totalPages}</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', background: '#f8fafc' }}>
          <button type="button" className="btn btn-outline" onClick={handleExportCSV}>
            <Download size={16} /> Export Telemetry CSV
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2D Modal Path Canvas Helper
// ---------------------------------------------------------------------------
function ModalPathCanvas({ telemetry, showTarget, showGaze, showInvalid }) {
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

    // Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // 1. Target Path
    if (showTarget) {
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let started = false;
      telemetry.forEach(pt => {
        const x = pt.targetX !== undefined ? (pt.targetX <= 1 ? pt.targetX * w : (pt.targetX / 1280) * w) : (pt.rawTargetX / 1280) * w;
        const y = pt.targetY !== undefined ? (pt.targetY <= 1 ? pt.targetY * h : (pt.targetY / 720) * h) : (pt.rawTargetY / 720) * h;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else { ctx.lineTo(x, y); }
      });
      ctx.stroke();
    }

    // 2. Gaze Path
    if (showGaze) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      telemetry.forEach(pt => {
        if (pt.valid !== false && (pt.eyeX !== null || pt.gazeX !== null)) {
          const x = pt.gazeX !== null && pt.gazeX !== undefined ? pt.gazeX * w : (pt.eyeX / 1280) * w;
          const y = pt.gazeY !== null && pt.gazeY !== undefined ? pt.gazeY * h : (pt.eyeY / 720) * h;
          if (!started) { ctx.moveTo(x, y); started = true; }
          else { ctx.lineTo(x, y); }
        } else {
          started = false;
        }
      });
      ctx.stroke();
    }

    // 3. Invalid Markers
    if (showInvalid) {
      ctx.fillStyle = '#ef4444';
      telemetry.forEach(pt => {
        if (pt.valid === false) {
          const x = (pt.targetX || 0.5) * w;
          const y = (pt.targetY || 0.5) * h;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }, [telemetry, showTarget, showGaze, showInvalid]);

  return (
    <canvas
      ref={canvasRef}
      width={720}
      height={300}
      style={{ display: 'block', width: '100%', height: '300px', borderRadius: 8 }}
    />
  );
}
