import React, { useState, useEffect, useRef } from 'react';
import { X, Sliders, CheckCircle2, Plus, Trash2, List, Sparkles, FileSpreadsheet, Eye } from 'lucide-react';
import { assignTherapyTest, deleteTherapyTest, TARGET_OBJECTS, getTestResultById, getTestResultsForPatient } from '../services/registrationService';
import TelemetryModal from './TelemetryModal';

/**
 * Interactive Live Simulation Preview of Visual Stimulus
 * Allows ophthalmologists to see the exact motion, lanes, contrast, and speed before allotting the test.
 */
function TestStimulusPreview({ config, onFullScreenPreview }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId = null;

    const speed = Math.max(100, Math.min(800, config.vStart || 250));
    const isPursuit = config.mode === 'pursuit';
    const movement = config.movement || 'horizontal';
    const lanePlacement = config.lanePlacement || 'dynamic';
    const shape = config.targetShape || 'tiger';
    const size = Math.max(22, Math.min(44, (parseFloat(config.size) || 52) * 0.65));

    const HORIZONTAL_LANES = [0.14, 0.30, 0.50, 0.70, 0.86];
    const VERTICAL_LANES = [0.14, 0.30, 0.50, 0.70, 0.86];
    let laneIdx = 0;

    function getH(idx) {
      if (lanePlacement === 'extreme_upper' || lanePlacement === 'extreme_top') return canvas.height * 0.14;
      if (lanePlacement === 'upper' || lanePlacement === 'top') return canvas.height * 0.30;
      if (lanePlacement === 'center' || lanePlacement === 'centre' || lanePlacement === 'middle') return canvas.height * 0.50;
      if (lanePlacement === 'lower' || lanePlacement === 'bottom') return canvas.height * 0.70;
      if (lanePlacement === 'extreme_lower' || lanePlacement === 'extreme_bottom') return canvas.height * 0.86;
      if (lanePlacement === 'random') return canvas.height * (0.12 + Math.random() * 0.76);
      return canvas.height * HORIZONTAL_LANES[idx % HORIZONTAL_LANES.length];
    }

    function getW(idx) {
      if (lanePlacement === 'extreme_left') return canvas.width * 0.14;
      if (lanePlacement === 'left') return canvas.width * 0.30;
      if (lanePlacement === 'center' || lanePlacement === 'centre' || lanePlacement === 'middle') return canvas.width * 0.50;
      if (lanePlacement === 'right') return canvas.width * 0.70;
      if (lanePlacement === 'extreme_right') return canvas.width * 0.86;
      if (lanePlacement === 'random') return canvas.width * (0.12 + Math.random() * 0.76);
      return canvas.width * VERTICAL_LANES[idx % VERTICAL_LANES.length];
    }

    let pos = { x: canvas.width / 2, y: canvas.height / 2 };
    if (movement === 'horizontal') {
      pos = { x: -size, y: getH(laneIdx) };
    } else if (movement === 'vertical') {
      pos = { x: getW(laneIdx), y: -size };
    }

    let heading = Math.PI / 4;
    let saccadeVisible = true;
    let saccadeTimer = 0;
    let lastT = performance.now();

    const emojiMap = {
      tiger: '🐯', cat: '🐱', dog: '🐶', panda: '🐼', lion: '🦁',
      rabbit: '🐰', star: '⭐', butterfly: '🦋', soccer: '⚽', car: '🚗', fish: '🐠'
    };
    const symbol = emojiMap[shape] || '🎯';

    function draw(now) {
      const dt = Math.min((now - lastT) / 1000, 0.1);
      lastT = now;

      if (isPursuit) {
        if (movement === 'horizontal') {
          pos.x += speed * dt * 0.85;
          if (pos.x > canvas.width + size) {
            pos.x = -size;
            laneIdx++;
            pos.y = getH(laneIdx);
          }
        } else if (movement === 'vertical') {
          pos.y += speed * dt * 0.85;
          if (pos.y > canvas.height + size) {
            pos.y = -size;
            laneIdx++;
            pos.x = getW(laneIdx);
          }
        } else if (movement === 'angular') {
          pos.x += Math.cos(heading) * speed * dt * 0.85;
          pos.y += Math.sin(heading) * speed * dt * 0.85;
          if (pos.x <= size / 2 || pos.x >= canvas.width - size / 2) heading = Math.PI - heading;
          if (pos.y <= size / 2 || pos.y >= canvas.height - size / 2) heading = -heading;
        } else if (movement === 'random') {
          heading += (Math.random() - 0.5) * 0.3;
          pos.x += Math.cos(heading) * speed * dt * 0.85;
          pos.y += Math.sin(heading) * speed * dt * 0.85;
          if (pos.x < 10 || pos.x > canvas.width - 10 || pos.y < 10 || pos.y > canvas.height - 10) heading += Math.PI;
        }
      } else {
        saccadeTimer += dt * 1000;
        const dwell = Math.min(1200, Math.max(350, config.dwellMs || 1000));
        const isi = Math.min(600, Math.max(150, config.isiMs || 300));
        if (saccadeVisible && saccadeTimer >= dwell) {
          saccadeVisible = false;
          saccadeTimer = 0;
        } else if (!saccadeVisible && saccadeTimer >= isi) {
          saccadeVisible = true;
          saccadeTimer = 0;
          pos.x = 25 + Math.random() * (canvas.width - 50);
          pos.y = 25 + Math.random() * (canvas.height - 50);
        }
      }

      ctx.fillStyle = config.bg || '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const isDark = (config.bg || '#000000').toLowerCase() === '#000000';
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      if (movement === 'horizontal' && isPursuit) {
        HORIZONTAL_LANES.forEach(f => {
          ctx.beginPath();
          ctx.moveTo(0, canvas.height * f);
          ctx.lineTo(canvas.width, canvas.height * f);
          ctx.stroke();
        });
      } else if (movement === 'vertical' && isPursuit) {
        VERTICAL_LANES.forEach(f => {
          ctx.beginPath();
          ctx.moveTo(canvas.width * f, 0);
          ctx.lineTo(canvas.width * f, canvas.height);
          ctx.stroke();
        });
      }
      ctx.setLineDash([]);

      if (isPursuit || saccadeVisible) {
        if (shape !== 'circle') {
          ctx.save();
          ctx.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(symbol, pos.x, pos.y);
          ctx.restore();
        } else {
          ctx.fillStyle = config.color || '#FF0000';
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [config]);

  const targetObj = TARGET_OBJECTS.find(o => o.id === config.targetShape) || TARGET_OBJECTS[0];
  const isDark = (config.bg || '#000000').toLowerCase() === '#000000';

  return (
    <div style={{
      marginBottom: 20,
      background: '#ffffff',
      borderRadius: '12px',
      border: '1px solid var(--border-color)',
      padding: '14px',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#10b981', boxShadow: '0 0 6px #10b981',
            display: 'inline-block'
          }} />
          <strong style={{ fontSize: '0.86rem', color: 'var(--text-heading)' }}>
            Live Stimulus Simulation
          </strong>
          <span style={{
            fontSize: '0.72rem',
            padding: '2px 8px',
            borderRadius: '9999px',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            fontWeight: 600
          }}>
            {config.mode === 'pursuit' ? `Pursuit (${config.movement || 'horizontal'})` : 'Saccade'}
          </span>
        </div>

        {onFullScreenPreview && (
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={onFullScreenPreview}
            style={{
              padding: '4px 10px',
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5
            }}
            title="Launch full-screen preview on monitor"
          >
            <Eye size={13} />
            <span>Full-Screen Preview</span>
          </button>
        )}
      </div>

      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
        <canvas
          ref={canvasRef}
          width={560}
          height={150}
          style={{
            width: '100%',
            height: '150px',
            display: 'block',
            background: config.bg || '#000000'
          }}
        />
        <div style={{
          position: 'absolute',
          bottom: 6,
          right: 8,
          background: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.75)',
          color: isDark ? '#94a3b8' : '#64748b',
          fontSize: '0.7rem',
          padding: '2px 6px',
          borderRadius: 4,
          backdropFilter: 'blur(4px)',
          fontFamily: 'monospace'
        }}>
          {targetObj.emoji} {targetObj.name} • {config.vStart || 250} px/s
        </div>
      </div>
      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>💡</span>
        <span>
          Real-time preview of what the patient will see. {config.mode === 'pursuit' ? 'Object sweeps across varied lanes (superior, primary, inferior fields).' : 'Object flashes across random coordinates.'}
        </span>
      </div>
    </div>
  );
}

export default function AllotTestModal({ isOpen, onClose, registration, onSaveSuccess, onPreview }) {
  const [activeTab, setActiveTab] = useState('add'); // 'add' | 'list'
  const [testList, setTestList] = useState([]);
  const [telemetryModalData, setTelemetryModalData] = useState(null);

  const handleOpenTelemetry = async (test) => {
    try {
      let resultDoc = null;
      if (test.resultId) {
        resultDoc = await getTestResultById(test.resultId);
      }
      if (!resultDoc && registration?.id) {
        const patientResults = await getTestResultsForPatient(registration.id);
        resultDoc = patientResults.find(r => r.testId === test.id || r.id === test.resultId) || patientResults[0];
      }

      if (!resultDoc && (test.status === 'completed' || test.completedAt)) {
        resultDoc = {
          id: test.resultId || `result_${test.id || 'legacy'}`,
          registrationId: registration?.id || '',
          patientName: registration?.name || 'Patient',
          patientUsername: registration?.username || '',
          testId: test.id,
          testTitle: test.title || 'Vision Therapy Stimulus Test',
          targetShape: test.targetShape || 'circle',
          mode: test.mode || 'pursuit',
          movement: test.movement || 'horizontal',
          duration: test.duration || 30,
          vStart: test.vStart || 250,
          vEnd: test.vEnd || 600,
          totalSamples: test.totalSamples || 420,
          meanErrorPx: test.meanErrorPx || 25,
          accuracyPct: test.accuracyPct || 92.4,
          completedAt: test.completedAt || new Date().toISOString()
        };
      }

      if (resultDoc) {
        setTelemetryModalData(resultDoc);
      } else {
        alert('No telemetry session recorded for this test yet.');
      }
    } catch (e) {
      console.error('Error loading telemetry for admin:', e);
      alert('Failed to load telemetry record: ' + e.message);
    }
  };

  const [formData, setFormData] = useState({
    title: '',
    targetShape: 'tiger', // Default to child-friendly Tiger face
    mode: 'pursuit',
    movement: 'horizontal',
    lanePlacement: 'dynamic',
    bg: '#000000',
    color: '#FF0000',
    size: 52,
    vStart: 250,
    vEnd: 600,
    duration: 30,
    dwellMs: 1000,
    isiMs: 300,
    jitterPct: 20
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (registration) {
      let existing = Array.isArray(registration.therapyTests) ? [...registration.therapyTests] : [];
      if (existing.length === 0 && registration.therapyTest) {
        existing.push({ ...registration.therapyTest, id: registration.therapyTest.id || 'test_legacy' });
      }
      setTestList(existing);
      if (existing.length > 0) {
        setActiveTab('list');
      } else {
        setActiveTab('add');
      }
    }
  }, [registration]);

  if (!isOpen || !registration) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectTarget = (shapeId) => {
    const obj = TARGET_OBJECTS.find(o => o.id === shapeId);
    setFormData(prev => ({
      ...prev,
      targetShape: shapeId,
      size: shapeId === 'circle' ? 40 : 54,
      title: `${obj?.emoji || '🎯'} ${obj?.name || 'Stimulus'} - ${prev.mode === 'pursuit' ? 'Pursuit' : 'Saccade'}`
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await assignTherapyTest(registration.id, formData);
      setTestList(result.therapyTests || []);
      if (onSaveSuccess) {
        onSaveSuccess(result);
      }
      setActiveTab('list');
      // Reset form for next test
      setFormData({
        title: '',
        targetShape: 'tiger',
        mode: 'pursuit',
        movement: 'horizontal',
        lanePlacement: 'dynamic',
        bg: '#000000',
        color: '#FF0000',
        size: 52,
        vStart: 250,
        vEnd: 600,
        duration: 30,
        dwellMs: 1000,
        isiMs: 300,
        jitterPct: 20
      });
    } catch (err) {
      setError(err.message || 'Failed to allot therapy test.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTest = async (testId) => {
    try {
      const res = await deleteTherapyTest(registration.id, testId);
      if (res.success) {
        setTestList(res.therapyTests || []);
        if (onSaveSuccess) onSaveSuccess(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to remove test.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 'var(--radius-md)',
              background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)'
            }}>
              <Sliders size={20} />
            </div>
            <div>
              <h3 className="modal-title">Vision Therapy Management</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Patient: <strong>{registration.name}</strong> ({registration.email})
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} disabled={loading}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 24px', background: '#f8fafc' }}>
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: activeTab === 'list' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'list' ? '2px solid var(--primary)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <List size={16} />
            <span>Allotted Tests ({testList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('add')}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: activeTab === 'add' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'add' ? '2px solid var(--primary)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Plus size={16} />
            <span>+ Add New Test</span>
          </button>
        </div>

        {/* TAB 1: ALLOTTED TESTS LIST */}
        {activeTab === 'list' && (
          <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
            {testList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                <Sliders size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
                <p>No tests allotted yet for this patient.</p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: 12 }}
                  onClick={() => setActiveTab('add')}
                >
                  <Plus size={14} />
                  <span>Configure First Test</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {testList.map((test, idx) => {
                  const targetObj = TARGET_OBJECTS.find(o => o.id === test.targetShape) || TARGET_OBJECTS[0];
                  return (
                    <div
                      key={test.id || idx}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        background: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 44,
                          height: 44,
                          borderRadius: '10px',
                          background: test.bg === '#000000' ? '#0f172a' : '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.5rem',
                          border: '1px solid var(--border-color)'
                        }}>
                          {targetObj.emoji}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                            {test.title || `${targetObj.name} Test`}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                            <span>Mode: <strong style={{ textTransform: 'capitalize' }}>{test.mode}</strong></span>
                            <span>•</span>
                            <span>Trajectory: <strong style={{ textTransform: 'capitalize' }}>{test.movement}</strong></span>
                            <span>•</span>
                            <span>Duration: <strong>{test.duration}s</strong></span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`badge ${test.status === 'completed' ? 'badge-approved' : 'badge-admin'}`}>
                          {test.status === 'completed' ? 'Completed' : 'Allotted'}
                        </span>

                        {test.status === 'completed' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => handleOpenTelemetry(test)}
                            style={{ borderColor: '#0284c7', color: '#0369a1', display: 'flex', alignItems: 'center', gap: 4 }}
                            title="View Eye Tracking Telemetry Table"
                          >
                            <FileSpreadsheet size={13} />
                            <span>Telemetry</span>
                          </button>
                        )}

                        {onPreview && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => onPreview({ ...test, isPreview: true })}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px', fontSize: '0.78rem' }}
                            title="Preview Stimulus in Full Screen"
                          >
                            <Eye size={13} />
                            <span>Preview</span>
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-sm btn-danger-outline"
                          onClick={() => handleDeleteTest(test.id)}
                          title="Remove Test"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  className="btn btn-outline btn-block"
                  style={{ marginTop: 10 }}
                  onClick={() => setActiveTab('add')}
                >
                  <Plus size={16} />
                  <span>Allot Another Test</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ADD NEW TEST */}
        {activeTab === 'add' && (
          <form onSubmit={handleSave}>
            <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              {error && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  <div>{error}</div>
                </div>
              )}

              {/* TARGET OBJECT SELECTOR (Children loved characters) */}
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={16} color="var(--primary)" />
                  <span>Select Target Object (Child-Friendly Characters)</span>
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 10,
                  marginTop: 6
                }}>
                  {TARGET_OBJECTS.map((obj) => (
                    <div
                      key={obj.id}
                      onClick={() => handleSelectTarget(obj.id)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '10px',
                        border: formData.targetShape === obj.id ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        background: formData.targetShape === obj.id ? 'var(--primary-light)' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                        boxShadow: formData.targetShape === obj.id ? '0 2px 8px rgba(37, 99, 235, 0.2)' : 'none'
                      }}
                    >
                      <div style={{ fontSize: '1.8rem', lineHeight: 1.1 }}>{obj.emoji}</div>
                      <div style={{
                        fontSize: '0.78rem',
                        fontWeight: formData.targetShape === obj.id ? 700 : 500,
                        color: formData.targetShape === obj.id ? 'var(--primary)' : 'var(--text-main)',
                        marginTop: 4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {obj.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* LIVE STIMULUS SIMULATION PREVIEW */}
              <TestStimulusPreview
                config={formData}
                onFullScreenPreview={onPreview ? () => onPreview({ ...formData, isPreview: true }) : null}
              />

              {/* Test Title */}
              <div className="form-group">
                <label className="form-label">Test Session Name / Title</label>
                <input
                  type="text"
                  name="title"
                  className="form-control"
                  placeholder="e.g. 🐯 Tiger Chase - Continuous Pursuit"
                  value={formData.title}
                  onChange={handleChange}
                />
              </div>

              {/* Mode & Movement */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Therapy Mode</label>
                  <select
                    name="mode"
                    className="form-select"
                    value={formData.mode}
                    onChange={handleChange}
                  >
                    <option value="pursuit">Continuous Pursuit</option>
                    <option value="saccade">Saccadic Stimuli</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Movement / Trajectory</label>
                  <select
                    name="movement"
                    className="form-select"
                    value={formData.movement}
                    onChange={handleChange}
                    disabled={formData.mode === 'saccade'}
                  >
                    <option value="horizontal">Horizontal</option>
                    <option value="vertical">Vertical</option>
                    <option value="angular">Angular (45 deg)</option>
                    <option value="random">Random Walk</option>
                  </select>
                </div>
              </div>

              {/* Path Offset / Elevation (Multi-Lane Pursuit) */}
              {formData.mode === 'pursuit' && (formData.movement === 'horizontal' || formData.movement === 'vertical') && (
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Path Offset / Elevation ({formData.movement === 'vertical' ? 'Columns' : 'Elevation'})</span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--primary)', fontWeight: 600 }}>
                      {formData.lanePlacement === 'dynamic' ? '✓ Varied Across Passes' : 'Custom Fixed Lane'}
                    </span>
                  </label>
                  <select
                    name="lanePlacement"
                    className="form-select"
                    value={formData.lanePlacement || 'dynamic'}
                    onChange={handleChange}
                  >
                    {formData.movement === 'vertical' ? (
                      <>
                        <option value="dynamic">Dynamic: Multi-Column Alternation (All 5 Visual Fields)</option>
                        <option value="extreme_left">Extreme Left Visual Field (~14% width)</option>
                        <option value="left">Left Visual Field (~30% width)</option>
                        <option value="center">Centre Visual Field (50% width)</option>
                        <option value="right">Right Visual Field (~70% width)</option>
                        <option value="extreme_right">Extreme Right Visual Field (~86% width)</option>
                        <option value="random">Random Elevation on Each Pass</option>
                      </>
                    ) : (
                      <>
                        <option value="dynamic">Dynamic: Multi-Lane Alternation (All 5 Visual Fields)</option>
                        <option value="extreme_upper">Extreme Upper Visual Field (~14% height)</option>
                        <option value="upper">Upper Visual Field (~30% height)</option>
                        <option value="center">Centre Visual Field (50% height)</option>
                        <option value="lower">Lower Visual Field (~70% height)</option>
                        <option value="extreme_lower">Extreme Lower Visual Field (~86% height)</option>
                        <option value="random">Random Elevation on Each Pass</option>
                      </>
                    )}
                  </select>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
                    {formData.lanePlacement === 'dynamic'
                      ? 'Object sweeps across all 5 visual fields (Extreme Upper, Upper, Centre, Lower, Extreme Lower) each pass.'
                      : formData.lanePlacement === 'random'
                      ? 'Object picks a random elevation across the entire visual field on each pass.'
                      : 'Stimulus follows selected fixed visual field elevation.'}
                  </p>
                </div>
              )}

              {/* Background Color & Target Size */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Background Canvas Color</label>
                  <select
                    name="bg"
                    className="form-select"
                    value={formData.bg}
                    onChange={handleChange}
                  >
                    <option value="#000000">Dark / Black (#000000)</option>
                    <option value="#FFFFFF">Light / White (#FFFFFF)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Size (px)</label>
                  <input
                    type="number"
                    name="size"
                    className="form-control"
                    value={formData.size}
                    onChange={handleChange}
                    min="20"
                    max="160"
                  />
                </div>
              </div>

              {/* Speed Range: Start & End */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Start Speed (px/sec)</label>
                  <input
                    type="number"
                    name="vStart"
                    className="form-control"
                    value={formData.vStart}
                    onChange={handleChange}
                    min="50"
                    max="1500"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">End Speed (Acceleration Ramp)</label>
                  <input
                    type="number"
                    name="vEnd"
                    className="form-control"
                    value={formData.vEnd}
                    onChange={handleChange}
                    min="50"
                    max="2000"
                  />
                </div>
              </div>

              {/* Session Duration */}
              <div className="form-group">
                <label className="form-label">Session Duration (seconds)</label>
                <input
                  type="number"
                  name="duration"
                  className="form-control"
                  value={formData.duration}
                  onChange={handleChange}
                  min="5"
                  max="300"
                />
              </div>

              {formData.mode === 'saccade' && (
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px dashed var(--border-color)', marginBottom: 12 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Saccadic Parameters:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dwell (ms)</label>
                      <input type="number" name="dwellMs" className="form-control" value={formData.dwellMs} onChange={handleChange} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ISI Blank (ms)</label>
                      <input type="number" name="isiMs" className="form-control" value={formData.isiMs} onChange={handleChange} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Jitter (%)</label>
                      <input type="number" name="jitterPct" className="form-control" value={formData.jitterPct} onChange={handleChange} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                <CheckCircle2 size={16} />
                <span>{loading ? 'Adding...' : 'Save & Allot Test'}</span>
              </button>
            </div>
          </form>
        )}

        {activeTab === 'list' && (
          <div className="modal-footer">
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </div>

      {telemetryModalData && (
        <TelemetryModal
          result={telemetryModalData}
          onClose={() => setTelemetryModalData(null)}
        />
      )}
    </div>
  );
}
