// data.js — mock data for the SehatUp CRM
// Uses names from the user's screenshots, expanded with realistic Indian names + phone numbers.

const RISKS = ["Low", "Moderate", "High", "Critical"];
const CATEGORIES = ["Womens Wellness", "Mens Health", "Joint Care", "Diabetes Care", "Heart Care", "Sleep & Stress"];
const SOURCES = ["Full", "Partial", "Manual", "Consulted", "Purchased", "WhatsApp"];
const STATES_IN = ["Maharashtra", "Delhi", "Karnataka", "UP", "Gujarat", "Tamil Nadu", "West Bengal", "Punjab", "Rajasthan", "Telangana"];
const CITIES = { Maharashtra:"Mumbai", Delhi:"New Delhi", Karnataka:"Bengaluru", UP:"Lucknow", Gujarat:"Ahmedabad", "Tamil Nadu":"Chennai", "West Bengal":"Kolkata", Punjab:"Ludhiana", Rajasthan:"Jaipur", Telangana:"Hyderabad" };

const NAMES = [
  "Aamina Jan","Madhu Sharma","Bhagyashree Pawara","Mitali Fale","Saloni Agarwal",
  "Radhika Nonia","Mst Zinat Parveen","Purva Chambhare","Kirti Agrawal","Nisha Prajapati",
  "Komal Verma","Shaya Thakur","Isha Mehta","Anjali Patel","Sneha Iyer",
  "Divya Reddy","Pooja Singh","Riya Joshi","Tanvi Desai","Meera Nair",
  "Lakshmi Rao","Priya Kapoor","Aditi Khan","Neha Bansal","Sakshi Choudhary",
  "Anshika Yadav","Bhavna Mishra","Charul Pandey","Damini Sinha","Esha Saxena"
];

const RISK_TYPE_OF_SCORE = (s) => s < 25 ? "Critical" : s < 50 ? "High" : s < 75 ? "Moderate" : "Low";

function seed(i) { return ((i * 9301 + 49297) % 233280) / 233280; }
function phoneOf(i) {
  // 10-digit India numbers starting 6/7/8/9
  const base = "987651234060062944268824842805777694138790211097107057296750938988327691349694018695720684952905259183023005919327188081".match(/.{10}/g);
  return base[i % base.length];
}

const NOW = new Date("2026-05-24T22:57:00+05:30");

function timeAgo(i) {
  const minsAgo = Math.floor(seed(i + 7) * 60 * 24 * 12); // up to 12 days
  const d = new Date(NOW.getTime() - minsAgo * 60 * 1000);
  return d;
}

