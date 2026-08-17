import { FiArrowUp, FiArrowDown } from 'react-icons/fi'

function MetricCard({ label, value, color, danger = false, trend = null }) {
  const isDangerCard = danger || label === 'Critical Alerts'
  
  const baseStyle = {
    backgroundColor: isDangerCard ? 'rgba(229, 72, 77, 0.04)' : 'var(--bg-panel)',
    border: `1px solid ${isDangerCard ? 'rgba(229, 72, 77, 0.25)' : 'var(--border-color)'}`,
    borderRadius: '8px',
    padding: '1.25rem',
    flex: 1,
    minWidth: '200px',
  }

  const getTrendColor = () => {
    if (!trend) return 'var(--text-secondary)'
    const isGood = label === 'Detection Rate' ? trend.direction === 'up' : trend.direction === 'down'
    return isGood ? '#3FB950' : 'var(--risk-critical)'
  }

  return (
    <div style={baseStyle}>
      <p style={{ margin: 0, fontSize: '0.875rem', color: isDangerCard ? 'var(--risk-critical)' : 'var(--text-secondary)' }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.5rem' }}>
        <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: color }}>
          {value}
        </p>
        {trend && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '2px',
            color: getTrendColor(), fontSize: '0.8rem', fontWeight: 600,
          }}>
            {trend.direction === 'up' ? <FiArrowUp size={14} /> : <FiArrowDown size={14} />}
            {trend.value}%
          </div>
        )}
      </div>
    </div>
  )
}

export default MetricCard