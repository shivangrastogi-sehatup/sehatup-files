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
  const riskCounts = _.countBy(allCompleted, (d) => d.riskType || "Unknown");
  const peerAvg = _.mean(allCompleted.map(d => d.peerAverage || NaN).filter(Number.isFinite));

  const byDay = {};
  let totalPurchased = 0;
  
  (allCompleted || []).forEach((d) => {
    if (d.isPurchased) totalPurchased++;
    
    const ts = d.timestamp?.toDate ? d.timestamp.toDate() : (d.timestamp ? new Date(d.timestamp) : new Date());
    const day = ts.toISOString().slice(0,10);
    if (!byDay[day]) byDay[day] = { count: 0, purchases: 0 };
    byDay[day].count += 1;
    if (d.isPurchased) byDay[day].purchases += 1;
  });
  const timeSeries = Object.keys(byDay).sort().map(day => ({ 
    day, 
    count: byDay[day].count,
    purchases: byDay[day].purchases
  }));

  const purchaseRate = totalCompleted === 0 ? 0 : (totalPurchased / totalCompleted) * 100;

  const concerns = _.countBy(allCompleted, (d) => d.reportCategory || "Unknown");

  return {
    totalStarted, totalCompleted, totalPartial, totalManual, totalPurchased,
    completionRate, dropoffRate, purchaseRate,
    genders, avgHealthScore, riskCounts, timeSeries, concerns, peerAvg
  };
}
