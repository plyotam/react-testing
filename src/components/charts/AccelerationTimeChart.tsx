import React, { useMemo } from 'react';
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
  acceleration: number;
}

interface ChartProps {
  history: SimulationDataPoint[];
  currentTime: number;
}

const commonOptionsBase = {
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
            text: 'Acceleration (m/s²)'
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
        text: 'Acceleration vs. Time'
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

const AccelerationTimeChart: React.FC<ChartProps> = ({ history, currentTime }) => {
  const customTimeIndicatorPlugin = useMemo(() => ({
    id: 'customTimeIndicator',
    afterDraw: (chart: any) => {
      const currentPluginTime = chart.options.plugins.customTimeIndicator?.currentTime;
      if (typeof currentPluginTime !== 'number' || chart.tooltip?.getActiveElements()?.length) return;

      const ctx = chart.ctx;
      const xAxis = chart.scales.x;
      const yAxis = chart.scales.y;

      if (!xAxis || !yAxis) return;

      const xPos = xAxis.getPixelForValue(currentPluginTime);

      if (xPos >= xAxis.left && xPos <= xAxis.right) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(xPos, yAxis.top);
        ctx.lineTo(xPos, yAxis.bottom);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(220, 53, 69, 0.7)'; // A distinct red color
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();
      }
    }
  }), []);

  const chartOptions = useMemo(() => ({
    ...commonOptionsBase,
    plugins: {
      ...commonOptionsBase.plugins,
      customTimeIndicator: {
        currentTime: currentTime
      }
    }
  }), [currentTime]);

  if (!history || history.length === 0) {
    return <div className="p-4 text-center text-text-secondary">No data</div>;
  }

  const labels = history.map(p => p.time.toFixed(2));
  const data = history.map(p => p.acceleration);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Acceleration (m/s²)',
        data,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        tension: 0.1,
      },
    ],
  };

  return <Line options={chartOptions} data={chartData} plugins={[customTimeIndicatorPlugin]}/>;
};

export default AccelerationTimeChart; 