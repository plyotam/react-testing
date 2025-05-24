import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface SimulationDataPoint {
  time: number;
  velocity: number;
}

interface ChartProps {
  history: SimulationDataPoint[];
}

const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      type: 'linear' as const,
      title: {
        display: true,
        text: 'Time (s)',
      },
      ticks: {
        maxRotation: 0,
        minRotation: 0,
        autoSkip: true,
        maxTicksLimit: 10,
      },
    },
    y: {
        title: {
            display: true,
            text: 'Velocity (m/s)'
        }
    }
  },
  plugins: {
    legend: {
      position: 'top' as const,
      display: false, // Usually legend is not needed for a single dataset chart
    },
    title: {
        display: true,
        text: 'Velocity vs. Time'
    }
  },
  elements: {
    point: {
      radius: 1,
    },
    line: {
      borderWidth: 2,
    }
  }
};

const VelocityTimeChart: React.FC<ChartProps> = ({ history }) => {
  if (!history || history.length === 0) {
    return <div className="p-4 text-center text-text-secondary">No data</div>;
  }

  const labels = history.map(p => p.time.toFixed(2));
  const data = history.map(p => p.velocity);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Velocity (m/s)',
        data,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.1,
      },
    ],
  };

  return <Line options={commonOptions} data={chartData} />;
};

export default VelocityTimeChart; 