function fmtTime(d) {
  const day = d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  const tm = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${day}, ${tm.toLowerCase()}`;
}

function fmtShortTime(d) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + ", " +
    d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
}

const CUSTOMERS = NAMES.map((name, i) => {
  // Force the canonical top 5 to match screenshot scores
  const fixedScores = { "Aamina Jan": 56, "Madhu Sharma": 11, "Bhagyashree Pawara": 37, "Mitali Fale": 23, "Saloni Agarwal": 22, "Radhika Nonia": 29, "Mst Zinat Parveen": 35, "Purva Chambhare": 15, "Kirti Agrawal": 23, "Nisha Prajapati": 45 };
  const score = fixedScores[name] ?? Math.floor(seed(i) * 100);
  const cat = CATEGORIES[i % CATEGORIES.length];
  const stateI = i % STATES_IN.length;
  const state = STATES_IN[stateI];
  const d = timeAgo(i);
  return {
    id: "SU" + (1000 + i),
    docId: ["h1IFeuyHPkDlgK8fmdo5","8ii5p92zIll5WYrMzzYq","Qf9NkA2pXr5T0aBjL1Cv","D7eU3oXq4mZ8b6sVcN0w","K2pHvA9LjMcXqR8tNn1Y","Z5oBeY1uJk0WgHsPq6T8","M4rXc2pVoLfA7uK3JhN1","E6tPzA9NhXqB0RkLcMv2","V8uXoCpL5JqA2NkR1ZcM","N3wKpA1RfM5UoCdJqBxL"][i] || ("xR" + Math.floor(seed(i+99) * 1e10).toString(36)),
    name,
    phone: phoneOf(i),
    email: name.split(" ")[0].toLowerCase() + "." + (name.split(" ")[1]||"x").toLowerCase() + "@gmail.com",
    score,
    risk: RISK_TYPE_OF_SCORE(score),
    category: cat,
    source: SOURCES[i % SOURCES.length],
    timestamp: d,
    timestampShort: fmtShortTime(d),
    timestampLong: fmtTime(d),
    age: 22 + Math.floor(seed(i + 3) * 35),
    gender: i % 7 === 3 ? "Male" : "Female",
    state, city: CITIES[state],
    address: `${100 + i}, ${["Brigade Rd","MG Rd","Linking Rd","Lodhi Estate","Sector 18","Park Street","Civil Lines"][i % 7]}`,
    pincode: 110000 + (i * 47) % 89999,
    orders: i % 4 === 0 ? 0 : Math.floor(seed(i+11) * 4) + 1,
    ltv: i % 4 === 0 ? 0 : (Math.floor(seed(i+13) * 12000) + 1500),
    consulted: i % 3 === 0,
    callStatus: ["New","Contacted","Follow up","Converted","No answer"][i % 5],
    avatarHue: Math.floor(seed(i + 5) * 360),
  };
});

const PRODUCTS = [
  { id: "P-100", name: "Femina Vitality Capsules", subtitle: "60 caps · 1 month", price: 899, sku: "FV-060", stock: 142, category: "Womens Wellness" },
  { id: "P-101", name: "Iron Boost Syrup", subtitle: "200ml", price: 449, sku: "IB-200", stock: 88, category: "Womens Wellness" },
  { id: "P-102", name: "Joint Care Pro", subtitle: "30 tablets", price: 699, sku: "JC-030", stock: 56, category: "Joint Care" },
  { id: "P-103", name: "Sugar Balance Forte", subtitle: "60 tablets", price: 999, sku: "SB-060", stock: 33, category: "Diabetes Care" },
  { id: "P-104", name: "Cardio Shield", subtitle: "30 caps", price: 1199, sku: "CS-030", stock: 21, category: "Heart Care" },
  { id: "P-105", name: "Mens Vigour", subtitle: "60 tablets", price: 1499, sku: "MV-060", stock: 67, category: "Mens Health" },
  { id: "P-106", name: "Stress Relief Drops", subtitle: "30ml", price: 349, sku: "SR-030", stock: 120, category: "Sleep & Stress" },
  { id: "P-107", name: "Ashwagandha 30 Tablets", subtitle: "Free sample · 30 tabs", price: 0, sku: "ASH-030", stock: 500, category: "Wellness", isFreeSample: true },
];

const QUESTIONNAIRE = {
  category: "Womens Wellness",
  sections: [
    { name: "Profile", qs: [
      { q: "What is your age?", a: "29 years" },
      { q: "What is your weight?", a: "68 kg" },
      { q: "What is your height?", a: "162 cm" },
    ]},
    { name: "Cycle & Hormones", qs: [
      { q: "How regular are your periods?", a: "Irregular — varies by 7+ days" },
      { q: "Do you experience severe cramps?", a: "Yes, often", flag: true },
      { q: "Have you been diagnosed with PCOS / PCOD?", a: "Suspected but not confirmed", flag: true },
      { q: "How would you rate your mood during periods?", a: "Often low, anxious" },
    ]},
    { name: "Lifestyle", qs: [
      { q: "How many hours do you sleep on average?", a: "5–6 hours", flag: true },
      { q: "How would you rate your daily stress?", a: "High" },
      { q: "Do you exercise regularly?", a: "1–2 times a week" },
      { q: "How is your appetite?", a: "Frequent cravings, especially sweets" },
    ]},
    { name: "Symptoms (last 30 days)", qs: [
      { q: "Fatigue or low energy?", a: "Most days", flag: true },
      { q: "Hair fall?", a: "Noticeable" },
      { q: "Acne or skin issues?", a: "Mild but recurring" },
      { q: "Weight gain unexplained?", a: "Yes, ~3kg in 3 months" },
    ]},
  ],
};

const ORDERS = CUSTOMERS.filter(c => c.orders > 0).slice(0, 14).map((c, i) => ({
  id: "#SU-" + (45230 + i),
  customer: c,
  items: PRODUCTS.slice(i % 3, (i % 3) + 2 + (i % 2)).map((p, idx) => ({ ...p, qty: 1 + (idx % 2) })),
  status: ["Placed","Packed","Shipped","Out for delivery","Delivered","Returned","Failed delivery"][i % 7],
  paymentMode: i % 3 === 0 ? "Prepaid" : "COD",
  amount: 599 + ((i * 137) % 4500),
  placedAt: c.timestampShort,
  awb: "NB" + (12000000 + i * 731),
  courier: ["Delhivery","Bluedart","XpressBees","Ekart"][i % 4],
  shippingAddress: `${c.address}, ${c.city}, ${c.state} - ${c.pincode}`,
}));

const ROLES = [
  { key: "admin", label: "Admin", subtitle: "All access", icon: "shield", color: "var(--accent)" },
  { key: "doctor", label: "Doctor", subtitle: "Clinical review", icon: "stethoscope", color: "var(--risk-low)" },
  { key: "telesales", label: "Tele-Sales", subtitle: "Customer outreach", icon: "phone", color: "var(--accent-2)" },
  { key: "order_creator", label: "Order Creator", subtitle: "Manual orders", icon: "package", color: "var(--risk-moderate)" },
  { key: "marketing", label: "Marketing", subtitle: "Analytics & funnel", icon: "bar", color: "var(--accent)" },
  { key: "logistics", label: "Logistics", subtitle: "Shipments", icon: "truck", color: "var(--risk-high)" },
];

const USERS = [
  { name: "shivang.rastogi", email: "shivang@sehatup.in", role: "admin", lastActive: "Now", initials: "SR" },
  { name: "Dr. Anand Iyer", email: "anand.iyer@sehatup.in", role: "doctor", lastActive: "12 min ago", initials: "AI" },
  { name: "Dr. Nisha Patel", email: "nisha.p@sehatup.in", role: "doctor", lastActive: "1 hr ago", initials: "NP" },
  { name: "Karthik R.", email: "karthik@sehatup.in", role: "telesales", lastActive: "3 min ago", initials: "KR" },
  { name: "Priya S.", email: "priya.s@sehatup.in", role: "telesales", lastActive: "Just now", initials: "PS" },
  { name: "Rohan M.", email: "rohan.m@sehatup.in", role: "order_creator", lastActive: "5 min ago", initials: "RM" },
  { name: "Aarav C.", email: "aarav@sehatup.in", role: "marketing", lastActive: "2 hr ago", initials: "AC" },
  { name: "Sneha V.", email: "sneha@sehatup.in", role: "logistics", lastActive: "8 min ago", initials: "SV" },
];

// Completion timeline — 90 days of data
const TIMELINE = Array.from({ length: 90 }, (_, i) => {
  const x = i / 89;
  const noise = (Math.sin(i * 0.7) + Math.cos(i * 1.3) * 0.6 + Math.sin(i * 0.31) * 0.4);
  const base = 18 + Math.sin(x * Math.PI) * 60;
  const v = Math.max(0, Math.floor(base + noise * 18));
  const d = new Date(NOW.getTime() - (89 - i) * 24 * 3600 * 1000);
  return { date: d, value: v, label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) };
});

const RISK_DIST = {
  Low: 1612, Moderate: 1083, High: 522, Critical: 189, Unknown: 40
};

const GENDER_SPLIT = { Female: 3284, Male: 162 };

const FUNNEL = [
  { stage: "Visited Quiz", count: 6210 },
  { stage: "Started",      count: 4062 },
  { stage: "Completed",    count: 3446 },
  { stage: "Consulted",    count: 1289 },
  { stage: "Ordered",      count: 842  },
];

const ACTIVITY = [
  { who: "Aamina Jan", what: "completed assessment", meta: "Score 56 · High Risk", time: "2 min ago", icon: "clipboard" },
  { who: "Order #SU-45239", what: "shipped via Delhivery", meta: "AWB NB12005118 · Mumbai → Chennai", time: "8 min ago", icon: "truck" },
  { who: "Dr. Anand Iyer", what: "added prescription", meta: "for Madhu Sharma · Critical", time: "14 min ago", icon: "stethoscope" },
  { who: "Karthik R.", what: "called Bhagyashree Pawara", meta: "Follow-up scheduled tomorrow 11am", time: "21 min ago", icon: "phone" },
  { who: "Saloni Agarwal", what: "placed order", meta: "₹1,899 · 2 items · COD", time: "34 min ago", icon: "package" },
  { who: "Order #SU-45235", what: "marked failed delivery", meta: "Reason: Address not found · Lucknow", time: "1 hr ago", icon: "flag" },
  { who: "Priya S.", what: "imported 142 leads", meta: "Google Sheet · Tele-sales", time: "2 hr ago", icon: "upload" },
];

const SHIPMENTS_STATUS = [
  { stage: "Placed",            count: 38, color: "var(--muted)" },
  { stage: "Packed",            count: 27, color: "var(--accent)" },
  { stage: "Shipped",           count: 62, color: "var(--accent-2)" },
  { stage: "Out for delivery",  count: 19, color: "var(--risk-moderate)" },
  { stage: "Delivered",         count: 184, color: "var(--risk-low)" },
  { stage: "Failed",            count: 11, color: "var(--risk-critical)" },
];

window.SehatData = {
  CUSTOMERS, PRODUCTS, ORDERS, ROLES, USERS, RISKS, CATEGORIES, SOURCES,
  TIMELINE, RISK_DIST, GENDER_SPLIT, FUNNEL, ACTIVITY, SHIPMENTS_STATUS,
  QUESTIONNAIRE, NOW, fmtTime, fmtShortTime, RISK_TYPE_OF_SCORE
};
