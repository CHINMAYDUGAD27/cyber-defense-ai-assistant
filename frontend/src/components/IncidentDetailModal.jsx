import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import FollowupChat from './FollowupChat'
import { API_BASE } from '../config/api'
import RiskBadge from './RiskBadge'
import {
  FiX, FiDownload, FiAlertTriangle, FiFileText,
  FiShield, FiCheckCircle, FiZap
} from 'react-icons/fi'

// ─── Indicator extraction (client-side regex) ─────────────────────────────
function extractIndicators(text) {
  if (!text) return { ips: [], urls: [], emails: [] }
  const ipRegex = /\b(\d{1,3}\.){3}\d{1,3}\b/g
  const urlRegex = /https?:\/\/[^\s<>"'\])}]+/gi
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  const unique = (arr) => [...new Set(arr)]
  return {
    ips: unique(text.match(ipRegex) || []),
    urls: unique(text.match(urlRegex) || []),
    emails: unique(text.match(emailRegex) || []),
  }
}

// ─── Phase 3: Highlight trigger phrases in raw text ───────────────────────
function HighlightedText({ text, phrases }) {
  if (!phrases || phrases.length === 0) {
    return <span>{text}</span>
  }

  // Escape special regex chars in phrases
  const escaped = phrases
    .filter(p => p && p.trim())
    .map(p => p.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  
  if (escaped.length === 0) return <span>{text}</span>

  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(pattern)

  return (
    <>
      {parts.map((part, i) => {
        const isMatch = escaped.some(e => new RegExp(`^${e}$`, 'i').test(part))
        return isMatch ? (
          <mark key={i} style={{
            backgroundColor: '#E8590C33',
            color: '#E8590C',
            borderRadius: '3px',
            padding: '0 2px',
            border: '1px solid #E8590C55',
            fontWeight: 600,
          }}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      })}
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────
function Chip({ label, color }) {
  return (
    <span style={{
      display: 'inline-block',
      backgroundColor: color + '18',
      border: `1px solid ${color}55`,
      color: color,
      borderRadius: '4px',
      padding: '0.2rem 0.6rem',
      fontSize: '0.78rem',
      fontFamily: 'monospace',
      wordBreak: 'break-all',
      marginRight: '0.4rem',
      marginBottom: '0.4rem',
    }}>
      {label}
    </span>
  )
}

function SectionLabel({ children }) {
  return (
    <p style={{
      margin: '0 0 0.6rem 0',
      fontSize: '0.72rem',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--text-secondary)',
      fontWeight: 600,
    }}>
      {children}
    </p>
  )
}

function TimelineStep({ icon, label, timestamp, isLast }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          backgroundColor: 'var(--bg-main)',
          border: '1px solid var(--accent)',
          color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.9rem', flexShrink: 0,
        }}>
          {icon}
        </div>
        {!isLast && (
          <div style={{ width: '1px', height: '28px', backgroundColor: 'var(--border-color)', marginTop: '4px' }} />
        )}
      </div>
      <div style={{ paddingTop: '4px' }}>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{label}</p>
        {timestamp && (
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{timestamp}</p>
        )}
      </div>
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────
function IncidentDetailModal({ incidentId, onClose }) {
  const [incident, setIncident] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    const token = localStorage.getItem('token')
    setLoading(true)
    setError(null)
    axios.get(`${API_BASE}/incidents/${incidentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => { setIncident(res.data); setLoading(false) })
      .catch(() => { setError('Could not load incident details.'); setLoading(false) })
  }, [incidentId])

  const downloadReport = useCallback(async () => {
    setDownloading(true)
    const token = localStorage.getItem('token')
    try {
      const res = await axios.get(
        `${API_BASE}/incidents/${incidentId}/report`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      )
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `incident_${incidentId}_report.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch {
      // silent fail
    } finally {
      setDownloading(false)
    }
  }, [incidentId])

  const indicators = incident ? extractIndicators(incident.input_text) : {}
  const hasIndicators = indicators.ips?.length || indicators.urls?.length || indicators.emails?.length
  const timeStr = incident ? new Date(incident.created_at).toLocaleString() : ''
  const triggerPhrases = incident?.trigger_phrases || []
  const hasTriggers = triggerPhrases.filter(p => p && p.trim()).length > 0

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(2px)',
          zIndex: 1000,
          animation: 'fadeIn 0.15s ease',
        }}
      />

      {/* Slide-in panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0,
        width: 'min(660px, 100vw)',
        height: '100vh',
        backgroundColor: 'var(--bg-panel)',
        borderLeft: '1px solid var(--border-color)',
        zIndex: 1001,
        overflowY: 'auto',
        animation: 'slideIn 0.22s cubic-bezier(0.22,1,0.36,1)',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          position: 'sticky', top: 0,
          backgroundColor: 'var(--bg-panel)', zIndex: 2,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FiShield style={{ color: 'var(--accent)', fontSize: '1.1rem' }} />
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              Incident #{incidentId}
            </span>
            {incident && (
              <>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  · {incident.attack_type || 'Unknown'}
                </span>
                <RiskBadge risk={incident.risk} />
              </>
            )}
          </div>
          <button
            onClick={onClose}
            title="Close (Esc)"
            style={{
              background: 'none', border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)', borderRadius: '6px',
              padding: '0.3rem 0.5rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', fontSize: '1rem',
            }}
          >
            <FiX />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', flex: 1 }}>
          {loading && (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '3rem' }}>
              Loading incident…
            </p>
          )}
          {error && (
            <p style={{ color: 'var(--risk-critical)', textAlign: 'center', marginTop: '3rem' }}>{error}</p>
          )}

          {incident && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

              {/* ── Phase 2: Recommended Action Banner ── */}
              {incident.recommended_action && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  backgroundColor: '#D4A72C18',
                  border: '1px solid #D4A72C55',
                  borderRadius: '8px',
                  padding: '0.85rem 1.25rem',
                }}>
                  <FiZap style={{ color: '#D4A72C', fontSize: '1.1rem', flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#D4A72C', fontWeight: 600 }}>
                      Recommended Action
                    </p>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {incident.recommended_action}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Timeline ── */}
              <div>
                <SectionLabel>Detection Timeline</SectionLabel>
                <div style={{
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '1rem 1.25rem',
                }}>
                  <TimelineStep icon={<FiFileText />} label="Input submitted for analysis" timestamp={timeStr} />
                  <TimelineStep icon={<FiAlertTriangle />} label="AI threat analysis completed" timestamp={timeStr} />
                  <TimelineStep icon={<FiCheckCircle />} label="Incident saved to database" timestamp={timeStr} isLast />
                </div>
              </div>

              {/* ── Raw Input (with Phase 3 highlights) ── */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                  <SectionLabel>Raw Input</SectionLabel>
                  {hasTriggers && (
                    <span style={{
                      fontSize: '0.7rem', backgroundColor: '#E8590C22',
                      color: '#E8590C', border: '1px solid #E8590C44',
                      borderRadius: '4px', padding: '0.1rem 0.4rem',
                      marginBottom: '0.6rem',
                    }}>
                      {triggerPhrases.filter(p => p.trim()).length} trigger phrases highlighted
                    </span>
                  )}
                </div>
                <pre style={{
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '1rem 1.25rem',
                  margin: 0,
                  fontSize: '0.8rem',
                  fontFamily: "'Courier New', Consolas, monospace",
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.6,
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}>
                  <HighlightedText
                    text={incident.input_text}
                    phrases={triggerPhrases}
                  />
                </pre>
              </div>

              {/* ── Extracted Indicators ── */}
              <div>
                <SectionLabel>Extracted Indicators</SectionLabel>
                <div style={{
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '1rem 1.25rem',
                }}>
                  {!hasIndicators && (
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      No IP addresses, URLs, or email addresses detected.
                    </p>
                  )}
                  {indicators.ips?.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>IP Addresses</p>
                      {indicators.ips.map((ip) => <Chip key={ip} label={ip} color="#E8590C" />)}
                    </div>
                  )}
                  {indicators.urls?.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>URLs</p>
                      {indicators.urls.map((url) => <Chip key={url} label={url} color="#3B9EFF" />)}
                    </div>
                  )}
                  {indicators.emails?.length > 0 && (
                    <div>
                      <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Email Addresses</p>
                      {indicators.emails.map((email) => <Chip key={email} label={email} color="#D4A72C" />)}
                    </div>
                  )}
                </div>
              </div>

              {/* ── AI Reasoning ── */}
              <div>
                <SectionLabel>AI Reasoning</SectionLabel>
                <div style={{
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '1rem 1.25rem',
                }}>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.7 }}>
                    {incident.reason}
                  </p>
                </div>
              </div>

              {/* ── Recommendations ── */}
              {incident.recommendations?.length > 0 && (
                <div>
                  <SectionLabel>Recommended Actions</SectionLabel>
                  <div style={{
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '1rem 1.25rem',
                  }}>
                    <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
                      {incident.recommendations.map((rec, i) => (
                        <li key={i} style={{
                          fontSize: '0.875rem', color: 'var(--text-primary)',
                          lineHeight: 1.6, marginBottom: i < incident.recommendations.length - 1 ? '0.5rem' : 0,
                        }}>
                          {rec}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {incident && !loading && (
          <div style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color)',
            position: 'sticky', bottom: 0,
            backgroundColor: 'var(--bg-panel)',
            display: 'flex', justifyContent: 'flex-end',
          }}>
            <button
              onClick={downloadReport}
              disabled={downloading}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                backgroundColor: 'var(--accent)',
                border: 'none', borderRadius: '7px',
                color: '#fff', padding: '0.55rem 1.1rem',
                fontSize: '0.85rem', cursor: downloading ? 'not-allowed' : 'pointer',
                opacity: downloading ? 0.7 : 1,
                fontWeight: 500,
              }}
            >
              <FiDownload />
              {downloading ? 'Generating…' : 'Download PDF Report'}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>
    </>
  )
}

export default IncidentDetailModal
