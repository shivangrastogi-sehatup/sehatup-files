// src/utils/analytics.js
import _ from "lodash";

// Buckets a submission into Low / Moderate / High / Critical / Unknown.
// The questionnaires save riskType as "Critical Risk", "High Risk",
// "Moderate Risk" or "Low Risk" (see questionnaire config getRiskType);
// match on the keyword so suffix/casing variants all land in the right bucket.
// If riskType is missing, derive it from healthScore using the same
// thresholds the questionnaires use: <=30 Critical, <=60 High, <=84 Moderate, >84 Low.
export function riskBucket(d) {
  const raw = (d?.riskType || "").toString().toLowerCase();
  if (raw.includes("critical")) return "Critical";
  if (raw.includes("moderate")) return "Moderate";
  if (raw.includes("high")) return "High";
  if (raw.includes("low")) return "Low";
  const score = Number(d?.healthScore ?? d?.score);
  if (Number.isFinite(score)) {
    if (score <= 30) return "Critical";
    if (score <= 60) return "High";
    if (score <= 84) return "Moderate";
    return "Low";
  }
  return "Unknown";
}

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
    let g = d.gender || d.sex;
    
    if (!g) {
      let h = d.reportCategory;
      if (d.rawState && d.rawState.html) {
          const match = d.rawState.html.match(/<h1>(.*?)<\/h1>/i);
          if (match) h = match[1];
      } else if (d.html) {
          const match = d.html.match(/<h1>(.*?)<\/h1>/i);
          if (match) h = match[1];
      }
      
      if (h) {
        const lowerH = h.toLowerCase();
        if (lowerH.includes("mens") || lowerH.includes("men's") || lowerH.includes("male") || lowerH === "men") {
           g = "Men";
        } else if (lowerH.includes("womens") || lowerH.includes("women's") || lowerH.includes("female") || lowerH === "women") {
           g = "Women";
        }
      }
    }
    
    // Normalize string
    if (g) {
       const lowerG = g.toLowerCase();
       if (lowerG.startsWith("m")) g = "Male";
       else if (lowerG.startsWith("w") || lowerG.startsWith("f")) g = "Female";
    }

    g = g || "Unknown";
    genders[g] = (genders[g] || 0) + 1;
  });

  const avgHealthScore = totalCompleted === 0 ? 0 : _.meanBy(allCompleted, (d) => d.healthScore || d.score || 0);
  const riskCounts = _.countBy(allCompleted, riskBucket);
  const peerAvg = _.mean(allCompleted.map(d => d.peerAverage || NaN).filter(Number.isFinite));

  const byDay = {};
  let totalPurchased = 0;
  let totalConsulted = 0;

  const dayKey = (d) => {
    const ts = d.timestamp?.toDate ? d.timestamp.toDate() : (d.timestamp ? new Date(d.timestamp) : new Date());
    return ts.toISOString().slice(0, 10);
  };
  const bump = (day, field) => {
    if (!byDay[day]) byDay[day] = { started: 0, completed: 0, partial: 0, purchases: 0, consulted: 0 };
    byDay[day][field] += 1;
  };

  (partialList || []).forEach((d) => {
    const day = dayKey(d);
    bump(day, "started");
    bump(day, "partial");
  });

  (allCompleted || []).forEach((d) => {
    const day = dayKey(d);
    bump(day, "started");    // completed users also started
    bump(day, "completed");
    if (d.isPurchased) { totalPurchased++; bump(day, "purchases"); }
    if (d.isConsulted) { totalConsulted++; bump(day, "consulted"); }
  });

  const timeSeries = Object.keys(byDay).sort().map(day => ({
    day,
    started:   byDay[day].started,
    completed: byDay[day].completed,
    partial:   byDay[day].partial,
    purchases: byDay[day].purchases,
    consulted: byDay[day].consulted,
    // Backward compat
    count:     byDay[day].completed,
  }));

  const purchaseRate = totalCompleted === 0 ? 0 : (totalPurchased / totalCompleted) * 100;
  const consultedRate = totalCompleted === 0 ? 0 : (totalConsulted / totalCompleted) * 100;
  const concerns = _.countBy(allCompleted, (d) => d.reportCategory || "Unknown");

  return {
    totalStarted, totalCompleted, totalPartial, totalManual, totalPurchased, totalConsulted,
    completionRate, dropoffRate, purchaseRate, consultedRate,
    genders, avgHealthScore, riskCounts, timeSeries, concerns, peerAvg
  };
}
