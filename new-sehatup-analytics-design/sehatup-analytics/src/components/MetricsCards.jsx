// src/components/MetricsCards.jsx
import React from "react";
export default function MetricsCards({ analytics }) {
  if (!analytics) return null;
  const { totalStarted, totalCompleted, totalPartial, completionRate, avgHealthScore, peerAvg } = analytics;
  return (
    <div className="cards" style={{ marginBottom: 12 }}>
      <div className="card"><div className="title">Started</div><div className="value">{totalStarted}</div></div>
      <div className="card"><div className="title">Completed</div><div className="value">{totalCompleted}</div></div>
      <div className="card"><div className="title">Dropped</div><div className="value">{totalPartial}</div></div>
      <div className="card"><div className="title">Completion %</div><div className="value">{Math.round(completionRate)}</div></div>
      <div className="card"><div className="title">Avg Score</div><div className="value">{Math.round(avgHealthScore)}</div></div>
      <div className="card"><div className="title">Peer Avg</div><div className="value">{Math.round(peerAvg)}</div></div>
    </div>
  );
}
