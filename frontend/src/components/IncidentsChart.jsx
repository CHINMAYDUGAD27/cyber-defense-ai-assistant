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

function IncidentsChart({ weeklyData }) {
  const values = weeklyData && weeklyData.length === 7 ? weeklyData : [0, 0, 0, 0, 0, 0, 0]

  const data = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Incidents',
        data: values,
        borderColor: '#3B9EFF',
        backgroundColor: 'rgba(59, 158, 255, 0.15)',
        fill: true,
        tension: 0.35,
        pointRadius: 3
      }
    ]
  }

  const options = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#8B94A3' }, grid: { color: '#232A36' } },
      y: { ticks: { color: '#8B94A3' }, grid: { color: '#232A36' }, beginAtZero: true }
    }
  }

  return (
    <div style={{
      backgroundColor: 'var(--bg-panel)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '1.2rem',
      flex: 2,
      minWidth: '400px'
    }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 0 }}>
        Incidents this week
      </p>
      <Line data={data} options={options} />
    </div>
  )
}

export default IncidentsChart