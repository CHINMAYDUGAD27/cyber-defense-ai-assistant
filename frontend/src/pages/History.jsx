import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import RiskBadge from '../components/RiskBadge'
import IncidentDetailModal from '../components/IncidentDetailModal'
import { FiEye, FiZap } from 'react-icons/fi'
import { API_BASE } from '../config/api'

function History() {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [searchText, setSearchText] = useState('')
  const [riskFilter, setRiskFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')

  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    axios.get(`${API_BASE}/incidents`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => { setIncidents(res.data); setLoading(false) })
      .catch(() => {
        setError('Could not load incident history. Is the backend running?')
        setLoading(false)
      })
  }, [])

  const downloadReport = async (incidentId) => {
    const token = localStorage.getItem('token')
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
  }

  const closeModal = useCallback(() => setSelectedId(null), [])

  const riskLevels = ['All', 'Low', 'Medium', 'High', 'Critical']
  const attackTypes = ['All', ...new Set(incidents.map(i => i.attack_type).filter(Boolean))]

  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch = searchText.trim() === '' ||
      (inc.reason && inc.reason.toLowerCase().includes(searchText.toLowerCase())) ||
      (inc.attack_type && inc.attack_type.toLowerCase().includes(searchText.toLowerCase()))
    const matchesRisk = riskFilter === 'All' || inc.risk === riskFilter
    const matchesType = typeFilter === 'All' || inc.attack_type === typeFilter
    return matchesSearch && matchesRisk && matchesType
  })

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginTop: 0 }}>Incident history</h1>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>}
      {error && <p style={{ color: 'var(--risk-critical)' }}>{error}</p>}

      {!loading && !error && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search reason or attack type..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '0.5rem 0.8rem',
                color: 'var(--text-primary)',
                outline: 'none',
                minWidth: '240px',
                fontSize: '0.85rem'
              }}
            />
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} style={selectStyle}>
              {riskLevels.map((r) => (
                <option key={r} value={r}>{r === 'All' ? 'All risk levels' : r}</option>
              ))}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle}>
              {attackTypes.map((t) => (
                <option key={t} value={t}>{t === 'All' ? 'All attack types' : t}</option>
              ))}
            </select>
          </div>

          {filteredIncidents.length === 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'var(--bg-panel)', border: '1px dashed var(--border-color)',
              borderRadius: '8px', padding: '4rem 2rem', textAlign: 'center', marginTop: '1rem'
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--bg-main)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem',
                color: 'var(--text-secondary)', fontSize: '1.2rem'
              }}>
                <FiEye />
              </div>
              <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
                {incidents.length === 0 ? 'No incidents yet' : 'No results found'}
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '300px' }}>
                {incidents.length === 0 
                  ? 'Run your first analysis to see threat details and history here.' 
                  : 'Try adjusting your search or filters to find what you are looking for.'}
              </p>
            </div>
          )}

          {filteredIncidents.length > 0 && (
            <div style={{
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Attack type</th>
                    <th style={thStyle}>Risk</th>
                    <th style={thStyle}>Reason</th>
                    <th style={thStyle}>⚡ Action</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIncidents.map((inc) => (
                    <tr 
                      key={inc.id} 
                      className="hover-row"
                      onClick={() => setSelectedId(inc.id)}
                      style={{ 
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer', transition: 'background-color 0.15s'
                      }}
                    >
                      <td style={tdStyle}>#{inc.id}</td>
                      <td style={tdStyle}>{inc.attack_type || 'None'}</td>
                      <td style={tdStyle}><RiskBadge risk={inc.risk} /></td>
                      <td style={{ ...tdStyle, color: 'var(--text-secondary)', maxWidth: '220px' }}>
                        {inc.reason}
                      </td>
                      {/* Phase 2: recommended_action column */}
                      <td style={{ ...tdStyle, maxWidth: '180px' }}>
                        {inc.recommended_action ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                            fontSize: '0.78rem', color: '#D4A72C',
                          }}>
                            <FiZap style={{ flexShrink: 0 }} />
                            {inc.recommended_action}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>—</span>
                        )}
                      </td>
                      <td style={tdStyle}>{new Date(inc.created_at).toLocaleString()}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadReport(inc.id); }}
                          style={{
                            background: 'none',
                            border: '1px solid var(--border-color)',
                            color: 'var(--accent)', borderRadius: '6px',
                            padding: '0.3rem 0.7rem', fontSize: '0.8rem', cursor: 'pointer'
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
          )}
        </>
      )}

      {selectedId !== null && (
        <IncidentDetailModal incidentId={selectedId} onClose={closeModal} />
      )}

      <style>{`
        .hover-row:hover {
          background-color: rgba(255, 255, 255, 0.03);
        }
      `}</style>
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
const tdStyle = { padding: '0.75rem 1rem', fontSize: '0.85rem' }
const selectStyle = {
  backgroundColor: 'var(--bg-panel)',
  border: '1px solid var(--border-color)',
  borderRadius: '6px',
  padding: '0.5rem 0.8rem',
  color: 'var(--text-primary)',
  outline: 'none',
  fontSize: '0.85rem',
  cursor: 'pointer'
}

export default History