import React, { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import AnnotationPlugin from 'chartjs-plugin-annotation';
import { TriggeredEvent } from '../../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler,
  AnnotationPlugin
);

interface ChartDataPoint {
  time: number;
  acceleration: number;
}

interface ChartProps {
  history: ChartDataPoint[];
  currentTime: number;
  triggeredEvents: TriggeredEvent[];
}

const AccelerationTimeChart: React.FC<ChartProps> = ({ history, currentTime, triggeredEvents }) => {
  const chartRef = useRef<ChartJS<"line"> | null>(null);

  const data = {
    labels: history.map(p => p.time.toFixed(2)),
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

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0
    },
    hover: {
      animationDuration: 0
    },
    responsiveAnimationDuration: 0,
    scales: {
      x: {
        type: 'linear' as const,
        position: 'bottom' as const,
        title: {
          display: true,
          text: 'Time (s)',
          color: '#cbd5e1',
          font: { family: "'SF Mono', 'Consolas', 'Liberation Mono', Menlo, Courier, monospace", size: 12 }
        },
        ticks: {
          color: '#94a3b8',
          font: { family: "'SF Mono', 'Consolas', 'Liberation Mono', Menlo, Courier, monospace", size: 10 }
        },
        grid: {
          color: 'rgba(100, 116, 139, 0.2)'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Acceleration (m/s²)',
          color: '#cbd5e1',
          font: { family: "'SF Mono', 'Consolas', 'Liberation Mono', Menlo, Courier, monospace", size: 12 }
        },
        ticks: {
          color: '#94a3b8',
          font: { family: "'SF Mono', 'Consolas', 'Liberation Mono', Menlo, Courier, monospace", size: 10 }
        },
        grid: {
          color: 'rgba(100, 116, 139, 0.2)'
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        titleFont: { family: "'SF Mono', 'Consolas', 'Liberation Mono', Menlo, Courier, monospace" },
        bodyFont: { family: "'SF Mono', 'Consolas', 'Liberation Mono', Menlo, Courier, monospace" },
        borderColor: 'rgba(51, 65, 85, 0.5)',
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            return `Accel: ${context.parsed.y.toFixed(2)} m/s²`;
          }
        }
      },
      annotation: {
        annotations: {
          currentTimeLine: {
            type: 'line' as const,
            xMin: currentTime,
            xMax: currentTime,
            borderColor: 'rgb(239, 68, 68)',
            borderWidth: 2,
            borderDash: [6, 6],
            label: {
              content: 'Current Time',
              enabled: true,
              position: 'start',
              backgroundColor: 'rgba(239, 68, 68, 0.7)',
              color: 'white',
              font: { family: "'SF Mono', 'Consolas', 'Liberation Mono', Menlo, Courier, monospace", size: 10, weight: 'bold' },
              padding: { x: 4, y: 2 },
              cornerRadius: 3,
            }
          },
          ...(triggeredEvents.reduce((acc, event, index) => {
            let borderColor = 'rgb(255, 255, 0)';
            let labelText = event.name;
            if (event.type === 'marker') {
              borderColor = 'rgb(59, 130, 246)';
              labelText = `Marker: ${event.name}`;
            } else if (event.type === 'zoneEnter') {
              borderColor = 'rgb(34, 197, 94)';
              labelText = `Enter: ${event.name}`;
            } else if (event.type === 'zoneExit') {
              borderColor = 'rgb(249, 115, 22)';
              labelText = `Exit: ${event.name}`;
            } else if (event.type === 'zoneActiveStart') {
              borderColor = 'rgb(168, 85, 247)';
              labelText = `Active: ${event.name}`;
            }
            acc[`eventLine${index}`] = {
              type: 'line' as const,
              xMin: event.time,
              xMax: event.time,
              borderColor: borderColor,
              borderWidth: 1,
              label: {
                content: labelText,
                enabled: true,
                position: 'start',
                backgroundColor: 'rgba(0,0,0,0.6)',
                color: 'white',
                font: { family: "'SF Mono', 'Consolas', 'Liberation Mono', Menlo, Courier, monospace", size: 9 },
                padding: { x: 3, y: 1 },
                cornerRadius: 2,
                yAdjust: index * 15, 
              }
            };
            return acc;
          }, {} as any))
        }
      }
    }
  };

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.options.plugins!.annotation!.annotations = {
        currentTimeLine: {
          type: 'line' as const,
          xMin: currentTime,
          xMax: currentTime,
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 2,
          borderDash: [6, 6],
          label: {
            content: 'Current Time',
            enabled: true,
            position: 'start',
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            color: 'white',
            font: { family: "'SF Mono', 'Consolas', 'Liberation Mono', Menlo, Courier, monospace", size: 10, weight: 'bold' },
            padding: { x: 4, y: 2 },
            cornerRadius: 3,
          }
        },
        ...(triggeredEvents.reduce((acc, event, index) => {
          let borderColor = 'rgb(255, 255, 0)';
          let labelText = event.name;
          if (event.type === 'marker') {
            borderColor = 'rgb(59, 130, 246)';
            labelText = `Marker: ${event.name}`;
          } else if (event.type === 'zoneEnter') {
            borderColor = 'rgb(34, 197, 94)';
            labelText = `Enter: ${event.name}`;
          } else if (event.type === 'zoneExit') {
            borderColor = 'rgb(249, 115, 22)';
            labelText = `Exit: ${event.name}`;
          } else if (event.type === 'zoneActiveStart') {
            borderColor = 'rgb(168, 85, 247)';
            labelText = `Active: ${event.name}`;
          }
          acc[`eventLine${index}`] = {
            type: 'line' as const,
            xMin: event.time,
            xMax: event.time,
            borderColor: borderColor,
            borderWidth: 1,
            label: {
              content: labelText,
              enabled: true,
              position: 'start',
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: 'white',
              font: { family: "'SF Mono', 'Consolas', 'Liberation Mono', Menlo, Courier, monospace", size: 9 },
              padding: { x: 3, y: 1 },
              cornerRadius: 2,
              yAdjust: index * 15,
            }
          };
          return acc;
        }, {} as any))
      };
      chartRef.current.update('none');
    }
  }, [currentTime, triggeredEvents]);

  return <Line ref={chartRef} options={options} data={data} />;
};

export default AccelerationTimeChart; 