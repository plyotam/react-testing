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
  x: number;
  y: number;
  velocity: number;
  acceleration: number;
  heading: number;
}

interface SimulationGraphsProps {
  history: SimulationDataPoint[];
  onClose: () => void;
}

const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      type: 'linear' as const, // Treat as a linear scale for time
      title: {
        display: true,
        text: 'Time (s)',
      },
      ticks: {
        maxRotation: 0,
        minRotation: 0,
        autoSkip: true,
        maxTicksLimit: 10, // Adjust for desired density
      },
    },
  },
  plugins: {
    legend: {
      position: 'top' as const,
    },
  },
  elements: {
    point: {
      radius: 1, // Smaller points for dense data
    },
    line: {
      borderWidth: 2, // Thicker lines
    }
  }
};

const SimulationGraphs: React.FC<SimulationGraphsProps> = ({ history, onClose }) => {
  if (!history || history.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-background-secondary p-6 rounded-lg shadow-2xl text-text-primary">
          <p>No simulation data available yet. Run a simulation first.</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-accent-primary text-white rounded hover:bg-accent-secondary">
            Close
          </button>
        </div>
      </div>
    );
  }

  const labels = history.map(p => p.time.toFixed(2));

  const velocityData = {
    labels,
    datasets: [
      {
        label: 'Velocity (m/s)',
        data: history.map(p => p.velocity),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.1,
      },
    ],
  };

  const accelerationData = {
    labels,
    datasets: [
      {
        label: 'Acceleration (m/s²)',
        data: history.map(p => p.acceleration),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        tension: 0.1,
      },
    ],
  };

  const headingData = {
    labels,
    datasets: [
      {
        label: 'Heading (°)',
        data: history.map(p => p.heading),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        tension: 0.1,
      },
    ],
  };

  const positionData = {
    labels,
    datasets: [
      {
        label: 'Position X (m)',
        data: history.map(p => p.x),
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: 'rgba(255, 159, 64, 0.5)',
        tension: 0.1,
        yAxisID: 'y-axis-x',
      },
      {
        label: 'Position Y (m)',
        data: history.map(p => p.y),
        borderColor: 'rgb(153, 102, 255)',
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
        tension: 0.1,
        yAxisID: 'y-axis-y',
      },
    ],
  };
  
  const positionOptions = {
    ...commonOptions,
    plugins: {
        ...commonOptions.plugins,
        title: { display: true, text: 'Robot Position vs. Time' }
    },
    scales: {
        ...commonOptions.scales,
        'y-axis-x': {
            type: 'linear' as const,
            display: true,
            position: 'left' as const,
            title: { display: true, text: 'X (m)' }
        },
        'y-axis-y': {
            type: 'linear' as const,
            display: true,
            position: 'right' as const,
            title: { display: true, text: 'Y (m)' },
            grid: { drawOnChartArea: false } // only one grid for Y
        }
    }
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-hidden">
      <div className="bg-background-secondary w-full h-full max-w-6xl max-h-[90vh] p-6 rounded-xl shadow-2xl text-text-primary flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-accent text-accent-primary">Simulation Graphs</h2>
          <button 
            onClick={onClose} 
            className="p-2 rounded-md hover:bg-background-tertiary text-text-secondary hover:text-accent-primary transform hover:scale-110"
            title="Close Graphs"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-grow overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 pr-2">
          <div className="bg-background-tertiary/70 p-4 rounded-lg shadow-lg min-h-[300px]">
            <h3 className="text-lg font-semibold mb-2 text-center">Velocity vs. Time</h3>
            <div className="relative h-[250px] sm:h-[300px]">
              <Line options={{...commonOptions, plugins: {...commonOptions.plugins, title: {display: true, text: 'Velocity (m/s)'}}}} data={velocityData} />
            </div>
          </div>
          <div className="bg-background-tertiary/70 p-4 rounded-lg shadow-lg min-h-[300px]">
            <h3 className="text-lg font-semibold mb-2 text-center">Acceleration vs. Time</h3>
            <div className="relative h-[250px] sm:h-[300px]">
              <Line options={{...commonOptions, plugins: {...commonOptions.plugins, title: {display: true, text: 'Acceleration (m/s²)'}}}} data={accelerationData} />
            </div>
          </div>
          <div className="bg-background-tertiary/70 p-4 rounded-lg shadow-lg min-h-[300px]">
            <h3 className="text-lg font-semibold mb-2 text-center">Heading vs. Time</h3>
            <div className="relative h-[250px] sm:h-[300px]">
              <Line options={{...commonOptions, plugins: {...commonOptions.plugins, title: {display: true, text: 'Heading (°)'}}}} data={headingData} />
            </div>
          </div>
          <div className="bg-background-tertiary/70 p-4 rounded-lg shadow-lg min-h-[300px]">
            <h3 className="text-lg font-semibold mb-2 text-center">Position vs. Time</h3>
            <div className="relative h-[250px] sm:h-[300px]">
                <Line options={positionOptions} data={positionData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationGraphs; 