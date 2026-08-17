import { useState, useRef } from 'react'
import axios from 'axios'
import RiskBadge from '../components/RiskBadge'
import FollowupChat from '../components/FollowupChat'
import { FiAlertTriangle, FiUpload, FiTrash2, FiPlay } from 'react-icons/fi'
import { MdSecurity } from 'react-icons/md'
import { API_BASE } from '../config/api'

function Analyze() {
  const [logText, setLogText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [file, setFile] = useState(null)
  const [bulkResult, setBulkResult] = useState(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkError, setBulkError] = useState(null)

  // ============================
  // Speech Recognition States
  // ============================
  const [listening, setListening] = useState(false)
  const [language, setLanguage] = useState("en-IN")
  const recognitionRef = useRef(null)

  // ============================
  // Start Voice Recognition
  // ============================
  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert("Speech Recognition is not supported in this browser.")
      return
    }

    const recognition = new SpeechRecognition()

    recognition.lang = language
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => {
      setListening(true)
    }

    recognition.onresult = (event) => {
      let transcript = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }

      setLogText(transcript)
    }

    recognition.onerror = (event) => {
      console.log(event.error)
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  // ============================
  // Stop Voice Recognition
  // ============================
  const stopListening = () => {
    recognitionRef.current?.stop()
  }

  // ============================
  // Analyze Single Log
  // ============================
  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const token = localStorage.getItem('token')

      const response = await axios.post(
        `${API_BASE}/analyze`,
        { log_text: logText },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      setResult(response.data)
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Could not reach the backend. Is uvicorn running?'
      )
    }

    setLoading(false)
  }

  // ============================
  // Download PDF
  // ============================
  const handleDownload = async (incidentId) => {
    const token = localStorage.getItem('token')

    const res = await axios.get(
      `${API_BASE}/incidents/${incidentId}/report`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        responseType: 'blob'
      }
    )

    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')

    link.href = url
    link.setAttribute(
      'download',
      `incident_${incidentId}_report.pdf`
    )

    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  // ============================
  // Bulk File Upload
  // ============================
  const handleFileChange = (e) => {
    setFile(e.target.files[0])
    setBulkResult(null)
    setBulkError(null)
  }

  const handleBulkAnalyze = async () => {
    if (!file) return

    setBulkLoading(true)
    setBulkError(null)
    setBulkResult(null)

    try {
      const token = localStorage.getItem('token')

      const formData = new FormData()
      formData.append('file', file)

      const response = await axios.post(
        `${API_BASE}/analyze/bulk`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      )

      setBulkResult(response.data)

    } catch (err) {
      setBulkError(
        err.response?.data?.detail ||
        'Bulk analysis failed. Is the backend running?'
      )
    }

    setBulkLoading(false)
  }

  return (
    <div style={{ padding: '2rem', display: 'flex', gap: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Left Column: Main Analysis */}
      <div style={{ flex: 1, maxWidth: '800px' }}>
        <h1 style={{ marginTop: 0 }}>Analyze</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Paste a security log, email, or activity description below.
        </p>

  {/* Language Selection */}
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '12px'
    }}
  >
    <label style={{ color: 'var(--text-secondary)' }}>
      Language
    </label>

    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value)}
      style={{
        padding: '8px',
        borderRadius: '6px',
        background: 'var(--bg-panel)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-color)'
      }}
    >
      <option value="en-IN">English</option>
      <option value="hi-IN">Hindi</option>
    </select>
  </div>

  {/* Text Area + Microphone */}
  <div style={{ position: 'relative' }}>
    <textarea
      value={logText}
      onChange={(e) => setLogText(e.target.value)}
      placeholder="Speak or type a security log..."
      style={{
        width: '100%',
        height: '170px',
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        color: 'var(--text-primary)',
        padding: '1rem',
        paddingRight: '70px',
        fontFamily: 'monospace',
        fontSize: '0.9rem',
        resize: 'vertical',
        outline: 'none',
        boxSizing: 'border-box'
      }}
    />

    <button
      onClick={listening ? stopListening : startListening}
      title={listening ? "Stop Recording" : "Start Recording"}
      style={{
        position: 'absolute', right: '15px', bottom: '15px',
        width: '45px', height: '45px', borderRadius: '50%', border: 'none',
        background: listening ? '#dc2626' : '#2563eb', color: '#fff',
        cursor: 'pointer', fontSize: '20px', transition: '0.3s',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
    >
      {listening && (
        <div style={{
          position: 'absolute', top: '4px', right: '4px',
          width: '8px', height: '8px', backgroundColor: '#fff', borderRadius: '50%',
          animation: 'pulse 1s infinite'
        }} />
      )}
      {listening ? '⏹️' : '🎤'}
    </button>
  </div>

  {listening && (
    <p
      style={{
        color: '#22c55e',
        marginTop: '10px',
        fontWeight: 'bold'
      }}
    >
      🎤 Listening...
    </p>
  )}

  <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
    <button
      onClick={handleAnalyze}
      disabled={loading || !logText.trim()}
      style={{
        backgroundColor: 'var(--accent)', color: '#fff', border: 'none',
        borderRadius: '6px', padding: '0.6rem 1.4rem', fontWeight: 'bold',
        cursor: 'pointer', opacity: loading || !logText.trim() ? 0.7 : 1,
        display: 'flex', alignItems: 'center', gap: '0.5rem'
      }}
    >
      {loading ? 'Analyzing...' : 'Analyze'}
    </button>
    {loading && (
      <div style={{
        width: '20px', height: '20px', border: '3px solid var(--border-color)',
        borderTopColor: 'var(--accent)', borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
    )}
  </div>

  {error && (
    <p
      style={{
        color: 'var(--risk-critical)',
        marginTop: '1rem'
      }}
    >
      {error}
    </p>
  )}

  {result && (
    <div
      style={{
        marginTop: '1.5rem',
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '1.5rem'
      }}
    >
      {result.detected ? (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.75rem'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <h2 style={{ margin: 0 }}>
                {result.attack_type}
              </h2>

              <RiskBadge risk={result.risk} />
            </div>

            <button
              onClick={() => handleDownload(result.id)}
              style={{
                background: 'none',
                border: '1px solid var(--border-color)',
                color: 'var(--accent)',
                borderRadius: '6px',
                padding: '0.4rem 0.9rem',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Download PDF
            </button>
          </div>

          <p style={{ color: 'var(--text-secondary)' }}>
            {result.reason}
          </p>

          <h3 style={{ marginBottom: '0.5rem' }}>
            Recommended actions
          </h3>

          <ul
            style={{
              color: 'var(--text-primary)',
              lineHeight: '1.8'
            }}
          >
            {result.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>

          <FollowupChat incidentId={result.id} />
        </>
      ) : (
        <p>
          No threat detected. {result.reason}
        </p>
      )}
    </div>
  )}

  <hr
    style={{
      border: 'none',
      borderTop: '1px solid var(--border-color)',
      margin: '2.5rem 0'
    }}
  />

  <h2 style={{ marginTop: 0 }}>
    Bulk upload
  </h2>

  <p style={{ color: 'var(--text-secondary)' }}>
    Upload a .txt, .log, or .csv file — each non-empty line is analyzed separately (max 50 lines).
  </p>

  <div
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginTop: '1rem'
  }}
>
  <input
    type="file"
    accept=".txt,.log,.csv"
    onChange={handleFileChange}
    style={{
      color: 'var(--text-secondary)',
      fontSize: '0.85rem'
    }}
  />

  <button
    onClick={handleBulkAnalyze}
    disabled={!file || bulkLoading}
    style={{
      backgroundColor: 'var(--accent)',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      padding: '0.5rem 1.2rem',
      fontWeight: 'bold',
      cursor: 'pointer',
      fontSize: '0.85rem'
    }}
  >
    {bulkLoading ? 'Processing...' : 'Analyze file'}
  </button>
</div>

{bulkError && (
  <p
    style={{
      color: 'var(--risk-critical)',
      marginTop: '1rem'
    }}
  >
    {bulkError}
  </p>
)}

{bulkResult && (
  <div style={{ marginTop: '1.5rem' }}>
    <div
      style={{
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        marginBottom: '1.25rem'
      }}
    >
      <SummaryPill
        label="Processed"
        value={bulkResult.summary.total_processed}
        color="var(--accent)"
      />

      <SummaryPill
        label="Threats detected"
        value={bulkResult.summary.threats_detected}
        color="var(--risk-medium)"
      />

      <SummaryPill
        label="High risk"
        value={bulkResult.summary.high}
        color="var(--risk-high)"
      />

      <SummaryPill
        label="Critical"
        value={bulkResult.summary.critical}
        color="var(--risk-critical)"
      />
    </div>

    <div
      style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        overflow: 'hidden'
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse'
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: '1px solid var(--border-color)'
            }}
          >
            <th style={thStyle}>Line</th>
            <th style={thStyle}>Attack type</th>
            <th style={thStyle}>Risk</th>
            <th style={thStyle}>Report</th>
          </tr>
        </thead>

        <tbody>
          {bulkResult.results.map((r) => (
            <tr
              key={r.id}
              style={{
                borderBottom:
                  '1px solid var(--border-color)'
              }}
            >
              <td
                style={{
                  ...tdStyle,
                  maxWidth: '400px',
                  color: 'var(--text-secondary)'
                }}
              >
                {r.input_text.length > 80
                  ? r.input_text.slice(0, 80) + '...'
                  : r.input_text}
              </td>

              <td style={tdStyle}>
                {r.attack_type || 'None'}
              </td>

              <td style={tdStyle}>
                <RiskBadge risk={r.risk} />
              </td>

              <td style={tdStyle}>
                <button
                  onClick={() => handleDownload(r.id)}
                  style={{
                    background: 'none',
                    border:
                      '1px solid var(--border-color)',
                    color: 'var(--accent)',
                    borderRadius: '6px',
                    padding: '0.3rem 0.7rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Download
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}

      </div>
      {/* end left column */}

      {/* Right Column: Tips (Phase 3) */}
      <div style={{ width: '300px', flexShrink: 0 }}>
        <div style={{
          backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)',
          borderRadius: '8px', padding: '1.25rem', position: 'sticky', top: '80px'
        }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem' }}>💡 Analysis Tips</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <p style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>Be specific</p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Include raw headers, IP addresses, or the exact payload text rather than summarizing.
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>Bulk Upload</p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Use CSV or TXT files for bulk processing. Each non-empty line is parsed independently.
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>Microphone</p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                You can dictate incident descriptions quickly on the go.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(255, 255, 255, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); } }
      `}</style>
    </div>
  )
}

function SummaryPill({ label, value, color }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderLeft: `4px solid ${color}`,
        borderRadius: '8px',
        padding: '0.75rem 1.1rem',
        minWidth: '130px'
      }}
    >
      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: '0.75rem',
          margin: 0
        }}
      >
        {label}
      </p>

      <p
        style={{
          fontSize: '1.3rem',
          fontWeight: 'bold',
          margin: '0.2rem 0 0'
        }}
      >
        {value}
      </p>
    </div>
  )
}

const thStyle = {
  textAlign: 'left',
  padding: '0.75rem 1rem',
  fontSize: '0.8rem',
  color: 'var(--text-secondary)',
  fontWeight: 'normal'
}

const tdStyle = {
  padding: '0.75rem 1rem',
  fontSize: '0.85rem'
}

export default Analyze
