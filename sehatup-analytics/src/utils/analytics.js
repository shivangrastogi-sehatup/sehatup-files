// src/utils/analytics.js
import _ from "lodash";

export function computeAnalytics(partialList = [], completedList = [], manualList = []) {
  const allCompleted = [...(completedList || []), ...(manualList || [])];
  const totalStarted = (partialList?.length || 0) + (allCompleted?.length || 0);
  const totalCompleted = allCompleted?.length || 0;
  const totalPartial = partialList?.length || 0;
  const totalManual = manualList?.length || 0;
  const completionRate = totalStarted === 0 ? 0 : (totalCompleted / totalStarted) * 100;
  const dropoffRate = totalStarted === 0 ? 0 : (totalPartial / totalStarted) * 100;

  const genders = {};
  (allCompleted || []).forEach((d) => {
    const g = d.gender || d.sex || "Unknown";
    genders[g] = (genders[g] || 0) + 1;
  });

  const avgHealthScore = totalCompleted === 0 ? 0 : _.meanBy(allCompleted, (d) => d.healthScore || d.score || 0);
  const riskCounts = _.countBy(allCompleted, (d) => d.riskType || "Unknown");
  const peerAvg = _.mean(allCompleted.map(d => d.peerAverage || NaN).filter(Number.isFinite));

  const byDay = {};
  (allCompleted || []).forEach((d) => {
    const ts = d.timestamp?.toDate ? d.timestamp.toDate() : (d.timestamp ? new Date(d.timestamp) : new Date());
    const day = ts.toISOString().slice(0,10);
    byDay[day] = (byDay[day] || 0) + 1;
  });
  const timeSeries = Object.keys(byDay).sort().map(day => ({ day, count: byDay[day] }));

  const concerns = _.countBy(allCompleted, (d) => d.reportCategory || "Unknown");

  return {
    totalStarted, totalCompleted, totalPartial, totalManual,
    completionRate, dropoffRate,
    genders, avgHealthScore, riskCounts, timeSeries, concerns, peerAvg
  };
}
