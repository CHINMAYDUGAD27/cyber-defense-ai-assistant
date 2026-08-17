import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

function TrendChart({ labels, dailyCounts, avgRiskScores }) {
  const shortLabels = labels.map(d => {
    const parts = d.split('-')
    return `${parts[1]}/${parts[2]}`
  })

  const countData = {
    labels: shortLabels,
    datasets: [{
      label: 'Incidents',
      data: dailyCounts,
      borderColor: '#3B9EFF',
      backgroundColor: 'rgba(59,158,255,0.12)',
      fill: true,
      tension: 0.4,
      pointRadius: 2,
    }]
  }

  const riskData = {
    labels: shortLabels,
    datasets: [{
      label: 'Avg Risk Score',
      data: avgRiskScores,
      borderColor: '#E8590C',
      backgroundColor: 'rgba(232,89,12,0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 2,
    }]
  }

  const baseOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: { color: '#8B94A3', maxTicksLimit: 8, font: { size: 10 } },
        grid: { color: '#232A36' }
      },
      y: {
        ticks: { color: '#8B94A3', font: { size: 10 } },
        grid: { color: '#232A36' },
        beginAtZero: true
      }
    }
  }

  const riskOptions = {
    ...baseOptions,
    scales: {
      ...baseOptions.scales,
      y: {
        ...baseOptions.scales.y,
        max: 4,
        ticks: {
          color: '#8B94A3', font: { size: 10 },
          callback: (v) => ['', 'Low', 'Med', 'High', 'Crit'][v] || v
        }
      }
    }
  }

  const panelStyle = {
    backgroundColor: 'var(--bg-panel)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '1.2rem',
    flex: 1,
    minWidth: '300px',
  }

  return (
    <>
      <div style={panelStyle}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 0, marginBottom: '0.75rem' }}>
          Incidents — last 30 days
        </p>
        <Line data={countData} options={baseOptions} />
      </div>
      <div style={panelStyle}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 0, marginBottom: '0.75rem' }}>
          Avg risk score — last 30 days
        </p>
        <Line data={riskData} options={riskOptions} />
      </div>
    </>
  )
}

export default TrendChart
