// src/components/ChartsPanel.jsx
import React from "react";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
  Filler
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
  Filler
);

export default function ChartsPanel({ analytics = {} }) {
  const {
    totalStarted = 0,
    totalCompleted = 0,
    timeSeries = [],
    genders = {},
    riskCounts = {},
  } = analytics || {};

  // Chart configuration defaults
  const defaults = {
    color: '#94a3b8',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    font: { family: 'Inter', size: 11 }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: defaults.color,
          font: defaults.font,
          boxWidth: 12,
          padding: 20,
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#fff',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: defaults.color }
      },
      y: {
        grid: { color: defaults.borderColor },
        ticks: { color: defaults.color }
      }
    }
  };

  const barData = {
    labels: ["Started", "Completed"],
    datasets: [{
      label: "Users",
      data: [totalStarted, totalCompleted],
      backgroundColor: ["rgba(6, 182, 212, 0.6)", "rgba(139, 92, 246, 0.6)"],
      borderColor: ["#06b6d4", "#8b5cf6"],
      borderWidth: 1,
      borderRadius: 8
    }]
  };

  const tsLabels = timeSeries.map((t) => t.day);
  const tsData = timeSeries.map((t) => t.count);
  const tsLine = {
    labels: tsLabels,
    datasets: [{
      label: "Trend",
      data: tsData,
      fill: true,
      tension: 0.4,
      borderColor: "#f43f5e",
      backgroundColor: "rgba(244, 63, 94, 0.1)",
      pointBackgroundColor: "#f43f5e",
      borderWidth: 2,
    }]
  };

  const genderPie = {
    labels: Object.keys(genders),
    datasets: [{
      data: Object.values(genders),
      backgroundColor: [
        "rgba(244, 63, 94, 0.7)",
        "rgba(139, 92, 246, 0.7)",
        "rgba(6, 182, 212, 0.7)",
        "rgba(245, 158, 11, 0.7)"
      ],
      borderWidth: 0
    }]
  };

  const riskDoughnut = {
    labels: Object.keys(riskCounts),
    datasets: [{
      data: Object.values(riskCounts),
      backgroundColor: [
        "rgba(16, 185, 129, 0.7)",
        "rgba(245, 158, 11, 0.7)",
        "rgba(244, 63, 94, 0.7)",
        "rgba(139, 92, 246, 0.7)"
      ],
      borderWidth: 0,
      hoverOffset: 15
    }]
  };

  const circularOptions = {
    ...chartOptions,
    scales: {
      x: { display: false },
      y: { display: false }
    }
  };


  return (
    <div className="charts-grid">
      <div className="glass-panel chart-card">
        <h3 className="chart-title">Performance funnel</h3>
        <div style={{ flex: 1 }}><Bar data={barData} options={chartOptions} /></div>
      </div>

      <div className="glass-panel chart-card">
        <h3 className="chart-title">Completion timeline</h3>
        <div style={{ flex: 1 }}><Line data={tsLine} options={chartOptions} /></div>
      </div>

      <div className="glass-panel chart-card">
        <h3 className="chart-title">Risk profiles</h3>
        <div style={{ flex: 1 }}><Doughnut data={riskDoughnut} options={{ ...circularOptions, cutout: '70%' }} /></div>
      </div>

      <div className="glass-panel chart-card">
        <h3 className="chart-title">Gender split</h3>
        <div style={{ flex: 1 }}><Pie data={genderPie} options={circularOptions} /></div>
      </div>
    </div>
  );
}

