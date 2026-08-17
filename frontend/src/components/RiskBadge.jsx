function RiskBadge({ risk }) {
  const colors = {
    Low: 'var(--risk-low)',
    Medium: 'var(--risk-medium)',
    High: 'var(--risk-high)',
    Critical: 'var(--risk-critical)'
  }
  const color = colors[risk] || 'var(--text-secondary)'

  return (
    <span style={{
      display: 'inline-block',
      padding: '0.25rem 0.75rem',
      borderRadius: '999px',
      fontSize: '0.8rem',
      fontWeight: 'bold',
      color: color,
      backgroundColor: `${color}22`,
      border: `1px solid ${color}`
    }}>
      {risk}
    </span>
  )
}

export default RiskBadge