import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'

ChartJS.register(ArcElement, Tooltip)

const COLOR_MAP = {
  'Phishing': '#3B9EFF',
  'Brute Force': '#E8590C',
  'Malware Indicator': '#E5484D',
  'Suspicious Network Activity': '#D4A72C',
  'Other': '#6B7280' // Gray for other grouped types
}

const DEFAULT_COLOR = '#8B94A3'

function ThreatBreakdownChart({ breakdown }) {
  const entries = breakdown ? Object.entries(breakdown) : []
  let groupedEntries = []
  
  if (entries.length > 0) {
    // Sort descending by count
    entries.sort((a, b) => b[1] - a[1])
    
    if (entries.length > 4) {
      // Top 4 stay as is, rest go to "Other"
      const top4 = entries.slice(0, 4)
      const others = entries.slice(4)
      const otherCount = others.reduce((sum, [, count]) => sum + count, 0)
      groupedEntries = [...top4, ['Other', otherCount]]
    } else {
      groupedEntries = [...entries]
    }
  }

  const hasData = groupedEntries.length > 0
  const total = hasData ? groupedEntries.reduce((sum, [, count]) => sum + count, 0) : 0

  const labels = hasData ? groupedEntries.map(([label]) => label) : ['No data yet']
  const values = hasData ? groupedEntries.map(([, count]) => count) : [1]
  const bgColors = hasData
    ? groupedEntries.map(([label]) => COLOR_MAP[label] || DEFAULT_COLOR)
    : ['#232A36']

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: bgColors,
        borderColor: '#141922',
        borderWidth: 2
      }
    ]
  }

  const options = {
    responsive: true,
    cutout: '70%',
    plugins: {
      legend: {
        display: false // Phase 1: Disable default chart.js legend
      }
    }
  }

  return (
    <div style={{
      backgroundColor: 'var(--bg-panel)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '1.2rem',
      flex: 1,
      minWidth: '320px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 0, marginBottom: '1.2rem' }}>
        Threat type breakdown
      </p>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
        {/* Doughnut Chart */}
        <div style={{ width: '140px', height: '140px', flexShrink: 0, margin: '0 auto' }}>
          <Doughnut data={data} options={options} />
        </div>

        {/* Custom Ranked Legend (Phase 1) */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          {!hasData && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No data available.</p>
          )}
          {hasData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {groupedEntries.map(([label, count]) => {
                const color = COLOR_MAP[label] || DEFAULT_COLOR
                const pct = ((count / total) * 100).toFixed(1)
                
                return (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
                        {label}
                      </span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{count}</span>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--bg-main)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '2px' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ThreatBreakdownChart