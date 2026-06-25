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
  // Manual entries are NOT quiz funnel events, so they're excluded from the
  // funnel/quiz metrics below (started, completed, completion/drop-off rates, avg
  // score, risk distribution, gender split). EXCEPTION: a manual lead can still be
  // consulted or purchased, so those flags ARE counted into Consulted / Purchased.
  // Manual still surfaces on its own via totalManual / the Source breakdown.
  const allCompleted = [...(completedList || [])];
  const totalStarted = (partialList?.length || 0) + (allCompleted?.length || 0);
  const totalCompleted = allCompleted?.length || 0;
  const totalPartial = partialList?.length || 0;
  const totalManual = manualList?.length || 0;
  const completionRate = totalStarted === 0 ? 0 : (totalCompleted / totalStarted) * 100;
  const dropoffRate = totalStarted === 0 ? 0 : (totalPartial / totalStarted) * 100;

  const genders = {};
  // Gender is derived PRIMARILY from the questionnaire taken — the live questionnaire
  // IDs are mens-wellness / mens-weight / womens-wellness / womens-weight, which map
  // cleanly to Male / Female. IMPORTANT: "womens" contains the substring "mens", so
  // women must always be tested before men to avoid misclassifying them as male.
  const genderFromQid = (qid) => {
    const q = (qid || "").toString().toLowerCase();
    if (q.startsWith("womens") || q.startsWith("women")) return "Female";
    if (q.startsWith("mens") || q.startsWith("men")) return "Male";
    return null;
  };
  (allCompleted || []).forEach((d) => {
    let g = genderFromQid(d.questionnaireId || d.qid);

    // Fallbacks (only when the questionnaire id doesn't resolve): an explicit gender
    // field, then the report category / report HTML heading.
    if (!g) {
      g = d.gender || d.sex;
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
          // Women first — "womens" contains the substring "mens".
          if (lowerH.includes("women") || lowerH.includes("female")) g = "Women";
          else if (lowerH.includes("men") || lowerH.includes("male")) g = "Men";
        }
      }
      // Normalize whatever the fallback produced to Male / Female.
      if (g) {
        const lowerG = g.toLowerCase();
        if (lowerG.startsWith("w") || lowerG.startsWith("f")) g = "Female";
        else if (lowerG.startsWith("m")) g = "Male";
      }
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

  // Bucket by LOCAL calendar date (IST for the team), not UTC. Using toISOString()
  // here pushed early-morning IST submissions (before 05:30 IST) onto the previous
  // UTC day, so "today" undercounted (e.g. showed 5 when 7 were submitted today).
  const dayKey = (d) => {
    const ts = d.timestamp?.toDate ? d.timestamp.toDate() : (d.timestamp ? new Date(d.timestamp) : new Date());
    const y = ts.getFullYear();
    const m = String(ts.getMonth() + 1).padStart(2, '0');
    const day = String(ts.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const bump = (day, field) => {
    if (!byDay[day]) byDay[day] = { started: 0, completed: 0, partial: 0, purchases: 0, consulted: 0 };
    byDay[day][field] += 1;
  };

  (partialList || []).forEach((d) => {
    const day = dayKey(d);
    bump(day, "started");
    bump(day, "partial");
    // A partial (abandoned-quiz) lead can still be consulted/purchased after follow-up,
    // so include those flags in the Consulted / Purchased totals too.
    if (d.isPurchased) { totalPurchased++; bump(day, "purchases"); }
    if (d.isConsulted) { totalConsulted++; bump(day, "consulted"); }
  });

  (allCompleted || []).forEach((d) => {
    const day = dayKey(d);
    bump(day, "started");    // completed users also started
    bump(day, "completed");
    if (d.isPurchased) { totalPurchased++; bump(day, "purchases"); }
    if (d.isConsulted) { totalConsulted++; bump(day, "consulted"); }
  });

  // Manual entries are not quiz funnel events (no started/completed), but a manually
  // created lead CAN still be consulted or marked purchased — so include those in the
  // Consulted / Purchased totals (and their day series) per product requirement.
  let manualConsulted = 0;
  let manualPurchased = 0;
  (manualList || []).forEach((d) => {
    const day = dayKey(d);
    if (d.isPurchased) { totalPurchased++; manualPurchased++; bump(day, "purchases"); }
    if (d.isConsulted) { totalConsulted++; manualConsulted++; bump(day, "consulted"); }
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
    // How much of consulted/purchased came from manual leads (for "X incl. Y manual" labels).
    manualConsulted, manualPurchased,
    completionRate, dropoffRate, purchaseRate, consultedRate,
    genders, avgHealthScore, riskCounts, timeSeries, concerns, peerAvg
  };
}
