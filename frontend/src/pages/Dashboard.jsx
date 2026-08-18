import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { API_BASE } from '../config/api'
import MetricCard from '../components/MetricCard'
import IncidentsChart from '../components/IncidentsChart'
import ThreatBreakdownChart from '../components/ThreatBreakdownChart'
import TrendChart from '../components/TrendChart'
import { FiDownload, FiCalendar, FiRefreshCw, FiActivity } from 'react-icons/fi'
import { MdRadar } from 'react-icons/md'
import { Link } from 'react-router-dom'

function Dashboard() {
  const [stats, setStats] = useState(null)
  const [trends, setTrends] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [error, setError] = useState(null)
  const [watcherRunning, setWatcherRunning] = useState(false)

  // Date range — used for BOTH report download and data filtering
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [summaryLoading, setSummaryLoading] = useState(false)

  const [incidentsData, setIncidentsData] = useState([])

  const fetchDashboard = useCallback((from, to, isInitial = false) => {
    const token = localStorage.getItem('token')
    const headers = { Authorization: `Bearer ${token}` }

    if (isInitial) setLoading(true)
    else setChartLoading(true)
    setError(null)

    const params = `?from_date=${from}&to_date=${to}`

    Promise.all([
      axios.get(`${API_BASE}/dashboard/stats${params}`, { headers }),
      axios.get(`${API_BASE}/dashboard/trends${params}`, { headers }),
      axios.get(`${API_BASE}/incidents`, { headers })
    ])
      .then(([statsRes, trendsRes, incRes]) => {
        setStats(statsRes.data)
        setTrends(trendsRes.data)
        setIncidentsData(incRes.data)
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          setError('Your session has expired. Redirecting to sign in…')
          return
        }

        const detail = err.response?.data?.detail
        setError(detail ? `Could not load dashboard: ${detail}` : 'Could not load dashboard. Please try again.')
      })
      .finally(() => {
        setLoading(false)
        setChartLoading(false)
      })
  }, [])

  // Initial load
  useEffect(() => {
    fetchDashboard(fromDate, toDate, true)
  }, []) // eslint-disable-line

  // Poll watcher status every 10s
  useEffect(() => {
    const token = localStorage.getItem('token')
    const check = () =>
      axios.get(`${API_BASE}/watcher/status`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => setWatcherRunning(r.data.running))
        .catch(() => {})
    check()
    const id = setInterval(check, 10000)
    return () => clearInterval(id)
  }, [])

  // Re-fetch whenever either date changes (debounced 400ms to avoid rapid fire)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (stats !== null) {
        fetchDashboard(fromDate, toDate, false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [fromDate, toDate]) // eslint-disable-line

  const downloadSummary = async () => {
    setSummaryLoading(true)
    const token = localStorage.getItem('token')
    try {
      const res = await axios.get(
        `${API_BASE}/reports/summary?from_date=${fromDate}&to_date=${toDate}`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      )
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `summary_${fromDate}_to_${toDate}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch {
      // silent
    } finally {
      setSummaryLoading(false)
    }
  }

  // Compute week-over-week trend for metric cards
  const computeTrend = (allIncidents, metricType) => {
    if (!allIncidents || allIncidents.length === 0) return null
    const now = new Date()
    const last7Days = []
    const prior7Days = []
    allIncidents.forEach(inc => {
      const d = new Date(inc.created_at)
      const diffDays = Math.ceil(Math.abs(now - d) / (1000 * 60 * 60 * 24))
      if (diffDays <= 7) last7Days.push(inc)
      else if (diffDays <= 14) prior7Days.push(inc)
    })
    const getVal = (list, type) => {
      if (type === 'total') return list.length
      if (type === 'critical') return list.filter(i => i.risk === 'Critical').length
      if (type === 'detection') {
        const detected = list.filter(i => i.attack_type).length
        return list.length ? (detected / list.length) * 100 : 0
      }
      return 0
    }
    const currentVal = getVal(last7Days, metricType)
    const priorVal = getVal(prior7Days, metricType)
    if (priorVal === 0) return null
    const delta = ((currentVal - priorVal) / priorVal) * 100
    if (delta === 0) return null
    return { value: Math.abs(Math.round(delta)), direction: delta > 0 ? 'up' : 'down' }
  }

  const fadedStyle = { opacity: chartLoading ? 0.45 : 1, transition: 'opacity 0.25s' }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          {chartLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              <FiRefreshCw style={{ animation: 'spin 1s linear infinite' }} size={13} />
              Updating…
            </div>
          )}
        </div>

        {/* Date range picker + Summary Report */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <FiCalendar style={{ color: 'var(--text-secondary)' }} />
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            style={dateInputStyle}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>to</span>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            style={dateInputStyle}
          />
          <button
            onClick={downloadSummary}
            disabled={summaryLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              backgroundColor: 'var(--accent)',
              border: 'none', borderRadius: '7px',
              color: '#fff', padding: '0.5rem 1rem',
              fontSize: '0.82rem', fontWeight: 500,
              cursor: summaryLoading ? 'not-allowed' : 'pointer',
              opacity: summaryLoading ? 0.7 : 1,
            }}
          >
            <FiDownload />
            {summaryLoading ? 'Generating…' : 'Summary Report'}
          </button>
        </div>
      </div>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>}
      {error && <p style={{ color: 'var(--risk-critical)' }}>{error}</p>}

      {stats && (
        <>
          {/* Metric cards + Watcher status */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', ...fadedStyle }}>
            <MetricCard
              label="Total Incidents"
              value={stats.total_incidents}
              color="var(--accent)"
              trend={computeTrend(incidentsData, 'total')}
            />
            <MetricCard
              label="Critical Alerts"
              value={stats.critical_alerts}
              color="var(--risk-critical)"
              danger={true}
              trend={computeTrend(incidentsData, 'critical')}
            />
            <MetricCard
              label="Detection Rate"
              value={`${stats.detection_rate}%`}
              color="var(--risk-low)"
              trend={computeTrend(incidentsData, 'detection')}
            />
            {/* Watcher status widget */}
            <Link to="/live-monitor" style={{ textDecoration: 'none', flex: '1 1 140px' }}>
              <div style={{
                backgroundColor: 'var(--bg-panel)',
                border: `1px solid ${watcherRunning ? '#22c55e44' : 'var(--border-color)'}`,
                borderRadius: '10px',
                padding: '1rem 1.25rem',
                display: 'flex', flexDirection: 'column', gap: '0.35rem',
                height: '100%', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MdRadar style={{ fontSize: '1.1rem', color: watcherRunning ? '#22c55e' : 'var(--text-secondary)' }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Live Monitor
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    backgroundColor: watcherRunning ? '#22c55e' : '#6b7280',
                    animation: watcherRunning ? 'dash-pulse 1.4s ease-out infinite' : 'none',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: '1.15rem', fontWeight: 700, color: watcherRunning ? '#22c55e' : 'var(--text-secondary)' }}>
                    {watcherRunning ? 'WATCHING' : 'IDLE'}
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--accent)' }}>Open Live Monitor →</span>
              </div>
            </Link>
          </div>

          {/* Weekly chart + Threat breakdown */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', ...fadedStyle }}>
            <IncidentsChart weeklyData={stats.weekly_incidents} />
            <ThreatBreakdownChart breakdown={stats.threat_breakdown} />
          </div>

          {/* Phase 4: Trend charts */}
          {trends && (
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', ...fadedStyle }}>
              <TrendChart
                labels={trends.labels}
                dailyCounts={trends.daily_counts}
                avgRiskScores={trends.avg_risk_scores}
              />
            </div>
          )}
          
          {/* Cybersecurity Awareness Video */}
          <div style={{ marginTop: '2rem', ...fadedStyle }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>Cybersecurity Awareness</h2>
            <div style={{ 
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '1rem',
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <video 
                controls 
                style={{ width: '100%', borderRadius: '6px', maxHeight: '500px', backgroundColor: '#000' }}
              >
                <source src="/generate_the_video.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </>
      )}

      {/* spin keyframe for the refresh icon */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const dateInputStyle = {
  backgroundColor: 'var(--bg-panel)',
  border: '1px solid var(--border-color)',
  borderRadius: '6px',
  padding: '0.4rem 0.7rem',
  color: 'var(--text-primary)',
  fontSize: '0.82rem',
  outline: 'none',
  colorScheme: 'dark',
}

export default Dashboard
