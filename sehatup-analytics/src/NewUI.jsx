/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { FIREBASE_MODE, setFirebaseMode } from './config/firebaseEnvironment';
import { searchCustomers, getOrders, getCustomersCount, createDraftOrder, createCustomer } from './utils/shopify';
import { triggerOrderPlacedWebhook, triggerHealthKitReadyWebhook } from './utils/webhookHelpers';
import { db, auth } from './firebase';
import { collection, query, orderBy, where, limit, getDocs, onSnapshot, getCountFromServer, getDoc, doc, updateDoc, setDoc, serverTimestamp, addDoc, runTransaction, writeBatch, deleteDoc, deleteField } from 'firebase/firestore';
import { computeAnalytics } from "./utils/analytics";


const useStateCx = useState;
const useMemoCx = useMemo;
const useStateD = useState;
const useStateO = useState;
const useMemoS = useMemo;
const useStateS = useState;
const useStateM = useState;

// --- Permissions context ---
const PermissionsCtx = React.createContext({ permissions: {}, hasPermission: () => false, isAdmin: false });
const usePermissions = () => React.useContext(PermissionsCtx);

// --- data.js ---
// data.js — mock data for the SehatUp CRM
// Uses names from the user's screenshots, expanded with realistic Indian names + phone numbers.

const RISKS = ["Low", "Moderate", "High", "Critical"];
const CATEGORIES = ["Womens Wellness", "Mens Health", "Joint Care", "Diabetes Care", "Heart Care", "Sleep & Stress"];
const SOURCES = ["Full", "Partial", "Manual", "Consulted", "Purchased", "WhatsApp"];
const STATES_IN = ["Maharashtra", "Delhi", "Karnataka", "UP", "Gujarat", "Tamil Nadu", "West Bengal", "Punjab", "Rajasthan", "Telangana"];
const CITIES = { Maharashtra:"Mumbai", Delhi:"New Delhi", Karnataka:"Bengaluru", UP:"Lucknow", Gujarat:"Ahmedabad", "Tamil Nadu":"Chennai", "West Bengal":"Kolkata", Punjab:"Ludhiana", Rajasthan:"Jaipur", Telangana:"Hyderabad" };

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", 
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", 
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Congo-Brazzaville)", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia", 
  "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic", 
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", 
  "Fiji", "Finland", "France", 
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", 
  "Haiti", "Honduras", "Hungary", 
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", 
  "Jamaica", "Japan", "Jordan", 
  "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", 
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", 
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", 
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", 
  "Oman", 
  "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", 
  "Qatar", 
  "Romania", "Russia", "Rwanda", 
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", 
  "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", 
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States of America", "Uruguay", "Uzbekistan", 
  "Vanuatu", "Vatican City", "Venezuela", "Vietnam", 
  "Yemen", 
  "Zambia", "Zimbabwe"
];

const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", 
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", 
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", 
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", 
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", 
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

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
  { who: "Saloni Agarwal", what: "placed order", meta: "Rs. 1,899 · 2 items · COD", time: "34 min ago", icon: "package" },
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


// --- icons.jsx ---
// icons.jsx — single-source SVG icon set (lucide-style outline, 1.6 stroke)
// Globally exposes Icon component: <Icon name="search" size={16} />

const I = {
  search:    "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35",
  bell:      "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M14 21a2 2 0 0 1-4 0",
  plus:      "M12 5v14M5 12h14",
  filter:    "M3 5h18l-7 8v6l-4 2v-8L3 5Z",
  download:  "M12 3v12m0 0 5-5m-5 5-5-5M5 21h14",
  upload:    "M12 21V9m0 0 5 5m-5-5-5 5M5 3h14",
  chevron_down:  "m6 9 6 6 6-6",
  chevron_right: "m9 6 6 6-6 6",
  chevron_left:  "m15 6-6 6 6 6",
  chevron_up:    "m6 15 6-6 6 6",
  x:         "M6 6l12 12M18 6 6 18",
  check:     "M5 13l4 4L19 7",
  copy:      "M9 9h10v10H9zM5 5h10v4H9v6H5z",
  refresh:   "M3 12a9 9 0 0 1 15-6.7L21 8M3 16l3 2.7A9 9 0 0 0 21 12M21 3v5h-5M3 21v-5h5",
  more:      "M6 12h.01M12 12h.01M18 12h.01",
  edit:      "M4 20h4l11-11-4-4L4 16v4Zm10-15 4 4",
  trash:     "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  external:  "M14 5h5v5M19 5 10 14M19 13v6H5V5h6",
  user:      "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
  users:     "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 10a7 7 0 0 1 14 0M16 3a4 4 0 0 1 0 8M17 21a7 7 0 0 0-4-6.3",
  heart:     "M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z",
  shield:    "M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z",
  pulse:     "M3 12h4l3-8 4 16 3-8h4",
  bar:       "M3 21V10m6 11V4m6 17v-9m6 9V8",
  pie:       "M12 3a9 9 0 1 0 9 9h-9V3Z",
  trend_up:  "M3 17l6-6 4 4 8-8M14 7h7v7",
  trend_dn:  "M3 7l6 6 4-4 8 8M14 17h7v-7",
  calendar:  "M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 3v4M16 3v4",
  clock:     "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-15v5l3 3",
  phone:     "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2Z",
  mail:      "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2 8 7 8-7",
  chat:      "M21 12a8 8 0 1 1-3.4-6.6L21 4l-1.4 3.4A8 8 0 0 1 21 12Z",
  whatsapp:  "M3 21l1.65-4.5A9 9 0 1 1 8 19.4L3 21Z M8 10c.5 3 2 4.5 5 5l1.3-1.5c.3-.4.9-.5 1.4-.3l2 1c.4.2.6.6.5 1-.4 1.7-2 2.3-3.6 2-3.7-.8-7-4-7.7-7.7-.3-1.6.3-3.2 2-3.6.4-.1.8.1 1 .5l1 2c.2.5.1 1.1-.3 1.4L8 10Z",
  package:   "M12 12 3 7l9-5 9 5-9 5Zm0 0v10M3 7v10l9 5M21 7v10l-9 5",
  truck:     "M3 5h11v11H3zM14 9h4l3 4v3h-7M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  stethoscope:"M6 3v6a4 4 0 0 0 8 0V3M9 21v-4a5 5 0 0 1 5-5 5 5 0 0 1 5 5 2 2 0 1 1-4 0",
  pill:      "m10.5 20.5 10-10a5 5 0 0 0-7-7l-10 10a5 5 0 0 0 7 7Zm-3.5-3.5 7-7",
  settings:  "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.4.6 1 1 1.6 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
  home:      "M3 11 12 3l9 8v9a2 2 0 0 1-2 2h-3v-6h-8v6H5a2 2 0 0 1-2-2v-9Z",
  inbox:     "M22 12h-6l-2 3h-4l-2-3H2M5 4h14l3 8v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3-8Z",
  flag:      "M4 21V4h11l1 2h5v9h-6l-1-2H6v8H4Z",
  link:      "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5",
  bolt:      "M13 2 4 14h6l-1 8 9-12h-6l1-8Z",
  sparkles:  "M12 3 13.5 9 19 10.5 13.5 12 12 18 10.5 12 5 10.5 10.5 9 12 3Z M19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7L19 17Z",
  eye:       "M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  arrow_right:"M5 12h14M13 5l7 7-7 7",
  arrow_up_right:"M7 17 17 7M8 7h9v9",
  layers:    "M12 2 2 7l10 5 10-5-10-5Zm10 10-10 5L2 12m20 5-10 5L2 17",
  command:   "M6 3a3 3 0 0 0 0 6h12a3 3 0 0 0 0-6 3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 0-6H6a3 3 0 0 0 0 6 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3Z",
  side:      "M3 4h18v16H3zM9 4v16",
  map:       "M3 6 9 4l6 2 6-2v14l-6 2-6-2-6 2V6Zm6-2v16m6-14v16",
  clipboard: "M9 3h6v3H9zM7 5H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2",
  message:   "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z",
  star:      "m12 2 3 7 7 .6-5.3 4.7L18 21l-6-3.7L6 21l1.3-6.7L2 9.6 9 9l3-7Z",
  layout_sidebar: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z M9 3v18",
  lock:      "M5 11h14v10H5zM7 11V8a5 5 0 0 1 10 0v3",
  arrow_left:"M19 12H5M12 5l-7 7 7 7",
  user_plus: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9 1v6m3-3h-6",
  ruler:     "M1 20L20 1M7 7l2.5 2.5M4 10l3.5 3.5M10 4l3.5 3.5M14 14l2.5 2.5M17 11l2.5 2.5M11 17l2.5 2.5",
  target:    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-4a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  scale:     "M9 17H5a2 2 0 0 0-2 2h18a2 2 0 0 0-2-2h-4M12 3v14M3 6l3 6c.8 2 2.6 3 5.2 3M21 6l-3 6c-.8 2-2.6 3-5.2 3",
};

export function Icon({ name, size = 16, color = "currentColor", strokeWidth = 1.6, fill = "none", className = "" }) {
  const d = I[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" className={className}>
      {d.split(' M').map((p, i) => <path key={i} d={(i ? 'M' : '') + p} />)}
    </svg>
  );
}




// --- components.jsx ---
// components.jsx — shared UI primitives
// Exposes globally: Avatar, Badge, RiskBadge, Gauge, Tabs, KPI, FilterBar, Toolbar,
// LineChart, BarChart, DonutChart, FunnelChart, Sparkbars, Pagination

const RISK_COLOR = {
  Low: "var(--risk-low)",
  Moderate: "var(--risk-moderate)",
  High: "var(--risk-high)",
  Critical: "var(--risk-critical)",
  Unknown: "var(--risk-unknown)",
};

function Avatar({ name = "?", size, hue, src }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase();
  const cls = "avatar" + (size === "lg" ? " lg" : size === "sm" ? " sm" : "");
  const bg = hue != null
    ? `oklch(92% 0.04 ${hue})`
    : undefined;
  const fg = hue != null
    ? `oklch(34% 0.14 ${hue})`
    : undefined;
  return (
    <div className={cls} style={{ background: bg, color: fg }} aria-label={name}>
      {src ? <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
    </div>
  );
}

function Badge({ children, tone, className = "", dot, ...rest }) {
  return (
    <span className={`badge ${tone ? `risk-${tone}` : ""} ${className}`.trim()} {...rest}>
      {dot && <span className="dotx" style={{ background: dot }} />}
      {children}
    </span>
  );
}

function RiskBadge({ risk }) {
  const key = (risk || "Unknown").toLowerCase();
  return <span className={`badge risk-${key}`}><span className="dotx" style={{ background: RISK_COLOR[risk] || RISK_COLOR.Unknown }} />{risk}</span>;
}

function Gauge({ value = 50, size = 96, stroke = 8, label = "Score", showLabel = true, big = false }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 75 ? "var(--risk-low)"
              : pct >= 50 ? "var(--risk-moderate)"
              : pct >= 25 ? "var(--risk-high)"
                          : "var(--risk-critical)";
  const dash = (pct / 100) * c;
  return (
    <div className={"gauge" + (big ? " lg" : "")} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} stroke="var(--border)" strokeWidth={stroke} fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
      </svg>
      <div className="gv">
        <span className="n">{pct}</span>
        {showLabel && <span className="l">{label}</span>}
      </div>
    </div>
  );
}

function Tabs({ value, onChange, items }) {
  return (
    <div className="tabs">
      {items.map(it => {
        const isOn = Array.isArray(value) ? value.includes(it.value) : value === it.value;
        return (
          <button key={it.value} className={isOn ? "on" : ""} onClick={() => onChange(it.value)}>
            {it.label}
            {it.count != null && <span className="ct">{it.count.toLocaleString()}</span>}
          </button>
        );
      })}
    </div>
  );
}

function KPI({ label, value, icon, delta, deltaDir = "up", suffix, feature, sparkline }) {
  return (
    <div className={"kpi" + (feature ? " feature" : "")}>
      <div className="kpi-hd">
        {icon && <div className="ic"><Icon name={icon} size={14} /></div>}
        <div className="lbl">{label}</div>
      </div>
      <div className="kpi-val">{value}{suffix && <span style={{ color: "var(--muted)", fontSize: 16, fontWeight: 500, marginLeft: 4 }}>{suffix}</span>}</div>
      <div className="kpi-ft">
        {delta != null && (
          <span className={"delta " + (deltaDir === "up" ? "up" : "down")}>
            <Icon name={deltaDir === "up" ? "trend_up" : "trend_dn"} size={12} /> {delta}
          </span>
        )}
        {sparkline && <Sparkbars data={sparkline} />}
        <span>vs. last 30d</span>
      </div>
    </div>
  );
}

function Sparkbars({ data = [], height = 28 }) {
  const max = Math.max(...data, 1);
  return (
    <div className="sparkbars" style={{ height, marginLeft: "auto" }}>
      {data.map((v, i) => <span key={i} style={{ height: `${(v / max) * 100}%`, opacity: 0.55 + (i / data.length) * 0.45 }} />)}
    </div>
  );
}

/* â”€â”€ Charts (lightweight inline SVG, no library) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function LineChart({ data = [], height = 220, color = "var(--accent)", fill = true }) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const w = 700, h = height;
  const pad = { l: 36, r: 16, t: 16, b: 26 };
  const ys = data.map(d => d.value);
  const maxY = Math.ceil(Math.max(...ys, 1) / 20) * 20;
  const scaleX = i => pad.l + (i / Math.max(1, data.length - 1)) * (w - pad.l - pad.r);
  const scaleY = v => pad.t + (1 - v / maxY) * (h - pad.t - pad.b);
  const pts = data.map((d, i) => `${scaleX(i)},${scaleY(d.value)}`).join(" ");
  const area = `${pad.l},${h - pad.b} ${pts} ${scaleX(data.length - 1)},${h - pad.b}`;
  const yticks = [0, maxY / 2, maxY];
  const xticks = [0, Math.floor(data.length / 4), Math.floor(data.length / 2), Math.floor(data.length * 3 / 4), data.length - 1];

  return (
    <div className="chart-wrap" style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="lg-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {yticks.map((t, i) => (
          <g key={i}>
            <line className="gridline" x1={pad.l} x2={w - pad.r} y1={scaleY(t)} y2={scaleY(t)} />
            <text className="" x={pad.l - 8} y={scaleY(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="Geist Mono, monospace">{t}</text>
          </g>
        ))}
        {fill && <polygon points={area} fill="url(#lg-fill)" />}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={scaleX(i)} cy={scaleY(d.value)} r={hoveredNode === i ? "4" : "2.5"} fill={hoveredNode === i ? color : "var(--surface)"} stroke={color} strokeWidth="1.5" style={{ transition: "all 0.2s" }} />
            <circle cx={scaleX(i)} cy={scaleY(d.value)} r="14" fill="transparent" style={{ cursor: "pointer" }} onMouseEnter={() => setHoveredNode(i)} onMouseLeave={() => setHoveredNode(null)} />
          </g>
        ))}

        {hoveredNode !== null && (
          <g>
            <rect x={scaleX(hoveredNode) - 20} y={scaleY(data[hoveredNode].value) - 30} width="40" height="20" rx="4" fill="var(--fg)" />
            <text x={scaleX(hoveredNode)} y={scaleY(data[hoveredNode].value) - 16} textAnchor="middle" fill="var(--bg)" fontSize="11" fontWeight="600">{data[hoveredNode].value}</text>
          </g>
        )}

        {xticks.map((i, k) => (
          <text key={k} x={scaleX(i)} y={h - 8} textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="Geist Mono, monospace">
            {data[i]?.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function BarChart({ data = [], height = 220, color = "var(--accent)" }) {
  const w = 700, h = height;
  const pad = { l: 36, r: 16, t: 16, b: 36 };
  const maxY = Math.ceil(Math.max(...data.map(d => d.value), 1) * 1.1 / 100) * 100;
  const bw = (w - pad.l - pad.r) / data.length;
  const barW = Math.min(bw * 0.6, 60);
  const scaleY = v => pad.t + (1 - v / maxY) * (h - pad.t - pad.b);
  const yticks = [0, maxY / 4, maxY / 2, (3 * maxY) / 4, maxY];
  return (
    <div className="chart-wrap" style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {yticks.map((t, i) => (
          <g key={i}>
            <line className="gridline" x1={pad.l} x2={w - pad.r} y1={scaleY(t)} y2={scaleY(t)} />
            <text x={pad.l - 8} y={scaleY(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="Geist Mono, monospace">{t.toLocaleString()}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + bw * i + (bw - barW) / 2;
          const y = scaleY(d.value);
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={(h - pad.b) - y} rx="6" fill={d.color || color} opacity={d.color ? 1 : 0.88} />
              <text x={x + barW / 2} y={h - 18} textAnchor="middle" fontSize="11" fill="var(--fg-soft)" fontFamily="inherit">{d.label}</text>
              <text x={x + barW / 2} y={h - 4} textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="Geist Mono, monospace">{d.value.toLocaleString()}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DonutChart({ data = [], size = 200, thickness = 26, centerLabel, centerValue }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const r = size / 2;
  const inner = r - thickness;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let a0 = -Math.PI / 2;
  const arcs = data.map((d, i) => {
    const a1 = a0 + (d.value / total) * Math.PI * 2;
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    const p = (a, R) => [r + Math.cos(a) * R, r + Math.sin(a) * R];
    const [x0, y0] = p(a0, r - 1);
    const [x1, y1] = p(a1, r - 1);
    const [xi1, yi1] = p(a1, inner);
    const [xi0, yi0] = p(a0, inner);
    const d_ = `M ${x0} ${y0} A ${r-1} ${r-1} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${inner} ${inner} 0 ${large} 0 ${xi0} ${yi0} Z`;
    
    // Calculate center of the arc for 3D translation
    const midAngle = a0 + (a1 - a0) / 2;
    const popOutDistance = 6;
    const popX = Math.cos(midAngle) * popOutDistance;
    const popY = Math.sin(midAngle) * popOutDistance;

    a0 = a1;
    return { d: d_, color: d.color, label: d.label, value: d.value, pct: (d.value / total) * 100, popX, popY };
  });

  return (
    <div style={{ display: "inline-grid", placeItems: "center", position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        {arcs.map((a, i) => {
          const isHovered = hoveredIndex === i;
          return (
            <path key={i} d={a.d} fill={a.color} 
              style={{
                transition: "transform 0.2s cubic-bezier(0.25, 1.5, 0.5, 1), filter 0.2s ease",
                transform: isHovered ? `translate(${a.popX}px, ${a.popY}px) scale(1.05)` : "translate(0px, 0px) scale(1)",
                transformOrigin: "center",
                filter: isHovered ? "drop-shadow(0px 8px 12px rgba(0,0,0,0.4))" : "none",
                cursor: "pointer"
              }}
              onMouseEnter={() => setHoveredIndex(i)} 
              onMouseLeave={() => setHoveredIndex(null)} 
            />
          );
        })}
      </svg>
      {(centerLabel || centerValue) && (
        <div style={{ position: "absolute", textAlign: "center", pointerEvents: "none" }}>
          {centerValue != null && <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{hoveredIndex !== null ? arcs[hoveredIndex].value.toLocaleString() : centerValue}</div>}
          {centerLabel && <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{hoveredIndex !== null ? arcs[hoveredIndex].label : centerLabel}</div>}
        </div>
      )}
    </div>
  );
}

function FunnelChart({ data = [] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="stack-12" style={{ width: "100%" }}>
      {data.map((d, i) => {
        const pct = (d.count / max) * 100;
        const conv = i > 0 ? ((d.count / data[i - 1].count) * 100).toFixed(1) : null;
        return (
          <div key={d.stage}>
            <div className="hstack-8" style={{ marginBottom: 6, fontSize: 12.5 }}>
              <span style={{ fontWeight: 500 }}>{d.stage}</span>
              <span className="muted">{d.count.toLocaleString()}</span>
              <span className="spacer" />
              {conv && <span className="badge" style={{ fontSize: 11 }}>{conv}% conv</span>}
            </div>
            <div className="fbar"><i style={{ width: pct + "%" }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function FilterBar({ children }) {
  return <div className="filterbar">{children}</div>;
}

// eslint-disable-next-line no-unused-vars
function Pagination({ page, total, perPage, onChange }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  return (
    <div className="hstack-8" style={{ padding: "10px 0", fontSize: 13 }}>
      <span className="muted">Showing <b className="num" style={{ color: "var(--fg)" }}>{(page - 1) * perPage + 1}-{Math.min(page * perPage, total)}</b> of <b className="num" style={{ color: "var(--fg)" }}>{total.toLocaleString()}</b></span>
      <span className="spacer" />
      <button className="btn sm" onClick={() => onChange(Math.max(1, page - 1))}><Icon name="chevron_left" size={14}/> Prev</button>
      <span className="num muted">Page {page} of {pages}</span>
      <button className="btn sm" onClick={() => onChange(Math.min(pages, page + 1))}>Next <Icon name="chevron_right" size={14}/></button>
    </div>
  );
}

function EnvToggle({ value, onChange }) {
  return (
    <div className="env-toggle">
      <button className={value === "live" ? "on" : ""} onClick={() => onChange("live")}>
        <span className="pulse" style={{ background: "var(--risk-low)" }} /> Live
      </button>
      <button className={value === "dev" ? "on" : ""} onClick={() => onChange("dev")}>
        <span className="pulse" style={{ background: "var(--risk-moderate)" }} /> Dev
      </button>
    </div>
  );
}




// --- tweaks-panel.jsx ---

// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// â”€â”€ useTweaks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    setValues((prev) => ({ ...prev, ...edits }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', { detail: edits }));
  }, []);
  return [values, setTweak];
}

// â”€â”€ TweaksPanel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({ title = 'Tweaks', children }) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({ x: 16, y: 16 });
  const PAD = 16;

  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y)),
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);

  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);

  React.useEffect(() => {
    const onMsg = (e) => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);
      else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
  };

  const onDragStart = (e) => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = (ev) => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy),
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  if (!open) return null;
  return (
    <>
      <style>{__TWEAKS_STYLE}</style>
      <div ref={dragRef} className="twk-panel" data-omelette-chrome=""
           style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}>
        <div className="twk-hd" onMouseDown={onDragStart}>
          <b>{title}</b>
          <button className="twk-x" aria-label="Close tweaks"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={dismiss}>âœ•</button>
        </div>
        <div className="twk-body">
          {children}
        </div>
      </div>
    </>
  );
}

// â”€â”€ Layout helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TweakSection({ label, children }) {
  return (
    <>
      <div className="twk-sect">{label}</div>
      {children}
    </>
  );
}

function TweakRow({ label, value, children, inline = false }) {
  return (
    <div className={inline ? 'twk-row twk-row-h' : 'twk-row'}>
      <div className="twk-lbl">
        <span>{label}</span>
        {value != null && <span className="twk-val">{value}</span>}
      </div>
      {children}
    </div>
  );
}

// â”€â”€ Controls â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// eslint-disable-next-line no-unused-vars
function TweakSlider({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }) {
  return (
    <TweakRow label={label} value={`${value}${unit}`}>
      <input type="range" className="twk-slider" min={min} max={max} step={step}
             value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </TweakRow>
  );
}

// eslint-disable-next-line no-unused-vars
function TweakToggle({ label, value, onChange }) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl"><span>{label}</span></div>
      <button type="button" className="twk-toggle" data-on={value ? '1' : '0'}
              role="switch" aria-checked={!!value}
              onClick={() => onChange(!value)}><i /></button>
    </div>
  );
}

function TweakRadio({ label, value, options, onChange }) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel âˆ’ 28 body pad âˆ’ 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = (o) => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({ 2: 16, 3: 10 }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = (s) => {
      const m = options.find((o) => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return <TweakSelect label={label} value={value} options={options}
                        onChange={(s) => onChange(resolve(s))} />;
  }
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const idx = Math.max(0, opts.findIndex((o) => o.value === value));
  const n = opts.length;

  const segAt = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor(((clientX - r.left - 2) / inner) * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };

  const onPointerDown = (e) => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev) => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <TweakRow label={label}>
      <div ref={trackRef} role="radiogroup" onPointerDown={onPointerDown}
           className={dragging ? 'twk-seg dragging' : 'twk-seg'}>
        <div className="twk-seg-thumb"
             style={{ left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
                      width: `calc((100% - 4px) / ${n})` }} />
        {opts.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value}>
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}

function TweakSelect({ label, value, options, onChange }) {
  return (
    <TweakRow label={label}>
      <select className="twk-field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </TweakRow>
  );
}

// eslint-disable-next-line no-unused-vars
function TweakText({ label, value, placeholder, onChange }) {
  return (
    <TweakRow label={label}>
      <input className="twk-field" type="text" value={value} placeholder={placeholder}
             onChange={(e) => onChange(e.target.value)} />
    </TweakRow>
  );
}

// eslint-disable-next-line no-unused-vars
function TweakNumber({ label, value, min, max, step = 1, unit = '', onChange }) {
  const clamp = (n) => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({ x: 0, val: 0 });
  const onScrubStart = (e) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, val: value };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = (ev) => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div className="twk-num">
      <span className="twk-num-lbl" onPointerDown={onScrubStart}>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step}
             onChange={(e) => onChange(clamp(Number(e.target.value)))} />
      {unit && <span className="twk-num-unit">{unit}</span>}
    </div>
  );
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}

const TwkCheck = ({ light }) => (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3 7.2 5.8 10 11 4.2" fill="none" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          stroke={light ? 'rgba(0,0,0,.78)' : '#fff'} />
  </svg>
);

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
// eslint-disable-next-line no-unused-vars
function TweakColor({ label, value, options, onChange }) {
  if (!options || !options.length) {
    return (
      <div className="twk-row twk-row-h">
        <div className="twk-lbl"><span>{label}</span></div>
        <input type="color" className="twk-swatch" value={value}
               onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = (o) => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return (
    <TweakRow label={label}>
      <div className="twk-chips" role="radiogroup">
        {options.map((o, i) => {
          const colors = Array.isArray(o) ? o : [o];
          const [hero, ...rest] = colors;
          const sup = rest.slice(0, 4);
          const on = key(o) === cur;
          return (
            <button key={i} type="button" className="twk-chip" role="radio"
                    aria-checked={on} data-on={on ? '1' : '0'}
                    aria-label={colors.join(', ')} title={colors.join(' · ')}
                    style={{ background: hero }}
                    onClick={() => onChange(o)}>
              {sup.length > 0 && (
                <span>
                  {sup.map((c, j) => <i key={j} style={{ background: c }} />)}
                </span>
              )}
              {on && <TwkCheck light={__twkIsLight(hero)} />}
            </button>
          );
        })}
      </div>
    </TweakRow>
  );
}

// eslint-disable-next-line no-unused-vars
function TweakButton({ label, onClick, secondary = false }) {
  return (
    <button type="button" className={secondary ? 'twk-btn secondary' : 'twk-btn'}
            onClick={onClick}>{label}</button>
  );
}




// --- screens-dashboard.jsx ---
// screens-dashboard.jsx — Home / Health Score Questionnaire Dashboard
// Two layouts:
//   - "analytics"  : KPIs + charts + risk donut + small recent activity
//   - "activity"   : KPIs + big recent submissions feed + side charts



const GENDER_MAPPING = {
  "Men": ["Mens Health", "Mens Vitality", "Male Wellness", "Mens Sexual Wellness", "Mens Weight Loss"],
  "Women": ["Female Wellness", "Womens Personal Wellness", "Womens Weight Management", "Womens Wellness", "Womens Weight Loss", "Women's Wellness", "Women's Weight"]
};

function Dashboard({ tweaks, openCustomer, openSubmission, setRoute }) {
  const [partialData, setPartialData] = useState([]);
  const [completedData, setCompletedData] = useState([]);
  const [manualData, setManualData] = useState([]);

  // Filter states
  const [daysFilter, setDaysFilter] = useState(30);
  const [genderFilter, setGenderFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, "partial_submissions"), orderBy("timestamp", "desc")), snap => {
      setPartialData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub2 = onSnapshot(query(collection(db, "questionnaire_submissions"), orderBy("timestamp", "desc")), snap => {
      setCompletedData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub3 = onSnapshot(query(collection(db, "manual_submissions"), orderBy("timestamp", "desc")), snap => {
      setManualData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const filtered = useMemoCx(() => {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysFilter);

    const filterItem = (item) => {
      if (!item.timestamp) return false;
      const ts = item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
      if (ts < fromDate) return false;
      if (categoryFilter !== "All" && item.reportCategory !== categoryFilter && item.primaryGoal !== categoryFilter) return false;
      if (genderFilter !== "All") {
        const categories = GENDER_MAPPING[genderFilter] || [];
        if (!categories.includes(item.reportCategory) && !categories.includes(item.primaryGoal)) return false;
      }
      return true;
    };

    return {
      partial: partialData.filter(filterItem),
      completed: completedData.filter(filterItem),
      manual: manualData.filter(filterItem)
    };
  }, [partialData, completedData, manualData, daysFilter, genderFilter, categoryFilter]);

  const analytics = useMemoCx(() => computeAnalytics(filtered.partial, filtered.completed, filtered.manual), [filtered]);

  const D = window.SehatData;
  const layout = tweaks.homeLayout || "analytics";
  const [tab, setTab] = useState("completed");

  const kpis = (
    <div className="grid-12">
      <div className="span-3"><KPI feature label="Started" value={analytics.totalStarted.toLocaleString()} icon="clipboard" delta="+8.2%" deltaDir="up" sparkline={analytics.timeSeries.slice(-14).map(d => d.count)} /></div>
      <div className="span-3"><KPI label="Completed" value={analytics.totalCompleted.toLocaleString()} icon="check" delta="+12.4%" deltaDir="up" sparkline={analytics.timeSeries.slice(-14).map(d => d.count * 0.85)} /></div>
      <div className="span-3"><KPI label="Drop-off" value={Math.round(analytics.dropoffRate || 0)} suffix="%" icon="trend_dn" delta="-2.1%" deltaDir="up" sparkline={analytics.timeSeries.slice(-14).map(d => 60 - d.count * 0.4)} /></div>
      <div className="span-3"><KPI label="Avg. score" value={Math.round(analytics.avgHealthScore || 0)} suffix="/100" icon="pulse" delta="+1.3" deltaDir="up" sparkline={analytics.timeSeries.slice(-14).map(d => d.count * 0.6 + 20)} /></div>
    </div>
  );

  const riskDonut = (() => {
    const r = analytics.riskCounts || {};
    return [
      { label: "Low",       value: r.Low || 0,       color: "var(--risk-low)" },
      { label: "Moderate",  value: r.Moderate || 0,  color: "var(--risk-moderate)" },
      { label: "High",      value: r.High || 0,      color: "var(--risk-high)" },
      { label: "Critical",  value: r.Critical || 0,  color: "var(--risk-critical)" },
      { label: "Unknown",   value: r.Unknown || 0,   color: "var(--risk-unknown)" },
    ];
  })();

  const timeSeriesChartData = (analytics.timeSeries || []).map(d => ({
    label: d.day.slice(5).replace("-", "/"),
    value: d.count
  }));

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Health Score Questionnaire</h1>
          <p className="page-sub">Real-time submission analytics · last 30 days</p>
        </div>
        <div className="page-head-actions">
          <div className="filterbar" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="chip" style={{ position: 'relative' }}>
              <Icon name="calendar" /> Last {daysFilter} days <Icon name="chevron_down" />
              <select style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} value={daysFilter} onChange={e => setDaysFilter(Number(e.target.value))}>
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
                <option value={365}>Last 1 year</option>
              </select>
            </span>
            <span className="chip" style={{ position: 'relative' }}>
              <Icon name="users" /> {genderFilter === 'All' ? 'All genders' : genderFilter} <Icon name="chevron_down" />
              <select style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} value={genderFilter} onChange={e => setGenderFilter(e.target.value)}>
                <option value="All">All genders</option>
                <option value="Men">Men</option>
                <option value="Women">Women</option>
              </select>
            </span>
            <span className="chip" style={{ position: 'relative' }}>
              <Icon name="layers" /> {categoryFilter === 'All' ? 'All categories' : categoryFilter} <Icon name="chevron_down" />
              <select style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="All">All categories</option>
                <option>Female Wellness</option>
                <option>Womens Personal Wellness</option>
                <option>Womens Weight Management</option>
                <option>Womens Wellness</option>
                <option>Mens Health</option>
                <option>Mens Vitality</option>
                <option>Mens Sexual Wellness</option>
                <option>Mens Weight Loss</option>
              </select>
            </span>
            {(genderFilter !== 'All' || categoryFilter !== 'All' || daysFilter !== 30) && (
              <span className="chip ghost" style={{ cursor: 'pointer', padding: "0 8px" }} onClick={() => { setGenderFilter('All'); setCategoryFilter('All'); setDaysFilter(30); }}>
                Clear
              </span>
            )}
          </div>
          <button className="btn"><Icon name="download" /> Export</button>
          <button className="btn primary"><Icon name="refresh" /> Refresh</button>
        </div>
      </div>

      {kpis}

      {layout === "analytics" ? (
        <>
          <div className="grid-12">
            <div className="span-8 card">
              <div className="hstack-8" style={{ marginBottom: 14 }}>
                <div className="section-title">Completion timeline</div>
                <span className="muted" style={{ fontSize: 12 }}>· past 90 days</span>
                <span className="spacer" />
                <Tabs value="completed" onChange={() => {}} items={[
                  { label: "Completed", value: "completed" },
                  { label: "Started", value: "started" },
                  { label: "Both", value: "both" },
                ]} />
              </div>
              <LineChart data={timeSeriesChartData.length ? timeSeriesChartData : D.TIMELINE} height={240} />
            </div>
            <div className="span-4 card">
              <div className="hstack-8" style={{ marginBottom: 14 }}>
                <div className="section-title">Risk distribution</div>
                <span className="spacer" />
                <button className="btn sm ghost"><Icon name="more" /></button>
              </div>
              <div className="hstack-12" style={{ justifyContent: "center", padding: "8px 0" }}>
                <DonutChart data={riskDonut} size={184} thickness={28} centerValue={(riskDonut.reduce((a, b) => a + b.value, 0)).toLocaleString()} centerLabel="profiles" />
              </div>
              <div className="legend" style={{ justifyContent: "center", marginTop: 8 }}>
                {riskDonut.map(r => (
                  <span key={r.label}><i style={{ background: r.color }} /> {r.label} <span className="muted num">· {r.value.toLocaleString()}</span></span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid-12">
            <div className="span-5 card">
              <div className="section-title" style={{ marginBottom: 10 }}>Conversion funnel</div>
              <FunnelChart data={D.FUNNEL} />
            </div>
            <div className="span-4 card">
              <div className="section-title" style={{ marginBottom: 10 }}>Category breakdown</div>
              <BarChart height={232} data={D.CATEGORIES.slice(0, 6).map((c, i) => ({
                label: c.split(" ")[0],
                value: [842, 612, 433, 387, 298, 174][i],
              }))} />
            </div>
            <div className="span-3 card">
              <div className="section-title" style={{ marginBottom: 10 }}>Gender split</div>
              <div style={{ display: "grid", placeItems: "center", padding: "14px 0" }}>
                <DonutChart size={150} thickness={22} centerValue="95%" centerLabel="female" data={[
                  { label: "Female", value: D.GENDER_SPLIT.Female, color: "var(--accent)" },
                  { label: "Male",   value: D.GENDER_SPLIT.Male,   color: "var(--accent-2)" },
                ]} />
              </div>
              <div className="stack-6" style={{ marginTop: 8 }}>
                <div className="hstack-8" style={{ fontSize: 12.5 }}><span className="dot" style={{ background: "var(--accent)" }} /><span>Female</span><span className="spacer" /><span className="num muted">{D.GENDER_SPLIT.Female.toLocaleString()}</span></div>
                <div className="hstack-8" style={{ fontSize: 12.5 }}><span className="dot" style={{ background: "var(--accent-2)" }} /><span>Male</span><span className="spacer" /><span className="num muted">{D.GENDER_SPLIT.Male.toLocaleString()}</span></div>
              </div>
            </div>
          </div>

          <SubmissionsHistory recent={D.CUSTOMERS} openCustomer={openCustomer} openSubmission={openSubmission} tab={tab} setTab={setTab} />
        </>
      ) : (
        // ACTIVITY-FEED LAYOUT
        <>
          <div className="grid-12">
            <div className="span-8">
              <SubmissionsHistory recent={D.CUSTOMERS} openCustomer={openCustomer} openSubmission={openSubmission} tab={tab} setTab={setTab} compact />
            </div>
            <div className="span-4 col">
              <div className="card">
                <div className="section-title" style={{ marginBottom: 10 }}>Risk distribution</div>
                <div style={{ display: "grid", placeItems: "center", padding: "8px 0" }}>
                  <DonutChart data={riskDonut} size={160} thickness={24} centerValue={(riskDonut.reduce((a, b) => a + b.value, 0)).toLocaleString()} centerLabel="profiles" />
                </div>
                <div className="legend" style={{ marginTop: 10 }}>
                  {riskDonut.map(r => <span key={r.label}><i style={{ background: r.color }} /> {r.label}</span>)}
                </div>
              </div>
              <div className="card">
                <div className="section-title" style={{ marginBottom: 10 }}>Live activity</div>
                <div className="stack-12">
                  {D.ACTIVITY.slice(0, 6).map((a, i) => (
                    <div key={i} className="tl">
                      <div style={{ fontSize: 13 }}><b>{a.who}</b> <span className="muted">{a.what}</span></div>
                      <div className="muted" style={{ fontSize: 12 }}>{a.meta}</div>
                      <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>{a.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid-12">
            <div className="span-8 card">
              <div className="hstack-8" style={{ marginBottom: 14 }}>
                <div className="section-title">Completion timeline</div>
                <span className="muted" style={{ fontSize: 12 }}>· past 90 days</span>
              </div>
              <LineChart data={timeSeriesChartData.length ? timeSeriesChartData : D.TIMELINE} height={220} />
            </div>
            <div className="span-4 card">
              <div className="section-title" style={{ marginBottom: 10 }}>Conversion funnel</div>
              <FunnelChart data={D.FUNNEL} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SubmissionsScreen({ openCustomer, openSubmission, setSubmissionsCount }) {
  const [activeTabs, setActiveTabs] = useState([]);
  const [partialData, setPartialData] = useState([]);
  const [completedData, setCompletedData] = useState([]);
  const [manualData, setManualData] = useState([]);
  const [loaded, setLoaded] = useState({ partial: false, completed: false, manual: false });

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "partial_submissions"), snap => {
      setPartialData(snap.docs.map(d => ({ id: d.id, _source: "partial", ...d.data() })));
      setLoaded(p => ({ ...p, partial: true }));
    });
    const unsub2 = onSnapshot(collection(db, "questionnaire_submissions"), snap => {
      setCompletedData(snap.docs.map(d => ({ id: d.id, _source: "completed", ...d.data() })));
      setLoaded(p => ({ ...p, completed: true }));
    });
    const unsub3 = onSnapshot(collection(db, "manual_submissions"), snap => {
      setManualData(snap.docs.map(d => ({ id: d.id, _source: "manual", ...d.data() })));
      setLoaded(p => ({ ...p, manual: true }));
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const isLoading = !loaded.partial || !loaded.completed || !loaded.manual;

  const toggleTab = (val) => {
    setActiveTabs(prev => prev.includes(val) ? prev.filter(t => t !== val) : [...prev, val]);
  };

  const clearFilters = () => setActiveTabs([]);

  const recent = [...completedData, ...partialData, ...manualData]
    .filter(d => activeTabs.length === 0 || activeTabs.includes(d._source))
    .sort((a, b) => {
      const ta = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
      const tb = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
      return tb - ta;
    })
    .map(d => ({
    ...d,
    id: d.id,
    docId: d.id,
    source: d._source,
    name: d.name || d.userName || "Unknown",
    age: d.age || "-",
    gender: d.gender || "-",
    phone: d.phone || "-",
    category: d.primaryGoal || d.reportCategory || "General",
    score: d.healthScore ?? d.score ?? "-",
    risk: (d.healthScore ?? d.score) !== undefined ? ((d.healthScore ?? d.score) < 40 ? "Critical" : ((d.healthScore ?? d.score) < 60 ? "High" : ((d.healthScore ?? d.score) < 80 ? "Moderate" : "Low"))) : "-",
    city: d.city || "-", state: d.state || "-",
    timestampShort: d.timestamp?.toDate ? d.timestamp.toDate().toLocaleDateString() : (d.timestamp ? new Date(d.timestamp).toLocaleDateString() : "-"),
    avatarHue: Math.floor(Math.random()*360),
    answers: d.answers || {}
  }));

  useEffect(() => {
    if (setSubmissionsCount && activeTabs.length === 0) {
      setSubmissionsCount(recent.length.toLocaleString());
    }
  }, [recent.length, activeTabs.length, setSubmissionsCount]);

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Submissions</h1>
          <p className="page-sub">View recent partial and completed assessments</p>
        </div>
      </div>
      <SubmissionsHistory loading={isLoading} recent={recent} openCustomer={openCustomer} openSubmission={openSubmission} activeTabs={activeTabs} toggleTab={toggleTab} clearFilters={clearFilters} />
    </div>
  );
}

function SubmissionsHistory({ loading, recent, openCustomer, openSubmission, tab, setTab, activeTabs, toggleTab, clearFilters, compact }) {
  const tabs = [
    { label: "Completed", value: "completed" },
    { label: "Partial",   value: "partial" },
    { label: "Manual",    value: "manual" },
    { label: "Consulted", value: "consulted" },
    { label: "Purchased", value: "purchased" },
    { label: "WhatsApp",  value: "whatsapp" },
  ];

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 14;
  const totalCount = recent ? recent.length : 0;
  const maxPages = Math.max(1, Math.ceil(totalCount / pageSize));
  
  useEffect(() => {
    if (currentPage > maxPages) setCurrentPage(Math.max(1, maxPages));
  }, [maxPages, currentPage]);

  const pagedList = recent ? recent.slice((currentPage - 1) * pageSize, currentPage * pageSize) : [];

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="hstack-8" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", rowGap: "8px" }}>
        <div className="section-title">Submissions history</div>
        <span className="muted num" style={{ fontSize: 12 }}>· {totalCount.toLocaleString()} entries</span>
        <span className="spacer" />
        <Tabs value={activeTabs !== undefined ? activeTabs : tab} onChange={toggleTab || setTab} items={tabs.slice(0, compact ? 4 : 6)} />
        {activeTabs && activeTabs.length > 0 && (
          <button className="btn sm ghost" onClick={clearFilters}>Clear Filters</button>
        )}
        <button className="btn sm primary"><Icon name="download" /> Export</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 36 }}><input type="checkbox" /></th>
              <th>Name</th>
              <th>Phone</th>
              <th>Score</th>
              <th>Risk</th>
              <th>Category</th>
              <th>Source</th>
              <th>Timestamp</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <style>{`
            @keyframes shimmerPulse {
              0% { opacity: 0.4; }
              50% { opacity: 0.8; }
              100% { opacity: 0.4; }
            }
            .skel-box {
              background: var(--border);
              border-radius: 4px;
              animation: shimmerPulse 1.5s ease-in-out infinite;
            }
          `}</style>
          <tbody>
            {loading ? (
              Array.from({ length: 14 }).map((_, i) => (
                <tr key={`skel-${i}`} className="fade-in">
                  <td><div className="skel-box" style={{ width: 16, height: 16, borderRadius: 4 }}></div></td>
                  <td>
                    <div className="hstack-10">
                      <div className="skel-box" style={{ width: 32, height: 32, borderRadius: "50%" }}></div>
                      <div className="stack-2">
                        <div className="skel-box" style={{ width: 120, height: 14 }}></div>
                        <div className="skel-box" style={{ width: 80, height: 10 }}></div>
                      </div>
                    </div>
                  </td>
                  <td><div className="skel-box" style={{ width: 100, height: 14 }}></div></td>
                  <td><div className="skel-box" style={{ width: 80, height: 24, borderRadius: 99 }}></div></td>
                  <td><div className="skel-box" style={{ width: 60, height: 24, borderRadius: 99 }}></div></td>
                  <td><div className="skel-box" style={{ width: 100, height: 14 }}></div></td>
                  <td><div className="skel-box" style={{ width: 80, height: 24, borderRadius: 99 }}></div></td>
                  <td><div className="skel-box" style={{ width: 80, height: 14 }}></div></td>
                  <td></td>
                </tr>
              ))
            ) : pagedList.length === 0 ? (
               <tr><td colSpan="9" style={{ textAlign: "center", padding: 60 }} className="muted">No submissions found.</td></tr>
            ) : (
              pagedList.map(c => (
                <tr key={c.id} onClick={() => openCustomer(c)} className="fade-in">
                <td><input type="checkbox" onClick={e => e.stopPropagation()} /></td>
                <td>
                  <div className="hstack-10">
                    <Avatar name={c.name} hue={c.avatarHue} size="sm" />
                    <div className="stack-2">
                      <div className="fw5">{c.name}</div>
                      <div className="muted mono" style={{ fontSize: 11 }}>{(c.docId || c.id || "").slice(0, 12)}...</div>
                    </div>
                  </div>
                </td>
                <td className="num">{c.phone}</td>
                <td>
                  <div className="hstack-8">
                    <ScoreChip score={c.score} />
                  </div>
                </td>
                <td><RiskBadge risk={c.risk} /></td>
                <td className="muted">{c.category}</td>
                <td><Badge>{c.source}</Badge></td>
                <td className="muted num">{c.timestampShort}</td>
                <td className="right">
                  <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); openSubmission(c); }} title="View submission"><Icon name="eye" /></button>
                  <button className="btn sm ghost" onClick={(e) => e.stopPropagation()} title="More"><Icon name="more" /></button>
                </td>
              </tr>
            ))
          )}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)" }}>
        <div className="hstack-8" style={{ fontSize: 13, justifyContent: "space-between" }}>
          <span className="muted">
            Showing <b className="num" style={{ color: "var(--fg)" }}>{totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCount)}</b> of <b className="num" style={{ color: "var(--fg)" }}>{totalCount.toLocaleString()}</b>
          </span>
          
          <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
            <select 
              className="input sm" 
              style={{ padding: "2px 8px", fontSize: 13, minWidth: 100 }}
              value={currentPage}
              onChange={e => {
                if (e.target.value === 'custom') {
                  const p = window.prompt("Enter page number to jump to (max " + maxPages + "):");
                  if (p && !isNaN(p) && Number(p) > 0 && Number(p) <= maxPages) setCurrentPage(Number(p));
                } else {
                  setCurrentPage(Number(e.target.value));
                }
              }}
            >
              <option value={currentPage}>Page {currentPage}</option>
              <option disabled>---</option>
              <option value="10">Page 10</option>
              <option value="50">Page 50</option>
              <option value="100">Page 100</option>
              <option value="custom">Custom...</option>
            </select>
          </div>

          <div className="hstack-4">
            <button 
                onClick={() => setCurrentPage(currentPage - 1)} 
                disabled={currentPage <= 1}
                className={`btn sm sq ghost ${currentPage <= 1 ? "disabled" : ""}`}
            >
                <Icon name="chevron_left" size={14}/>
            </button>
            
            {(() => {
               let start = Math.max(1, currentPage - 2);
               let end = Math.min(start + 4, maxPages);
               if (end - start < 4) start = Math.max(1, end - 4);
               
               return Array.from({ length: end - start + 1 }).map((_, i) => {
                 const p = start + i;
                 return (
                   <button 
                     key={p}
                     onClick={() => setCurrentPage(p)}
                     className={`btn sm sq ${currentPage === p ? "primary" : "ghost"}`}
                   >
                     {p}
                   </button>
                 );
               });
            })()}

            <button 
                onClick={() => setCurrentPage(currentPage + 1)} 
                disabled={currentPage >= maxPages}
                className={`btn sm sq ghost ${currentPage >= maxPages ? "disabled" : ""}`}
            >
                <Icon name="chevron_right" size={14}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreChip({ score }) {
  if (score === "-" || score === undefined || score === null) {
    return <span className="muted num">-</span>;
  }
  const color = score >= 75 ? "var(--risk-low)"
              : score >= 50 ? "var(--risk-moderate)"
              : score >= 25 ? "var(--risk-high)"
                            : "var(--risk-critical)";
  return (
    <span className="hstack-8" style={{ fontVariantNumeric: "tabular-nums" }}>
      <span className="num fw6" style={{ color, fontSize: 14 }}>{score}</span>
      <span style={{ width: 44, height: 4, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden", display: "inline-block" }}>
        <span style={{ display: "block", width: score + "%", height: "100%", background: color, borderRadius: 99 }} />
      </span>
    </span>
  );
}






// --- screens-customers.jsx ---
// screens-customers.jsx — Customers list + Customer detail drawer + Submission detail drawer



const CUSTOMERS_GRAPHQL_QUERY = `
    query($query: String, $first: Int, $after: String) {
        customers(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
            pageInfo { hasNextPage endCursor }
            edges {
                node {
                    id
                    displayName
                    firstName
                    lastName
                    email
                    phone
                    numberOfOrders
                    amountSpent { amount currencyCode }
                    createdAt
                    defaultAddress { 
                        address1 address2 city province provinceCode zip country countryCodeV2 phone
                    }
                }
            }
        }
    }
`;

function CustomersList({ openCustomer, openSubmission }) {
  const D = window.SehatData;
  const [q, setQ] = useStateCx("");
  const [risk, setRisk] = useStateCx("all");
  const [src, setSrc] = useStateCx("all");
  const [sort, setSort] = useStateCx("recent");

  const [customers, setCustomers] = useStateCx([]);
  const [loading, setLoading] = useStateCx(true);
  const [totalCount, setTotalCount] = useStateCx(null);
  const [pageCursors, setPageCursors] = useStateCx([]);
  const [hasNextPage, setHasNextPage] = useStateCx(false);
  const [, setEndCursor] = useStateCx(null);
  const [jumpProgress, setJumpProgress] = useStateCx(null);
  const lastQ = useRef(q);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    getCustomersCount().then(c => setTotalCount(c)).catch(e => console.error(e));
  }, []);

  useEffect(() => {
    let cancel = false;
    
    const isQChange = lastQ.current !== q;
    lastQ.current = q;
    
    setLoading(true);
    const delay = isQChange ? 400 : 0;
    
    const t = setTimeout(async () => {
      try {
        const queryParts = [];
        if (q.trim()) {
            queryParts.push(`(first_name:*${q.trim()}* OR last_name:*${q.trim()}* OR phone:*${q.trim()}*)`);
        }
        const qString = queryParts.join(' AND ');


        const res = await fetch('/shopify-v2/graphql.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: CUSTOMERS_GRAPHQL_QUERY,
                variables: {
                    first: 14,
                    after: pageCursors.length > 0 ? pageCursors[pageCursors.length - 1] : null,
                    query: qString || null
                }
            })
        });

        if (cancel) return;
        const data = await res.json();
        if (data.errors) throw new Error(data.errors[0].message);

        const connection = data.data.customers;
        const mapped = connection.edges.map(e => {
            const c = e.node;
            return {
                id: c.id,
                name: c.displayName || "Unknown",
                age: "-", gender: "-",
                phone: c.phone || c.defaultAddress?.phone || "-",
                city: c.defaultAddress?.city || "-",
                state: c.defaultAddress?.provinceCode || c.defaultAddress?.province || "-",
                orders: c.numberOfOrders || 0,
                ltv: parseFloat(c.amountSpent?.amount || "0"),
                timestampShort: new Date(c.createdAt).toLocaleDateString(),
                avatarHue: Math.floor(Math.random() * 360)
            };
        });
        
        setCustomers(mapped);
        setHasNextPage(connection.pageInfo.hasNextPage);
        setEndCursor(connection.pageInfo.endCursor);
      } catch (err) {
        if (!cancel) console.error("Error fetching customers", err);
      } finally {
        if (!cancel) setLoading(false);
      }
    }, delay);

    return () => { cancel = true; clearTimeout(t); };
  }, [q, pageCursors]);

  // Reset pagination on search change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
      setPageCursors([]);
  }, [q]);

  const jumpToPage = async (targetPage) => {
    if (targetPage === pageCursors.length + 1) return;
    if (targetPage < pageCursors.length + 1) {
      setPageCursors(prev => prev.slice(0, targetPage - 1));
      return;
    }
    
    setLoading(true);
    let tempCursors = [...pageCursors];
    let currentIdx = tempCursors.length + 1;
    let currentCursor = tempCursors.length > 0 ? tempCursors[tempCursors.length - 1] : null;
    const qString = q ? `name:*${q}* OR phone:*${q}* OR email:*${q}*` : "";
    
    // Show progress if jumping more than 1 page
    if (targetPage - currentIdx > 1) {
      setJumpProgress({ current: currentIdx, target: targetPage });
    }
    
    try {
      while (currentIdx < targetPage) {
        if (targetPage - currentIdx >= 1) {
           setJumpProgress({ current: currentIdx, target: targetPage });
        }
        const res = await fetch('/shopify-v2/graphql.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: CUSTOMERS_GRAPHQL_QUERY,
                variables: { first: 14, after: currentCursor, query: qString || null }
            })
        });
        const data = await res.json();
        currentCursor = data.data.customers.pageInfo.endCursor;
        tempCursors.push(currentCursor);
        currentIdx++;
      }
      setPageCursors(tempCursors);
      setEndCursor(currentCursor);
    } catch(e) {
      console.error(e);
      setLoading(false); // Only reset on error, success will be handled by useEffect
    } finally {
      setJumpProgress(null);
    }
  };

  const list = useMemoCx(() => {
    let l = customers;
    // Server-side search handles q. Client-side handles sorting by mock scores if applied.
    if (risk !== "all") l = l.filter(c => c.risk === risk);
    if (src !== "all")  l = l.filter(c => c.source === src);
    if (sort === "score-hi") l = [...l].sort((a, b) => b.score - a.score);
    if (sort === "score-lo") l = [...l].sort((a, b) => a.score - b.score);
    return l;
  }, [customers, risk, src, sort]);

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-sub">{loading ? "Syncing..." : `${totalCount !== null ? totalCount.toLocaleString() : customers.length.toLocaleString()} profiles`} · synced from Shopify</p>
        </div>
        <div className="page-head-actions">
          <button className="btn"><Icon name="upload" /> Import</button>
          <button className="btn"><Icon name="download" /> Export</button>
          <button className="btn primary"><Icon name="plus" /> New customer</button>
        </div>
      </div>

      <div className="grid-12">
        <div className="span-3"><KPI label="Total customers" value={totalCount !== null ? totalCount.toLocaleString() : (loading ? "..." : customers.length.toLocaleString())} icon="users" /></div>
        <div className="span-3"><KPI label="High / Critical" value="-" icon="flag" /></div>
        <div className="span-3"><KPI label="Avg. LTV" value="Rs. -" icon="trend_up" /></div>
        <div className="span-3"><KPI label="WhatsApp opt-in" value="-" icon="whatsapp" /></div>
      </div>

      <div className="toolbar">
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <input className="input" style={{ paddingLeft: 34 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, phone, or symptom..." />
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }}><Icon name="search" size={14}/></span>
        </div>
        <FilterBar>
          <SelectChip icon="flag" label="Risk" value={risk} onChange={setRisk} options={[["all","All risks"],...["Low","Moderate","High","Critical"].map(r => [r, r])]} />
          <SelectChip icon="layers" label="Source" value={src} onChange={setSrc} options={[["all","All sources"],...D.SOURCES.map(s => [s, s])]} />
          <SelectChip icon="bar" label="Sort" value={sort} onChange={setSort} options={[["recent","Most recent"],["score-hi","Score: high→low"],["score-lo","Score: low→high"]]} />
        </FilterBar>
        <span className="spacer" />
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 36 }}><input type="checkbox" /></th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Location</th>
                <th>Orders</th>
                <th>LTV</th>
                <th>Last activity</th>
                <th></th>
              </tr>
            </thead>
            <style>{`
              @keyframes shimmerPulse {
                0% { opacity: 0.4; }
                50% { opacity: 0.8; }
                100% { opacity: 0.4; }
              }
              .skel-box {
                background: var(--border);
                border-radius: 4px;
                animation: shimmerPulse 1.5s ease-in-out infinite;
              }
              @keyframes spinFast { 100% { transform: rotate(360deg); } }
              .spin { animation: spinFast 1s linear infinite; }
            `}</style>
            <tbody>
              {loading && jumpProgress ? (
                 <tr className="fade-in">
                   <td colSpan="8" style={{ padding: "120px 20px", textAlign: "center" }}>
                     <Icon name="refresh" size={28} className="spin" color="var(--accent)" />
                     <div className="fw5" style={{ marginTop: 24, fontSize: 16 }}>Fast-forwarding to Page {jumpProgress.target}...</div>
                     <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                       Fetching {jumpProgress.current} of {jumpProgress.target}
                     </div>
                     <div style={{ background: "var(--border)", height: 6, borderRadius: 6, width: 240, margin: "20px auto 0", overflow: "hidden" }}>
                       <div style={{ background: "var(--accent)", height: "100%", borderRadius: 6, width: `${Math.round((jumpProgress.current/jumpProgress.target)*100)}%`, transition: "width 0.2s ease-out" }} />
                     </div>
                   </td>
                 </tr>
              ) : loading ? (
                Array.from({ length: 14 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="fade-in">
                    <td><div className="skel-box" style={{ width: 16, height: 16, borderRadius: 4 }}></div></td>
                    <td>
                      <div className="hstack-10">
                        <div className="skel-box" style={{ width: 32, height: 32, borderRadius: "50%" }}></div>
                        <div className="stack-2">
                          <div className="skel-box" style={{ width: 120, height: 14 }}></div>
                          <div className="skel-box" style={{ width: 80, height: 10 }}></div>
                        </div>
                      </div>
                    </td>
                    <td><div className="skel-box" style={{ width: 100, height: 14 }}></div></td>
                    <td><div className="skel-box" style={{ width: 120, height: 14 }}></div></td>
                    <td><div className="skel-box" style={{ width: 40, height: 14 }}></div></td>
                    <td><div className="skel-box" style={{ width: 60, height: 14 }}></div></td>
                    <td><div className="skel-box" style={{ width: 80, height: 14 }}></div></td>
                    <td></td>
                  </tr>
                ))
              ) : list.length === 0 ? (
                 <tr><td colSpan="8" style={{ textAlign: "center", padding: 60 }} className="muted">No customers found.</td></tr>
              ) : (
                list.slice(0, 14).map(c => (
                  <tr key={c.id} onClick={() => openCustomer(c)} className="fade-in">
                    <td><input type="checkbox" onClick={e => e.stopPropagation()} /></td>
                    <td>
                      <div className="hstack-10">
                        <Avatar name={c.name} hue={c.avatarHue} size="sm" />
                        <div className="stack-2">
                          <div className="fw5">{c.name}</div>
                          <div className="muted" style={{ fontSize: 11.5 }}>{c.age} · {c.gender}</div>
                        </div>
                      </div>
                    </td>
                    <td className="num">{c.phone}</td>
                    <td className="muted">{c.city}, {c.state}</td>
                    <td className="num">{c.orders}</td>
                    <td className="num">{c.ltv ? "Rs. " + c.ltv.toLocaleString() : "—"}</td>
                    <td className="muted num">{c.timestampShort}</td>
                    <td className="right">
                      <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); openSubmission(c); }} title="View answers"><Icon name="clipboard" /></button>
                      <button className="btn sm ghost" onClick={(e) => e.stopPropagation()}><Icon name="phone" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)" }}>
          <div className="hstack-8" style={{ fontSize: 13, justifyContent: "space-between" }}>
            <span className="muted">
              Showing <b className="num" style={{ color: "var(--fg)" }}>{(pageCursors.length) * 14 + 1}-{Math.min((pageCursors.length + 1) * 14, totalCount || 0)}</b> of <b className="num" style={{ color: "var(--fg)" }}>{(totalCount || 0).toLocaleString()}</b>
            </span>
            
            <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
              <select 
                className="input sm" 
                style={{ padding: "2px 8px", fontSize: 13, minWidth: 100 }}
                value={pageCursors.length + 1}
                onChange={e => {
                  if (e.target.value === 'custom') {
                    const maxPages = Math.max(1, Math.ceil((totalCount || 0) / 14));
                    const p = window.prompt("Enter page number to jump to (max " + maxPages + "):");
                    if (p && !isNaN(p) && Number(p) > 0 && Number(p) <= maxPages) jumpToPage(Number(p));
                  } else {
                    jumpToPage(Number(e.target.value));
                  }
                }}
              >
                <option value={pageCursors.length + 1}>Page {pageCursors.length + 1}</option>
                <option disabled>---</option>
                <option value="10">Page 10</option>
                <option value="50">Page 50</option>
                <option value="100">Page 100</option>
                <option value="custom">Custom...</option>
              </select>
            </div>

            <div className="hstack-4">
              <button 
                  onClick={() => jumpToPage(pageCursors.length)} 
                  disabled={pageCursors.length === 0 || loading}
                  className={`btn sm sq ghost ${pageCursors.length === 0 ? "disabled" : ""}`}
              >
                  <Icon name="chevron_left" size={14}/>
              </button>
              
              {(() => {
                 const currentPage = pageCursors.length + 1;
                 const maxPages = Math.max(1, Math.ceil((totalCount || 0) / 14));
                 let start = Math.max(1, currentPage - 2);
                 let end = Math.min(start + 4, maxPages);
                 if (end - start < 4) start = Math.max(1, end - 4);
                 
                 return Array.from({ length: end - start + 1 }).map((_, i) => {
                   const p = start + i;
                   return (
                     <button 
                       key={p}
                       onClick={() => jumpToPage(p)}
                       className={`btn sm sq ${currentPage === p ? "primary" : "ghost"}`}
                     >
                       {p}
                     </button>
                   );
                 });
              })()}

              <button 
                  onClick={() => jumpToPage(pageCursors.length + 2)} 
                  disabled={!hasNextPage || loading}
                  className={`btn sm sq ghost ${!hasNextPage ? "disabled" : ""}`}
              >
                  <Icon name="chevron_right" size={14}/>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectChip({ icon, label, value, options, onChange }) {
  // Lightweight custom select that looks like a chip
  return (
    <label className="chip" style={{ position: "relative" }}>
      {icon && <Icon name={icon} />}
      <span className="muted" style={{ fontSize: 11.5 }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{options.find(o => o[0] === value)?.[1]}</span>
      <Icon name="chevron_down" />
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

/* â”€â”€ Customer detail drawer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function CustomerDrawer({ customer, onClose, openSubmission, setRoute, role }) {
  const [isPurchased, setIsPurchased] = useStateCx(false);
  const [isConsulted, setIsConsulted] = useStateCx(false);
  if (!customer) return null;
  const c = customer;
  return (
    <Drawer onClose={onClose} title={c.name} subtitle={`${c.phone} · ${c.email}`}>
      <div className="hstack-12">
        <Avatar name={c.name} hue={c.avatarHue} size="lg" />
        <div className="stack-2">
          <div className="hstack-8">
            <span className="page-title" style={{ fontSize: 18 }}>{c.name}</span>
            {c.risk && <RiskBadge risk={c.risk} />}
          </div>
          <div className="muted" style={{ fontSize: 12.5 }}>{c.age !== "-" ? `${c.age} · ${c.gender} · ` : ""}{c.city}, {c.state}</div>
        </div>
        <span className="spacer" />
        {c.score !== undefined && <Gauge value={c.score} size={84} stroke={9} label="Score" />}
      </div>

      <div className="grid-12">
        <div className="span-4 card flat" style={{ background: "var(--surface-2)" }}>
          <div className="mini-stat"><div className="l">Lifetime value</div><div className="v">{c.ltv ? "Rs. " + c.ltv.toLocaleString() : "—"}</div></div>
        </div>
        <div className="span-4 card flat" style={{ background: "var(--surface-2)" }}>
          <div className="mini-stat"><div className="l">Orders</div><div className="v">{c.orders}</div></div>
        </div>
        <div className="span-4 card flat" style={{ background: "var(--surface-2)" }}>
          <div className="mini-stat"><div className="l">Call status</div><div className="v" style={{ fontSize: 15 }}>{c.callStatus}</div></div>
        </div>
      </div>

      {c.score !== undefined && (
        <div className="stack-12">
          <div className="hstack-8">
            <div className="section-title">Latest assessment</div>
            <span className="spacer" />
            <button className="btn sm" onClick={() => openSubmission(c)}>View full answers <Icon name="arrow_right" /></button>
          </div>
          <div className="card flat">
            <div className="hstack-12">
              <Gauge value={c.score} size={64} stroke={7} showLabel={false} />
              <div className="stack-2">
                <div className="fw5">{c.category || "Submitted"}</div>
                <div className="muted" style={{ fontSize: 12 }}>Submitted {c.timestampLong || c.timestampShort}</div>
              </div>
              <span className="spacer" />
              {c.risk && <RiskBadge risk={c.risk} />}
            </div>
            <div className="divider" style={{ margin: "12px 0" }} />
            <div className="stack-6">
              <div className="hstack-8" style={{ fontSize: 12.5 }}><Icon name="bolt" size={12} color="var(--risk-high)"/><span className="muted">Top concerns:</span><span>Irregular cycle · Low sleep · Fatigue · Cravings</span></div>
              <div className="hstack-8" style={{ fontSize: 12.5 }}><Icon name="sparkles" size={12} color="var(--accent)"/><span className="muted">Suggested:</span><span>Femina Vitality + Iron Boost (8-week plan)</span></div>
            </div>
          </div>
        </div>
      )}
      <div className="stack-12">
        <div className="section-title">Activity timeline</div>
        <div className="stack-12" style={{ paddingTop: 4 }}>
          {c.score !== undefined && (
            <div className="tl">
              <div className="fw5" style={{ fontSize: 13 }}>Completed health questionnaire</div>
              <div className="muted" style={{ fontSize: 12 }}>Score {c.score}/100 · {c.risk} risk · {c.category}</div>
              <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>{c.timestampLong}</div>
            </div>
          )}
          <div className="tl">
            <div className="fw5" style={{ fontSize: 13 }}>Tele-sales call · Karthik R.</div>
            <div className="muted" style={{ fontSize: 12 }}>Outcome: interested, sending plan over WhatsApp</div>
            <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>3 hours ago · 4:12 PM</div>
          </div>
          {c.orders > 0 && (
            <div className="tl">
              <div className="fw5" style={{ fontSize: 13 }}>Order #SU-45239 placed</div>
              <div className="muted" style={{ fontSize: 12 }}>2 items · Rs. {c.ltv?.toLocaleString()} · Prepaid</div>
              <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>Yesterday · 11:08 AM</div>
            </div>
          )}
          <div className="tl">
            <div className="fw5" style={{ fontSize: 13 }}>Profile created from quiz</div>
            <div className="muted" style={{ fontSize: 12 }}>Source: Instagram → Quiz landing page</div>
            <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>12 days ago</div>
          </div>
        </div>
      </div>

      <div className="stack-12">
        <div className="section-title">Address on file</div>
        <div className="card flat">
          <div style={{ fontSize: 13 }}>{c.address}<br/>{c.city}, {c.state} – <span className="num">{c.pincode}</span></div>
        </div>
      </div>

      {role === "doctor" && (
        <div className="stack-12">
          <div className="section-title">Clinical status</div>
          <div className="card flat hstack-8" style={{ background: "var(--surface-2)" }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: isConsulted ? 'var(--accent)' : 'var(--fg)' }}>
              <input type="checkbox" checked={isConsulted} onChange={(e) => setIsConsulted(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
              Consulted
            </label>
            <span className="spacer" />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: isPurchased ? 'var(--accent)' : 'var(--fg)' }}>
              <input type="checkbox" checked={isPurchased} onChange={(e) => setIsPurchased(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
              Purchased
            </label>
          </div>
          
          <div className="section-title" style={{ marginTop: 8 }}>Recommended treatment</div>
          <div className="card flat hstack-12" style={{ alignItems: "flex-start" }}>
             <img src="https://sehatup.com/cdn/shop/files/femina.png" alt="Femina Vitality" style={{ width: 48, height: 48, borderRadius: 8, background: "#fff", objectFit: "contain", border: "1px solid var(--border)" }} onError={(e) => { e.target.onerror = null; e.target.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 width%3D%2248%22 height%3D%2248%22%3E%3Crect width%3D%2248%22 height%3D%2248%22 fill%3D%22%23f3f4f6%22%2F%3E%3C%2Fsvg%3E'; }} />
             <div className="stack-2">
               <div className="fw5" style={{ fontSize: 13 }}>Femina Vitality + Iron Boost (8-week plan)</div>
               <div className="muted" style={{ fontSize: 12 }}>Rs. 1,299 · Qty: 1</div>
             </div>
          </div>
        </div>
      )}

      <DrawerFooter>
        {role === "doctor" ? (
          <>
            {c.reportDownloadUrl ? (
              <a href={c.reportDownloadUrl} target="_blank" rel="noopener noreferrer" className="btn" style={{textDecoration: 'none'}}>
                <Icon name="file_text" /> Show medical report
              </a>
            ) : (
              <button className="btn disabled" disabled><Icon name="file_text" /> Show medical report</button>
            )}
            <span className="spacer" />
            <button className="btn primary" onClick={() => { onClose(); setRoute && setRoute("doctor", { customer: c }); }}>
               <Icon name="file_plus" /> Create prescription
            </button>
          </>
        ) : (
          <>
            <button className="btn"><Icon name="phone" /> Call</button>
            <button className="btn"><Icon name="whatsapp" /> WhatsApp</button>
            <button className="btn"><Icon name="mail" /> Email</button>
            <span className="spacer" />
            <button className="btn primary" onClick={() => { onClose(); setRoute && setRoute("order_create", { customer: c }); }}><Icon name="package" /> Create order</button>
          </>
        )}
      </DrawerFooter>
    </Drawer>
  );
}

/* â”€â”€ Submission detail drawer (wide) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function SubmissionDrawer({ customer, onClose }) {
  if (!customer) return null;
  const D = window.SehatData;
  const c = customer;
  const Q = D.QUESTIONNAIRE;
  let qn = 0;
  return (
    <Drawer wide onClose={onClose} title={`Submission — ${c.name}`} subtitle={<>
      <span className="mono">{c.docId.slice(0, 18)}...</span> · Submitted {c.timestampLong}
    </>}>
      <div className="grid-12">
        <div className="span-4 col">
          <div className="card flat" style={{ background: "var(--surface-2)", display: "grid", placeItems: "center", padding: 22 }}>
            <Gauge value={c.score} size={148} stroke={12} label="Health score" big />
            <div style={{ marginTop: 12 }}><RiskBadge risk={c.risk} /></div>
          </div>
          <div className="card flat">
            <div className="section-title" style={{ marginBottom: 10 }}>Profile</div>
            <div className="stack-8">
              {[
                ["Name", c.name],
                ["Age", c.age + " yrs"],
                ["Gender", c.gender],
                ["Phone", c.phone],
                ["Category", c.category],
                ["Location", `${c.city}, ${c.state}`],
                ["Source", c.source],
              ].map(([k, v]) => (
                <div key={k} className="hstack-8" style={{ fontSize: 12.5 }}>
                  <span className="muted" style={{ width: 80 }}>{k}</span>
                  <span className="fw5">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card flat">
            <div className="section-title" style={{ marginBottom: 10 }}>Risk flags <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>· auto-detected</span></div>
            <div className="stack-8">
              {["Irregular periods", "Low sleep (<6 hrs)", "Suspected PCOS", "Persistent fatigue"].map(f => (
                <div key={f} className="hstack-8" style={{ fontSize: 12.5 }}>
                  <Icon name="flag" size={12} color="var(--risk-high)" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="span-8 col">
          {Q.sections.map(s => (
            <div key={s.name} className="card flat">
              <div className="hstack-8" style={{ marginBottom: 6 }}>
                <div className="section-title">{s.name}</div>
                <span className="muted" style={{ fontSize: 11.5 }}>· {s.qs.length} questions</span>
              </div>
              <div>
                {s.qs.map((qa, i) => {
                  qn += 1;
                  return (
                    <div key={i} className="ans-row">
                      <div className="qn mono">{String(qn).padStart(2, "0")}</div>
                      <div className="qa">
                        <div className="q">{qa.q}</div>
                        <div className="a">{qa.a}</div>
                      </div>
                      <div>
                        {qa.flag && <Badge tone="high" dot={"var(--risk-high)"}>flagged</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <DrawerFooter>
        <button className="btn"><Icon name="download" /> Export PDF</button>
        <button className="btn"><Icon name="copy" /> Copy link</button>
        <span className="spacer" />
        <button className="btn"><Icon name="stethoscope" /> Send to doctor</button>
        <button className="btn primary"><Icon name="package" /> Create order from this</button>
      </DrawerFooter>
    </Drawer>
  );
}

/* â”€â”€ Drawer shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function Drawer({ children, onClose, title, subtitle, wide }) {
  return (
    <>
      <div className="drawer-scrim on" onClick={onClose} />
      <aside className={"drawer on" + (wide ? " wide" : "")}>
        <div className="drawer-hd">
          <button className="iconbtn" onClick={onClose} title="Close"><Icon name="x" /></button>
          <div className="stack-2" style={{ flex: 1, minWidth: 0 }}>
            <div className="fw6" style={{ fontSize: 15, letterSpacing: "-0.01em" }}>{title}</div>
            {subtitle && <div className="muted" style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>}
          </div>
          <button className="iconbtn"><Icon name="external" /></button>
          <button className="iconbtn"><Icon name="more" /></button>
        </div>
        <div className="drawer-body">
          {children}
        </div>
      </aside>
    </>
  );
}

function DrawerFooter({ children }) {
  // Render via portal-ish trick: just append into the drawer-body, styled like a footer block
  return (
    <div className="card flat" style={{ position: "sticky", bottom: -22, marginTop: 8, background: "var(--surface)", borderTop: "1px solid var(--border)", borderRadius: 0, marginLeft: -22, marginRight: -22, marginBottom: -22, padding: "12px 22px" }}>
      <div className="hstack-8">{children}</div>
    </div>
  );
}




// --- screens-doctor.jsx ---
// screens-doctor.jsx — Doctor portal: queue + prescription / treatment plan composer



const NP_PROGRAMS = [
  { id: "Men's Sexual Wellness",     qid: "mens-wellness",   label: "Men's Wellness",   sub: "Sexual & hormonal",  icon: "user",  accent: "#0ea5e9" },
  { id: "Women's Wellness",          qid: "womens-wellness",  label: "Women's Wellness", sub: "Hormones & cycles",  icon: "heart", accent: "#f43f5e" },
  { id: "Men's Weight Management",   qid: "mens-weight",      label: "Men's Weight",     sub: "Metabolism & loss",  icon: "scale", accent: "#8b5cf6" },
  { id: "Women's Weight Management", qid: "womens-weight",    label: "Women's Weight",   sub: "Nutrition & weight", icon: "scale", accent: "#10b981" },
];
const NP_EMPTY = { name: '', phone: '', dob: '', reportCategory: '', height: '', currentWeight: '', targetWeight: '', gender: '' };

function CreateNewPatientModal({ isOpen, onClose, onUserCreated }) {
  const [formData, setFormData] = useState(NP_EMPTY);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const prog = NP_PROGRAMS.find(p => p.id === formData.reportCategory);
  const isWeight = formData.reportCategory.toLowerCase().includes('weight');
  const today = new Date().toISOString().slice(0, 10);

  const reset = () => { setFormData(NP_EMPTY); setErrors({}); };
  const close = () => { if (loading) return; reset(); onClose(); };

  const set = (key, val) => { setFormData(f => ({ ...f, [key]: val })); setErrors(e => ({ ...e, [key]: '' })); };

  const validate = () => {
    const e = {};
    if (!formData.reportCategory) e.reportCategory = 'Please select a program';
    if (!formData.name.trim())    e.name = 'Required';
    if (!/^\d{10}$/.test(formData.phone)) e.phone = 'Enter 10-digit number';
    if (!formData.gender) e.gender = 'Required';
    if (!formData.dob)    e.dob = 'Required';
    if (isWeight) {
      if (!formData.height)        e.height = 'Required';
      if (!formData.currentWeight) e.currentWeight = 'Required';
      if (!formData.targetWeight)  e.targetWeight = 'Required';
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || loading) return;
    setLoading(true);
    try {
      const data = {
        name: formData.name.trim(), userName: formData.name.trim(),
        phone: formData.phone, dob: formData.dob, gender: formData.gender,
        source: 'doctor_panel', status: 'Created by Doctor',
        reportCategory: formData.reportCategory, questionnaireId: prog?.qid || 'unknown',
        timestamp: serverTimestamp(), createdAt: serverTimestamp(), _collection: 'manual',
        height: isWeight ? Number(formData.height) : null,
        currentWeight: isWeight ? Number(formData.currentWeight) : null,
        targetWeight: isWeight ? Number(formData.targetWeight) : null,
      };
      const ref = await addDoc(collection(db, 'manual_submissions'), data);
      onUserCreated?.({ id: ref.id, ...data });
      reset(); onClose();
    } catch (err) {
      console.error(err);
      alert('Failed: ' + err.message);
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
    <div className="np-blur-layer" />
    <div className="np-backdrop" onClick={close}>
      <div className="np-modal" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="np-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="np-hdr-icon"><Icon name="user_plus" size={15} /></div>
            <div>
              <div className="np-title">New patient</div>
              <div className="np-subtitle">Manual record · Doctor panel</div>
            </div>
          </div>
          <button type="button" className="np-close" onClick={close}><Icon name="x" size={15} /></button>
        </div>

        {/* ── Two-panel body ── */}
        <form onSubmit={handleSubmit} className="np-panels">

          {/* LEFT — program list */}
          <div className="np-left">
            <div className="np-panel-label">Care program</div>
            {NP_PROGRAMS.map(p => {
              const isSel = formData.reportCategory === p.id;
              return (
                <button key={p.id} type="button"
                  className={`np-prog-item ${isSel ? 'sel' : ''}`}
                  style={{ '--npa': p.accent }}
                  onClick={() => {
                    set('reportCategory', p.id);
                    set('gender', p.id.toLowerCase().includes('women') ? 'Female' : 'Male');
                  }}>
                  <div className="np-prog-item-ic"><Icon name={p.icon} size={15} /></div>
                  <div className="np-prog-item-text">
                    <span className="np-prog-item-name">{p.label}</span>
                    <span className="np-prog-item-sub">{p.sub}</span>
                  </div>
                  {isSel && <div className="np-prog-item-dot" />}
                </button>
              );
            })}
            {errors.reportCategory && <div className="np-err-msg" style={{ marginTop: 4 }}>{errors.reportCategory}</div>}
          </div>

          {/* Vertical separator */}
          <div className="np-vsep" />

          {/* RIGHT — patient form */}
          <div className="np-right">
            <div className="np-panel-label">Patient details</div>

            <div className="field" style={{ marginBottom: 10 }}>
              <div className="lbl">Full name</div>
              <input className={`input ${errors.name ? 'np-err-input' : ''}`} type="text"
                placeholder="e.g. Rohan Sharma" value={formData.name}
                onChange={e => set('name', e.target.value)} />
              {errors.name && <div className="np-err-msg">{errors.name}</div>}
            </div>

            <div className="field" style={{ marginBottom: 10 }}>
              <div className="lbl">Phone</div>
              <div className={`np-phone-wrap ${errors.phone ? 'np-phone-err' : ''}`}>
                <span className="np-phone-prefix">+91</span>
                <input className="input np-phone-input" type="tel" inputMode="numeric"
                  placeholder="98765 XXXXX" maxLength="10" value={formData.phone}
                  onChange={e => set('phone', e.target.value.replace(/\D/g, ''))} />
              </div>
              {errors.phone && <div className="np-err-msg">{errors.phone}</div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div className="field">
                <div className="lbl">Gender</div>
                <select className={`select ${errors.gender ? 'np-err-input' : ''}`} value={formData.gender}
                  onChange={e => set('gender', e.target.value)}>
                  <option value="">Select…</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                {errors.gender && <div className="np-err-msg">{errors.gender}</div>}
              </div>
              <div className="field">
                <div className="lbl">Date of birth</div>
                <input className={`input ${errors.dob ? 'np-err-input' : ''}`} type="date" max={today}
                  value={formData.dob} onChange={e => set('dob', e.target.value)} />
                {errors.dob && <div className="np-err-msg">{errors.dob}</div>}
              </div>
            </div>

            {isWeight && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="field">
                    <div className="lbl">Height (cm)</div>
                    <input className={`input ${errors.height ? 'np-err-input' : ''}`} type="number" inputMode="numeric" placeholder="170"
                      value={formData.height} onChange={e => set('height', e.target.value)} />
                    {errors.height && <div className="np-err-msg">{errors.height}</div>}
                  </div>
                  <div className="field">
                    <div className="lbl">Current weight (kg)</div>
                    <input className={`input ${errors.currentWeight ? 'np-err-input' : ''}`} type="number" inputMode="numeric" placeholder="80"
                      value={formData.currentWeight} onChange={e => set('currentWeight', e.target.value)} />
                    {errors.currentWeight && <div className="np-err-msg">{errors.currentWeight}</div>}
                  </div>
                </div>
                <div className="field">
                  <div className="lbl">Target weight (kg)</div>
                  <input className={`input ${errors.targetWeight ? 'np-err-input' : ''}`} type="number" inputMode="numeric" placeholder="70"
                    value={formData.targetWeight} onChange={e => set('targetWeight', e.target.value)} />
                  {errors.targetWeight && <div className="np-err-msg">{errors.targetWeight}</div>}
                </div>
              </div>
            )}
          </div>

        </form>

        {/* ── Footer ── */}
        <div className="np-footer">
          <button type="button" className="btn ghost" onClick={close}>Cancel</button>
          <button type="submit" form="np-form-hidden" className="btn primary" disabled={loading}
            onClick={handleSubmit}>
            {loading ? <><Icon name="refresh" size={14} className="spin" /> Creating…</> : <><Icon name="user_plus" size={14} /> Create patient</>}
          </button>
        </div>

      </div>
    </div>
    </>,
    document.querySelector('.app') || document.body
  );
}

function DoctorScreen({ openCustomer, openSubmission, context }) {
  const [allData, setAllData] = useStateD({
      questionnaire_submissions: [], 
      partial_submissions: [],
      manual_submissions: [] 
  });
  const [loading, setLoading] = useStateD(true);
  
  const [searchQuery, setSearchQuery] = useStateD("");
  const [debouncedSearch, setDebouncedSearch] = useStateD("");
  
  const [selected, setSelected] = useStateD(context?.customer || null);
  const [tab, setTab] = useStateD("prescription");
  const [prefillPrescription, setPrefillPrescription] = useStateD(null);

  // Track consulted/purchased for the selected patient
  const [isConsultedState, setIsConsultedState] = useStateD(false);
  const [isPurchasedState, setIsPurchasedState] = useStateD(false);
  const [isSavingStatus, setIsSavingStatus] = useStateD(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
      setIsConsultedState(selected?.isConsulted || false);
      setIsPurchasedState(selected?.isPurchased || false);
  }, [selected]);

  const getCollectionName = (item) => {
      if (!item) return 'questionnaire_submissions';
      if (item._collection === 'full') return 'questionnaire_submissions';
      if (item._collection === 'partial') return 'partial_submissions';
      return 'manual_submissions';
  };

  const handleSaveConsultedState = async () => {
      if (!selected) return;
      setIsSavingStatus(true);
      const wasNotPurchased = !selected.isPurchased;
      try {
          const collName = getCollectionName(selected);
          const ref = doc(db, collName, selected.id);
          await updateDoc(ref, {
              isConsulted: isConsultedState,
              isPurchased: isPurchasedState,
              lastConsultedAt: serverTimestamp()
          });
          // Update the local selected object so UI reflects saved state
          setSelected(prev => ({ ...prev, isConsulted: isConsultedState, isPurchased: isPurchasedState }));

          // Fire order_placed webhook only when newly marked as purchased
          if (isPurchasedState && wasNotPurchased) {
              triggerOrderPlacedWebhook(
                  selected.userName || selected.name || 'Patient',
                  selected.phone || ''
              );
          }
      } catch (e) {
          console.error('Failed to save consulted/purchased:', e);
          alert('Failed to save status: ' + e.message);
      } finally {
          setIsSavingStatus(false);
      }
  };

  // Queue tab: 'pending' shows non-consulted, 'consulted' shows consulted
  const [queueTab, setQueueTab] = useStateD('pending');

  // Filter States
  const [showFilters, setShowFilters] = useStateD(false);
  const filterRef = React.useRef(null);
  const [activeCollection, setActiveCollection] = useStateD('all');
  const [purchasedOnly, setPurchasedOnly] = useStateD(false);
  const [whatsappOnly, setWhatsappOnly] = useStateD(false);
  const [myPatientsOnly, setMyPatientsOnly] = useStateD(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useStateD(false);

  // Pagination states
  const [renderedCount, setRenderedCount] = useStateD(20);

  // Click outside to close filters
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    function handleClickOutside(e) {
        if (filterRef.current && !filterRef.current.contains(e.target)) {
            setShowFilters(false);
        }
    }
    if (showFilters) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilters]);

  // Debounce search
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setRenderedCount(20); // reset on search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch all 3 collections
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    let loaded = 0;
    const checkLoaded = () => {
      loaded++;
      if (loaded >= 3) setLoading(false);
    };
    
    const q1 = query(collection(db, "questionnaire_submissions"), orderBy("timestamp", "desc"));
    const unsub1 = onSnapshot(q1, (snap) => {
        setAllData(prev => ({ ...prev, questionnaire_submissions: snap.docs.map(d => ({ id: d.id, ...d.data(), _collection: 'full' })) }));
        checkLoaded();
    }, (err) => { console.error(err); checkLoaded(); });

    const q2 = query(collection(db, "partial_submissions"), orderBy("timestamp", "desc"));
    const unsub2 = onSnapshot(q2, (snap) => {
        setAllData(prev => ({ ...prev, partial_submissions: snap.docs.map(d => ({ id: d.id, ...d.data(), _collection: 'partial' })) }));
        checkLoaded();
    }, (err) => { console.error(err); checkLoaded(); });

    const q3 = query(collection(db, "manual_submissions"));
    const unsub3 = onSnapshot(q3, (snap) => {
        setAllData(prev => ({ ...prev, manual_submissions: snap.docs.map(d => ({ id: d.id, ...d.data(), _collection: 'manual' })) }));
        checkLoaded();
    }, (err) => { console.error(err); checkLoaded(); });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  // Process and filter data
  const processedQueue = React.useMemo(() => {
      let combined = [
          ...allData.questionnaire_submissions,
          ...allData.partial_submissions,
          ...allData.manual_submissions
      ].map(val => {
          const score = val.healthScore !== undefined ? val.healthScore : null;
          const risk = score === null ? "Unknown" : (score <= 30 ? "Critical" : (score <= 60 ? "High" : (score <= 84 ? "Moderate" : "Low")));
          
          let ts = null;
          if (val.timestamp) {
              if (val.timestamp.toDate) ts = val.timestamp.toDate();
              else ts = new Date(val.timestamp);
          }
          
          let calcAge = val.age || "-";
          if (val.dob) {
              const bd = new Date(val.dob);
              if (!isNaN(bd)) {
                  const ageDifMs = Date.now() - bd.getTime();
                  const ageDate = new Date(ageDifMs);
                  calcAge = Math.abs(ageDate.getUTCFullYear() - 1970).toString();
              }
          }
          
          let calcGender = val.gender || "-";
          let calcCategory = val.primaryGoal;
          
          if (calcGender === "-" || calcGender === "Not Selected" || !calcCategory) {
              const qid = (val.questionnaireId || val.reportCategory || "").toLowerCase();
              if (calcGender === "-" || calcGender === "Not Selected") {
                  if (qid.includes('womens') || qid.includes("women's")) calcGender = "Female";
                  else if (qid.includes('mens')) calcGender = "Male";
              }
              if (!calcCategory) {
                  if (qid.includes('weight')) calcCategory = "Weight Management";
                  else if (qid.includes('wellness')) calcCategory = "Wellness";
                  else calcCategory = "General";
              }
          }
          
          return {
             ...val,
             id: val.id,
             name: val.name || val.userName || "Unknown",
             age: calcAge,
             gender: calcGender,
             phone: val.phone || "-",
             category: calcCategory || "General",
             score: score,
             risk: risk,
             city: val.city || "-", 
             state: val.state || "-",
             timestampObj: ts,
             timestampShort: ts ? ts.toLocaleDateString() : "-",
             avatarHue: Math.floor(Math.random()*360),
             answers: val.answers || {}
          };
      });

      // Type filter
      if (activeCollection !== 'all') {
          combined = combined.filter(s => s._collection === activeCollection);
      }

      // Status filters
      if (purchasedOnly) combined = combined.filter(s => s.isPurchased);
      if (whatsappOnly) combined = combined.filter(s => s.isWhatsAppSent);

      // Fuzzy Search
      if (debouncedSearch) {
          const q = debouncedSearch.toLowerCase();
          combined = combined.filter(s => {
              const nameMatch = (s.name || "").toLowerCase().includes(q);
              const phoneMatch = (s.phone || "").toLowerCase().includes(q);
              let responseMatch = false;
              if (s.answers && Array.isArray(s.answers)) {
                  responseMatch = s.answers.some(qa =>
                      (qa.question || "").toLowerCase().includes(q) ||
                      (qa.answer || "").toLowerCase().includes(q)
                  );
              } else if (s.answers && typeof s.answers === 'object') {
                  responseMatch = Object.values(s.answers).some(ans => 
                      (ans || "").toString().toLowerCase().includes(q)
                  );
              }
              return nameMatch || phoneMatch || responseMatch;
          });
      }

      // Sort by timestamp desc
      combined.sort((a, b) => {
          const timeA = a.timestampObj ? a.timestampObj.getTime() : 0;
          const timeB = b.timestampObj ? b.timestampObj.getTime() : 0;
          return timeB - timeA;
      });

      return combined;
  }, [allData, debouncedSearch, activeCollection, purchasedOnly, whatsappOnly]);

  const currentUid = auth?.currentUser?.uid;
  const pendingQueue = React.useMemo(() => processedQueue.filter(s => !s.isConsulted), [processedQueue]);
  const consultedQueue = React.useMemo(() => processedQueue.filter(s => s.isConsulted), [processedQueue]);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const reviewedToday = processedQueue.filter(c => {
    if (!c.lastConsultedAt) return false;
    const d = c.lastConsultedAt.toDate ? c.lastConsultedAt.toDate() : new Date(c.lastConsultedAt);
    return d >= todayStart;
  }).length;
  const criticalCount = pendingQueue.filter(c => c.risk === 'Critical' || c.risk === 'High').length;
  const purchasedToday = processedQueue.filter(c => {
    if (!c.isPurchased || !c.lastConsultedAt) return false;
    const d = c.lastConsultedAt.toDate ? c.lastConsultedAt.toDate() : new Date(c.lastConsultedAt);
    return d >= todayStart;
  }).length;

  // my_prescriptions patient IDs
  const [myPatientIds, setMyPatientIds] = useStateD(new Set());
  const [myPatientsLoading, setMyPatientsLoading] = useStateD(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!myPatientsOnly || !currentUid) return;
    setMyPatientsLoading(true);

    console.group('%c[MyPatients] Fetching my_prescriptions', 'color:#a78bfa;font-weight:bold');
    console.log('currentUid:', currentUid);
    console.log('Path: users/' + currentUid + '/my_prescriptions');
    console.groupEnd();

    const unsub = onSnapshot(
      collection(db, 'users', currentUid, 'my_prescriptions'),
      snap => {
        console.group('%c[MyPatients] my_prescriptions snapshot', 'color:#34d399;font-weight:bold');
        console.log('Total prescription docs in my_prescriptions:', snap.docs.length);

        const ids = new Set();
        snap.docs.forEach(d => {
          const data = d.data();
          const pid = data.patientId;
          console.log(`  doc ${d.id} → patientId: ${pid}, patient: ${data.patientName}, date: ${data.consultationDate}`);
          if (pid) ids.add(pid);
        });

        console.log('Unique patientIds collected:', [...ids]);
        console.groupEnd();

        setMyPatientIds(ids);
        setMyPatientsLoading(false);
      },
      err => {
        console.group('%c[MyPatients] ERROR fetching my_prescriptions', 'color:#f87171;font-weight:bold');
        console.error('code:', err.code, '| message:', err.message);
        console.error(err);
        console.groupEnd();
        setMyPatientsLoading(false);
      }
    );
    return unsub;
  }, [myPatientsOnly, currentUid]);

  const myPatientsQueue = React.useMemo(() => {
    if (!myPatientsOnly || myPatientIds.size === 0) return [];
    const result = processedQueue.filter(s => myPatientIds.has(s.id));
    console.log('%c[MyPatients] Queue filtered by my_prescriptions patientIds', 'color:#60a5fa;font-weight:bold',
      { totalPatients: processedQueue.length, myPatientIdsCount: myPatientIds.size, matchedPatients: result.length,
        matched: result.map(s => ({ id: s.id, name: s.userName || s.name })) });
    return result;
  }, [myPatientsOnly, myPatientIds, processedQueue]);

  const activeQueue = React.useMemo(() => {
    if (myPatientsOnly) return myPatientsQueue;
    if (queueTab === 'pending') return pendingQueue;
    return consultedQueue;
  }, [queueTab, myPatientsOnly, pendingQueue, consultedQueue, myPatientsQueue]);

  // Set initial selected
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
      if (!loading && pendingQueue.length > 0 && !selected) {
          if (context?.customer) {
              setSelected(context.customer);
          } else {
              setSelected(pendingQueue[0] || processedQueue[0]);
          }
      }
  }, [loading, pendingQueue, processedQueue, selected, context]);

  const handleScroll = (e) => {
      const bottom = e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 50;
      if (bottom && renderedCount < activeQueue.length) {
          setRenderedCount(prev => prev + 20);
      }
  };

  const visibleQueue = activeQueue.slice(0, renderedCount);

  if (!selected && loading) {
    return <div className="col fade-in"><div className="page-head"><h1 className="page-title">Clinical review</h1><p className="page-sub">Syncing with Firestore...</p></div></div>;
  }
  if (!selected && !loading && processedQueue.length === 0) {
    return <div className="col fade-in"><div className="page-head"><h1 className="page-title">Clinical review</h1><p className="page-sub">No patients found.</p></div></div>;
  }

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Clinical review</h1>
          <p className="page-sub">{pendingQueue.length} pending · {consultedQueue.length} consulted</p>
        </div>
        <div className="page-head-actions">
          <div className="filterbar">
            <span className="chip"><Icon name="flag" /> Critical & High <Icon name="chevron_down" /></span>
            <span className="chip"><Icon name="calendar" /> Today <Icon name="chevron_down" /></span>
          </div>
          <button
            onClick={() => { setMyPatientsOnly(p => !p); setMyPatientIds(new Set()); }}
            style={myPatientsOnly ? { background: 'rgba(124,58,237,0.12)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.35)', fontWeight: 600 } : {}}
            className="btn"
          ><Icon name="users" /> {myPatientsLoading ? 'Loading…' : 'My patients'}</button>
          <button className="btn primary" onClick={() => setIsCreateModalOpen(true)}><Icon name="user_plus" /> New patient</button>
        </div>
      </div>

      <div className="grid-12">
        <div className="span-3"><KPI label="In queue" value={processedQueue.length} icon="inbox" /></div>
        <div className="span-3"><KPI label="Reviewed today" value={reviewedToday} icon="check" /></div>
        <div className="span-3"><KPI label="Pending critical" value={criticalCount} icon="flag" /></div>
        <div className="span-3"><KPI label="Purchased today" value={purchasedToday} icon="trend_up" /></div>
      </div>

      <div className="grid-12" style={{ flex: 1, minHeight: 0 }}>
        {/* Queue list */}
        <div className="span-4 card" style={{ padding: 0, display: "flex", flexDirection: "column", maxHeight: 720 }}>
          <div style={{ borderBottom: "1px solid var(--border)", position: 'relative' }}>
            {/* Pending / Consulted tabs — hidden when My Patients active */}
            {myPatientsOnly ? (
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#7c3aed' }}>My Patients</span>
                <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(124,58,237,0.1)', color: '#7c3aed', padding: '1px 7px', borderRadius: 100 }}>{myPatientsQueue.length}</span>
              </div>
            ) : (
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                {[
                    { key: 'pending',   label: 'Pending',   count: pendingQueue.length },
                    { key: 'consulted', label: 'Consulted', count: consultedQueue.length },
                ].map(t => (
                    <button key={t.key} onClick={() => { setQueueTab(t.key); setRenderedCount(20); }}
                        style={{ flex: 1, padding: '10px 0', fontSize: 12.5, fontWeight: queueTab === t.key ? 600 : 400, color: queueTab === t.key ? 'var(--accent)' : 'var(--muted)', background: 'none', border: 'none', borderBottom: queueTab === t.key ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: -1 }}>
                        {t.label}
                        <span style={{ fontSize: 11, fontWeight: 600, background: queueTab === t.key ? 'var(--accent-soft)' : 'var(--surface-3)', color: queueTab === t.key ? 'var(--accent-ink)' : 'var(--muted)', padding: '1px 7px', borderRadius: 100 }}>{t.count}</span>
                    </button>
                ))}
            </div>
            )}
            <div style={{ padding: "10px 14px" }}>
                <div style={{ position: 'relative' }} ref={filterRef}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <div style={{ position: 'absolute', left: 10, top: 9, color: 'var(--muted)', display: 'flex' }}>
                                <Icon name="search" size={14} />
                            </div>
                            <input
                                className="input"
                                placeholder="Search name, phone..."
                                style={{ paddingLeft: 32, borderRadius: 8 }}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button className="btn sm ghost" onClick={() => setShowFilters(!showFilters)} style={{ position: 'relative', flexShrink: 0 }}>
                            <Icon name="filter" />
                            {(activeCollection !== 'all' || purchasedOnly || whatsappOnly) && (
                                <div style={{ position: 'absolute', top: 2, right: 2, width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%' }} />
                            )}
                        </button>
                    </div>
                    {showFilters && (
                        <div className="card shadow" style={{ position: 'absolute', top: '100%', right: 0, width: 210, zIndex: 100, padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source</div>
                                {(activeCollection !== 'all' || purchasedOnly || whatsappOnly) && (
                                    <button onClick={() => { setActiveCollection('all'); setPurchasedOnly(false); setWhatsappOnly(false); }} style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear all</button>
                                )}
                            </div>
                            <div className="hstack-8" style={{ flexWrap: 'wrap', gap: 6 }}>
                                {[['all','All'],['full','Completed'],['partial','Partial'],['manual','Manual']].map(([v,l]) => (
                                    <Badge key={v} tone={activeCollection === v ? 'high' : ''} className="clickable" style={{ cursor: 'pointer' }} onClick={() => setActiveCollection(v)}>{l}</Badge>
                                ))}
                            </div>
                            <div className="divider" style={{ margin: '2px 0' }} />
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
                            <div className="hstack-8" style={{ flexWrap: 'wrap', gap: 6 }}>
                                <Badge tone={purchasedOnly ? 'high' : ''} className="clickable" style={{ cursor: 'pointer' }} onClick={() => setPurchasedOnly(!purchasedOnly)}>Purchased</Badge>
                                <Badge tone={whatsappOnly ? 'high' : ''} className="clickable" style={{ cursor: 'pointer' }} onClick={() => setWhatsappOnly(!whatsappOnly)}>WhatsApp</Badge>
                            </div>
                        </div>
                    )}
                </div>
            </div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }} onScroll={handleScroll}>
            {visibleQueue.map(c => (
              <div key={c.id} onClick={() => setSelected(c)}
                style={{
                  padding: "12px 14px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex", gap: 10,
                  background: selected?.id === c.id ? "var(--accent-soft)" : "transparent",
                  cursor: "pointer",
                  borderLeft: selected?.id === c.id ? "2px solid var(--accent)" : "2px solid transparent",
                }}>
                <Avatar name={c.name} hue={c.avatarHue} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <div className="fw5" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{c.name}</div>
                    <RiskBadge risk={c.risk} style={{ flexShrink: 0 }} />
                  </div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                    <span className="num">{c.age}</span> · {c.gender} · {c.category}
                  </div>
                  <div className="hstack-8" style={{ marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
                    <Icon name="clock" size={10} /> <span className="num">{c.timestampShort}</span>
                    {c._collection !== 'full' && <span style={{ background: 'var(--surface-3)', padding: '2px 6px', borderRadius: 4, fontSize: 9 }}>{c._collection}</span>}
                    {c.isWhatsAppSent && <span style={{ background: 'rgba(37,211,102,0.12)', color: '#15803d', padding: '2px 6px', borderRadius: 4, fontSize: 9, display: 'flex', alignItems: 'center', gap: 3 }}><Icon name="whatsapp" size={9} /> WA</span>}
                  </div>
                </div>
                {c.score !== null ? (
                    <Gauge value={c.score} size={42} stroke={4} showLabel={false} />
                ) : (
                    <div style={{ width: 42, height: 42, borderRadius: '50%', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>N/A</div>
                )}
              </div>
            ))}
            {renderedCount < activeQueue.length && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                    Loading more...
                </div>
            )}
          </div>
        </div>

        {/* Detail / composer */}
        <div className="span-8 col">
          {selected && (
              <>
                <div className="card" style={{ padding: "18px 20px" }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                        <Avatar name={selected.name} hue={selected.avatarHue} size="lg" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="hstack-8" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
                                <span className="fw6" style={{ fontSize: 18, letterSpacing: "-0.01em" }}>{selected.name}</span>
                                {selected.risk !== "Unknown" && <RiskBadge risk={selected.risk} />}
                            </div>
                            <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                                {selected.age} yr · {selected.gender} · <span className="num">{selected.phone}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500, padding: '4px 12px', borderRadius: 100, background: isConsultedState ? 'var(--accent-soft)' : 'var(--surface-3)', color: isConsultedState ? 'var(--accent-ink)' : 'var(--muted)', transition: 'all 0.15s' }}>
                                    <input type="checkbox" checked={isConsultedState} onChange={e => setIsConsultedState(e.target.checked)} style={{ accentColor: 'var(--accent)', margin: 0 }} />
                                    Consulted
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500, padding: '4px 12px', borderRadius: 100, background: isPurchasedState ? '#dcfce7' : 'var(--surface-3)', color: isPurchasedState ? '#15803d' : 'var(--muted)', transition: 'all 0.15s' }}>
                                    <input type="checkbox" checked={isPurchasedState} onChange={e => setIsPurchasedState(e.target.checked)} style={{ accentColor: '#16a34a', margin: 0 }} />
                                    Purchased
                                </label>
                                <button className="btn sm primary" onClick={handleSaveConsultedState} disabled={isSavingStatus} style={{ padding: '4px 12px', fontSize: 12 }}>
                                    {isSavingStatus ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </div>
                        {selected.score !== null ? (
                            <Gauge value={selected.score} size={80} stroke={8} label="Score" />
                        ) : (
                            <div style={{ width: 80, height: 80, borderRadius: '50%', border: '3px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--muted)', flexShrink: 0 }}>
                                <span style={{ fontSize: 20, fontWeight: 600 }}>N/A</span>
                                <span style={{ fontSize: 11 }}>Score</span>
                            </div>
                        )}
                    </div>
                    {(selected.symptoms?.length > 0 || selected.tags?.length > 0) && (
                        <>
                            <div className="divider" style={{ margin: "14px 0" }} />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {(selected.symptoms || selected.tags || []).map(s => (
                                    <Badge key={s} tone="high" dot="var(--risk-high)">{s}</Badge>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="card" style={{ padding: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', padding: "10px 16px", borderBottom: "1px solid var(--border)", gap: 8 }}>
                        <Tabs value={tab} onChange={setTab} items={[
                            { label: "Prescription", value: "prescription" },
                            { label: "Assessment", value: "assessment" },
                            { label: "History", value: "history" },
                        ]} />
                        <span className="spacer" />
                    </div>

                    {tab === "prescription" && <PrescriptionComposer customer={selected} prefillOverride={prefillPrescription} onPrefillConsumed={() => setPrefillPrescription(null)} />}
                    {tab === "assessment" && <AssessmentInline customer={selected} />}
                    {tab === "history" && <HistoryInline customer={selected} onUsePrescription={data => { setPrefillPrescription(data); setTab('prescription'); }} />}
                </div>

                <div className="hstack-8">
                    <button className="btn"><Icon name="message" /> Send to patient</button>
                    <button className="btn"><Icon name="whatsapp" /> WhatsApp summary</button>
                </div>
              </>
          )}
        </div>
      </div>

      <CreateNewPatientModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onUserCreated={(newUser) => {
          setAllData(prev => ({
            ...prev,
            manual_submissions: [newUser, ...prev.manual_submissions]
          }));
          setIsCreateModalOpen(false);
        }}
      />
    </div>
  );
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function MiniDatePicker({ value, onChange, placeholder = 'Select date' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const parsed = value ? new Date(value + 'T00:00:00') : null;
  const [viewYear, setViewYear] = useState((parsed || new Date()).getFullYear());
  const [viewMonth, setViewMonth] = useState((parsed || new Date()).getMonth());

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const displayStr = parsed
    ? parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : placeholder;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();

  const prevMonth = () => viewMonth === 0 ? (setViewMonth(11), setViewYear(y => y - 1)) : setViewMonth(m => m - 1);
  const nextMonth = () => viewMonth === 11 ? (setViewMonth(0), setViewYear(y => y + 1)) : setViewMonth(m => m + 1);

  const handleSelect = (day) => {
    const d = new Date(viewYear, viewMonth, day);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    onChange(iso);
    setOpen(false);
  };

  const today = new Date();

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="input" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none', gap: 8 }}
        onClick={() => setOpen(o => !o)}>
        <span style={{ flex: 1, fontSize: 13, color: parsed ? 'var(--fg)' : 'var(--faint)' }}>{displayStr}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 300, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', width: 236, minWidth: 236 }}>
          {/* Month / Year nav */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <button onClick={prevMonth} style={{ background: 'var(--surface-2)', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '3px 8px', color: 'var(--fg)', fontSize: 16, lineHeight: 1 }}>‹</button>
            <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>{MONTHS_SHORT[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth} style={{ background: 'var(--surface-2)', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '3px 8px', color: 'var(--fg)', fontSize: 16, lineHeight: 1 }}>›</button>
          </div>

          {/* Weekday row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {WEEKDAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--muted)', padding: '2px 0' }}>{d}</div>
            ))}
          </div>

          {/* Date grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={'e' + i} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const sel = parsed && parsed.getDate() === day && parsed.getMonth() === viewMonth && parsed.getFullYear() === viewYear;
              const tod = today.getDate() === day && today.getMonth() === viewMonth && today.getFullYear() === viewYear;
              return (
                <button key={day} onClick={() => handleSelect(day)} style={{
                  textAlign: 'center', fontSize: 12.5, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: sel ? 'var(--accent)' : tod ? 'var(--accent-soft)' : 'transparent',
                  color: sel ? '#fff' : tod ? 'var(--accent)' : 'var(--fg)',
                  fontWeight: sel ? 700 : tod ? 600 : 400,
                }}>
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8, textAlign: 'center' }}>
            <button onClick={() => handleSelect(today.getDate())} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const DIET_TEMPLATES = {
  lean_to_weight_gain:       { label: "PCOD – Lean Type (Weight Gain)",            advice: [] },
  weight_to_lean:            { label: "PCOD – Overweight Type (Weight Loss)",       advice: [] },
  infertility_pcod_pcos:     { label: "PCOD – Infertility & Irregular Periods",     advice: [] },
  thyroid_diabetes_pcod:     { label: "PCOD – Thyroid + Diabetes (Leucorrhea)",     advice: [] },
  pcod_mood_anxiety_insomnia:{ label: "PCOD – Mood Swings, Anxiety & Insomnia",     advice: [] },
  general_pcod_pcos:         { label: "PCOD – General (Irregular Periods)",         advice: [] },
};

function PrescriptionComposer({ customer, prefillOverride, onPrefillConsumed }) {
  const { hasPermission } = usePermissions();
  const canSign = hasPermission('can_generate_prescription');
  const [patientName, setPatientName] = useStateD(customer?.name || "");
  const [patientGender, setPatientGender] = useStateD(customer?.gender || "Not Selected");
  const [patientAge, setPatientAge] = useStateD(() => {
      if (customer?.dob) {
          const bd = new Date(customer.dob);
          const ageDifMs = Date.now() - bd.getTime();
          const ageDate = new Date(ageDifMs);
          return Math.abs(ageDate.getUTCFullYear() - 1970).toString();
      }
      return customer?.age || "";
  });
  const [numericPatientId, setNumericPatientId] = useStateD("");
  const [consultationDate, setConsultationDate] = useStateD(new Date().toISOString().split('T')[0]);
  const [followUpDate, setFollowUpDate] = useStateD("");
  
  // Clinical Diagnosis States
  const [prescriptionTemplate, setPrescriptionTemplate] = useStateD("");
  const [primaryDiagnosis, setPrimaryDiagnosis] = useStateD(customer?.doctorComments || customer?.primaryDiagnosis || "");
  const [clinicalFindings, setClinicalFindings] = useStateD("");
  const [lifestyleAdvice, setLifestyleAdvice] = useStateD(() => {
      if (customer?.lifestyleChanges && Array.isArray(customer.lifestyleChanges)) {
          return customer.lifestyleChanges.map(l => l.text || l).join('\n');
      }
      const initial = [];
      if (customer?.dietAdvice) initial.push(customer.dietAdvice);
      if (customer?.lifestyleAdvice) initial.push(customer.lifestyleAdvice);
      return initial.join('\n');
  });

  // Load next Prescription ID on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
      const fetchNextId = async () => {
          try {
              const counterSnap = await getDoc(doc(db, 'metadata', 'counters'));
              if (counterSnap.exists()) {
                  setNumericPatientId((counterSnap.data().prescriptionId + 1).toString());
              } else {
                  setNumericPatientId("1000");
              }
          } catch (e) {
              console.error('Failed to fetch prescription counter:', e);
          }
      };
      if (!customer?.prescriptionId && !numericPatientId) {
          fetchNextId();
      }
  }, []);

  // Normalize a product (from saved prescription or questionnaire) into the items shape
  const toItem = (prod) => ({
    name:           prod.name || '',
    image:          prod.image || '',
    productId:      prod.productId || '',
    variantId:      prod.variantId || '',
    qty:            prod.qty || 1,
    dosageType:     prod.dosageType || 'schedule',
    dosage:         prod.dosage || ['0', '0', '0', '0'],
    dosageValue:    prod.dosageValue || '',
    dosageFrequency:prod.dosageFrequency || '',
    detailsHeader:  prod.detailsHeader || (prod.type || prod.timing ? [prod.type, prod.timing].filter(Boolean).join(' | ') : ''),
    detailsSubtext: prod.detailsSubtext || prod.instruction || '',
    durationValue:  prod.durationValue || 1,
    durationUnit:   prod.durationUnit || 'month',
  });

  // Load latest saved prescription from subcollection to prefill lifestyle, diagnosis & products
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
      if (!customer?.id || !customer?._collection) return;
      const collName = customer._collection === 'full' ? 'questionnaire_submissions'
          : customer._collection === 'partial' ? 'partial_submissions'
          : 'manual_submissions';
      const loadLatest = async () => {
          try {
              const q = query(
                  collection(db, `${collName}/${customer.id}/prescriptions`),
                  orderBy('savedAt', 'desc'),
                  limit(1)
              );
              const snap = await getDocs(q);
              if (!snap.empty) {
                  // Has prescription history — prefill from last prescription
                  const latest = snap.docs[0].data();
                  if (latest.lifestyleAdvice) {
                      setLifestyleAdvice(Array.isArray(latest.lifestyleAdvice)
                          ? latest.lifestyleAdvice.join('\n')
                          : latest.lifestyleAdvice);
                  }
                  if (latest.primaryDiagnosis || latest.doctorComments) {
                      setPrimaryDiagnosis(latest.primaryDiagnosis || latest.doctorComments);
                  }
                  if (Array.isArray(latest.recommendedProducts) && latest.recommendedProducts.length > 0) {
                      setItems(latest.recommendedProducts.map(toItem));
                  }
              } else {
                  // No prescription history — prefill products from questionnaire data
                  if (Array.isArray(customer.recommendedProducts) && customer.recommendedProducts.length > 0) {
                      setItems(customer.recommendedProducts.map(toItem));
                  }
              }
          } catch (e) {
              console.warn('Could not load latest prescription:', e.message);
          }
      };
      loadLatest();
  }, [customer?.id]);

  const [items, setItems] = useStateD([]);

  // Apply prefill from History tab "Use as template"
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!prefillOverride) return;
    if (prefillOverride.primaryDiagnosis !== undefined) setPrimaryDiagnosis(prefillOverride.primaryDiagnosis || '');
    if (prefillOverride.clinicalFindings !== undefined) setClinicalFindings(prefillOverride.clinicalFindings || '');
    if (prefillOverride.prescriptionTemplate !== undefined) setPrescriptionTemplate(prefillOverride.prescriptionTemplate || '');
    if (Array.isArray(prefillOverride.lifestyleChanges)) {
      setLifestyleAdvice(prefillOverride.lifestyleChanges.map(l => l.text || l).join('\n'));
    }
    if (Array.isArray(prefillOverride.recommendedProducts) && prefillOverride.recommendedProducts.length > 0) {
      setItems(prefillOverride.recommendedProducts.map(toItem));
    }
    onPrefillConsumed?.();
  }, [prefillOverride]);

  // Product Search State
  const [productSearch, setProductSearch] = useStateD("");
  const [searchResults, setSearchResults] = useStateD([]);
  const [isSearchingProducts, setIsSearchingProducts] = useStateD(false);

  const normalizeSearchText = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const fetchProducts = useCallback(async (term) => {
    setIsSearchingProducts(true);
    try {
      const cleanTerm = term.replace(/"/g, '\\"');
      const query = `{
        products(first: 15, query: "${cleanTerm}*") {
          edges {
            node {
              id
              title
              handle
              featuredImage { url }
              variants(first: 50) {
                edges {
                  node {
                    id
                    title
                    sku
                    price
                  }
                }
              }
            }
          }
        }
      }`;

      const res = await fetch('/shopify-v2/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();

      if (data.errors) {
        setSearchResults([]);
        return;
      }

      const products = (data?.data?.products?.edges || []).map(edge => {
        const node = edge.node;
        return {
          id: parseInt(node.id.split('/').pop(), 10) || node.id,
          title: node.title,
          handle: node.handle,
          image: node.featuredImage?.url || null,
          variants: (node.variants?.edges || []).map(vEdge => {
            const vNode = vEdge.node;
            return {
              id: parseInt(vNode.id.split('/').pop(), 10) || vNode.id,
              title: vNode.title,
              sku: vNode.sku || '',
              price: Math.round(parseFloat(vNode.price) * 100),
            };
          }),
        };
      });

      const tokens = normalizeSearchText(term).split(/\s+/).filter(Boolean);
      const strictMatches = products.filter(product => {
        if (!product.variants?.length) return false;
        const searchable = normalizeSearchText([
          product.title,
          product.handle,
          ...product.variants.flatMap(variant => [variant.title, variant.sku]),
        ].join(" "));
        return tokens.every(token => searchable.includes(token));
      });

      setSearchResults(strictMatches);
    } catch (err) {
      setSearchResults([]);
    } finally {
      setIsSearchingProducts(false);
    }
  }, [setIsSearchingProducts, setSearchResults]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const term = productSearch.trim();
      if (term.length > 1) fetchProducts(term);
      else setSearchResults([]);
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchProducts, productSearch, setSearchResults]);

  const toggleProduct = (product, variant) => {
      const vid = variant ? variant.id : null;
      const existingIdx = items.findIndex(it => it.variantId === vid && it.productId === product.id);
      
      if (existingIdx >= 0) {
          setItems(prev => prev.filter((_, i) => i !== existingIdx));
      } else {
          setItems(prev => [...prev, {
              name: variant && variant.title !== "Default Title" ? `${product.title} - ${variant.title}` : product.title,
              dose: "",
              freq: "",
              durationValue: 1,
              durationUnit: "month",
              productId: product.id,
              variantId: vid,
              image: product.image,
              qty: 1
          }]);
          setProductSearch("");
          setSearchResults([]);
      }
  };

  const removeItem = (index) => {
      setItems(prev => prev.filter((_, i) => i !== index));
  };
  
  // Helper for gender detection
  const detectGender = (name) => {
    if (!name) return "";
    const lower = name.toLowerCase();
    if (lower.includes('womens') || lower.includes("women's")) return 'Female';
    if (lower.includes('mens')) return 'Male';
    return "";
  };

  // Keep fields synced & auto-detect if customer changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (customer?.name) setPatientName(customer.name);

    // Age Detection
    if (customer?.dob) {
      const bd = new Date(customer.dob);
      const ageDifMs = Date.now() - bd.getTime();
      const ageDate = new Date(ageDifMs);
      const calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);
      setPatientAge(calculatedAge > 0 ? calculatedAge.toString() : (customer?.age || ""));
    } else if (customer?.age) {
      setPatientAge(customer.age);
    }

    // Gender Detection
    if (customer?.gender && customer.gender !== "Not Selected") {
      setPatientGender(customer.gender);
    } else {
      const contextString = [
        customer?.reportCategory,
        customer?.source,
        ...(customer?.tags || [])
      ].filter(Boolean).join(' ');
      const detected = detectGender(contextString);
      setPatientGender(detected || "Not Selected");
    }

    // Lifestyle Changes — repopulate from questionnaire data when patient switches
    if (customer?.lifestyleChanges && Array.isArray(customer.lifestyleChanges) && customer.lifestyleChanges.length > 0) {
      setLifestyleAdvice(customer.lifestyleChanges.map(l => l.text || l).join('\n'));
    } else {
      const initial = [];
      if (customer?.dietAdvice) initial.push(customer.dietAdvice);
      if (customer?.lifestyleAdvice) initial.push(customer.lifestyleAdvice);
      setLifestyleAdvice(initial.join('\n'));
    }

    // Primary diagnosis
    if (customer?.primaryDiagnosis || customer?.doctorComments) {
      setPrimaryDiagnosis(customer.primaryDiagnosis || customer.doctorComments);
    } else {
      setPrimaryDiagnosis('');
    }

    // Reset template, findings & products for new patient (loadLatest will repopulate products)
    setPrescriptionTemplate('');
    setClinicalFindings('');
    setItems([]);
  }, [customer?.id]);

  const [isSaving, setIsSaving] = useStateD(false);
  const [saveStatus, setSaveStatus] = useStateD(null); // null | 'success' | 'error'
  const [savedCartLink, setSavedCartLink] = useStateD('');
  const [copiedCart, setCopiedCart] = useStateD(false);

  const collectionName = customer?._collection === 'full' ? 'questionnaire_submissions'
    : customer?._collection === 'partial' ? 'partial_submissions'
    : 'manual_submissions';

  const handleApproveSign = async () => {
    if (!patientName.trim()) { alert('Patient name is required.'); return; }
    if (!patientGender || patientGender === 'Not Selected') { alert('Please select the patient\'s gender.'); return; }
    if (!customer?.id) { alert('No patient selected.'); return; }
    setIsSaving(true);
    setSaveStatus(null);
    let docId = null;
    try {
      const prescriptionData = {
        patientId: customer.id,
        numericPatientId,
        patientName,
        patientGender,
        patientAge,
        phone: customer.phone || '',
        reportCategory: customer.reportCategory || '',
        primaryDiagnosis,
        clinicalFindings,
        prescriptionTemplate: prescriptionTemplate || null,
        consultationDate,
        followUpDate: followUpDate || null,
        lifestyleChanges: (lifestyleAdvice || '').split('\n').filter(l => l.trim()).map(text => ({ text })),
        recommendedProducts: items.map(it => {
          let frequency;
          if (it.dosageType === 'drops') {
            frequency = `${it.dosageValue || '5'} Drops - ${it.dosageFrequency || '2'} Times a day`;
          } else if (it.dosageType === 'topical') {
            frequency = it.dosageValue || 'Apply as directed';
          } else {
            frequency = Array.isArray(it.dosage) ? it.dosage.join(' - ') : '';
          }
          return {
            ...it,
            frequency,
            duration: `${it.durationValue || 1} ${it.durationUnit || 'month'}${(it.durationValue || 1) > 1 ? 's' : ''}`,
            type: it.detailsHeader?.split('|')?.[0]?.trim() || 'TABLET',
            timing: it.detailsHeader?.split('|')?.[1]?.trim() || 'As directed',
            instruction: it.detailsSubtext || '',
            dosageType: it.dosageType || 'schedule',
          };
        }),
        submissionCollectionName: collectionName,
        doctorUid: auth?.currentUser?.uid || '',
        timestamp: serverTimestamp(),
      };

      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'metadata', 'counters');
        const counterDoc = await transaction.get(counterRef);
        const currentSystemId = counterDoc.exists() ? (counterDoc.data().prescriptionId || 999) : 999;
        let nextId;
        if (numericPatientId && !isNaN(parseInt(numericPatientId, 10))) {
          nextId = parseInt(numericPatientId, 10);
        } else {
          nextId = currentSystemId + 1;
        }
        const newCounterValue = Math.max(currentSystemId, nextId);
        const prescriptionID = `RX-${nextId}`;

        const newPrescriptionRef = doc(collection(db, 'prescriptions'));
        docId = newPrescriptionRef.id;
        const patientRef = doc(db, collectionName, customer.id);
        const patientPrescriptionRef = doc(collection(patientRef, 'prescriptions'), docId);
        const finalData = { ...prescriptionData, sequentialId: nextId, prescriptionID };

        transaction.set(counterRef, { prescriptionId: newCounterValue }, { merge: true });
        transaction.set(newPrescriptionRef, finalData);
        const doctorName = auth?.currentUser?.displayName
          || auth?.currentUser?.email?.split('@')[0]?.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          || 'Doctor';
        transaction.update(patientRef, {
          userName: patientName,
          isConsulted: true,
          lastConsultedAt: serverTimestamp(),
          lastConsultationDiagnosis: primaryDiagnosis,
          latestPrescriptionId: docId,
          consultedByUid: auth?.currentUser?.uid || '',
          consultedByName: doctorName,
        });
        transaction.set(patientPrescriptionRef, { ...finalData, docId, savedAt: serverTimestamp() });
        // Also write to doctor's personal my_prescriptions subcollection
        if (auth?.currentUser?.uid) {
          const myPrescRef = doc(db, 'users', auth.currentUser.uid, 'my_prescriptions', docId);
          transaction.set(myPrescRef, { ...finalData, docId, savedAt: serverTimestamp() });
        }
      });

      // Trigger PDF generation on local dev
      if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
        const projectId = auth?.app?.options?.projectId || 'sehatup-f96b5';
        const targetEnv = projectId.includes('dev') ? 'dev' : 'live';
        fetch(`http://localhost:5505/generatePrescriptionPDF?docId=${docId}&env=${targetEnv}`).catch(() => {});
      }

      // Poll for prescriptionDownloadUrl + cartUrl, update UI and fire webhook (fire-and-forget)
      const savedDocId = docId;
      const patientPhone = customer?.phone || '';
      setSavedCartLink('');
      (async () => {
        let webhookFired = false;
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 3000));
          try {
            const snap = await getDoc(doc(db, 'prescriptions', savedDocId));
            if (snap.exists()) {
              const data = snap.data();
              const cart = data.cartUrl || data.cartLink || '';
              if (cart) setSavedCartLink(cart);
              if (data.prescriptionDownloadUrl && !webhookFired) {
                webhookFired = true;
                triggerHealthKitReadyWebhook(
                  patientName,
                  patientPhone,
                  cart,
                  data.prescriptionDownloadUrl
                );
                return;
              }
            }
          } catch (_) {}
        }
      })();

      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err) {
      console.error('Prescription save failed:', err);
      setSaveStatus('error');
      alert('Failed to save prescription: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ padding: "16px 18px" }}>
      <div className="stack-12">
        <div style={{ background: "var(--surface-2)", borderRadius: 10, border: "1px solid var(--border)", padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', letterSpacing: '0.01em' }}>Patient Details</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12.5, fontWeight: 500, color: followUpDate ? 'var(--accent)' : 'var(--muted)' }}>
              <input
                type="checkbox"
                checked={!!followUpDate}
                onChange={e => setFollowUpDate(e.target.checked ? new Date().toISOString().split('T')[0] : '')}
                style={{ accentColor: 'var(--accent)', width: 14, height: 14, margin: 0 }}
              />
              Add follow-up
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 80px', gap: 12, marginBottom: 12 }}>
            <div className="field" style={{ margin: 0 }}>
              <span className="lbl">Full Name *</span>
              <input className="input" value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="Patient name" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <span className="lbl">Gender *</span>
              <select className="select" value={patientGender} onChange={e => setPatientGender(e.target.value)}>
                <option value="Not Selected" disabled>Not Selected</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <span className="lbl">Age</span>
              <input type="number" className="input" value={patientAge} onChange={e => setPatientAge(e.target.value)} placeholder="Yrs" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
            <div className="field" style={{ margin: 0 }}>
              <span className="lbl">Prescription ID</span>
              <input className="input" value={numericPatientId} onChange={e => setNumericPatientId(e.target.value)} placeholder="RX-1001" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <span className="lbl">Consultation Date</span>
              <MiniDatePicker value={consultationDate} onChange={setConsultationDate} />
            </div>
          </div>

          {followUpDate && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <span className="lbl" style={{ marginBottom: 8, display: 'block' }}>Follow-up Date</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {[
                  { label: '7 Days', days: 7 },
                  { label: '15 Days', days: 15 },
                  { label: '1 Month', days: 30 },
                  { label: '3 Months', days: 90 }
                ].map(preset => (
                  <button
                    key={preset.days}
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + preset.days);
                      setFollowUpDate(d.toISOString().split('T')[0]);
                    }}
                    className="btn sm ghost"
                  >
                    {preset.label}
                  </button>
                ))}
                <div style={{ width: 180, marginLeft: 4 }}><MiniDatePicker value={followUpDate} onChange={setFollowUpDate} placeholder="Pick follow-up date" /></div>
              </div>
            </div>
          )}
        </div>

        <div className="hstack-8" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="fw6">Clinical Diagnosis</span>
        </div>
        <div className="card flat" style={{ marginBottom: 32 }}>
            <div className="field">
                <span className="lbl">Prescription Template (Diet & Lifestyle)</span>
                <select className="select" value={prescriptionTemplate} onChange={e => {
                    setPrescriptionTemplate(e.target.value);
                }}>
                    <option value="">N/A (No Diet Template)</option>
                    {Object.entries(DIET_TEMPLATES).map(([key, t]) => (
                        <option key={key} value={key}>{t.label}</option>
                    ))}
                </select>
            </div>
            <div className="grid-12" style={{ gap: 16, marginTop: 16 }}>
                <div className="span-6 field">
                    <span className="lbl">Primary Diagnosis</span>
                    <textarea className="input" style={{ resize: 'vertical', minHeight: 60 }} placeholder="Main condition or diagnosis..." value={primaryDiagnosis} onChange={e => setPrimaryDiagnosis(e.target.value)} />
                </div>
                <div className="span-6 field">
                    <span className="lbl">Clinical Findings & Observations</span>
                    <textarea className="input" style={{ resize: 'vertical', minHeight: 60 }} placeholder="Physical exam findings, symptoms..." value={clinicalFindings} onChange={e => setClinicalFindings(e.target.value)} />
                </div>
            </div>
            <div className="field" style={{ marginBottom: 0, marginTop: 16 }}>
                <span className="lbl">Lifestyle & Dietary Advice</span>
                <div className="grid-12" style={{ gap: 12 }}>
                    {(lifestyleAdvice || '').split('\n').map((line, idx) => (
                        <div key={idx} className="span-6 hstack-8">
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }}></div>
                            <input className="input" style={{ flex: 1, padding: '8px 12px' }} value={line} onChange={e => {
                                const lines = (lifestyleAdvice || '').split('\n');
                                lines[idx] = e.target.value;
                                setLifestyleAdvice(lines.join('\n'));
                            }} />
                            <button type="button" className="btn sm ghost" style={{ padding: '0 8px', height: 36 }} onClick={() => {
                                const lines = (lifestyleAdvice || '').split('\n');
                                lines.splice(idx, 1);
                                setLifestyleAdvice(lines.join('\n'));
                            }}><Icon name="x" size={14} /></button>
                        </div>
                    ))}
                    <div className="span-6 hstack-8">
                        <button type="button" className="btn sm ghost" onClick={() => {
                            setLifestyleAdvice(prev => (prev || '') + '\n');
                        }}><Icon name="plus" size={14} /> Add advice</button>
                    </div>
                </div>
            </div>
        </div>
        
        <div className="section-title">Medications & Products</div>
        <div style={{ position: 'relative', zIndex: 50, marginBottom: 16 }}>
            <div className="input-with-icon" style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 10, top: 9, color: 'var(--muted)', display: 'flex' }}>
                    <Icon name="search" size={14} />
                </div>
                <input 
                    className="input" 
                    placeholder="Search medications and products..." 
                    style={{ paddingLeft: 32, borderRadius: 8 }}
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                />
                {isSearchingProducts && (
                    <div style={{ position: 'absolute', right: 10, top: 11, fontSize: 11, color: 'var(--muted)' }}>Loading...</div>
                )}
            </div>
            
            {searchResults.length > 0 && (
                <div className="card shadow" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 300, overflowY: 'auto', padding: 0 }}>
                    {searchResults.map(product => {
                        const isSingleVariant = product.variants.length === 1 && product.variants[0].title === "Default Title";
                        if (isSingleVariant) {
                            return (
                                <label key={product.id} className="hstack-12 clickable" style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                                    <input type="checkbox" checked={items.some(it => it.productId === product.id && it.variantId === product.variants[0].id)} onChange={() => toggleProduct(product, product.variants[0])} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                                    {product.image ? <img src={product.image} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} /> : <Icon name="pill" size={18} />}
                                    <span className="fw5">{product.title}</span>
                                </label>
                            );
                        }
                        return (
                            <div key={product.id} className="col" style={{ borderBottom: "1px solid var(--border)", padding: "8px 0" }}>
                                <div className="hstack-12" style={{ padding: "4px 12px" }}>
                                    {product.image ? <img src={product.image} alt="" style={{ width: 24, height: 24, objectFit: "cover", borderRadius: 4, border: "1px solid var(--border)" }} /> : <Icon name="pill" size={14} />}
                                    <span className="fw6" style={{ fontSize: 13 }}>{product.title}</span>
                                </div>
                                {product.variants.map(variant => (
                                    <label key={variant.id} className="hstack-12 clickable" style={{ padding: "8px 12px 8px 48px", cursor: "pointer" }}>
                                        <input type="checkbox" checked={items.some(it => it.variantId === variant.id)} onChange={() => toggleProduct(product, variant)} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                                        <span style={{ fontSize: 13 }}>{variant.title}</span>
                                    </label>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {items.length === 0 ? (
            <div className="muted" style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, background: 'var(--surface-2)', borderRadius: 8, border: '1px dashed var(--border)' }}>
                No medications added yet. Search and select products above.
            </div>
        ) : (
            items.map((it, i) => (
              <div key={i} className="card flat" style={{ background: "var(--surface-2)", marginBottom: 12 }}>
                <div className="hstack-8">
                  <div className="hstack-10">
                    {it.image ? (
                        <img src={it.image} alt="" style={{ width: 24, height: 24, objectFit: "cover", borderRadius: 4, border: "1px solid var(--border)" }} />
                    ) : (
                        <div className="avatar sm" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>{i + 1}</div>
                    )}
                    <div className="fw5">{it.name}</div>
                  </div>
                  <span className="spacer" />
                  <input type="number" min="1" className="input num" style={{ width: 60, height: 32, padding: "0 8px", textAlign: "center", marginRight: 8, fontSize: 13, background: 'var(--bg)', borderColor: 'var(--border)' }} value={it.qty || 1} onChange={e => {
                      const newItems = [...items];
                      newItems[i].qty = Math.max(1, Number(e.target.value) || 1);
                      setItems(newItems);
                  }} />
                  <button className="btn sm ghost" onClick={() => removeItem(i)}><Icon name="trash" /></button>
                </div>
                <div className="grid-12" style={{ marginTop: 10 }}>
                  {/* DOSAGE COLUMN */}
                  <div className="span-4 field">
                    <div className="hstack-8" style={{ marginBottom: 6, justifyContent: 'space-between' }}>
                        <span className="lbl" style={{ margin: 0 }}>Dosage</span>
                        <select className="select" style={{ width: 'auto', height: 28, fontSize: 12, borderRadius: 6 }} value={it.dosageType || 'schedule'} onChange={e => {
                            const newItems = [...items];
                            newItems[i].dosageType = e.target.value;
                            setItems(newItems);
                        }}>
                            <option value="schedule">Capsule</option>
                            <option value="drops">Drops</option>
                            <option value="topical">Topical</option>
                        </select>
                    </div>

                    {(!it.dosageType || it.dosageType === 'schedule') && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 8, padding: 6 }}>
                                {[0,1,2,3].map(dIdx => (
                                    <React.Fragment key={dIdx}>
                                        <input 
                                            id={`dosage-${i}-${dIdx}`}
                                            className="input num" 
                                            style={{ width: '100%', height: 32, textAlign: 'center', padding: 0, background: 'var(--bg)', borderRadius: 6, fontSize: 14, fontWeight: 'bold' }} 
                                            value={it.dosage?.[dIdx] || '0'} 
                                            onChange={e => {
                                                const val = e.target.value.replace(/[^0-9]/g, '').slice(-1);
                                                const newItems = [...items];
                                                if (!newItems[i].dosage) newItems[i].dosage = ['0','0','0','0'];
                                                newItems[i].dosage[dIdx] = val || '0';
                                                setItems(newItems);
                                                if (val && dIdx < 3 && e.target.value !== '') {
                                                    const nextEl = document.getElementById(`dosage-${i}-${dIdx + 1}`);
                                                    if (nextEl) { nextEl.focus(); setTimeout(() => nextEl.select(), 0); }
                                                }
                                            }} 
                                            onKeyDown={e => {
                                                if (e.key === 'Backspace') {
                                                    if ((!it.dosage?.[dIdx] || it.dosage?.[dIdx] === '0' || e.currentTarget.value === '') && dIdx > 0) {
                                                        e.preventDefault();
                                                        const prevEl = document.getElementById(`dosage-${i}-${dIdx - 1}`);
                                                        if (prevEl) { prevEl.focus(); setTimeout(() => prevEl.select(), 0); }
                                                    } else {
                                                        const newItems = [...items];
                                                        if (!newItems[i].dosage) newItems[i].dosage = ['0','0','0','0'];
                                                        newItems[i].dosage[dIdx] = '0';
                                                        setItems(newItems);
                                                        const currentTarget = e.currentTarget;
                                                        setTimeout(() => { if (currentTarget) currentTarget.select(); }, 0);
                                                    }
                                                } else if (e.key === 'ArrowLeft' && dIdx > 0) {
                                                    e.preventDefault();
                                                    const prevEl = document.getElementById(`dosage-${i}-${dIdx - 1}`);
                                                    if (prevEl) { prevEl.focus(); setTimeout(() => prevEl.select(), 0); }
                                                } else if (e.key === 'ArrowRight' && dIdx < 3) {
                                                    e.preventDefault();
                                                    const nextEl = document.getElementById(`dosage-${i}-${dIdx + 1}`);
                                                    if (nextEl) { nextEl.focus(); setTimeout(() => nextEl.select(), 0); }
                                                }
                                            }}
                                            onFocus={e => e.target.select()} 
                                        />
                                        {dIdx < 3 && <span style={{ color: 'var(--muted)', fontWeight: 'bold' }}>-</span>}
                                    </React.Fragment>
                                ))}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, padding: '0 6px' }}>
                                {[0,1,2,3].map(dIdx => (
                                    <React.Fragment key={dIdx}>
                                        <div style={{ width: '100%', textAlign: 'center', fontSize: 11, fontWeight: 'bold', color: 'var(--muted)' }}>{['M','A','E','N'][dIdx]}</div>
                                        {dIdx < 3 && <span style={{ color: 'transparent', fontWeight: 'bold' }}>-</span>}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    )}

                    {it.dosageType === 'drops' && (
                        <div className="col" style={{ gap: 8 }}>
                            <div className="input hstack-8" style={{ padding: '0 12px', height: 40, borderRadius: 8 }}>
                                <input type="number" style={{ width: 40, background: 'transparent', border: 'none', outline: 'none', fontWeight: 'bold', fontSize: 14 }} value={it.dosageValue || ''} onChange={e => {
                                    const newItems = [...items];
                                    newItems[i].dosageValue = e.target.value;
                                    setItems(newItems);
                                }} placeholder="5" />
                                <span className="muted fw6" style={{ fontSize: 13 }}>Drops</span>
                            </div>
                            <div className="input hstack-8" style={{ padding: '0 12px', height: 40, borderRadius: 8 }}>
                                <input type="number" style={{ width: 40, background: 'transparent', border: 'none', outline: 'none', fontWeight: 'bold', fontSize: 14 }} value={it.dosageFrequency || ''} onChange={e => {
                                    const newItems = [...items];
                                    newItems[i].dosageFrequency = e.target.value;
                                    setItems(newItems);
                                }} placeholder="2" />
                                <span className="muted fw6" style={{ fontSize: 13 }}>Times / Day</span>
                            </div>
                        </div>
                    )}

                    {it.dosageType === 'topical' && (
                        <textarea className="input" rows="2" style={{ resize: 'vertical', minHeight: 88, borderRadius: 8 }} value={it.dosageValue || ''} onChange={e => {
                            const newItems = [...items];
                            newItems[i].dosageValue = e.target.value;
                            setItems(newItems);
                        }} placeholder="e.g. Apply 1ml twice daily..." />
                    )}
                  </div>

                  {/* DETAILS COLUMN */}
                  <div className="span-4 field">
                    <span className="lbl" style={{ marginBottom: 6 }}>Medicine Details</span>
                    <div className="col" style={{ gap: 8 }}>
                        <input className="input" value={it.detailsHeader || ''} onChange={e => {
                            const newItems = [...items];
                            newItems[i].detailsHeader = e.target.value;
                            setItems(newItems);
                        }} placeholder="Type | Timing" style={{ height: 36, borderRadius: 8, fontWeight: 500 }} />
                        <input className="input" value={it.detailsSubtext || ''} onChange={e => {
                            const newItems = [...items];
                            newItems[i].detailsSubtext = e.target.value;
                            setItems(newItems);
                        }} placeholder="Instruction..." style={{ height: 36, borderRadius: 8, background: 'var(--surface-3)', border: '1px solid transparent' }} />
                    </div>
                  </div>

                  {/* DURATION COLUMN */}
                  <div className="span-4 field">
                    <span className="lbl" style={{ marginBottom: 6 }}>Duration</span>
                    <div className="hstack-8" style={{ gap: 4 }}>
                      <input type="number" min="1" className="input num" style={{ width: 56, padding: "0 8px", textAlign: "center", height: 36, borderRadius: 8 }} value={it.durationValue || 1} onChange={e => {
                          const newItems = [...items];
                          newItems[i].durationValue = Math.max(1, Number(e.target.value) || 1);
                          setItems(newItems);
                      }} />
                      <select className="select" style={{ flex: 1, height: 36, borderRadius: 8 }} value={it.durationUnit || 'month'} onChange={e => {
                          const newItems = [...items];
                          newItems[i].durationUnit = e.target.value;
                          setItems(newItems);
                      }}>
                        <option value="day">Day(s)</option>
                        <option value="week">Week(s)</option>
                        <option value="month">Month(s)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            ))
        )}
      </div>

      {/* Cart Link Banner — appears after prescription is saved */}
      {savedCartLink && (
        <div style={{ margin: '16px 0 0', background: 'rgba(124, 58, 237, 0.07)', border: '1px solid rgba(124, 58, 237, 0.2)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="link" size={17} style={{ color: '#7c3aed', flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Recommended Cart Link</div>
            <div style={{ fontSize: 12.5, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.8 }}>{savedCartLink}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => { navigator.clipboard.writeText(savedCartLink); setCopiedCart(true); setTimeout(() => setCopiedCart(false), 2000); }}
              className="btn sm"
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: copiedCart ? 'rgba(34,197,94,0.15)' : undefined, color: copiedCart ? 'var(--risk-low)' : undefined, borderColor: copiedCart ? 'var(--risk-low)' : undefined }}
            >
              <Icon name={copiedCart ? 'check' : 'copy'} size={13} />
              {copiedCart ? 'Copied!' : 'Copy'}
            </button>
            <a href={savedCartLink} target="_blank" rel="noreferrer" className="btn sm primary" style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
              <Icon name="external" size={13} /> Open
            </a>
          </div>
        </div>
      )}

      {/* Approve & Sign — floating, no background */}
      <div style={{ position: 'sticky', bottom: 16, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 24, pointerEvents: 'none' }}>
        {saveStatus === 'success' && (
          <span style={{ pointerEvents: 'all', fontSize: 12.5, fontWeight: 600, color: 'var(--risk-low)', display: 'flex', alignItems: 'center', gap: 5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <Icon name="check" size={13} /> Prescription saved
          </span>
        )}
        {canSign ? (
          <button
            className="btn primary"
            onClick={handleApproveSign}
            disabled={isSaving}
            style={{ pointerEvents: 'all', minWidth: 160, boxShadow: '0 4px 18px rgba(0,0,0,0.22)' }}
          >
            {isSaving
              ? <><Icon name="refresh" size={14} className="spin" /> Saving…</>
              : <><Icon name="check" size={14} /> Approve &amp; sign</>}
          </button>
        ) : (
          <div style={{ pointerEvents: 'all', fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Icon name="shield" size={13} /> Permission required to sign
          </div>
        )}
      </div>
    </div>
  );
}


function AssessmentInline({ customer }) {
  const D = window.SehatData;
  let qn = 0;
  return (
    <div style={{ padding: 18 }}>
      {D.QUESTIONNAIRE.sections.map(s => (
        <div key={s.name} style={{ marginBottom: 14 }}>
          <div className="h-label" style={{ marginBottom: 6 }}>{s.name}</div>
          {s.qs.map((qa, i) => {
            qn += 1;
            return (
              <div key={i} className="ans-row">
                <div className="qn mono">{String(qn).padStart(2, "0")}</div>
                <div className="qa">
                  <div className="q">{qa.q}</div>
                  <div className="a">{qa.a}</div>
                </div>
                <div>{qa.flag && <Badge tone="high" dot="var(--risk-high)">flag</Badge>}</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function HistoryInline({ customer, onUsePrescription }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [pdfUrls, setPdfUrls] = useState({});
  const [loading, setLoading] = useState(true);

  const collName = customer?._collection === 'full' ? 'questionnaire_submissions'
    : customer?._collection === 'partial' ? 'partial_submissions'
    : 'manual_submissions';

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!customer?.id) return;
    setLoading(true);
    setPrescriptions([]);
    setPdfUrls({});

    const q = query(
      collection(db, `${collName}/${customer.id}/prescriptions`),
      orderBy('savedAt', 'desc')
    );
    const unsub = onSnapshot(q, async snap => {
      const list = snap.docs.map(d => ({ _subId: d.id, ...d.data() }));
      setPrescriptions(list);
      setLoading(false);

      // Fetch PDF URLs from main prescriptions collection for each docId
      const docIds = list.map(p => p.docId).filter(Boolean);
      if (docIds.length === 0) return;
      const urlMap = {};
      await Promise.all(docIds.map(async id => {
        try {
          const snap = await getDoc(doc(db, 'prescriptions', id));
          if (snap.exists()) urlMap[id] = snap.data().prescriptionDownloadUrl || null;
        } catch (_) {}
      }));
      setPdfUrls(urlMap);
    }, () => setLoading(false));
    return unsub;
  }, [customer?.id]);

  const fmt = ts => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const submissionDate = customer?.createdAt || customer?.timestamp || customer?.submittedAt;

  return (
    <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: 560 }}>
      {loading && <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 24 }}>Loading history…</div>}

      {!loading && prescriptions.length === 0 && !submissionDate && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 24 }}>No history found.</div>
      )}

      <div style={{ position: 'relative' }}>
        {/* vertical line */}
        <div style={{ position: 'absolute', left: 15, top: 8, bottom: 8, width: 2, background: 'var(--border)', borderRadius: 2 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Prescription entries */}
          {prescriptions.map((p, i) => {
            const pdfUrl = pdfUrls[p.docId];
            const doctorName = p.doctors?.[0]?.name || p.consultedByName || '—';
            const medCount = p.recommendedProducts?.length || 0;
            return (
              <div key={p._subId} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* dot */}
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0, zIndex: 1, boxShadow: '0 0 0 3px var(--bg)' }}>
                  <Icon name="clipboard" size={14} />
                </div>
                <div className="card flat" style={{ flex: 1, background: 'var(--surface-2)', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="fw6" style={{ fontSize: 13 }}>{p.prescriptionID || 'Prescription'}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 6, padding: '2px 7px' }}>
                          {medCount} med{medCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
                        {fmt(p.savedAt)} · Dr. {doctorName}
                      </div>
                      {p.primaryDiagnosis && (
                        <div style={{ fontSize: 12, color: 'var(--fg-soft)', marginTop: 4, fontStyle: 'italic' }}>{p.primaryDiagnosis}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {pdfUrl ? (
                        <a href={pdfUrl} target="_blank" rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                          <Icon name="clipboard" size={12} /> View PDF
                        </a>
                      ) : p.docId ? (
                        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7 }}>
                          <Icon name="refresh" size={11} className="spin" /> Generating…
                        </span>
                      ) : null}
                      <button className="btn sm" style={{ fontSize: 12 }} onClick={() => onUsePrescription?.(p)}
                        title="Prefill prescription form with this prescription's values">
                        <Icon name="copy" size={12} /> Use
                      </button>
                    </div>
                  </div>

                  {/* Medications mini-list */}
                  {p.recommendedProducts?.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {p.recommendedProducts.map((med, mi) => (
                        <span key={mi} style={{ fontSize: 11, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', color: 'var(--fg-soft)' }}>
                          {med.name?.split('–')[0]?.split('-')[0]?.trim() || med.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Questionnaire submitted entry */}
          {submissionDate && (
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface)', border: '2px solid var(--border)', display: 'grid', placeItems: 'center', color: 'var(--muted)', flexShrink: 0, zIndex: 1, boxShadow: '0 0 0 3px var(--bg)' }}>
                <Icon name="check" size={14} />
              </div>
              <div style={{ paddingTop: 6 }}>
                <div className="fw5" style={{ fontSize: 13 }}>Questionnaire submitted</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                  {fmt(submissionDate)}
                  {customer?.reportCategory ? ` · ${customer.reportCategory}` : ''}
                  {customer?.score != null ? ` · Score ${customer.score}` : ''}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}




// --- screens-orders.jsx ---
// screens-orders.jsx — Create Order flow + Order History



function OrderCreate({ context = {}, setRoute }) {
  const preset = context.customer;
  const [cust, setCust] = useStateO(preset || null);
  const [items, setItems] = useStateO([]);
  const [includeSample, setIncludeSample] = useStateO(false);
  const [pay, setPay] = useStateO("Prepaid");
  const [custFirstName, setCustFirstName] = useStateO("");
  const [custLastName, setCustLastName] = useStateO("");
  const [custPhone, setCustPhone] = useStateO("");
  const [custEmail, setCustEmail] = useStateO("");
  const [, setShippingFirstName] = useStateO("");
  const [, setShippingLastName] = useStateO("");
  const [differentBillingAddress, setDifferentBillingAddress] = useStateO(false);
  const [billingFirstName, setBillingFirstName] = useStateO("");
  const [billingLastName, setBillingLastName] = useStateO("");
  const [billingPhone, setBillingPhone] = useStateO("");
  const [billingAddress, setBillingAddress] = useStateO("");
  const [billingLandmark, setBillingLandmark] = useStateO("");
  const [billingPincode, setBillingPincode] = useStateO("");
  const [billingCity, setBillingCity] = useStateO("");
  const [billingStateName, setBillingStateName] = useStateO("");
  const [billingCountry, setBillingCountry] = useStateO("India");
  const [billingAutofillMessage, setBillingAutofillMessage] = useStateO("");
  const [shippingAddress, setShippingAddress] = useStateO(preset?.address || "");
  const [shippingLandmark, setShippingLandmark] = useStateO(preset?.landmark || "");
  const [pincode, setPincode] = useStateO(preset?.pincode ? String(preset.pincode) : "");
  const [city, setCity] = useStateO(preset?.city || "");
  const [stateName, setStateName] = useStateO(preset?.state || "");
  const [country, setCountry] = useStateO(preset?.country || "India");
  const [productSearch, setProductSearch] = useStateO("");
  const [searchResults, setSearchResults] = useStateO([]);
  const [isSearchingProducts, setIsSearchingProducts] = useStateO(false);
  const [, setSelectedSearchVariants] = useStateO({});
  const [freeSampleVariant, setFreeSampleVariant] = useStateO(null);
  const [activeDiscountItemId, setActiveDiscountItemId] = useStateO(null);
  const [hoveredDiscountItemId, setHoveredDiscountItemId] = useStateO(null);
  const [discountPopupPos, setDiscountPopupPos] = useStateO('bottom');
  const [customerRecommendations, setCustomerRecommendations] = useStateO([]);
  const [isFetchingRecommendations, setIsFetchingRecommendations] = useStateO(false);
  const [focusedInput, setFocusedInput] = useStateO(null);
  const [autofillMessage, setAutofillMessage] = useStateO("");
  const [shippingRates, setShippingRates] = useStateO([]);
  const [isLoadingShipping, setIsLoadingShipping] = useStateO(false);
  const [selectedShipping, setSelectedShipping] = useStateO(null);
  const [useCustomShipping, setUseCustomShipping] = useStateO(false);
  const [customShippingTitle, setCustomShippingTitle] = useStateO('');
  const [customShippingPrice, setCustomShippingPrice] = useStateO('');
  const [orderDiscountPopupOpen, setOrderDiscountPopupOpen] = useStateO(false);
  const [orderDiscountCode, setOrderDiscountCode] = useStateO("");
  const [orderDiscountApplyAutomatic, setOrderDiscountApplyAutomatic] = useStateO(false);
  const [orderDiscountIsCustom, setOrderDiscountIsCustom] = useStateO(false);
  const [orderDiscountType, setOrderDiscountType] = useStateO("amount");
  const [orderDiscountValue, setOrderDiscountValue] = useStateO("");
  const [orderDiscountReason, setOrderDiscountReason] = useStateO("");
  const [discountShake, setDiscountShake] = useStateO(false);
  const [orderDiscountPopupClosing, setOrderDiscountPopupClosing] = useStateO(false);
  const [savingMode, setSavingMode] = useStateO(null);

  const handleSaveToCRM = async (mode = 'draft') => {
    const rawPhone = (custPhone || preset?.phone || '').replace(/\D/g, '');
    if (!rawPhone) return alert('Phone number is required for CRM orders.');
    const digits = rawPhone.slice(-10);
    const normalizedPhone = digits.length === 10 ? `+91${digits}` : rawPhone;

    if (!items || items.length === 0) return alert('Please add at least one product to the order.');
    
    setSavingMode(mode);
    try {
      let finalCustomerId = null;
      if (cust && cust.id) {
        finalCustomerId = cust.id;
      } else {
        const existingCustomers = await searchCustomers(normalizedPhone);
        if (existingCustomers && existingCustomers.length > 0) {
          finalCustomerId = existingCustomers[0].id;
        } else {
          console.log('--- SHOPIFY CREATE CUSTOMER ---');
          try {
            const newCust = await createCustomer({
              first_name: custFirstName || preset?.name?.split(' ')[0] || '',
              last_name: custLastName || preset?.name?.split(' ').slice(1).join(' ') || '',
              email: custEmail || '',
              phone: normalizedPhone,
              addresses: [{
                address1: shippingAddress || billingAddress || 'No Address',
                city: city || billingCity || 'Unknown',
                province: stateName || billingStateName || '',
                zip: pincode || billingPincode || '',
                country: "India",
                phone: normalizedPhone
              }]
            });
            finalCustomerId = newCust.id;
          } catch (custErr) {
            console.error('--- SHOPIFY CREATE CUSTOMER ERROR ---', custErr);
            throw new Error('Customer Creation Error: ' + custErr.message);
          }
        }
      }

      // Force update customer profile with phone to ensure Contact Info populates in Draft
      if (finalCustomerId) {
          try {
              const updateBody = {
                  customer: {
                      id: finalCustomerId,
                      phone: normalizedPhone
                  }
              };
              if (custFirstName) updateBody.customer.first_name = custFirstName;
              if (custLastName) updateBody.customer.last_name = custLastName;
              if (custEmail && custEmail.trim()) updateBody.customer.email = custEmail.trim();

              const updateRes = await fetch(`/shopify-v2/customers/${finalCustomerId}.json`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(updateBody),
              });
              if (!updateRes.ok) {
                  console.warn('Failed to update customer profile phone:', await updateRes.text());
              }
          } catch (updateErr) {
              console.warn('Customer update error:', updateErr);
          }
      }

      // Build advanced draft payload
      const getDiscountedPrice = (item) => {
          const dv = parseFloat(item.discountValue) || 0;
          if (dv <= 0) return item.price;
          if (item.discountType === 'percentage') return item.price * (1 - dv / 100);
          return Math.max(0, item.price - dv);
      };

      const line_items = items.map(item => {
          const li = { variant_id: item.variantId, quantity: item.qty, taxable: true };
          const dv = parseFloat(item.discountValue) || 0;
          if (dv > 0) {
              const discountedPrice = getDiscountedPrice(item);
              const discountAmt = ((item.price - discountedPrice) * item.qty).toFixed(2);
              li.applied_discount = {
                  value_type: item.discountType === 'percentage' ? 'percentage' : 'fixed_amount',
                  value: String(dv),
                  amount: discountAmt,
                  title: item.discountReason || 'Discount',
                  description: item.discountReason || 'Discount'
              };
          }
          return li;
      });

      const shippingAddr = {
          first_name: custFirstName || preset?.name?.split(' ')[0] || '',
          last_name: custLastName || preset?.name?.split(' ').slice(1).join(' ') || '',
          address1: shippingAddress || billingAddress || 'No Address',
          address2: shippingLandmark || billingLandmark || '',
          city: city || billingCity || 'Unknown',
          province: stateName || billingStateName || '',
          zip: pincode || billingPincode || '',
          country: "India",
          phone: normalizedPhone
      };

      const billingAddr = differentBillingAddress ? {
          first_name: billingFirstName || custFirstName || preset?.name?.split(' ')[0] || '',
          last_name: billingLastName || custLastName || preset?.name?.split(' ').slice(1).join(' ') || '',
          address1: billingAddress || 'No Address',
          address2: billingLandmark || '',
          city: billingCity || 'Unknown',
          province: billingStateName || '',
          zip: billingPincode || '',
          country: "India",
          phone: billingPhone ? (billingPhone.replace(/\D/g, '').slice(-10).length === 10 ? `+91${billingPhone.replace(/\D/g, '').slice(-10)}` : billingPhone) : normalizedPhone
      } : shippingAddr;

      const draftData = {
        email: custEmail && custEmail.trim() ? custEmail.trim() : undefined,
        customer: { id: finalCustomerId },
        shipping_address: shippingAddr,
        billing_address: billingAddr,
        line_items,
        tax_exempt: false,
        tags: 'Created via CRM'
      };

      // Shipping — COD uses selected rate; Prepaid uses "Prepaid Shipping" rate from Shopify
      if (pay === "COD" && useCustomShipping) {
          const title = customShippingTitle.trim() || 'Custom Shipping';
          const price = parseFloat(customShippingPrice) || 0;
          draftData.shipping_line = { title, price: price.toFixed(2), code: title };
          console.log('[Shipping] Custom COD rate applied:', title, price);
      } else if (selectedShipping) {
          draftData.shipping_line = {
              title: selectedShipping.title,
              price: selectedShipping.price.toFixed(2),
              code: selectedShipping.code || selectedShipping.title
          };
          console.log('[Shipping] Rate applied:', selectedShipping.title, 'Rs.', selectedShipping.price);
      } else {
          console.log('[Shipping] No shipping rate found — no shipping_line added');
      }

      // Order Discount
      if (orderDiscountType !== 'none') {
          const val = parseFloat(orderDiscountValue) || 0;
          if (val > 0) {
              draftData.applied_discount = {
                  value_type: orderDiscountType === 'percentage' ? 'percentage' : 'fixed_amount',
                  value: String(val),
                  title: orderDiscountReason || (orderDiscountType === 'code' ? orderDiscountCode : 'Custom Discount'),
                  description: orderDiscountReason || (orderDiscountType === 'code' ? orderDiscountCode : 'Custom Discount')
              };
          }
      }

      console.log('--- SHOPIFY DRAFT ORDER PAYLOAD ---');
      console.log(JSON.stringify(draftData, null, 2));

      let draftRes;
      try {
        draftRes = await createDraftOrder(draftData);
        console.log('--- SHOPIFY DRAFT ORDER SUCCESS ---', draftRes);
      } catch (shopErr) {
        console.error('--- SHOPIFY DRAFT ORDER ERROR ---', shopErr);
        throw new Error('Shopify Error: ' + shopErr.message);
      }

      // REST API does not support top-level `phone` on draft orders — use GraphQL to set Contact Information
      try {
          const gqlInput = { phone: normalizedPhone };
          if (custEmail && custEmail.trim()) gqlInput.email = custEmail.trim();
          const gqlRes = await fetch('/shopify-v2/graphql.json', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  query: `mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
                      draftOrderUpdate(id: $id, input: $input) {
                          draftOrder { id phone email }
                          userErrors { field message }
                      }
                  }`,
                  variables: {
                      id: draftRes.admin_graphql_api_id,
                      input: gqlInput
                  }
              })
          });
          const gqlData = await gqlRes.json();
          const errs = gqlData?.data?.draftOrderUpdate?.userErrors;
          if (errs && errs.length > 0) {
              console.warn('--- DRAFT PHONE UPDATE ERRORS ---', errs);
          } else {
              console.log('--- DRAFT CONTACT INFO UPDATED ---', gqlData?.data?.draftOrderUpdate?.draftOrder);
          }
      } catch (gqlErr) {
          console.warn('--- DRAFT PHONE UPDATE FAILED (non-fatal) ---', gqlErr.message);
      }

      // Complete to Active Order if requested
      let finalOrderId = draftRes.id;
      if (mode === 'active') {
          try {
              console.log('--- COMPLETING ACTIVE ORDER ---');
              const completeReq = await fetch(`/shopify-v2/draft_orders/${draftRes.id}/complete.json`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ payment_pending: true })
              });
              const completeData = await completeReq.json();
              if (!completeReq.ok) {
                  throw new Error(completeData.errors ? JSON.stringify(completeData.errors) : completeReq.statusText);
              }
              finalOrderId = completeData.draft_order?.order_id || draftRes.id;
              console.log('--- ACTIVE ORDER COMPLETE ---', finalOrderId);
          } catch (compErr) {
              console.error('--- COMPLETION ERROR ---', compErr);
              throw new Error('Failed to complete active order: ' + compErr.message);
          }
      }

      const gscriptUrl = localStorage.getItem('crm_gscript_url') || '/api/leads';
      
      const payload = {
        phone: rawPhone,
        updates: {
          'First Name': custFirstName || preset?.name?.split(' ')[0] || '',
          'Last Name': custLastName || preset?.name?.split(' ').slice(1).join(' ') || '',
          'Phone Number': rawPhone,
          'Address': shippingAddress || billingAddress || '',
          'Landmark': shippingLandmark || billingLandmark || '',
          'District/City': city || billingCity || '',
          'State': stateName || billingStateName || '',
          'Pin Code': pincode || billingPincode || '',
          'Last Order': `Order #${finalOrderId} on ${new Date().toLocaleDateString('en-IN')}`
        },
        updatedBy: window.SehatData?.me?.name || 'CRM Order Creator'
      };

      const res = await fetch(gscriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || 'Request failed');
      
      alert(mode === 'active' ? 'Active Order successfully created!' : 'Draft Order successfully saved!');
      if (setRoute) setRoute('crm_orders');
    } catch (err) {
      console.error(err);
      alert('Failed to process order: ' + err.message);
    } finally {
      setSavingMode(null);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPincode(cust?.pincode ? String(cust.pincode) : "");
    setCity(cust?.city || "");
    setStateName(cust?.state || "");
    setCountry(cust?.country || "India");
    if (cust) {
      const parts = (cust.name || "").split(" ");
      setCustFirstName(parts[0] || "");
      setCustLastName(parts.slice(1).join(" ") || "");
      setCustPhone(cust.phone || "");
      setCustEmail(cust.email || "");
    }
  }, [cust, setCity, setPincode, setStateName, setCountry]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setShippingFirstName(custFirstName);
  }, [custFirstName]);

  // When switching payment method, auto-select appropriate shipping rate
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (shippingRates.length === 0) return;
    const codRates     = shippingRates.filter(r => /cod|cash|delivery/i.test(r.title) && !/prepaid/i.test(r.title));
    const prepaidRate  = shippingRates.find(r => /prepaid/i.test(r.title));
    if (pay === "COD" && codRates.length > 0) {
      setSelectedShipping(codRates[0]);
    } else if (pay === "Prepaid") {
      setSelectedShipping(prepaidRate || null);
    }
  }, [pay, shippingRates]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setShippingLastName(custLastName);
  }, [custLastName]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pincode && pincode.length === 6 && /^\d+$/.test(pincode)) {
      fetch(`https://api.postalpincode.in/pincode/${pincode}`)
        .then(res => res.json())
        .then(data => {
          if (data && data[0] && data[0].Status === 'Success') {
            const postOffice = data[0].PostOffice[0];
            setCity(postOffice.District);
            setStateName(postOffice.State);
            setAutofillMessage("City and State auto-filled from pincode");
            setTimeout(() => setAutofillMessage(""), 3000);
          }
        })
        .catch(err => console.error("Error fetching pincode:", err));
    }
  }, [pincode]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (billingPincode && billingPincode.length === 6 && /^\d+$/.test(billingPincode)) {
      fetch(`https://api.postalpincode.in/pincode/${billingPincode}`)
        .then(res => res.json())
        .then(data => {
          if (data && data[0] && data[0].Status === 'Success') {
            const postOffice = data[0].PostOffice[0];
            setBillingCity(postOffice.District);
            setBillingStateName(postOffice.State);
            setBillingAutofillMessage("City and State auto-filled from pincode");
            setTimeout(() => setBillingAutofillMessage(""), 3000);
          }
        })
        .catch(err => console.error("Error fetching pincode:", err));
    }
  }, [billingPincode]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let active = true;
    const query = focusedInput === 'name' ? custFirstName : (focusedInput === 'phone' ? custPhone : "");
    if (!query || query.length < 2) {
      setCustomerRecommendations([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsFetchingRecommendations(true);
      try {
        const res = await searchCustomers(query);
        if (active) {
          setCustomerRecommendations(res.slice(0, 5));
        }
      } catch (err) {
        console.error("Error fetching customer recommendations", err);
      } finally {
        if (active) setIsFetchingRecommendations(false);
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [custFirstName, custPhone, focusedInput]);

  const handleSelectRecommendation = (c) => {
    setCust({ 
      ...c, 
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.phone || c.email || 'Unnamed',
      phone: c.phone,
      email: c.email,
      avatarHue: Math.floor(Math.random() * 360)
    });
    setCustFirstName(c.first_name || "");
    setCustLastName(c.last_name || "");
    setCustPhone(c.phone || "");
    setCustEmail(c.email || "");
    
    const defaultAddr = c.default_address || (c.addresses && c.addresses[0]);
    if (defaultAddr) {
      setShippingAddress(defaultAddr.address1 || "");
      setShippingLandmark(defaultAddr.address2 || "");
      setCity(defaultAddr.city || "");
      setStateName(defaultAddr.province || "");
      setCountry(defaultAddr.country || "India");
      setPincode(defaultAddr.zip ? String(defaultAddr.zip).replace(/\D/g, "").slice(0, 6) : "");
    } else {
      setShippingAddress("");
      setShippingLandmark("");
      setCity("");
      setStateName("");
      setCountry("India");
      setPincode("");
    }
    
    setFocusedInput(null);
    setCustomerRecommendations([]);
  };

  useEffect(() => {
    const fetchShippingRates = async () => {
      setIsLoadingShipping(true);
      try {
        const query = `{
          deliveryProfiles(first: 10) {
            edges {
              node {
                profileLocationGroups {
                  locationGroupZones(first: 30) {
                    edges {
                      node {
                        methodDefinitions(first: 30) {
                          edges {
                            node {
                              id name active
                              rateProvider {
                                ... on DeliveryRateDefinition { id price { amount } }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }`;
        const res = await fetch('/shopify-v2/graphql.json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
        const data = await res.json();
        const rates = [];
        const seen = new Set();
        (data?.data?.deliveryProfiles?.edges || []).forEach(({ node: profile }) => {
          (profile.profileLocationGroups || []).forEach(group => {
            (group.locationGroupZones?.edges || []).forEach(({ node: lgZone }) => {
              (lgZone.methodDefinitions?.edges || []).forEach(({ node: method }) => {
                if (!method.active) return;
                const rp = method.rateProvider;
                if (!rp?.price) return;
                const key = `${method.name}|${rp.price.amount}`;
                if (seen.has(key)) return;
                seen.add(key);
                rates.push({
                  id: method.id,
                  title: method.name,
                  price: parseFloat(rp.price.amount || 0),
                  code: method.name,
                });
              });
            });
          });
        });
        setShippingRates(rates);
        // Auto-select based on initial payment method (default is Prepaid)
        if (!selectedShipping && !useCustomShipping) {
          const prepaidRate = rates.find(r => /prepaid/i.test(r.title));
          const codRates    = rates.filter(r => /cod|cash|delivery/i.test(r.title) && !/prepaid/i.test(r.title));
          setSelectedShipping(prepaidRate || codRates[0] || null);
        }
      } catch (err) {
        console.error('[Shipping] Failed to fetch rates:', err);
      } finally {
        setIsLoadingShipping(false);
      }
    };
    fetchShippingRates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const pin = String(pincode || "").trim();
    if (!/^\d{6}$/.test(pin)) {
      setAutofillMessage("");
      return;
    }

    let cancelled = false;
    const fetchLocation = async () => {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        const data = await res.json();
        const postOffice = data?.[0]?.Status === "Success" ? data?.[0]?.PostOffice?.[0] : null;
        if (!cancelled && postOffice) {
          setCity(postOffice.District || "");
          setStateName(postOffice.State || "");
          setAutofillMessage("City and state autofilled from pincode");
        }
      } catch (err) {
        if (!cancelled) setAutofillMessage("");
      }
    };

    fetchLocation();
    return () => {
      cancelled = true;
    };
  }, [pincode, setAutofillMessage, setCity, setStateName]);

  useEffect(() => {
    const fetchFreeSample = async () => {
      try {
        const query = `{
          products(first: 1, query: "title:\\"Ashwagandha 30 Tablets (Free sample)\\"") {
            edges {
              node {
                title
                featuredImage { url }
                variants(first: 1) {
                  edges {
                    node {
                      id
                      title
                      sku
                      price
                    }
                  }
                }
              }
            }
          }
        }`;
        const res = await fetch('/shopify-v2/graphql.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });
        const data = await res.json();
        const product = data?.data?.products?.edges?.[0]?.node;
        const variant = product?.variants?.edges?.[0]?.node;
        if (product && variant) {
          setFreeSampleVariant({
            id: parseInt(variant.id.split('/').pop(), 10) || variant.id,
            productTitle: product.title,
            variantTitle: variant.title,
            sku: variant.sku || '',
            image: product.featuredImage?.url || null,
            price: Math.round(parseFloat(variant.price) * 100),
          });
        }
      } catch (err) {
        console.warn('[Free Sample] Failed to fetch:', err);
      }
    };

    fetchFreeSample();
  }, [setFreeSampleVariant]);

  const getDiscountedUnitPrice = (item) => {
    const value = Number(item.discountValue) || 0;
    if (value <= 0) return item.price;
    if (item.discountType === "percentage") return Math.max(0, item.price * (1 - Math.min(value, 100) / 100));
    return Math.max(0, item.price - value);
  };
  const hasItemDiscount = (item) => (Number(item.discountValue) || 0) > 0;
  const updateItemDiscount = (itemId, field, value) => {
    setItems(current => current.map(item => item.id === itemId ? { ...item, [field]: value } : item));
  };

  const subtotal = items.reduce((s, p) => s + getDiscountedUnitPrice(p) * p.qty, 0);
  const shipping = pay === "COD" 
    ? (useCustomShipping ? (parseFloat(customShippingPrice) || 0) : (selectedShipping ? selectedShipping.price : 0))
    : 0;
  const shippingLabel = pay === "COD"
    ? (useCustomShipping ? (customShippingTitle.trim() || 'Custom Shipping') : (selectedShipping ? selectedShipping.title : 'Free'))
    : "Free";
  let discount = 0;
  if (orderDiscountIsCustom) {
    const val = Number(orderDiscountValue) || 0;
    if (orderDiscountType === "percentage") {
      discount = subtotal * (Math.min(val, 100) / 100);
    } else {
      discount = val;
    }
  }
  discount = Math.round(discount);
  const total = Math.max(0, subtotal + shipping - discount);

  const normalizeSearchText = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const fetchProducts = useCallback(async (term) => {
    setIsSearchingProducts(true);
    try {
      const cleanTerm = term.replace(/"/g, '\\"');
      const query = `{
        products(first: 15, query: "${cleanTerm}*") {
          edges {
            node {
              id
              title
              handle
              featuredImage { url }
              variants(first: 50) {
                edges {
                  node {
                    id
                    title
                    sku
                    price
                  }
                }
              }
            }
          }
        }
      }`;

      const res = await fetch('/shopify-v2/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();

      if (data.errors) {
        console.error('[Product search] GraphQL errors:', data.errors);
        setSearchResults([]);
        return;
      }

      const products = (data?.data?.products?.edges || []).map(edge => {
        const node = edge.node;
        return {
          id: parseInt(node.id.split('/').pop(), 10) || node.id,
          title: node.title,
          handle: node.handle,
          image: node.featuredImage?.url || null,
          variants: (node.variants?.edges || []).map(vEdge => {
            const vNode = vEdge.node;
            return {
              id: parseInt(vNode.id.split('/').pop(), 10) || vNode.id,
              title: vNode.title,
              sku: vNode.sku || '',
              price: Math.round(parseFloat(vNode.price) * 100),
            };
          }),
        };
      });

      const tokens = normalizeSearchText(term).split(/\s+/).filter(Boolean);
      const strictMatches = products.filter(product => {
        if (!product.variants?.length) return false;
        const searchable = normalizeSearchText([
          product.title,
          product.handle,
          ...product.variants.flatMap(variant => [variant.title, variant.sku]),
        ].join(" "));
        return tokens.every(token => searchable.includes(token));
      });

      setSearchResults(strictMatches);
    } catch (err) {
      console.error('[Product search] failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearchingProducts(false);
    }
  }, [setIsSearchingProducts, setSearchResults]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const term = productSearch.trim();
      if (term.length > 1) fetchProducts(term);
      else {
        setSearchResults([]);
        setSelectedSearchVariants({});
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [fetchProducts, productSearch, setSearchResults, setSelectedSearchVariants]);

  const addVariantToOrder = (variant, product) => {
    setItems((current) => {
      let next = [...current];
      const existingIndex = next.findIndex(item => item.variantId === variant.id);
      if (existingIndex >= 0) {
        next = next.map((item, index) => index === existingIndex ? { ...item, qty: item.qty + 1 } : item);
      } else {
        const isDefaultVariant = variant.title === "Default Title";
        next.push({
          id: `variant-${variant.id}`,
          variantId: variant.id,
          name: product.title,
          subtitle: isDefaultVariant ? "Shopify product" : variant.title,
          price: variant.price / 100,
          sku: variant.sku || "-",
          image: product.image || null,
          qty: 1,
          discountType: "amount",
          discountValue: "",
          discountReason: "",
        });
      }
      return next;
    });
    setProductSearch("");
    setSearchResults([]);
  };

  const toggleFreeSample = (checked) => {
    setIncludeSample(checked);
    if (!freeSampleVariant) return;

    setItems(current => {
      const sampleId = `sample-${freeSampleVariant.id}`;
      if (!checked) return current.filter(item => item.id !== sampleId);
      if (current.some(item => item.id === sampleId)) return current;
      return [...current, {
        id: sampleId,
        variantId: freeSampleVariant.id,
        name: freeSampleVariant.productTitle,
        subtitle: freeSampleVariant.variantTitle === "Default Title" ? "Free sample" : freeSampleVariant.variantTitle,
        price: freeSampleVariant.price / 100,
        sku: freeSampleVariant.sku || "-",
        image: freeSampleVariant.image,
        qty: 1,
        isFreeSample: true,
        discountType: "percentage",
        discountValue: "100",
        discountReason: "Free Sample",
      }];
    });
  };

  useEffect(() => {
    if (includeSample && freeSampleVariant) {
      toggleFreeSample(true);
    }
  }, [freeSampleVariant]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeOrderItem = (index) => {
    if (items[index]?.isFreeSample) setIncludeSample(false);
    if (items[index]?.id === activeDiscountItemId) setActiveDiscountItemId(null);
    setItems(items.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="col fade-in" style={{ paddingTop: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Create order</h1>
          <p className="page-sub">Manually create a Shopify order on behalf of a customer</p>
        </div>
        <div className="page-head-actions">
          <button className="btn" onClick={() => setRoute && setRoute("orders")}><Icon name="chevron_left" /> Cancel</button>
          <button className="btn" onClick={() => handleSaveToCRM('draft')} disabled={savingMode !== null}>
            <Icon name={savingMode === 'draft' ? "refresh" : "save"} className={savingMode === 'draft' ? "spin" : ""} /> {savingMode === 'draft' ? 'Saving...' : 'Save Draft Order'}
          </button>
          <button className="btn primary" onClick={() => handleSaveToCRM('active')} disabled={savingMode !== null}>
            <Icon name={savingMode === 'active' ? "refresh" : "check"} className={savingMode === 'active' ? "spin" : ""} /> {savingMode === 'active' ? 'Creating...' : 'Create Active Order'}
          </button>
        </div>
      </div>

      <div className="grid-12">
        <div className="span-8 col">
          {/* Customer */}
          <div className="card">
            <div className="hstack-8">
              <div className="section-title">Customer</div>
            </div>
            {cust ? (
              <div className="hstack-12" style={{ marginTop: 12, padding: 12, background: "var(--surface-2)", borderRadius: 10 }}>
                <Avatar name={cust.name} hue={cust.avatarHue} />
                <div className="stack-2">
                  <div className="fw5">{cust.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}><span className="num">{cust.phone}</span> · {cust.email}</div>
                </div>
                <span className="spacer" />
                <RiskBadge risk={cust.risk} />
                <button className="btn sm ghost" onClick={() => setCust(null)}><Icon name="x" /></button>
              </div>
            ) : (
              <div className="grid-12" style={{ marginTop: 12 }}>
                <div className="span-6 field" style={{ position: "relative" }}>
                  <span className="lbl">First name *</span>
                  <input className="input" value={custFirstName} onFocus={() => setFocusedInput('name')} onBlur={() => setFocusedInput(null)} onChange={e => { setCustFirstName(e.target.value); setFocusedInput('name'); }} placeholder="Aamina" />
                  {focusedInput === 'name' && (customerRecommendations.length > 0 || isFetchingRecommendations) && (
                    <div style={{ position: "absolute", top: "100%", left: 0, width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 12px 32px rgba(15,23,42,.12)", zIndex: 100, overflow: "hidden", marginTop: 4 }}>
                      {isFetchingRecommendations ? <div className="muted" style={{ padding: 12, textAlign: "center", fontSize: 12 }}>Searching...</div> : customerRecommendations.map(c => (
                        <div key={c.id} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-soft)", cursor: "pointer" }} onMouseDown={(e) => { e.preventDefault(); handleSelectRecommendation(c); }}>
                          <div className="fw5">{c.first_name} {c.last_name}</div>
                          <div className="muted" style={{ fontSize: 12 }}>{c.phone || c.email || 'No contact info'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="span-6 field"><span className="lbl">Last name *</span><input className="input" value={custLastName} onChange={e => setCustLastName(e.target.value)} placeholder="Jan" /></div>
                <div className="span-6 field" style={{ position: "relative" }}>
                  <span className="lbl">Phone number *</span>
                  <input className="input" value={custPhone} onFocus={() => setFocusedInput('phone')} onBlur={() => setFocusedInput(null)} onChange={e => { setCustPhone(e.target.value); setFocusedInput('phone'); }} placeholder="+91 98765 43210" />
                  {focusedInput === 'phone' && (customerRecommendations.length > 0 || isFetchingRecommendations) && (
                    <div style={{ position: "absolute", top: "100%", left: 0, width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 12px 32px rgba(15,23,42,.12)", zIndex: 100, overflow: "hidden", marginTop: 4 }}>
                      {isFetchingRecommendations ? <div className="muted" style={{ padding: 12, textAlign: "center", fontSize: 12 }}>Searching...</div> : customerRecommendations.map(c => (
                        <div key={c.id} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-soft)", cursor: "pointer" }} onMouseDown={(e) => { e.preventDefault(); handleSelectRecommendation(c); }}>
                          <div className="fw5">{c.first_name} {c.last_name}</div>
                          <div className="muted" style={{ fontSize: 12 }}>{c.phone || c.email || 'No contact info'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="span-6 field"><span className="lbl">Email (optional)</span><input className="input" value={custEmail} onChange={e => setCustEmail(e.target.value)} placeholder="email@example.com" /></div>
              </div>
            )}
          </div>

          {/* Address */}
          <div className="card">
            <div className="hstack-8" style={{ alignItems: "flex-start" }}>
              <div className="section-title">Shipping address</div>
              <span className="spacer" />
              <label className="checkbox"><input type="checkbox" checked={differentBillingAddress} onChange={e => setDifferentBillingAddress(e.target.checked)} /> Different billing address</label>
            </div>
            <div className="grid-12" style={{ marginTop: 12 }}>
              <div className="span-12 field"><span className="lbl">Address *</span><input className="input" value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} placeholder="House / flat / street" /></div>
              <div className="span-5 field"><span className="lbl">Landmark</span><input className="input" value={shippingLandmark} onChange={e => setShippingLandmark(e.target.value)} placeholder="Near Apollo Hospital" /></div>
              <div className="span-3 field"><span className="lbl">Pincode *</span><input className="input num" value={pincode} onChange={e => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="400001" /></div>
              <div className="span-4 field"><span className="lbl">City *</span><input className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="Mumbai" /></div>
              <div className="span-6 field"><span className="lbl">State *</span>
                <select className="select" value={stateName} onChange={e => setStateName(e.target.value)}>
                  <option value="" disabled>Select State</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="span-6 field"><span className="lbl">Country</span>
                <select className="select" value={country} onChange={e => setCountry(e.target.value)}>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {autofillMessage && <div className="span-12 hstack-6" style={{ color: "var(--risk-low)", fontSize: 12 }}><Icon name="check" size={13} /> {autofillMessage}</div>}
            </div>
            
            {differentBillingAddress && (
              <>
                <div className="divider" style={{ margin: "20px -20px" }} />
                <div className="section-title" style={{ marginBottom: 12 }}>Billing address</div>
                <div className="grid-12">
                <div className="span-4 field"><span className="lbl">First name</span><input className="input" value={billingFirstName} onChange={e => setBillingFirstName(e.target.value)} placeholder="First name" /></div>
                <div className="span-4 field"><span className="lbl">Last name</span><input className="input" value={billingLastName} onChange={e => setBillingLastName(e.target.value)} placeholder="Last name" /></div>
                <div className="span-4 field"><span className="lbl">Phone number</span><input className="input" value={billingPhone} onChange={e => setBillingPhone(e.target.value)} placeholder="Phone" /></div>
                <div className="span-12 field"><span className="lbl">Address *</span><input className="input" value={billingAddress} onChange={e => setBillingAddress(e.target.value)} placeholder="House / flat / street" /></div>
                <div className="span-5 field"><span className="lbl">Landmark</span><input className="input" value={billingLandmark} onChange={e => setBillingLandmark(e.target.value)} placeholder="Near Apollo Hospital" /></div>
                <div className="span-3 field"><span className="lbl">Pincode *</span><input className="input num" value={billingPincode} onChange={e => setBillingPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="400001" /></div>
                <div className="span-4 field"><span className="lbl">City *</span><input className="input" value={billingCity} onChange={e => setBillingCity(e.target.value)} placeholder="Mumbai" /></div>
                <div className="span-6 field"><span className="lbl">State *</span>
                  <select className="select" value={billingStateName} onChange={e => setBillingStateName(e.target.value)}>
                    <option value="" disabled>Select State</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="span-6 field"><span className="lbl">Country</span>
                  <select className="select" value={billingCountry} onChange={e => setBillingCountry(e.target.value)}>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                  {billingAutofillMessage && <div className="span-12 hstack-6" style={{ color: "var(--risk-low)", fontSize: 12 }}><Icon name="check" size={13} /> {billingAutofillMessage}</div>}
                </div>
              </>
            )}
          </div>

          {/* Products */}
          <div className="card">
            <div className="hstack-8">
              <div className="section-title">Products</div>
              <span className="spacer" />
              {pay === "Prepaid" && (
                <label className="checkbox"><input type="checkbox" checked={includeSample} onChange={e => toggleFreeSample(e.target.checked)} /> Include Ashwagandha 30 Tablets (free sample)</label>
              )}
            </div>
            <div style={{ position: "relative", margin: "12px 0 8px" }}>
              <input className="input" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Search products by name..." style={{ paddingLeft: 34 }} />
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}><Icon name="search" size={14}/></span>
            </div>
            {isSearchingProducts && <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Searching products...</div>}
            {searchResults.length > 0 && (
              <div style={{ margin: "0 0 12px", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--surface)" }}>
                <div className="stack-2" style={{ maxHeight: 280, overflowY: "auto" }}>
                  {searchResults.map(product => {
                    const isSingleVariant = product.variants.length === 1 && product.variants[0].title === "Default Title";
                    if (isSingleVariant) {
                      const variant = product.variants[0];
                      return (
                        <div key={product.id} onClick={() => addVariantToOrder(variant, product)} className="hstack-12" style={{ justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div className="hstack-10" style={{ minWidth: 0 }}>
                            {product.image ? <img src={product.image} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} /> : <Icon name="pill" size={18} />}
                            <div className="stack-2" style={{ minWidth: 0 }}>
                              <span className="fw5" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{product.title}</span>
                              <span className="muted" style={{ fontSize: 12 }}>SKU <span className="mono">{variant.sku || "-"}</span></span>
                            </div>
                          </div>
                          <span className="num fw6" style={{ flexShrink: 0 }}>Rs. {(variant.price / 100).toLocaleString()}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={product.id}>
                        <div className="hstack-12" style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                          {product.image ? <img src={product.image} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} /> : <Icon name="pill" size={18} />}
                          <span className="fw5" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.title}</span>
                          <span className="spacer" />
                          <Badge tone="warn">{product.variants.length} variants</Badge>
                        </div>
                        {product.variants.map(variant => (
                          <div key={variant.id} onClick={() => addVariantToOrder(variant, product)} className="hstack-10" style={{ justifyContent: "space-between", padding: "9px 12px 9px 50px", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <div className="hstack-8" style={{ minWidth: 0 }}>
                              <span style={{ fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{variant.title}</span>
                              <span className="muted mono" style={{ fontSize: 12 }}>{variant.sku || "-"}</span>
                            </div>
                            <span className="num fw5" style={{ flexShrink: 0 }}>Rs. {(variant.price / 100).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="stack-8">
              {items.length === 0 && !includeSample && (
                <div className="center muted" style={{ padding: "18px 12px", border: "1px dashed var(--border)", borderRadius: 8, fontSize: 13 }}>
                  Search and add products to start this order.
                </div>
              )}
              {items.map((p, i) => {
                const lineTotal = getDiscountedUnitPrice(p) * p.qty;
                const discountAmount = Math.max(0, p.price - getDiscountedUnitPrice(p));
                const money = (value) => Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return (
                  <div key={p.id || i} className="hstack-12" style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 10, position: "relative" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent-ink)", overflow: "hidden", flexShrink: 0 }}>
                      {p.image ? <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon name="pill" size={20} />}
                    </div>
                    <div className="stack-2" style={{ flex: 1, minWidth: 0 }}>
                      <div className="fw5" style={{ textDecoration: "underline", textUnderlineOffset: 2 }}>{p.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{p.subtitle} · SKU <span className="mono">{p.sku}</span></div>
                    </div>
                    <div 
                      className="stack-2 num fw6" 
                      style={{ width: 92, position: "relative", textAlign: "right" }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          if (window.innerHeight - rect.bottom < 320) {
                            setDiscountPopupPos('top');
                          } else {
                            setDiscountPopupPos('bottom');
                          }
                          setActiveDiscountItemId(activeDiscountItemId === p.id ? null : p.id);
                        }}
                        onMouseEnter={() => setHoveredDiscountItemId(p.id)}
                        onMouseLeave={() => setHoveredDiscountItemId(null)}
                        style={{ border: 0, background: "transparent", padding: 0, color: "#005bd3", font: "inherit", fontWeight: 600, cursor: "pointer", textAlign: "right", textDecoration: "underline", textUnderlineOffset: 2, position: "relative" }}
                      >
                        Rs. {money(getDiscountedUnitPrice(p))}
                        {hoveredDiscountItemId === p.id && hasItemDiscount(p) && (
                          <div style={{ position: "absolute", bottom: "100%", right: "50%", transform: "translateX(50%)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 12px 32px rgba(15,23,42,.18)", color: "var(--fg)", fontWeight: 500, whiteSpace: "nowrap", zIndex: 10 }}>
                            <Icon name="settings" size={15} color="var(--muted)" /> 
                            {p.discountReason ? `${p.discountReason}: ` : 'discount: '}-Rs. {money(discountAmount)}
                          </div>
                        )}
                      </button>
                      {hasItemDiscount(p) && (
                        <div 
                          className="muted" 
                          style={{ textDecoration: "line-through", fontSize: 12, cursor: "default", position: "relative" }}
                        >
                          Rs. {money(p.price)}
                        </div>
                      )}
                      {activeDiscountItemId === p.id && (
                        <>
                          <div 
                            style={{ position: 'fixed', inset: 0, zIndex: 19 }} 
                            onClick={(e) => { e.stopPropagation(); setActiveDiscountItemId(null); }} 
                          />
                          <div style={{ position: "absolute", ...(discountPopupPos === 'top' ? { bottom: 30 } : { top: 30 }), right: -160, width: 280, padding: 18, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 18px 48px rgba(15,23,42,.18)", zIndex: 20, textAlign: "left" }}>
                            <div className="field" style={{ marginBottom: 14 }}>
                            <span className="lbl" style={{ color: "var(--fg)" }}>Discount type</span>
                            <select className="select" style={{ paddingRight: 32 }} value={p.discountType || "amount"} onChange={e => updateItemDiscount(p.id, "discountType", e.target.value)}>
                              <option value="amount">Amount</option>
                              <option value="percentage">Percentage</option>
                            </select>
                          </div>
                          <div className="field" style={{ marginBottom: 14 }}>
                            <span className="lbl" style={{ color: "var(--fg)" }}>Discount value (per unit)</span>
                            <div style={{ display: "flex", alignItems: "center", height: 40, border: "1px solid var(--accent)", borderRadius: 8, boxShadow: "0 0 0 2px var(--accent-soft)", overflow: "hidden" }}>
                              <span className="muted" style={{ paddingLeft: 12 }}>{p.discountType === "percentage" ? "%" : "Rs."}</span>
                              <input className="input" type="number" min="0" max={p.discountType === "percentage" ? 100 : p.price} value={p.discountValue || ""} onChange={e => updateItemDiscount(p.id, "discountValue", e.target.value)} placeholder="0.00" style={{ height: "100%", border: 0, boxShadow: "none", paddingLeft: 8 }} />
                              <span className="muted" style={{ paddingRight: 12 }}>{p.discountType === "percentage" ? "" : "INR"}</span>
                            </div>
                          </div>
                          <div className="field" style={{ marginBottom: 8 }}>
                            <span className="lbl" style={{ color: "var(--fg)" }}>Reason for discount</span>
                            <input className="input" value={p.discountReason || ""} onChange={e => updateItemDiscount(p.id, "discountReason", e.target.value)} />
                          </div>
                          <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>Visible to customer</div>
                          <div className="hstack-8">
                            {hasItemDiscount(p) && <button className="btn sm ghost" onClick={() => updateItemDiscount(p.id, "discountValue", "")}>Clear</button>}
                            <span className="spacer" />
                            <button className="btn sm primary" onClick={() => setActiveDiscountItemId(null)}>Done</button>
                          </div>
                          </div>
                        </>
                      )}
                    </div>
                    <input
                      className="input order-qty-input num"
                      type="number"
                      min="1"
                      value={p.qty}
                      onChange={e => { const c = [...items]; c[i].qty = Math.max(1, Number(e.target.value) || 1); setItems(c); }}
                    />
                    <div className="num fw6" style={{ width: 86, textAlign: "right" }}>Rs. {money(lineTotal)}</div>
                    <button className="btn sm ghost" onClick={() => removeOrderItem(i)}><Icon name="x" /></button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="span-4 col">
          <div className="card" style={{ position: "relative" }}>
            <div className="section-title">Order summary</div>
            <div className="stack-8" style={{ marginTop: 14 }}>
              <Row k="Subtotal" v={`Rs. ${subtotal.toLocaleString()}`} />
              <Row k={`Shipping${shippingLabel !== "Free" ? ` (${shippingLabel})` : ""}`} v={shipping ? `Rs. ${shipping}` : "Free"} />
              <div 
                className="hstack-8" 
                style={{ fontSize: 13, cursor: "pointer" }} 
                onClick={(e) => { e.stopPropagation(); setOrderDiscountPopupOpen(true); }}
                title={discount > 0 ? `${orderDiscountIsCustom ? 'Custom discount' : 'Discount'}${orderDiscountReason ? ` - ${orderDiscountReason}` : ''}` : ''}
              >
                <span style={{ color: "#3b82f6" }}>{discount > 0 ? 'Discount' : 'Add discount'}</span>
                <span className="spacer" />
                <span className="num fw5" style={{ color: discount ? "var(--fg)" : "var(--muted)" }}>{discount ? `− Rs. ${discount}` : "—"}</span>
              </div>
              {orderDiscountPopupOpen && createPortal(
                <div className={`theme-light accent-rose ${orderDiscountPopupClosing ? 'fade-out' : 'fade-in'}`} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg)' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)' }} onClick={(e) => {
                    e.stopPropagation();
                    if (orderDiscountIsCustom || orderDiscountCode) {
                      setDiscountShake(true);
                      setTimeout(() => setDiscountShake(false), 400);
                    } else {
                      setOrderDiscountPopupClosing(true);
                      setTimeout(() => { setOrderDiscountPopupClosing(false); setOrderDiscountPopupOpen(false); }, 200);
                    }
                  }} />
                  <div className={discountShake ? "shake" : ""} style={{ position: "relative", width: 440, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 24px 60px rgba(0,0,0,.2)", textAlign: "left", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
                    <div className="hstack-10" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                      <div className="fw6">Add discount</div>
                      <span className="spacer" />
                      <button className="btn sm ghost icon" onClick={() => { setOrderDiscountPopupClosing(true); setTimeout(() => { setOrderDiscountPopupClosing(false); setOrderDiscountPopupOpen(false); }, 200); }}><Icon name="x" /></button>
                    </div>
                    <div className="stack-12" style={{ padding: "20px" }}>
                      <div className="stack-4">
                        <span className="fw5" style={{ fontSize: 13 }}>Discount codes</span>
                        <input className="input" placeholder="Enter a discount code" value={orderDiscountCode} onChange={e => setOrderDiscountCode(e.target.value)} />
                      </div>
                      
                      <label className="hstack-8" style={{ alignItems: "flex-start", cursor: "pointer" }}>
                        <input type="checkbox" checked={orderDiscountApplyAutomatic} onChange={e => setOrderDiscountApplyAutomatic(e.target.checked)} style={{ marginTop: 2 }} />
                        <div className="stack-2">
                          <span style={{ fontSize: 13 }}>Apply all eligible automatic discounts</span>
                          <span className="muted" style={{ fontSize: 12 }}>No eligible automatic discounts</span>
                        </div>
                      </label>

                      <label className="hstack-8" style={{ alignItems: "center", cursor: "pointer" }}>
                        <input type="checkbox" checked={orderDiscountIsCustom} onChange={e => setOrderDiscountIsCustom(e.target.checked)} />
                        <span style={{ fontSize: 13 }}>Add custom order discount</span>
                      </label>

                      {orderDiscountIsCustom && (
                        <div className="stack-8" style={{ marginTop: 8, paddingLeft: 24 }}>
                          <div className="hstack-8">
                            <div className="field span-6" style={{ margin: 0 }}>
                              <span className="lbl">Discount type</span>
                              <select className="select" value={orderDiscountType} onChange={e => setOrderDiscountType(e.target.value)}>
                                <option value="amount">Amount</option>
                                <option value="percentage">Percentage</option>
                              </select>
                            </div>
                            <div className="field span-6" style={{ margin: 0 }}>
                              <span className="lbl">Discount value</span>
                              <div style={{ display: "flex", alignItems: "center", height: 40, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                                <span className="muted" style={{ paddingLeft: 12 }}>{orderDiscountType === "percentage" ? "%" : "Rs."}</span>
                                <input className="input num" type="number" min="0" value={orderDiscountValue} onChange={e => setOrderDiscountValue(e.target.value)} placeholder="0.00" style={{ height: "100%", border: 0, paddingLeft: 8, minWidth: 0, width: "100%" }} />
                              </div>
                            </div>
                          </div>
                          <div className="field" style={{ margin: 0 }}>
                            <span className="lbl">Reason for discount</span>
                            <input className="input" value={orderDiscountReason} onChange={e => setOrderDiscountReason(e.target.value)} />
                            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Visible to customer</div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="hstack-8" style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", justifyContent: "flex-end", background: "var(--surface-2)", borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
                      <button className="btn ghost" onClick={() => { setOrderDiscountPopupClosing(true); setTimeout(() => { setOrderDiscountPopupClosing(false); setOrderDiscountPopupOpen(false); }, 200); }}>Cancel</button>
                      <button className="btn primary" onClick={() => { setOrderDiscountPopupClosing(true); setTimeout(() => { setOrderDiscountPopupClosing(false); setOrderDiscountPopupOpen(false); }, 200); }}>Done</button>
                    </div>
                  </div>
                </div>, document.querySelector('.app') || document.body
              )}
              <div className="divider" style={{ margin: "4px 0" }} />
              <div className="hstack-8" style={{ alignItems: "baseline" }}>
                <span className="fw6">Total</span>
                <span className="spacer" />
                <span className="fw5 num" style={{ fontSize: 20, letterSpacing: "-0.015em" }}>Rs. {total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-title" style={{ marginBottom: 10 }}>Payment</div>
            <div className="stack-8">
              {["Prepaid","COD"].map(p => (
                <div key={p} className="stack-8">
                  <label className="hstack-10" style={{ padding: 12, border: "1px solid " + (pay === p ? "var(--accent)" : "var(--border)"), borderRadius: 10, cursor: "pointer", background: pay === p ? "var(--accent-soft)" : "transparent" }}>
                    <input type="radio" checked={pay === p} onChange={() => setPay(p)} style={{ accentColor: "var(--accent)" }} />
                    <div className="stack-2">
                      <div className="fw5">{p === "Prepaid" ? "Prepaid · UPI / Card" : "Cash on Delivery"}</div>
                      {p === "Prepaid" && <div className="muted" style={{ fontSize: 12 }}>Send Razorpay link via WhatsApp</div>}
                    </div>
                    {p === "COD" && (
                      <>
                        <span className="spacer" />
                        <Icon name={pay === p ? "chevron_up" : "chevron_down"} size={16} className="muted" />
                      </>
                    )}
                  </label>
                  {p === "COD" && pay === "COD" && (
                    <div style={{ marginLeft: 32, padding: "12px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                      <div className="fw6" style={{ marginBottom: 8, fontSize: 13 }}>Shipping method</div>
                      {isLoadingShipping ? (
                        <div className="muted" style={{ fontSize: 13 }}>Loading rates...</div>
                      ) : (
                        <div className="stack-6">
                          {!useCustomShipping && shippingRates
                            .filter(r => /cod|cash|delivery/i.test(r.title) && !/prepaid/i.test(r.title))
                            .map((rate, i) => (
                            <label key={i} className="hstack-8" style={{ cursor: "pointer" }}>
                              <input type="radio" name="shippingRate" checked={selectedShipping?.id === rate.id} onChange={() => setSelectedShipping(rate)} />
                              <span style={{ fontSize: 13 }}>{rate.title}</span>
                              <span className="spacer" />
                              <span className="num fw5" style={{ fontSize: 13 }}>Rs. {rate.price}</span>
                            </label>
                          ))}
                          {useCustomShipping ? (
                            <div className="stack-8" style={{ background: "var(--surface)", padding: 12, borderRadius: 8, border: "1px solid var(--accent)" }}>
                              <div className="hstack-8">
                                <div className="field span-6" style={{ margin: 0 }}><span className="lbl">Label</span><input className="input" value={customShippingTitle} onChange={e => setCustomShippingTitle(e.target.value)} placeholder="Express Delivery" /></div>
                                <div className="field span-6" style={{ margin: 0 }}><span className="lbl">Rate (Rs.)</span><input className="input num" type="number" value={customShippingPrice} onChange={e => setCustomShippingPrice(e.target.value)} placeholder="150" /></div>
                              </div>
                              <button className="btn sm ghost" onClick={() => setUseCustomShipping(false)}>Cancel custom rate</button>
                            </div>
                          ) : (
                            <button className="btn sm ghost" style={{ alignSelf: "flex-start", marginTop: 4 }} onClick={() => setUseCustomShipping(true)}><Icon name="plus" size={14} /> Add custom shipping rate</button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-title" style={{ marginBottom: 10 }}>Tags & note</div>
            <input className="input" placeholder="Tags: pcos, high-risk" />
            <textarea className="textarea" style={{ marginTop: 8 }} placeholder="Order note (visible internally only)..." rows="3" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return <div className="hstack-8" style={{ fontSize: 13 }}><span className="muted">{k}</span><span className="spacer" /><span className="num fw5">{v}</span></div>;
}

/* â”€â”€ Order history â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const formatOrderDate = (dateString) => {
  const d = new Date(dateString);
  const now = new Date();
  const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();

  const diffTime = Math.abs(now - d);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  let dayStr = "";
  if (isToday) {
    dayStr = "Today";
  } else if (isYesterday) {
    dayStr = "Yesterday";
  } else if (diffDays <= 7) {
    dayStr = d.toLocaleDateString('en-US', { weekday: 'long' });
  } else {
    dayStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  }
  
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  return `${dayStr} at ${timeStr}`;
};


export function parseCSV(text) {
  if (text.trim().toLowerCase().startsWith('<!doctype') || text.trim().toLowerCase().startsWith('<html')) throw new Error('HTML_RESPONSE');
  const rows = []; let field = ''; let row = []; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; } } else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; } else if (ch === ',') { row.push(field); field = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; if (row.some(c => c !== '')) rows.push(row); row = []; } else { field += ch; }
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); if (row.some(c => c !== '')) rows.push(row); }
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.trim());
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) { obj[headers[j]] = (rows[i][j] || '').trim(); }
    result.push(obj);
  }
  return result;
}

function CRMOrders({ setRoute, openCustomer }) {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showOnlyMyOrders, setShowOnlyMyOrders] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vSL_HNjTH0rykbrl-q3GwYZ6SDYrskbsCa-VxgtA2qVTXkxIl8r4SpLF_ne95EHK8wfcqYNFwjNMPqI/pub?output=csv');
      const text = await res.text();
      setOrders(parseCSV(text).reverse());
    } catch (err) {
      console.error('Failed to fetch CRM orders:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const myName = window.SehatData?.me?.name || '';
  const filteredOrders = useMemo(() => {
    let list = orders;
    if (showOnlyMyOrders) { list = list.filter(o => o['Updated By'] === myName); }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(o => 
      (o['First Name'] || '').toLowerCase().includes(q) ||
      (o['Last Name'] || '').toLowerCase().includes(q) ||
      (o['Phone Number'] || '').toLowerCase().includes(q) ||
      (o['District/City'] || '').toLowerCase().includes(q) ||
      (o['State'] || '').toLowerCase().includes(q)
    );
  }, [orders, search, showOnlyMyOrders, myName]);

  return (
    <div className='col fade-in'>
      <div className='page-head'>
        <div>
          <h1 className='page-title'>CRM orders</h1>
          <p className='page-sub'>Orders created manually from the CRM and stored in Google Sheets</p>
        </div>
        <div className='page-head-actions'>
          <button className='btn' onClick={fetchOrders} disabled={isLoading}>
            <Icon name='refresh' /> {isLoading ? 'Loading...' : 'Refresh'}
          </button>
          <button className='btn primary' onClick={() => setRoute && setRoute('order_create')}>
            <Icon name='plus' /> New order
          </button>
        </div>
      </div>
      <div className='card' style={{ marginBottom: 16 }}>
        <div className='hstack-12'>
          <div className='topbar-search' style={{ flex: 1, margin: 0, maxWidth: 'none', background: 'var(--surface)' }}>
            <Icon name='search' />
            <input placeholder='Search by name, phone, city, state...' value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type='checkbox' checked={showOnlyMyOrders} onChange={e => setShowOnlyMyOrders(e.target.checked)} />
            Show only my orders
          </label>
        </div>
      </div>
      <div className='card' style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading && orders.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Icon name='refresh' className='spin' />
            <div style={{ marginTop: 12 }}>Loading CRM orders...</div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>
            <Icon name='clipboard' size={40} />
            <div className='fw6' style={{ marginTop: 12, color: 'var(--fg)' }}>No CRM orders found</div>
            <div style={{ fontSize: 13 }}>Try adjusting your search or create a new order.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className='tbl' style={{ minWidth: 1000 }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: "nowrap" }}>Name</th>
                  <th style={{ whiteSpace: "nowrap" }}>Phone Number</th>
                  <th style={{ minWidth: 200 }}>Address</th>
                  <th style={{ whiteSpace: "nowrap" }}>Shopify Order</th>
                  <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Items</th>
                  <th style={{ whiteSpace: "nowrap" }}>Amount</th>
                  <th style={{ whiteSpace: "nowrap" }}>Payment</th>
                  <th style={{ whiteSpace: "nowrap" }}>Status</th>
                  <th style={{ whiteSpace: "nowrap" }}>CRM Last Updated</th>
                  <th style={{ whiteSpace: "nowrap" }}>Updated By</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o, i) => {
                  const oPhone = (o['Phone Number'] || '').replace(/\D/g, '');
                  const shopifyOrder = window.SehatData?.ORDERS?.find(s => {
                    const cPhone = (s.customer?.phone || '').replace(/\D/g, '');
                    return cPhone && oPhone && cPhone === oPhone;
                  });

                  return (
                    <tr key={i} style={{ opacity: shopifyOrder?.status === 'Cancelled' ? 0.6 : 1, textDecoration: shopifyOrder?.status === 'Cancelled' ? 'line-through' : 'none' }}>
                      <td className='fw6' style={{ whiteSpace: "nowrap" }}>
                        {o['First Name'] || ''} {o['Last Name'] || ''}
                      </td>
                      <td className='num' style={{ whiteSpace: "nowrap" }}>{o['Phone Number'] || '-'}</td>
                      <td>
                        <div className='stack-2' style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                          <div>{o['Address'] || '-'}</div>
                          <div className='muted' style={{ fontSize: 11 }}>
                            {o['Landmark'] ? 'Landmark: ' + o['Landmark'] + ' · ' : ''}
                            {o['District/City']} {o['State']} {o['Pin Code']}
                          </div>
                        </div>
                      </td>
                      <td className="mono num fw5" style={{ whiteSpace: "nowrap" }}>
                        {shopifyOrder ? `#${shopifyOrder.id}` : '-'}
                      </td>
                      <td className="muted" style={{ textAlign: "center", position: "relative" }}>
                        {shopifyOrder && shopifyOrder.items ? (
                          <>
                            <button 
                              className="item-hover-btn" 
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", fontWeight: "normal", padding: "4px 8px" }}
                              onClick={(e) => { e.stopPropagation(); setExpandedOrderId(expandedOrderId === i ? null : i); }}
                            >
                              <span className="num fw5" style={{ fontSize: 13 }}>{shopifyOrder.items.length}</span> {shopifyOrder.items.length === 1 ? 'item' : 'items'}
                              <Icon name={expandedOrderId === i ? "chevron_up" : "chevron_down"} size={14} className="muted" />
                            </button>
                            {expandedOrderId === i && (
                              <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.1)", zIndex: 100, padding: 16, minWidth: 320, textAlign: "left" }}>
                                <div className="fw6" style={{ marginBottom: 16, color: "var(--text)" }}>Items</div>
                                <div className="stack-12">
                                  {shopifyOrder.items.map((it, idx) => (
                                    <div key={idx} className="hstack-10">
                                      <div style={{ width: 44, height: 44, background: "var(--surface-2)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid var(--border)", overflow: "hidden" }}>
                                        {it.image ? <img src={it.image} alt={it.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon name="package" size={20} className="muted" />}
                                      </div>
                                      <div className="stack-2" style={{ flex: 1, minWidth: 0 }}>
                                        <div className="fw5" style={{ fontSize: 13, color: "var(--text)", whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.3 }}>{it.name}</div>
                                      </div>
                                      <div className="muted fw5" style={{ fontSize: 13, flexShrink: 0 }}>x {it.qty}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        ) : '-'}
                      </td>
                      <td className="num fw5" style={{ whiteSpace: "nowrap" }}>
                        {shopifyOrder ? `Rs. ${shopifyOrder.amount.toLocaleString()}` : '-'}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {shopifyOrder && typeof PaymentStatusBadge !== 'undefined' ? <PaymentStatusBadge status={shopifyOrder.paymentMode || shopifyOrder.paymentStatus || 'Pending'} /> : '-'}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {shopifyOrder && typeof OrderStatusBadge !== 'undefined' ? <OrderStatusBadge status={shopifyOrder.status} /> : '-'}
                      </td>
                      <td className='muted num' style={{ whiteSpace: "nowrap" }}>{o['Last Updated'] || '-'}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {o['Updated By'] ? <Badge tone='low'>{o['Updated By']}</Badge> : '-'}
                      </td>
                      <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                        <button 
                          className="btn sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (setRoute) {
                              setRoute('order_create', { 
                                customer: { 
                                  name: ((o['First Name'] || '') + ' ' + (o['Last Name'] || '')).trim(), 
                                  phone: o['Phone Number'] || '', 
                                  pincode: o['Pin Code'] || '', 
                                  city: o['District/City'] || '', 
                                  state: o['State'] || '', 
                                  address: o['Address'] || '',
                                  landmark: o['Landmark'] || ''
                                } 
                              });
                            }
                          }}
                        >
                          <Icon name="refresh" /> Reorder
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ padding: '12px 16px', fontSize: 12, borderTop: '1px solid var(--border)', color: 'var(--muted)' }}>
              Showing {filteredOrders.length} of {orders.length} orders
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OrdersHistory({ setRoute, openCustomer }) {
  const [tab, setTab] = useStateO("all");
  const [orders, setOrders] = useStateO([]);
  const [loading, setLoading] = useStateO(true);
  const [expandedOrderId, setExpandedOrderId] = useStateO(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      try {
        const data = await getOrders({ limit: 50, status: 'any' });

        let imageMap = {};
        const productIds = [...new Set(data.flatMap(o => o.line_items?.map(i => i.product_id)).filter(Boolean))];
        if (productIds.length > 0) {
          try {
            const query = `
              query {
                nodes(ids: [${productIds.map(id => `"gid://shopify/Product/${id}"`).join(",")}]) {
                  ... on Product {
                    id
                    featuredImage { url }
                  }
                }
              }
            `;
            const imgRes = await fetch('/shopify-v2/graphql.json', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query }),
            });
            const imgData = await imgRes.json();
            imgData?.data?.nodes?.forEach(node => {
              if (node && node.featuredImage) {
                const pId = parseInt(node.id.split('/').pop(), 10);
                imageMap[pId] = node.featuredImage.url;
              }
            });
          } catch (e) {
            console.error("Failed to fetch product images for orders", e);
          }
        }

        const mapped = data.map(o => ({
          id: o.order_number || o.id,
          status: o.cancelled_at ? 'Cancelled' : (o.fulfillment_status === 'fulfilled' ? 'Shipped' : (o.financial_status === 'paid' ? 'Packed' : 'Placed')),
          amount: parseFloat(o.total_price || 0),
          paymentMode: o.gateway || 'COD',
          paymentStatus: o.financial_status === 'paid' ? 'Paid' : (o.financial_status === 'pending' ? 'Payment pending' : (o.financial_status ? (o.financial_status.charAt(0).toUpperCase() + o.financial_status.slice(1).replace('_', ' ')) : 'Payment pending')),
          placedAt: formatOrderDate(o.created_at),
          courier: "Standard",
          awb: o.fulfillments?.[0]?.tracking_number || "-",
          items: o.line_items?.map(i => ({ qty: i.quantity, name: i.name || i.title, image: imageMap[i.product_id] || null })) || [],
          customer: {
            name: `${o.customer?.first_name || ""} ${o.customer?.last_name || ""}`.trim() || "Unknown",
            phone: o.customer?.phone || o.shipping_address?.phone || "-",
            avatarHue: Math.floor(Math.random() * 360)
          }
        }));
        setOrders(mapped);
      } catch (err) {
        console.error("Error fetching orders", err);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  const counts = orders.reduce((m, o) => { m[o.status] = (m[o.status] || 0) + 1; return m; }, {});
  const totalRev = orders.reduce((s, o) => s + o.amount, 0);

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-sub">{loading ? "Syncing..." : "Synced from Shopify in real-time"}</p>
        </div>
        <div className="page-head-actions">
          <button className="btn"><Icon name="download" /> Export</button>
          <button className="btn primary" onClick={() => setRoute && setRoute("order_create")}><Icon name="plus" /> New order</button>
        </div>
      </div>

      <div className="grid-12">
        <div className="span-3"><KPI label="Orders (30d)" value={loading ? "..." : orders.length.toLocaleString()} icon="package" /></div>
        <div className="span-3"><KPI label="Revenue (30d)" value={loading ? "..." : "Rs. " + totalRev.toLocaleString()} icon="trend_up" /></div>
        <div className="span-3"><KPI label="Avg. order value" value={loading ? "..." : (orders.length ? "Rs. " + Math.round(totalRev / orders.length).toLocaleString() : "Rs. 0")} icon="bar" /></div>
        <div className="span-3"><KPI label="COD share" value="-" icon="truck" /></div>
      </div>

      <div className="toolbar">
        <Tabs value={tab} onChange={setTab} items={[
          { label: "All", value: "all", count: orders.length },
          { label: "Placed", value: "Placed", count: counts.Placed || 0 },
          { label: "Packed", value: "Packed", count: counts.Packed || 0 },
          { label: "Shipped", value: "Shipped", count: counts.Shipped || 0 },
          { label: "Delivered", value: "Delivered", count: counts.Delivered || 0 },
          { label: "Failed", value: "Failed delivery", count: counts["Failed delivery"] || 0 },
        ]} />
        <span className="spacer" />
        <FilterBar>
          <span className="chip"><Icon name="calendar" /> Last 30 days <Icon name="chevron_down" /></span>
          <span className="chip"><Icon name="truck" /> All couriers <Icon name="chevron_down" /></span>
        </FilterBar>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Customer</th>
                <th style={{ textAlign: "center" }}>Items</th>
                <th>Amount</th>
                <th>Payment status</th>
                <th>Status</th>
                <th>Courier</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(tab === "all" ? orders : orders.filter(o => o.status === tab)).map(o => (
                <tr key={o.id} style={{ textDecoration: o.status === 'Cancelled' ? 'line-through' : 'none', opacity: o.status === 'Cancelled' ? 0.6 : 1, transition: 'all 0.2s' }}>
                  <td className="mono num fw5">#{o.id}</td>
                  <td className="muted num">{o.placedAt}</td>
                  <td>
                    <div className="hstack-10">
                      <Avatar name={o.customer.name} hue={o.customer.avatarHue} size="sm" />
                      <div className="stack-2" style={{ textAlign: "left" }}>
                        <div className="fw5">{o.customer.name}</div>
                        <div className="muted num" style={{ fontSize: 11.5 }}>{o.customer.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="muted" style={{ textAlign: "center", position: "relative" }}>
                    <button 
                      className="item-hover-btn" 
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", fontWeight: "normal", padding: "4px 8px" }}
                      onClick={(e) => { e.stopPropagation(); setExpandedOrderId(expandedOrderId === o.id ? null : o.id); }}
                    >
                      <span className="num fw5" style={{ fontSize: 13 }}>{o.items.length}</span> {o.items.length === 1 ? 'item' : 'items'}
                      <Icon name={expandedOrderId === o.id ? "chevron_up" : "chevron_down"} size={14} className="muted" />
                    </button>
                    {expandedOrderId === o.id && (
                      <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.1)", zIndex: 100, padding: 16, minWidth: 320, textAlign: "left" }}>
                        <div className="fw6" style={{ marginBottom: 16, color: "var(--text)" }}>Items</div>
                        <div className="stack-12">
                          {o.items.map((it, idx) => (
                            <div key={idx} className="hstack-10">
                              <div style={{ width: 44, height: 44, background: "var(--surface-2)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid var(--border)", overflow: "hidden" }}>
                                {it.image ? <img src={it.image} alt={it.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon name="package" size={20} className="muted" />}
                              </div>
                              <div className="stack-2" style={{ flex: 1, minWidth: 0 }}>
                                <div className="fw5" style={{ fontSize: 13, color: "var(--text)", whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.3 }}>{it.name}</div>
                              </div>
                              <div className="muted fw5" style={{ fontSize: 13, flexShrink: 0 }}>x {it.qty}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="num fw5">Rs. {o.amount.toLocaleString()}</td>
                  <td><PaymentStatusBadge status={o.paymentStatus} /></td>
                  <td><OrderStatusBadge status={o.status} /></td>
                  <td>
                    <div className="stack-2">
                      <div style={{ fontSize: 12.5 }}>{o.courier}</div>
                      <div className="muted mono" style={{ fontSize: 11 }}>{o.awb}</div>
                    </div>
                  </td>
                  <td className="right"><button className="btn sm ghost"><Icon name="more" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PaymentStatusBadge({ status }) {
  if (status.toLowerCase() === 'paid') {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--text)', fontSize: 12.5, fontWeight: 500 }}>
        <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--muted)', flexShrink: 0 }} />
        {status}
      </div>
    );
  } else {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 999, background: '#ffebb3', color: '#8c6000', fontSize: 12.5, fontWeight: 500 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #8c6000', background: 'transparent', flexShrink: 0 }} />
        {status}
      </div>
    );
  }
}

function OrderStatusBadge({ status }) {
  const map = {
    "Placed": { tone: null, color: "var(--muted)" },
    "Packed": { tone: null, color: "var(--accent)" },
    "Shipped": { tone: null, color: "var(--accent-2)" },
    "Out for delivery": { tone: "moderate", color: "var(--risk-moderate)" },
    "Delivered": { tone: "low", color: "var(--risk-low)" },
    "Returned": { tone: null, color: "var(--muted)" },
    "Failed delivery": { tone: "critical", color: "var(--risk-critical)" },
    "Cancelled": { tone: "critical", color: "var(--risk-critical)" },
  };
  const c = map[status] || map.Placed;
  return <span className="status"><span className="dotx" style={{ background: c.color }} /><span style={{ color: c.color }}>{status}</span></span>;
}




// --- screens-shipments.jsx ---
// screens-shipments.jsx — Logistics command center
// Pieces:
//  • Hero KPI strip with sparklines
//  • Pipeline strip (6 stage columns with counts + delta)
//  • Failed-delivery action banner (urgent, dismissible from view)
//  • Main 8/4 grid:
//      - Left: filter tabs + rich shipments table (with stage progress bar per row, SLA chip, action menu)
//      - Right: Detail panel — header, route map (SVG), stage timeline, customer contact, actions
//  • Bottom: Courier performance + SLA performance over time + Pincode heat (top failing pincodes)



const STAGES = [
  { key: "Awaiting tracking", label: "Awaiting",          short: "AW", color: "var(--muted)" },
  { key: "Shipped",           label: "In transit",         short: "SH", color: "#5b8def" },
  { key: "Out for delivery",  label: "Out for delivery",  short: "OFD",color: "var(--risk-moderate)" },
  { key: "Delivered",         label: "Delivered",         short: "DL", color: "var(--risk-low)" },
  { key: "Failed delivery",   label: "Failed",            short: "FL", color: "var(--risk-critical)" },
];
const STAGE_ORDER = ["Shipped","Out for delivery","Delivered"];
function stageIndex(s) { return STAGE_ORDER.indexOf(s); }

function ShipmentsScreen() {
  const [shipments, setShipments] = useStateS([]);
  const [loading, setLoading] = useStateS(true);
  const [trackingMap, setTrackingMap] = useStateS({});

  // Fetch orders from Shopify
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getOrders({ limit: 100, status: 'any' });
        const mapped = data.map(o => {
          const awb = o.fulfillments?.[0]?.tracking_number || '-';
          const courier = o.fulfillments?.[0]?.tracking_company || 'Nimbus';
          const shopifyStatus = o.cancelled_at ? 'Failed delivery'
            : o.fulfillment_status === 'fulfilled' ? 'Shipped'
            : o.fulfillment_status === 'partial' ? 'Packed'
            : 'Placed';
          return {
            id: '#' + (o.order_number || o.id),
            awb,
            courier,
            status: shopifyStatus,
            amount: parseFloat(o.total_price || 0),
            paymentMode: (o.gateway || '').toLowerCase().includes('cash') ? 'COD' : (o.payment_gateway_names?.[0] || 'Prepaid'),
            slaDaysLeft: 2,
            lastUpdate: o.updated_at ? new Date(o.updated_at).toLocaleString() : '-',
            lastLocation: '',
            eta: '-',
            origin: 'Warehouse',
            attempts: 1,
            items: o.line_items?.map(i => ({ qty: i.quantity, name: i.name || i.title })) || [],
            customer: {
              name: (`${o.customer?.first_name || ''} ${o.customer?.last_name || ''}`).trim() || 'Unknown',
              phone: o.customer?.phone || o.shipping_address?.phone || '-',
              city: o.shipping_address?.city || '-',
              state: o.shipping_address?.province || '-',
              avatarHue: Math.abs(o.customer?.id || 0) % 360,
            },
            shippingAddress: [o.shipping_address?.address1, o.shipping_address?.city, o.shipping_address?.province, o.shipping_address?.zip].filter(Boolean).join(', '),
          };
        });
        setShipments(mapped);
      } catch (err) {
        console.error('Shipments load error', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Live tracking events from Firestore nimbus_tracking
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'nimbus_tracking'), snap => {
      const map = {};
      snap.docs.forEach(d => {
        const ev = d.data();
        if (!ev.awb_number) return;
        if (!map[ev.awb_number]) map[ev.awb_number] = [];
        map[ev.awb_number].push(ev);
      });
      Object.keys(map).forEach(awb => {
        map[awb].sort((a, b) => (b.event_time || '').localeCompare(a.event_time || ''));
      });
      setTrackingMap(map);
    });
    return unsub;
  }, []);

  // Merge Nimbus tracking status into shipments
  const mergedShipments = useMemoS(() => {
    return shipments.map(s => {
      const events = trackingMap[s.awb] || [];
      // No Nimbus events yet — show as awaiting, not a guessed Shopify status
      if (events.length === 0) return { ...s, status: 'Awaiting tracking', hasTracking: false };
      const latest = events[0];
      const ns = (latest.status || '').toLowerCase();
      let status = 'Shipped';
      if (ns.includes('delivered') && !ns.includes('out')) status = 'Delivered';
      else if (ns.includes('out for delivery') || ns === 'out_for_delivery') status = 'Out for delivery';
      else if (ns.includes('transit') || ns === 'in transit') status = 'Shipped';
      else if (ns.includes('rto') || ns.includes('return') || ns.includes('fail') || ns.includes('cancel')) status = 'Failed delivery';
      else if (ns.includes('picked') || ns.includes('shipped') || ns.includes('dispatch')) status = 'Shipped';
      return { ...s, status, hasTracking: true, lastUpdate: latest.event_time || s.lastUpdate, lastLocation: latest.location || '' };
    });
  }, [shipments, trackingMap]);

  const [tab, setTab] = useStateS("all");
  const [sel, setSel] = useStateS(null);
  const [bannerOn, setBannerOn] = useStateS(true);
  const [search, setSearch] = useStateS('');

  useEffect(() => {
    if (!sel && mergedShipments.length > 0) setSel(mergedShipments[0]);
  }, [mergedShipments, sel]);

  const counts = useMemoS(() => {
    const m = {};
    STAGES.forEach(s => m[s.key] = mergedShipments.filter(x => x.status === s.key).length);
    m.attention = mergedShipments.filter(x => x.status === 'Failed delivery').length;
    m.all = mergedShipments.length;
    return m;
  }, [mergedShipments]);

  const filteredList = useMemoS(() => {
    let list = tab === 'all' ? mergedShipments
      : tab === 'attention' ? mergedShipments.filter(s => s.status === 'Failed delivery')
      : mergedShipments.filter(s => s.status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.awb.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.customer.name.toLowerCase().includes(q));
    }
    return list;
  }, [tab, mergedShipments, search]);

  const awaiting = mergedShipments.filter(s => !s.hasTracking).length;
  const inTransit = mergedShipments.filter(s => s.status === 'Shipped').length;
  const delivered = mergedShipments.filter(s => s.status === 'Delivered').length;
  const failed = mergedShipments.filter(s => s.status === 'Failed delivery').length;

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const data = await getOrders({ limit: 100, status: 'any' });
      const mapped = data.map(o => {
        const fn = o.customer?.first_name || '';
        const ln = o.customer?.last_name || '';
        return {
          id: '#' + (o.order_number || o.id),
          awb: o.fulfillments?.[0]?.tracking_number || '-',
          courier: o.fulfillments?.[0]?.tracking_company || 'Nimbus',
          status: o.cancelled_at ? 'Failed delivery' : o.fulfillment_status === 'fulfilled' ? 'Shipped' : o.fulfillment_status === 'partial' ? 'Packed' : 'Placed',
          amount: parseFloat(o.total_price || 0),
          paymentMode: (o.gateway || '').toLowerCase().includes('cash') ? 'COD' : 'Prepaid',
          slaDaysLeft: 2,
          lastUpdate: o.updated_at ? new Date(o.updated_at).toLocaleString() : '-',
          lastLocation: '',
          eta: '-',
          origin: 'Warehouse',
          attempts: 1,
          items: o.line_items?.map(i => ({ qty: i.quantity, name: i.name || i.title })) || [],
          customer: {
            name: (fn + ' ' + ln).trim() || 'Unknown',
            phone: o.customer?.phone || o.shipping_address?.phone || '-',
            city: o.shipping_address?.city || '-',
            state: o.shipping_address?.province || '-',
            avatarHue: Math.abs(o.customer?.id || 0) % 360,
          },
          shippingAddress: [o.shipping_address?.address1, o.shipping_address?.city, o.shipping_address?.province, o.shipping_address?.zip].filter(Boolean).join(', '),
        };
      });
      setShipments(mapped);
    } catch (e) {
      console.error('Refresh error', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Shipments</h1>
          <p className="page-sub">{loading ? "Loading orders..." : `${mergedShipments.length} shipments · ${awaiting} awaiting tracking · live via Nimbus webhook`}</p>
        </div>
        <div className="page-head-actions">
          <button className="btn" onClick={handleRefresh}><Icon name="refresh" /> Refresh</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid-12">
        <div className="span-3"><KPI         label="Awaiting tracking" value={awaiting.toString()}  icon="clock" /></div>
        <div className="span-3"><KPI feature label="In transit"        value={inTransit.toString()} icon="truck" /></div>
        <div className="span-3"><KPI         label="Delivered"         value={delivered.toString()} icon="check" /></div>
        <div className="span-3 needs-attention"><KPIAttention label="Needs attention" value={failed.toString()} sla={0} failed={failed} /></div>
      </div>

      {/* Pipeline strip */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="hstack-8" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <div className="section-title">Pipeline</div>
          <span className="spacer" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`, gap: 0 }}>
          {STAGES.map((s, i) => {
            const n = counts[s.key] ?? 0;
            return (
              <div key={s.key} style={{ padding: "16px 18px", borderRight: i < STAGES.length - 1 ? "1px solid var(--border)" : "none", position: "relative" }}>
                <div className="hstack-8" style={{ marginBottom: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: s.color }} />
                  <span className="muted" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</span>
                </div>
                <div className="num" style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em" }}>{n}</div>
                {i < STAGES.length - 1 && (
                  <span style={{ position: "absolute", right: -7, top: "50%", transform: "translateY(-50%)", color: "var(--border-strong)", background: "var(--surface)", padding: "2px 2px", display: "grid", placeItems: "center", borderRadius: 99 }}>
                    <Icon name="chevron_right" size={12} color="var(--muted)" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Failed-delivery banner */}
      {bannerOn && failed > 0 && (
        <div style={{ padding: "12px 18px", background: "color-mix(in oklab, var(--risk-critical) 8%, var(--surface))", border: "1px solid color-mix(in oklab, var(--risk-critical) 28%, var(--border))", borderRadius: "var(--r-lg)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--risk-critical)", color: "white", display: "grid", placeItems: "center" }}>
            <Icon name="flag" size={16} />
          </div>
          <div className="stack-2" style={{ flex: 1 }}>
            <div className="fw6" style={{ fontSize: 14 }}>{failed} shipment{failed > 1 ? 's' : ''} need your attention</div>
            <div className="muted" style={{ fontSize: 12.5 }}>Failed or returned deliveries — review and take action.</div>
          </div>
          <button className="btn" onClick={() => setTab("attention")}><Icon name="eye" /> Review</button>
          <button className="iconbtn" onClick={() => setBannerOn(false)} title="Dismiss"><Icon name="x" /></button>
        </div>
      )}

      {/* Main table + detail */}
      <div className="grid-12">
        <div className="span-8 card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="hstack-8" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <Tabs value={tab} onChange={setTab} items={[
              { label: "All", value: "all", count: counts.all },
              { label: "Awaiting", value: "Awaiting tracking", count: counts["Awaiting tracking"] },
              { label: "In transit", value: "Shipped", count: counts.Shipped },
              { label: "Out for delivery", value: "Out for delivery", count: counts["Out for delivery"] },
              { label: "Delivered", value: "Delivered", count: counts.Delivered },
              { label: "Failed", value: "Failed delivery", count: counts["Failed delivery"] },
            ]} />
            <span className="spacer" />
            <div style={{ position: "relative", width: 200 }}>
              <input className="input" placeholder="AWB, order #, customer..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32, height: 30 }} />
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}><Icon name="search" size={13} /></span>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Shipment</th>
                  <th>Customer</th>
                  <th style={{ minWidth: 230 }}>Progress</th>
                  <th>Last update</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5"><div className="empty"><Icon name="refresh" size={20} /><div>Loading orders...</div></div></td></tr>
                ) : filteredList.map(s => (
                  <ShipmentRow key={s.id} s={s} selected={sel?.id === s.id} onClick={() => setSel(s)} />
                ))}
                {!loading && filteredList.length === 0 && (
                  <tr><td colSpan="5"><div className="empty"><Icon name="package" size={20} /><div>No shipments match this filter</div></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
            <div className="hstack-8" style={{ fontSize: 12.5 }}>
              <span className="muted num">{filteredList.length} shown</span>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className="span-4 col">
          <ShipmentDetail s={sel} events={trackingMap[sel?.awb] || []} />
        </div>
      </div>
    </div>
  );
}

function ShipmentRow({ s, selected, onClick }) {
  const idx = stageIndex(s.status);
  const failed = s.status === "Failed delivery";
  return (
    <tr onClick={onClick} style={{
      background: selected ? "var(--accent-soft)" : undefined,
      boxShadow: selected ? "inset 2px 0 0 var(--accent)" : undefined,
      cursor: "pointer",
    }}>
      <td>
        <div className="stack-2">
          <div className="hstack-8">
            <span className="mono fw6" style={{ fontSize: 12.5 }}>{s.awb !== '-' ? s.awb : <span className="muted">No AWB</span>}</span>
            <span className="badge" style={{ fontSize: 10.5, padding: "1px 6px" }}>{s.courier}</span>
          </div>
          <div className="muted mono" style={{ fontSize: 11 }}>{s.id}</div>
        </div>
      </td>
      <td>
        <div className="hstack-10">
          <Avatar name={s.customer.name} hue={s.customer.avatarHue} size="sm" />
          <div className="stack-2">
            <div className="fw5">{s.customer.name}</div>
            <div className="muted" style={{ fontSize: 11.5 }}>{s.customer.city}</div>
          </div>
        </div>
      </td>
      <td>
        {s.hasTracking === false
          ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 6, background: "var(--surface-2)", color: "var(--muted)", fontSize: 12, fontWeight: 500 }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--muted)", display: "inline-block" }} />
              Awaiting tracking
            </span>
          : <StageProgress idx={idx} failed={failed} status={s.status} />
        }
      </td>
      <td className="muted" style={{ fontSize: 12 }}>{s.lastUpdate}</td>
      <td className="muted" style={{ fontSize: 12 }}>{s.lastLocation || '-'}</td>
    </tr>
  );
}

function StageProgress({ idx, failed, status }) {
  const total = STAGE_ORDER.length;
  return (
    <div className="stack-4" style={{ minWidth: 200 }}>
      <div className="hstack-4">
        {STAGE_ORDER.map((stg, i) => {
          const done = !failed && i <= idx;
          const current = !failed && i === idx;
          const dotColor = failed
            ? (i <= 3 ? "var(--risk-critical)" : "var(--surface-3)")
            : (done ? "var(--accent)" : "var(--surface-3)");
          return (
            <React.Fragment key={stg}>
              <span title={stg} style={{
                width: current ? 10 : 8, height: current ? 10 : 8, borderRadius: 99,
                background: dotColor,
                boxShadow: current ? "0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent)" : "none",
              }} />
              {i < total - 1 && (
                <span style={{
                  flex: 1, height: 2, borderRadius: 99,
                  background: failed ? (i < 3 ? "var(--risk-critical)" : "var(--surface-3)") : (i < idx ? "var(--accent)" : "var(--surface-3)"),
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="muted" style={{ fontSize: 11.5 }}>
        {failed ? <span style={{ color: "var(--risk-critical)", fontWeight: 500 }}>Failed delivery · 2 attempts</span> : status}
      </div>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function SLAChip({ days, failed, delivered }) {
  if (failed)    return <Badge tone="critical" dot="var(--risk-critical)">Breached</Badge>;
  if (delivered) return <Badge tone="low" dot="var(--risk-low)">On time</Badge>;
  if (days < 0)  return <Badge tone="critical" dot="var(--risk-critical)">{Math.abs(days)}d over</Badge>;
  if (days === 0) return <Badge tone="moderate" dot="var(--risk-moderate)">Due today</Badge>;
  if (days <= 1)  return <Badge tone="moderate" dot="var(--risk-moderate)">{days}d left</Badge>;
  return <Badge tone="low" dot="var(--risk-low)">{days}d left</Badge>;
}

/* â”€â”€ KPI variant for the "needs attention" tile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function KPIAttention({ label, value, sla, failed }) {
  return (
    <div className="kpi" style={{
      background: "linear-gradient(135deg, color-mix(in oklab, var(--risk-critical) 12%, var(--surface)) 0%, var(--surface) 70%)",
      borderColor: "color-mix(in oklab, var(--risk-critical) 30%, var(--border))",
    }}>
      <div className="kpi-hd">
        <div className="ic" style={{ background: "color-mix(in oklab, var(--risk-critical) 18%, transparent)", color: "var(--risk-critical)" }}>
          <Icon name="flag" size={14} />
        </div>
        <div className="lbl" style={{ color: "var(--risk-critical)" }}>{label}</div>
      </div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-ft">
        <span className="hstack-6"><span className="dotx" style={{ background: "var(--risk-critical)", width: 6, height: 6, borderRadius: 99 }} /> <span className="num">{failed}</span> failed</span>
        <span className="hstack-6"><span className="dotx" style={{ background: "var(--risk-moderate)", width: 6, height: 6, borderRadius: 99 }} /> <span className="num">{sla}</span> SLA breach</span>
        <span className="spacer" />
        <button className="btn ghost sm" style={{ color: "var(--risk-critical)", fontWeight: 500, fontSize: 12, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}>Resolve →</button>
      </div>
    </div>
  );
}

/* â”€â”€ Detail panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function ShipmentDetail({ s, events }) {
  if (!s) return null;
  const failed = s.status === "Failed delivery";
  return (
    <>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <RouteMap originLabel={s.origin.replace(" DC","")} destLabel={`${s.customer.city}, ${s.customer.state}`} status={s.status} />
        <div style={{ padding: 16 }}>
          <div className="hstack-8">
            <div className="stack-2">
              <div className="hstack-8">
                <span className="fw6">{s.id}</span>
                <span className="muted mono" style={{ fontSize: 12 }}>{s.awb}</span>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>{s.courier} · {s.items.reduce((a, i) => a + i.qty, 0)} qty · Rs. {s.amount.toLocaleString()} · {s.paymentMode}</div>
            </div>
            <span className="spacer" />
            <OrderStatusBadge status={s.status} />
          </div>
          <div className="divider" style={{ margin: "12px 0" }} />
          <div className="hstack-12">
            <Avatar name={s.customer.name} hue={s.customer.avatarHue} />
            <div className="stack-2" style={{ flex: 1, minWidth: 0 }}>
              <div className="fw5">{s.customer.name}</div>
              <div className="muted num" style={{ fontSize: 12 }}>{s.customer.phone}</div>
            </div>
            <button className="iconbtn" title="Call"><Icon name="phone" /></button>
            <button className="iconbtn" title="WhatsApp"><Icon name="whatsapp" /></button>
          </div>
          <div className="card flat" style={{ background: "var(--surface-2)", marginTop: 12, padding: 12 }}>
            <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Shipping to</div>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>{s.shippingAddress}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="hstack-8" style={{ marginBottom: 14 }}>
          <div className="section-title">Tracking timeline</div>
          <span className="spacer" />
          {events.length > 0 && <Badge tone="low">Live</Badge>}
        </div>
        <TrackingTimeline events={events} status={s.status} failed={failed} />
      </div>

      {failed && (
        <div className="card" style={{ borderColor: "color-mix(in oklab, var(--risk-critical) 30%, var(--border))" }}>
          <div className="hstack-8" style={{ marginBottom: 8 }}>
            <Icon name="flag" size={14} color="var(--risk-critical)" />
            <div className="section-title" style={{ color: "var(--risk-critical)" }}>Failed delivery</div>
          </div>
          <div className="stack-8">
            <button className="btn"><Icon name="phone" /> Call customer</button>
            <button className="btn"><Icon name="refresh" /> Schedule re-attempt</button>
            <button className="btn primary"><Icon name="package" /> Initiate RTO</button>
          </div>
        </div>
      )}
    </>
  );
}

function TrackingTimeline({ events, status, failed }) {
  // If we have real Nimbus webhook events, show them
  if (events && events.length > 0) {
    return (
      <div className="stack-12">
        {events.map((e, i) => {
          const isFirst = i === 0;
          const isFail = (e.status || '').toLowerCase().includes('fail') || (e.status || '').toLowerCase().includes('rto');
          const color = isFail ? "var(--risk-critical)" : (isFirst ? "var(--risk-moderate)" : "var(--accent)");
          return (
            <div key={i} style={{ position: "relative", paddingLeft: 24 }}>
              <span style={{
                position: "absolute", left: 0, top: 3, width: 12, height: 12, borderRadius: 99,
                background: color, border: "2px solid " + color,
                boxShadow: isFirst ? "0 0 0 4px color-mix(in oklab, var(--risk-moderate) 22%, transparent)" : "none",
                zIndex: 1,
              }} />
              {i < events.length - 1 && (
                <span style={{ position: "absolute", left: 5, top: 16, bottom: -14, width: 2, background: "var(--border)" }} />
              )}
              <div className="hstack-8" style={{ fontSize: 13 }}>
                <span className="fw5" style={{ color: isFail ? "var(--risk-critical)" : undefined }}>{e.status}</span>
                {isFirst && !isFail && <Badge tone="moderate">latest</Badge>}
                {isFail && <Badge tone="critical">RTO / Failed</Badge>}
                <span className="spacer" />
                <span className="muted" style={{ fontSize: 11.5 }}>{e.event_time}</span>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {e.location && <span>{e.location}</span>}
                {e.location && e.message && <span> · </span>}
                {e.message && <span>{e.message}</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback: show Shopify-based status-only timeline
  const idx = stageIndex(status);
  const fallbackEvents = [
    { stage: "Placed",           desc: "Order received" },
    { stage: "Packed",           desc: "Ready to ship" },
    { stage: "Shipped",          desc: "Handed to courier" },
    { stage: "Out for delivery", desc: "Out for delivery" },
    { stage: "Delivered",        desc: "Delivered" },
  ];
  return (
    <div>
      <div className="stack-12">
        {fallbackEvents.map((e, i) => {
          const passed = !failed && i <= idx;
          const current = !failed && i === idx;
          const color = current ? "var(--risk-moderate)" : (passed ? "var(--accent)" : "var(--faint)");
          return (
            <div key={e.stage} style={{ position: "relative", paddingLeft: 24 }}>
              <span style={{
                position: "absolute", left: 0, top: 3, width: 12, height: 12, borderRadius: 99,
                background: passed || current ? color : "var(--surface-2)",
                border: "2px solid " + (passed || current ? color : "var(--border)"),
                boxShadow: current ? "0 0 0 4px color-mix(in oklab, var(--risk-moderate) 22%, transparent)" : "none",
                zIndex: 1,
              }} />
              {i < fallbackEvents.length - 1 && (
                <span style={{ position: "absolute", left: 5, top: 16, bottom: -14, width: 2, background: i < idx && !failed ? "var(--accent)" : "var(--border)" }} />
              )}
              <div className="hstack-8" style={{ fontSize: 13 }}>
                <span className={passed || current ? "fw5" : "muted"}>{e.stage}</span>
                {current && <Badge tone="moderate">current</Badge>}
                <span className="spacer" />
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{e.desc}</div>
            </div>
          );
        })}
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 14, padding: "8px 10px", background: "var(--surface-2)", borderRadius: 6 }}>
        Nimbus webhook events will appear here once Nimbus sends updates for this shipment.
      </div>
    </div>
  );
}

/* â”€â”€ Route map (abstract India-shape SVG) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function RouteMap({ originLabel, destLabel, status }) {
  const failed = status === "Failed delivery";
  return (
    <div style={{
      position: "relative",
      height: 200,
      background: "linear-gradient(135deg, color-mix(in oklab, var(--accent) 6%, var(--surface-2)) 0%, var(--surface-2) 100%)",
      overflow: "hidden",
      borderBottom: "1px solid var(--border)",
    }}>
      <svg viewBox="0 0 400 200" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--border)" strokeWidth="0.5" opacity="0.6" />
          </pattern>
          <linearGradient id="route-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="var(--accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="1" />
          </linearGradient>
        </defs>
        <rect width="400" height="200" fill="url(#grid)" />

        {/* Abstract India-ish landmass blob */}
        <path d="M 70 40 Q 110 30 150 50 Q 200 35 240 60 Q 290 50 320 90 Q 340 130 310 165 Q 270 185 220 175 Q 170 180 130 165 Q 90 170 70 140 Q 50 100 70 40 Z"
          fill="color-mix(in oklab, var(--accent) 8%, transparent)"
          stroke="color-mix(in oklab, var(--accent) 25%, transparent)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* Route line */}
        <path d="M 90 130 Q 200 60 290 100"
          fill="none"
          stroke={failed ? "var(--risk-critical)" : "url(#route-grad)"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={failed ? "5 4" : "0"}
        />

        {/* Origin */}
        <g transform="translate(90, 130)">
          <circle r="9" fill="var(--surface)" stroke="var(--muted)" strokeWidth="2" />
          <circle r="4" fill="var(--muted)" />
        </g>

        {/* Truck position (mid-route) */}
        {!failed && (
          <g transform="translate(200, 85)">
            <circle r="14" fill="var(--accent)" opacity="0.18">
              <animate attributeName="r" values="10;20;10" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.35;0;0.35" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle r="10" fill="var(--accent)" />
            <g transform="translate(-8, -8) scale(0.7)" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
              <path d="M3 5h11v11H3zM14 9h4l3 4v3h-7" />
            </g>
          </g>
        )}

        {/* Destination */}
        <g transform="translate(290, 100)">
          <circle r="11" fill={failed ? "var(--risk-critical)" : "var(--accent)"} opacity="0.18" />
          <circle r="7" fill={failed ? "var(--risk-critical)" : "var(--accent)"} />
          <circle r="3" fill="white" />
        </g>
      </svg>

      <div style={{ position: "absolute", left: 12, bottom: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
        <span style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px" }}>
          <span className="muted">From</span> <b>{originLabel}</b>
        </span>
        <Icon name="arrow_right" size={12} color="var(--muted)" />
        <span style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px" }}>
          <span className="muted">To</span> <b>{destLabel}</b>
        </span>
      </div>

      <div style={{ position: "absolute", right: 12, top: 12 }}>
        <span className="badge" style={{ background: "var(--surface)", fontSize: 11 }}>
          <Icon name="map" size={11} /> Route preview
        </span>
      </div>
    </div>
  );
}

/* â”€â”€ Courier performance bars â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

// eslint-disable-next-line no-unused-vars
function CourierPerformance() {
  const rows = [
    { name: "Delhivery",  shipped: 2410, success: 96.4, ot: 91.8, color: "var(--accent)" },
    { name: "Bluedart",   shipped: 1880, success: 94.2, ot: 89.4, color: "var(--accent-2)" },
    { name: "XpressBees", shipped: 1102, success: 92.7, ot: 86.1, color: "var(--risk-moderate)" },
    { name: "Ekart",      shipped: 840,  success: 89.1, ot: 81.2, color: "var(--risk-high)" },
  ];
  return (
    <div className="stack-12">
      {rows.map(r => (
        <div key={r.name}>
          <div className="hstack-8" style={{ fontSize: 12.5, marginBottom: 6 }}>
            <span className="fw5">{r.name}</span>
            <span className="muted num">· {r.shipped.toLocaleString()} shipped</span>
            <span className="spacer" />
            <span className="num fw6" style={{ color: r.success >= 95 ? "var(--risk-low)" : r.success >= 92 ? "var(--risk-moderate)" : "var(--risk-high)" }}>{r.success}%</span>
            <span className="muted" style={{ fontSize: 11 }}>success</span>
          </div>
          <div className="fbar" style={{ height: 8 }}>
            <i style={{ width: r.success + "%", background: r.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}




// --- screens-misc.jsx ---
// screens-misc.jsx — Marketing analytics, Roles & Users admin, Settings



/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ MARKETING ANALYTICS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function MarketingScreen() {
  const [allData, setAllData] = React.useState({ full: [], partial: [], manual: [] });
  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    let counts = { full: false, partial: false, manual: false };
    const check = () => { if (counts.full && counts.partial && counts.manual) setLoading(false); };

    const u1 = onSnapshot(collection(db, "questionnaire_submissions"), snap => {
      setAllData(p => ({ ...p, full: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      counts.full = true; check();
    }, () => { counts.full = true; check(); });

    const u2 = onSnapshot(collection(db, "partial_submissions"), snap => {
      setAllData(p => ({ ...p, partial: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      counts.partial = true; check();
    }, () => { counts.partial = true; check(); });

    const u3 = onSnapshot(collection(db, "manual_submissions"), snap => {
      setAllData(p => ({ ...p, manual: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      counts.manual = true; check();
    }, () => { counts.manual = true; check(); });

    return () => { u1(); u2(); u3(); };
  }, []);

  const stats = React.useMemo(() => {
    const { full, partial, manual } = allData;
    const all = [...full, ...partial, ...manual];

    const getQid = r => (r.questionnaireId || r.reportCategory || "").toLowerCase();
    const getGender = r => {
      if (r.gender && r.gender !== "Not Selected" && r.gender !== "-") return r.gender;
      const qid = getQid(r);
      if (qid.includes("womens") || qid.includes("women's")) return "Female";
      if (qid.includes("mens") || qid.includes("men's")) return "Male";
      return "Other";
    };

    const CATS = [
      { key: "womens-wellness", label: "Women's Wellness", color: "var(--accent)" },
      { key: "mens-wellness",   label: "Men's Wellness",   color: "var(--accent-2)" },
      { key: "womens-weight",   label: "Women's Weight",   color: "var(--risk-low)" },
      { key: "mens-weight",     label: "Men's Weight",     color: "var(--risk-moderate)" },
    ];

    const byQid = {};
    all.forEach(r => {
      const qid = getQid(r);
      let key = "Other";
      if (qid.includes("womens-wellness") || (qid.includes("women") && !qid.includes("weight"))) key = "womens-wellness";
      else if (qid.includes("womens-weight") || (qid.includes("women") && qid.includes("weight"))) key = "womens-weight";
      else if (qid.includes("mens-wellness") || (qid.includes("mens") && !qid.includes("weight"))) key = "mens-wellness";
      else if (qid.includes("mens-weight") || (qid.includes("men") && qid.includes("weight"))) key = "mens-weight";
      if (!byQid[key]) byQid[key] = { fullArr: [], partialArr: [], allArr: [] };
      byQid[key].allArr.push(r);
      if (full.find(x => x.id === r.id)) byQid[key].fullArr.push(r);
      else if (partial.find(x => x.id === r.id)) byQid[key].partialArr.push(r);
    });

    const catRows = CATS.map(cat => {
      const grp = byQid[cat.key] || { fullArr: [], partialArr: [], allArr: [] };
      const starts = grp.allArr.length;
      const completed = grp.fullArr.length;
      const consulted = grp.allArr.filter(r => r.isConsulted).length;
      const purchased = grp.allArr.filter(r => r.isPurchased).length;
      const denomCR = grp.fullArr.length + grp.partialArr.length;
      const cr = denomCR > 0 ? ((completed / denomCR) * 100).toFixed(0) : null;
      return { ...cat, count: starts, completed, consulted, purchased, cr };
    });

    const female = all.filter(r => getGender(r) === "Female").length;
    const male = all.filter(r => getGender(r) === "Male").length;
    const other = all.length - female - male;

    const totalFull = full.length;
    const totalPartial = partial.length;
    const totalManual = manual.length;
    const totalAll = all.length;
    const totalConsulted = all.filter(r => r.isConsulted).length;
    const totalPurchased = all.filter(r => r.isPurchased).length;
    const whatsappLeads = all.filter(r => r.isWhatsAppSent).length;
    const denomComp = totalFull + totalPartial;
    const compRate = denomComp > 0 ? ((totalFull / denomComp) * 100).toFixed(1) : "0.0";
    return { totalAll, totalFull, totalPartial, totalManual, totalConsulted, totalPurchased, whatsappLeads, compRate, catRows, female, male, other };
  }, [allData]);

  if (loading) return <div className="col fade-in" style={{ display: 'grid', placeItems: 'center', minHeight: 300 }}><span className="muted">Loading analytics...</span></div>;

  const { totalAll, totalFull, totalPartial, totalManual, totalConsulted, totalPurchased, whatsappLeads, compRate, catRows, female, male, other } = stats;
  const maxCat = Math.max(...catRows.map(c => c.count), 1);
  const funnelData = [
    { stage: "Quiz started",  count: totalFull + totalPartial },
    { stage: "Completed",     count: totalFull },
    { stage: "Consulted",     count: totalConsulted },
    { stage: "Purchased",     count: totalPurchased },
  ];
  const totalGender = female + male + other || 1;
  const femalePct = Math.round((female / totalGender) * 100);

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Marketing analytics</h1>
          <p className="page-sub">Acquisition, conversion &amp; demographics</p>
        </div>
      </div>

      <div className="grid-12">
        <div className="span-3"><KPI feature label="Quiz starts" value={totalAll.toLocaleString()} icon="clipboard" /></div>
        <div className="span-3"><KPI label="Completion rate" value={compRate + "%"} icon="check" /></div>
        <div className="span-3"><KPI label="Consulted" value={totalConsulted.toLocaleString()} icon="stethoscope" /></div>
        <div className="span-3"><KPI label="Purchased" value={totalPurchased.toLocaleString()} icon="trend_up" /></div>
      </div>

      <div className="grid-12">
        <div className="span-8 card">
          <div className="hstack-8" style={{ marginBottom: 14 }}>
            <div className="section-title">Submissions by questionnaire</div>
          </div>
          <BarChart height={260} data={catRows.map(c => ({
            label: c.label.replace("'s", "").trim(),
            value: c.count,
            color: c.color,
          }))} />
        </div>
        <div className="span-4 card">
          <div className="section-title" style={{ marginBottom: 10 }}>Funnel</div>
          <FunnelChart data={funnelData} />
        </div>
      </div>

      <div className="grid-12">
        <div className="span-6 card">
          <div className="section-title" style={{ marginBottom: 10 }}>Category demand</div>
          <div className="stack-12" style={{ marginTop: 6 }}>
            {catRows.map(c => (
              <div key={c.key}>
                <div className="hstack-8" style={{ fontSize: 12.5, marginBottom: 4 }}>
                  <span className="fw5">{c.label}</span>
                  <span className="spacer" />
                  <span className="muted num">{c.count}</span>
                </div>
                <div className="fbar"><i style={{ width: (c.count / maxCat) * 100 + "%", background: c.color }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="span-3 card">
          <div className="section-title" style={{ marginBottom: 10 }}>Gender split</div>
          <div style={{ display: "grid", placeItems: "center", padding: "8px 0" }}>
            <DonutChart size={160} thickness={22} centerValue={femalePct + "%"} centerLabel="female" data={[
              { label: "Female", value: female, color: "var(--accent)" },
              { label: "Male",   value: male,   color: "var(--accent-2)" },
              { label: "Other",  value: other,  color: "var(--border)" },
            ]} />
          </div>
          <div className="stack-8" style={{ marginTop: 8 }}>
            {[["Female", female, "var(--accent)"], ["Male", male, "var(--accent-2)"], ["Other", other, "var(--border)"]].map(([l, v, col]) => (
              <div key={l} className="hstack-8" style={{ fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: col, flexShrink: 0 }} />
                <span>{l}</span>
                <span className="spacer" />
                <span className="muted num">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="span-3 card">
          <div className="section-title" style={{ marginBottom: 10 }}>Source breakdown</div>
          <div className="stack-12" style={{ marginTop: 6 }}>
            {[
              ["Completed quiz", totalFull,    "var(--risk-low)"],
              ["Partial quiz",   totalPartial, "var(--risk-moderate)"],
              ["Manual entry",   totalManual,  "var(--accent-2)"],
              ["WhatsApp leads", whatsappLeads,"var(--risk-high)"],
            ].map(([n, v, col]) => {
              const pct = totalAll > 0 ? (v / totalAll) * 100 : 0;
              return (
                <div key={n}>
                  <div className="hstack-8" style={{ fontSize: 12.5, marginBottom: 4 }}>
                    <span className="fw5">{n}</span>
                    <span className="spacer" />
                    <span className="muted num">{v}</span>
                  </div>
                  <div className="fbar"><i style={{ width: pct + "%", background: col }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="hstack-8" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <div className="section-title">Questionnaire performance</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Questionnaire</th>
                <th>Starts</th>
                <th>Completed</th>
                <th>Consulted</th>
                <th>Purchased</th>
                <th>Completion %</th>
                <th>Purchase rate</th>
              </tr>
            </thead>
            <tbody>
              {catRows.map(row => (
                <tr key={row.label}>
                  <td className="fw5">{row.label}</td>
                  <td className="num">{row.count.toLocaleString()}</td>
                  <td className="num">{row.completed.toLocaleString()}</td>
                  <td className="num">{row.consulted.toLocaleString()}</td>
                  <td className="num">{row.purchased.toLocaleString()}</td>
                  <td className="num">{row.cr != null ? row.cr + "%" : "-"}</td>
                  <td className="num fw5" style={{ color: "var(--risk-low)" }}>
                    {row.count > 0 ? ((row.purchased / row.count) * 100).toFixed(1) + "%" : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ ROLES & USERS (ADMIN) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const ADMIN_ROLES = ["admin", "doctor", "telesales", "order_creator", "marketing", "logistics"];

const PERMISSION_KEYS = [
  { key: 'can_generate_prescription',    label: 'Generate & Sign Prescriptions', icon: 'pill' },
  { key: 'can_edit_clinical_consulted',  label: 'Mark Patients as Consulted',    icon: 'check' },
  { key: 'can_edit_clinical_purchased',  label: 'Mark Patients as Purchased',    icon: 'package' },
  { key: 'can_edit_patient_info',        label: 'Edit Patient Information',      icon: 'edit' },
  { key: 'can_create_manual_patient',    label: 'Create New Patient Records',    icon: 'user' },
  { key: 'can_access_clinical_review',   label: 'Access Clinical Review',        icon: 'stethoscope' },
  { key: 'can_create_shopify_orders',    label: 'Create Shopify Orders',         icon: 'shopping' },
  { key: 'can_manage_shopify_customers', label: 'Manage Shopify Customers',      icon: 'users' },
  { key: 'can_view_prescriptions_tab',   label: 'View Prescriptions Tab (Telesales)', icon: 'pill', roles: ['telesales'] },
];

function AdminScreen() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [userPerms, setUserPerms] = useState({});
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ uid: '', email: '', name: '', role: 'doctor' });
  const [toast, setToast] = useState(null);

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u => (u.name || u.email || '').toLowerCase().includes(q));
  }, [users, search]);

  const openEdit = async (u) => {
    const editUser = { ...u };
    // Combine roles + legacy role field, deduplicate
    const raw = [...(Array.isArray(u.roles) ? u.roles : []), ...(u.role ? [u.role] : [])];
    const unique = [...new Set(raw)];
    // Sort known roles by priority; keep any unknown ones at the end
    const known = ADMIN_ROLES.filter(r => unique.includes(r));
    const unknown = unique.filter(r => !ADMIN_ROLES.includes(r));
    editUser.roles = [...known, ...unknown];
    if (!editUser.roles.length) editUser.roles = ['doctor'];
    setSelected(editUser);
    setLoadingPerms(true);
    try {
      const snap = await getDoc(doc(db, 'users', u.id, 'permissions', 'settings'));
      setUserPerms(snap.exists() ? snap.data() : {});
    } catch (_) { setUserPerms({}); }
    setLoadingPerms(false);
  };

  const toggleRole = (r) => {
    const cur = selected.roles || [];
    const next = cur.includes(r) ? cur.filter(x => x !== r) : [...cur, r];
    // Always keep sorted by ADMIN_ROLES priority so highest is [0] (primary nav role)
    setSelected({ ...selected, roles: ADMIN_ROLES.filter(x => next.includes(x)) });
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', selected.id), {
        name: (selected.name || '').trim(),
        roles: selected.roles?.length ? selected.roles : ['doctor'],
        role: deleteField(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      batch.set(doc(db, 'users', selected.id, 'permissions', 'settings'), userPerms);
      await batch.commit();
      setSelected(null);
      showToast('success', 'User saved successfully.');
    } catch (e) {
      showToast('error', 'Failed to save: ' + e.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Remove Firestore record for ${u.email}? This does not delete their Firebase Auth account.`)) return;
    try {
      await deleteDoc(doc(db, 'users', u.id));
      showToast('success', 'User record removed.');
    } catch (e) { showToast('error', 'Delete failed.'); }
  };

  const handleCreate = async () => {
    if (!newUser.uid || !newUser.email) return showToast('error', 'UID and Email are required.');
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', newUser.uid.trim()), {
        id: newUser.uid.trim(), uid: newUser.uid.trim(),
        email: newUser.email.trim(), name: newUser.name.trim(),
        roles: [newUser.role], createdAt: serverTimestamp(),
      });
      setShowCreate(false);
      setNewUser({ uid: '', email: '', name: '', role: 'doctor' });
      showToast('success', 'User record created.');
    } catch (e) { showToast('error', 'Create failed.'); }
    finally { setSaving(false); }
  };

  const Toggle = ({ on, onToggle }) => (
    <div onClick={onToggle} style={{ width: 36, height: 20, borderRadius: 10, background: on ? 'var(--accent)' : 'var(--border)', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
      <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: on ? 19 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </div>
  );

  const currentUid = auth?.currentUser?.uid;

  return (
    <div className="col fade-in">
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, padding: '10px 18px', borderRadius: 10, background: toast.type === 'success' ? 'var(--risk-low)' : '#ef4444', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {toast.msg}
        </div>
      )}

      <div className="page-head">
        <div>
          <h1 className="page-title">Roles & Users</h1>
          <p className="page-sub">Manage access and permissions across the SehatUp platform</p>
        </div>
        <div className="page-head-actions">
          <button className="btn primary" onClick={() => setShowCreate(true)}><Icon name="plus" /> Add User Record</button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 320, marginBottom: 8 }}>
        <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}><Icon name="search" size={14} /></div>
        <input className="input" style={{ paddingLeft: 32 }} placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Users table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>Loading…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>No users found.</td></tr>}
              {filtered.map(u => {
                const raw = [...(Array.isArray(u.roles) ? u.roles : []), ...(u.role ? [u.role] : [])];
                const allRoles = [...new Set(raw)];
                const isAdmin = allRoles.includes('admin');
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="hstack-10">
                        <div className="avatar sm" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontWeight: 700 }}>
                          {(u.name || u.email || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="fw5" style={{ fontSize: 13 }}>
                            {u.name || u.email?.split('@')[0] || 'Unnamed'}
                            {u.id === currentUid && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 5, padding: '1px 6px' }}>You</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{u.email}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {allRoles.length ? allRoles.map(r => (
                          <span key={r} style={{ fontSize: 11, fontWeight: 600, background: 'var(--accent-soft)', color: 'var(--accent-ink)', borderRadius: 6, padding: '2px 8px', textTransform: 'capitalize' }}>{r}</span>
                        )) : <span className="muted" style={{ fontSize: 12 }}>No roles</span>}
                      </div>
                    </td>
                    <td>
                      {isAdmin
                        ? <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--risk-low)' }}>Full access</span>
                        : <span style={{ fontSize: 12, color: 'var(--muted)' }}>Restricted</span>}
                    </td>
                    <td className="right">
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn sm ghost" onClick={() => openEdit(u)}><Icon name="edit" size={13} /> Edit</button>
                        {u.id !== currentUid && <button className="btn sm ghost" style={{ color: '#ef4444' }} onClick={() => handleDelete(u)}><Icon name="trash" size={13} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {selected && createPortal(
        <>
          <div className="np-blur-layer" />
          <div className="np-backdrop" onClick={() => setSelected(null)}>
            <div className="np-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', borderRadius: 16 }}>

              {/* Modal header */}
              <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 17, flexShrink: 0 }}>
                  {(selected.name || selected.email || 'U')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--fg)' }}>Edit User</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.email} · {selected.id}</div>
                </div>
                <button className="iconbtn" onClick={() => setSelected(null)} title="Close"><Icon name="x" size={16} /></button>
              </div>

              {/* Modal body */}
              <div style={{ padding: '22px 22px 8px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 22 }}>

                {/* Name */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Full Name</label>
                  <input className="input" value={selected.name || ''} onChange={e => setSelected({ ...selected, name: e.target.value })} placeholder="User's full name" style={{ width: '100%' }} />
                </div>

                {/* Roles — multi-select, sorted by priority; roles[0] = primary nav role */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Roles</label>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>· top selected role sets the navigation</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {ADMIN_ROLES.map(r => {
                      const has = selected.roles?.includes(r);
                      const isPrimary = selected.roles?.[0] === r;
                      return (
                        <div key={r} onClick={() => toggleRole(r)} style={{
                          padding: '11px 14px', borderRadius: 10,
                          border: `1.5px solid ${has ? 'var(--accent)' : 'var(--border)'}`,
                          background: has ? 'var(--accent-soft)' : 'var(--surface-2)',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          userSelect: 'none',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Icon name="shield" size={13} color={has ? 'var(--accent)' : 'var(--muted)'} />
                            <span style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize', color: has ? 'var(--fg)' : 'var(--muted)' }}>{r}</span>
                            {isPrimary && <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--accent)', color: '#fff', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.05em' }}>NAV</span>}
                          </div>
                          <div style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${has ? 'var(--accent)' : 'var(--border)'}`, background: has ? 'var(--accent)' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            {has && <Icon name="check" size={11} color="#fff" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Granular Permissions */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Granular Permissions</label>
                  {loadingPerms ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)', padding: '12px 0' }}>Loading permissions…</div>
                  ) : PERMISSION_KEYS.filter(p => !p.roles || p.roles.some(r => selected?.roles?.includes(r))).length === 0 ? (
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>No role-specific permissions for the assigned roles.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {PERMISSION_KEYS.filter(p => !p.roles || p.roles.some(r => selected?.roles?.includes(r))).map(p => (
                        <div key={p.key} onClick={() => setUserPerms(prev => ({ ...prev, [p.key]: !prev[p.key] }))}
                          style={{ padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${userPerms[p.key] ? 'var(--accent)' : 'var(--border)'}`, background: userPerms[p.key] ? 'var(--accent-soft)' : 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Icon name={p.icon} size={14} color={userPerms[p.key] ? 'var(--accent)' : 'var(--muted)'} />
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{p.label}</span>
                          </div>
                          <Toggle on={!!userPerms[p.key]} onToggle={() => setUserPerms(prev => ({ ...prev, [p.key]: !prev[p.key] }))} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal footer */}
              <div style={{ padding: '16px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
                <button className="btn ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setSelected(null)}>Cancel</button>
                <button className="btn primary" style={{ flex: 2, justifyContent: 'center' }} onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </>,
        document.querySelector('.app') || document.body
      )}

      {/* Create User Modal */}
      {showCreate && createPortal(
        <>
          <div className="np-blur-layer" />
          <div className="np-backdrop" onClick={() => setShowCreate(false)}>
            <div className="np-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, width: '100%' }}>
              <div className="fw6" style={{ fontSize: 16, marginBottom: 20 }}>Add User Record</div>
              <p className="muted" style={{ fontSize: 12.5, marginBottom: 20 }}>Manually create a Firestore profile for an existing Firebase Auth user.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <label className="lbl">Firebase Auth UID</label>
                  <input className="input" placeholder="Paste UID from Firebase Console" value={newUser.uid} onChange={e => setNewUser({ ...newUser, uid: e.target.value })} />
                </div>
                <div className="field">
                  <label className="lbl">Email Address</label>
                  <input className="input" type="email" placeholder="user@sehatup.com" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                </div>
                <div className="field">
                  <label className="lbl">Full Name</label>
                  <input className="input" placeholder="Full name" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
                </div>
                <div className="field">
                  <label className="lbl">Initial Role</label>
                  <select className="select" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                    {ADMIN_ROLES.map(r => <option key={r} value={r} style={{ textTransform: 'capitalize' }}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn primary" style={{ flex: 1 }} onClick={handleCreate} disabled={saving}>
                  {saving ? 'Creating…' : 'Create Record'}
                </button>
              </div>
            </div>
          </div>
        </>,
        document.querySelector('.app') || document.body
      )}
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function RolePill({ role }) {
  if (!role) return null;
  return <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)", borderColor: "transparent" }}><Icon name={role.icon} size={11} /> {role.label}</span>;
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ SETTINGS / PROFILE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function SettingsScreen({ tweaks, me }) {
  const [tab, setTab] = useStateM("profile");
  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Your profile, workspace, and integrations</p>
        </div>
      </div>

      <div className="grid-12">
        <div className="span-3">
          <div className="card" style={{ padding: 8 }}>
            <div className="stack-2">
              {[
                ["profile", "Profile", "user"],
                ["workspace", "Workspace", "settings"],
                ["notifications", "Notifications", "bell"],
                ["integrations", "Integrations", "link"],
                ["security", "Security", "lock"],
                ["billing", "Billing", "package"],
              ].map(([v, l, i]) => (
                <button key={v} className={"rail-item" + (tab === v ? " active" : "")} onClick={() => setTab(v)} style={{ width: "100%", textAlign: "left", border: 0, cursor: "pointer" }}>
                  <Icon name={i} className="ic" />
                  <span>{l}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="span-9 col">
          {tab === "profile" && <ProfilePane me={me} />}
          {tab === "workspace" && <WorkspacePane />}
          {tab === "notifications" && <NotificationsPane />}
          {tab === "integrations" && <IntegrationsPane />}
          {tab === "security" && <SecurityPane />}
          {tab === "billing" && <BillingPane />}
        </div>
      </div>
    </div>
  );
}

function ProfilePane({ me }) {
  return (
    <>
      <div className="card">
        <div className="hstack-12">
          <div className="avatar lg" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>{me?.initials || "U"}</div>
          <div className="stack-2">
            <div className="fw6" style={{ fontSize: 16 }}>{me?.name || "User"}</div>
            <div className="muted" style={{ fontSize: 13 }}>{me?.email || "user@sehatup.in"}</div>
          </div>
          <span className="spacer" />
          <button className="btn">Upload photo</button>
          <button className="btn ghost">Remove</button>
        </div>
        <div className="divider" style={{ margin: "20px 0" }} />
        <div className="grid-12">
          <div className="span-6 field"><span className="lbl">First name</span><input className="input" defaultValue={me?.name?.split(" ")[0] || ""} /></div>
          <div className="span-6 field"><span className="lbl">Last name</span><input className="input" defaultValue={me?.name?.split(" ").slice(1).join(" ") || ""} /></div>
          <div className="span-6 field"><span className="lbl">Email</span><input className="input" defaultValue={me?.email || ""} /></div>
          <div className="span-6 field"><span className="lbl">Phone</span><input className="input num" defaultValue="+91 98765 43210" /></div>
          <div className="span-12 field"><span className="lbl">Role</span>
            <div className="hstack-8" style={{ padding: "10px 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}>
              <Icon name="shield" size={14} color="var(--accent)" />
              <span className="fw5">Admin</span>
              <span className="muted" style={{ fontSize: 12 }}>· Full access</span>
              <span className="spacer" />
              <button style={{ color: "var(--accent-ink)", fontSize: 12.5, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Request role change</button>
            </div>
          </div>
        </div>
        <div className="divider" style={{ margin: "20px 0" }} />
        <div className="hstack-8">
          <span className="spacer" />
          <button className="btn">Discard</button>
          <button className="btn primary">Save changes</button>
        </div>
      </div>
    </>
  );
}

function WorkspacePane() {
  return (
    <div className="card">
      <div className="section-title">Workspace</div>
      <div className="grid-12" style={{ marginTop: 14 }}>
        <div className="span-6 field"><span className="lbl">Workspace name</span><input className="input" defaultValue="SehatUp Operations" /></div>
        <div className="span-6 field"><span className="lbl">Subdomain</span>
          <div className="hstack-8"><input className="input" defaultValue="sehatup" /><span className="muted">.sehatup.app</span></div>
        </div>
        <div className="span-6 field"><span className="lbl">Default timezone</span>
          <select className="select" defaultValue="Asia/Kolkata"><option>Asia/Kolkata</option><option>Asia/Dubai</option><option>UTC</option></select>
        </div>
        <div className="span-6 field"><span className="lbl">Currency</span>
          <select className="select" defaultValue="INR"><option>INR (Rs. )</option><option>USD ($)</option></select>
        </div>
      </div>
    </div>
  );
}

function NotificationsPane() {
  const items = [
    ["High-risk submissions", "Notify when a customer scores below 25", true],
    ["Failed deliveries", "Notify when a shipment fails delivery", true],
    ["Order milestones", "Notify on placed / shipped / delivered", false],
    ["Daily digest", "8:00 AM summary of yesterday's activity", true],
    ["Doctor signatures", "Notify when a prescription is signed", false],
  ];
  return (
    <div className="card">
      <div className="section-title">Notifications</div>
      <div className="stack-12" style={{ marginTop: 14 }}>
        {items.map(([n, d, on]) => (
          <div key={n} className="hstack-12" style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 10 }}>
            <div className="stack-2" style={{ flex: 1 }}>
              <div className="fw5">{n}</div>
              <div className="muted" style={{ fontSize: 12 }}>{d}</div>
            </div>
            <Toggle defaultOn={on} />
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationsPane() {
  const [gscriptUrl, setGscriptUrl] = useStateO(() => localStorage.getItem('crm_gscript_url') || '');

  const saveUrl = (val) => {
    setGscriptUrl(val);
    localStorage.setItem('crm_gscript_url', val);
  };

  const ints = [
    { n: "Firebase", d: "Realtime DB · Auth · Cloud Functions", on: true, ic: "bolt" },
    { n: "Shopify",  d: "Customers, products, orders", on: true, ic: "package" },
    { n: "Nimbus",   d: "Shipment tracking & AWB sync", on: true, ic: "truck" },
    { n: "Google Sheets", d: "Lead import / customer sync", on: true, ic: "layers" },
    { n: "WhatsApp Business", d: "Outbound messaging via Gupshup", on: false, ic: "whatsapp" },
    { n: "Razorpay", d: "Payment links & webhooks", on: false, ic: "package" },
  ];
  return (
    <div className="col">
    <div className="grid-12">
      {ints.map(it => (
        <div className="span-6" key={it.n}>
          <div className="card">
            <div className="hstack-12">
              <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--surface-2)", display: "grid", placeItems: "center" }}>
                <Icon name={it.ic} size={20} color="var(--accent-ink)" />
              </div>
              <div className="stack-2" style={{ flex: 1 }}>
                <div className="fw6">{it.n}</div>
                <div className="muted" style={{ fontSize: 12 }}>{it.d}</div>
              </div>
              {it.on ? <Badge tone="low" dot="var(--risk-low)">connected</Badge> : <Badge>off</Badge>}
            </div>
            <div className="divider" style={{ margin: "14px 0" }} />
            <div className="hstack-8">
              <span className="muted" style={{ fontSize: 12 }}>{it.on ? "Last sync: 12 min ago" : "Not connected"}</span>
              <span className="spacer" />
              {it.on ? <button className="btn sm">Configure</button> : <button className="btn sm primary">Connect</button>}
            </div>
          </div>
        </div>
      ))}
    </div>
    <div className="card" style={{ marginTop: 24 }}>
      <div className="section-title" style={{ marginBottom: 12 }}>Google Sheets CRM Sync</div>
      <div className="stack-8">
        <label className="fw5">Apps Script Web App URL</label>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Used to push new CRM orders to the Google Sheet automatically.</div>
        <input 
          className="input" 
          placeholder="https://script.google.com/macros/s/.../exec" 
          value={gscriptUrl} 
          onChange={e => saveUrl(e.target.value)} 
        />
        {gscriptUrl && <div className="muted" style={{ fontSize: 12, color: 'var(--risk-low)' }}>Url is saved locally.</div>}
      </div>
    </div>
    </div>
  );
}

function SecurityPane() {
  return (
    <div className="card">
      <div className="section-title">Security</div>
      <div className="stack-12" style={{ marginTop: 14 }}>
        <SecRow t="Two-factor authentication" d="Required for admin & doctor roles" tail={<Badge tone="low" dot="var(--risk-low)">enabled</Badge>} />
        <SecRow t="Active sessions" d="3 devices · Chrome on Mac · Safari on iPhone · Edge on Windows" tail={<button className="btn sm">Manage</button>} />
        <SecRow t="API keys" d="Service tokens for Firebase functions & Shopify webhooks" tail={<button className="btn sm">View keys</button>} />
        <SecRow t="Data residency" d="Stored in Mumbai (asia-south1)" tail={<Badge>locked</Badge>} />
      </div>
    </div>
  );
}

function BillingPane() {
  return (
    <div className="col">
      <div className="card">
        <div className="hstack-12">
          <div className="stack-2">
            <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Current plan</div>
            <div className="fw5" style={{ fontSize: 20, letterSpacing: "-0.015em" }}>Scale · Rs. 24,000/mo</div>
            <div className="muted" style={{ fontSize: 12.5 }}>Unlimited users · 50k assessments / month · API access</div>
          </div>
          <span className="spacer" />
          <button className="btn">Switch plan</button>
          <button className="btn primary">Manage billing</button>
        </div>
      </div>
      <div className="grid-12">
        <div className="span-4"><KPI label="Assessments used" value="38,210" suffix="/ 50,000" icon="clipboard" /></div>
        <div className="span-4"><KPI label="WhatsApp credits" value="1,240" suffix="left" icon="whatsapp" /></div>
        <div className="span-4"><KPI label="Next invoice" value="Rs. 24,000" icon="package" /></div>
      </div>
    </div>
  );
}

function SecRow({ t, d, tail }) {
  return (
    <div className="hstack-12" style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 10 }}>
      <div className="stack-2" style={{ flex: 1 }}>
        <div className="fw5">{t}</div>
        <div className="muted" style={{ fontSize: 12 }}>{d}</div>
      </div>
      {tail}
    </div>
  );
}

function Toggle({ defaultOn }) {
  const [on, setOn] = useStateM(!!defaultOn);
  return (
    <button onClick={() => setOn(!on)}
      style={{
        width: 38, height: 22, borderRadius: 99,
        background: on ? "var(--accent)" : "var(--surface-3)",
        border: 0, padding: 2, cursor: "pointer", position: "relative",
        transition: "background .15s ease",
      }}>
      <span style={{
        display: "block", width: 18, height: 18, borderRadius: 99,
        background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)",
        transform: on ? "translateX(16px)" : "translateX(0)",
        transition: "transform .15s ease",
      }} />
    </button>
  );
}




// --- app.jsx ---
// app.jsx — Sehatup CRM main shell: sidebar, topbar, routing, drawers, tweaks



const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "accent": "rose",
  "density": "comfortable",
  "homeLayout": "analytics"
}/*EDITMODE-END*/;

const NAV = {
  admin:         ["home", "submissions", "customers", "prescriptions", "doctors", "orders", "crm_orders", "shipments", "marketing", "users", "settings"],
  doctor:        ["doctor", "submissions", "customers", "prescriptions", "settings"],
  telesales:     ["home", "customers", "orders", "crm_orders", "order_create", "prescriptions", "settings"],
  order_creator: ["order_create", "orders", "crm_orders", "customers", "settings"],
  marketing:     ["marketing", "home", "customers", "prescriptions", "doctor", "settings"],
  logistics:     ["shipments", "orders", "crm_orders", "customers", "settings"],
};

const ITEMS = {
  home:          { label: "Health Score Dashboard",  icon: "pulse",       route: "home" },
  submissions:   { label: "Submissions",             icon: "clipboard",   route: "submissions", ct: "3.4k" },
  customers:     { label: "Customers",               icon: "users",       route: "customers",   ct: "30" },
  prescriptions: { label: "Prescriptions",           icon: "pill",        route: "prescriptions" },
  doctor:        { label: "Clinical review",         icon: "stethoscope", route: "doctor",      ct: "12" },
  doctors:       { label: "Doctors queue",           icon: "stethoscope", route: "doctor",      ct: "12" },
  orders:        { label: "Shopify orders",          icon: "package",     route: "orders" },
  crm_orders:    { label: "CRM orders",              icon: "clipboard",   route: "crm_orders" },
  order_create:  { label: "Create order",            icon: "plus",        route: "order_create" },
  shipments:     { label: "Shipments",               icon: "truck",       route: "shipments",   ct: "117" },
  marketing:     { label: "Marketing analytics",     icon: "bar",         route: "marketing" },
  users:         { label: "Roles & users",           icon: "shield",      route: "admin" },
  settings:      { label: "Settings",                icon: "settings",    route: "settings" },
};

function App({ user, roles, onLogout }) {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [role] = useState(() => {
    const saved = localStorage.getItem("sehatup_role");
    if (saved && NAV[saved]) return saved;
    if (saved && !NAV[saved]) localStorage.removeItem("sehatup_role");
    if (roles && roles.includes("admin")) return "admin";
    const firstValid = roles && roles.find(r => NAV[r]);
    return firstValid || "doctor";
  });

  useEffect(() => {
    if (role) localStorage.setItem("sehatup_role", role);
  }, [role]);
  const [route, setRouteState] = useState(() => {
    const navItems = NAV[role] || ["home"];
    const firstNavKey = navItems[0];
    const defaultRoute = ITEMS[firstNavKey]?.route || "home";
    return { key: defaultRoute, ctx: {} };
  });
  const [env, setEnv] = useState(FIREBASE_MODE);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [customerDrawer, setCustomerDrawer] = useState(null);
  const [submissionDrawer, setSubmissionDrawer] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [submissionsCount, setSubmissionsCount] = useState("...");

  useEffect(() => {
    Promise.all([
      getCountFromServer(collection(db, "partial_submissions")),
      getCountFromServer(collection(db, "questionnaire_submissions")),
      getCountFromServer(collection(db, "manual_submissions"))
    ]).then(counts => {
      const total = counts[0].data().count + counts[1].data().count + counts[2].data().count;
      setSubmissionsCount(total.toLocaleString());
    }).catch(e => console.error(e));
  }, []);

  const setRoute = (key, ctx = {}) => setRouteState({ key, ctx });

  // Fetch per-user permissions from Firestore subcollection
  const [permissions, setPermissions] = useState({});
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid, 'permissions', 'settings'), snap => {
      setPermissions(snap.exists() ? snap.data() : {});
    }, () => setPermissions({}));
    return unsub;
  }, [user?.uid]);

  const isAdmin = roles?.includes('admin');
  const permCtxValue = {
    permissions,
    isAdmin,
    hasPermission: (key) => isAdmin || permissions[key] === true,
  };

  // Force the user's chosen route on role-switch to a sensible default
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const allowed = NAV[role] || NAV.doctor;
    const validRoutes = allowed.map(k => ITEMS[k].route);
    if (!validRoutes.includes(route.key)) {
      setRoute(ITEMS[allowed[0]].route);
    }
  }, [role]);

  const me = {
    name: user?.displayName || (user?.email ? user.email.split("@")[0].split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "User"),
    initials: (user?.displayName || user?.email?.split("@")[0] || "U").substring(0, 2).toUpperCase(),
    email: user?.email,
    uid: user?.uid,
    role: role
  };
  window.SehatData.me = me;

  const navItems = (NAV[role] || NAV.doctor)
    .filter(k => {
      if (k === 'doctor' && role === 'marketing' && !isAdmin && !permissions.can_access_clinical_review) return false;
      if (k === 'prescriptions' && role === 'telesales' && !isAdmin && !permissions.can_view_prescriptions_tab) return false;
      return true;
    })
    .map(k => {
      let ct = ITEMS[k].ct;
      if (k === "submissions" && submissionsCount !== "...") ct = submissionsCount;
      return { ...ITEMS[k], key: k, ct };
    });

  // If current route isn't visible in nav (e.g. permission removed), redirect to first visible item
  useEffect(() => {
    if (navItems.length === 0) return;
    const visibleRoutes = navItems.map(i => i.route);
    if (!visibleRoutes.includes(route.key)) {
      setRoute(navItems[0].route);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navItems.map(i => i.key).join(','), route.key]);

  const themeClass = `theme-${t.theme} accent-${t.accent} density-${t.density}`;

  return (
    <PermissionsCtx.Provider value={permCtxValue}>
    <div className={"app " + themeClass} style={sidebarCollapsed ? { "--rail-w": "68px" } : {}}>
      <style>{`
        .app { transition: grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .rail { overflow: hidden; }
        .rail.collapsed .brand-mark,
        .rail.collapsed .brand-name,
        .rail.collapsed .rail-section,
        .rail.collapsed .rail-item span,
        .rail.collapsed .rail-item .ct,
        .rail.collapsed .rail-ft .stack-2 {
          display: none;
        }
        .rail.collapsed .rail-hd {
          padding: 16px 0;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .rail.collapsed .rail-nav {
          margin-top: 16px;
        }
        .rail.collapsed .rail-item {
          justify-content: center;
          padding: 10px 0;
        }
        .rail.collapsed .rail-ft {
          justify-content: center;
          padding: 16px 0;
        }
      `}</style>

      {/* Sidebar */}
      <aside className={`rail ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="rail-hd">
          <div className="brand-mark">
            <HeartLottieLogo />
          </div>
          <div className="brand-name">SehatUp <span>CRM</span></div>
          <button 
            className="iconbtn" 
            title="Toggle Sidebar"
            style={{ marginLeft: sidebarCollapsed ? "0" : "auto", width: 28, height: 28, border: "none", background: "transparent", color: "var(--muted)", flexShrink: 0 }}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <Icon name="layout_sidebar" size={16} />
          </button>
        </div>

        <div className="rail-section">Workspace</div>
        <nav className="rail-nav">
          {navItems.filter(it => !["settings"].includes(it.key)).map(it => (
            <div key={it.key} className={"rail-item" + (route.key === it.route ? " active" : "")}
              onClick={() => setRoute(it.route)}>
              <Icon name={it.icon} className="ic" />
              <span>{it.label}</span>
              {it.ct && <span className="ct">{it.ct}</span>}
            </div>
          ))}
        </nav>

      </aside>

      {/* Main */}
      <main className="main">
        <header className="topbar">
          <Breadcrumb route={route} role={role} />
          <div className="topbar-search">
            <Icon name="search" />
            <input placeholder="Search customers, orders, AWB, doctors...   âŒ˜K" />
          </div>
          <div className="topbar-actions">
            <EnvToggle value={env} onChange={(newEnv) => {
              setEnv(newEnv);
              setFirebaseMode(newEnv);
              window.location.reload();
            }} />
            <button className="iconbtn" title="Notifications">
              <Icon name="bell" size={16} />
              <span className="badge num">3</span>
            </button>
            <div style={{ position: "relative" }}>
              <div 
                className="avatar sm clickable" 
                style={{ background: "var(--accent-soft)", color: "var(--accent-ink)", cursor: "pointer" }}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                {me.initials}
              </div>
              {showProfileMenu && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setShowProfileMenu(false)} />
                  <div className="card shadow-lg" style={{ position: "absolute", top: "100%", right: 0, marginTop: 8, width: 220, padding: 8, zIndex: 100 }}>
                    <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
                      <div className="fw6">{me.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{me.email}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <button className="btn w-full" style={{ justifyContent: "flex-start" }} onClick={() => { setShowProfileMenu(false); setRoute("settings"); }}>
                        <Icon name="settings" size={16} /> Settings
                      </button>
                      <button className="btn w-full" style={{ justifyContent: "flex-start", color: "var(--risk-critical)" }} onClick={() => { setShowProfileMenu(false); onLogout(); }}>
                        <Icon name="log_out" size={16} /> Log out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="content">
          <Screen route={route} setRoute={setRoute} tweaks={t}
            openCustomer={setCustomerDrawer}
            openSubmission={setSubmissionDrawer}
            setSubmissionsCount={setSubmissionsCount}
            me={me} />
        </div>
      </main>

      {/* Drawers */}
      {customerDrawer && <CustomerDrawer customer={customerDrawer} onClose={() => setCustomerDrawer(null)} openSubmission={setSubmissionDrawer} setRoute={setRoute} role={role} />}
      {submissionDrawer && <SubmissionDrawer customer={submissionDrawer} onClose={() => setSubmissionDrawer(null)} />}

      {/* Tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Appearance" />
        <TweakRadio label="Theme"  value={t.theme}  options={["light", "dark"]}
          onChange={v => setTweak("theme", v)} />
        <TweakSelect label="Accent" value={t.accent}
          options={[{value:"vital",label:"Vital · teal"},{value:"rose",label:"Rose · brand"},{value:"indigo",label:"Indigo · calm"}]}
          onChange={v => setTweak("accent", v)} />
        <TweakRadio label="Density" value={t.density}
          options={["comfortable", "compact"]}
          onChange={v => setTweak("density", v)} />

        <TweakSection label="Home page" />
        <TweakRadio label="Layout" value={t.homeLayout}
          options={[{value:"analytics",label:"Analytics"},{value:"activity",label:"Activity"}]}
          onChange={v => setTweak("homeLayout", v)} />
      </TweaksPanel>
    </div>
    </PermissionsCtx.Provider>
  );
}

function Breadcrumb({ route, role }) {
  const D = window.SehatData;
  const roleDef = D.ROLES.find(r => r.key === role);
  const labels = {
    home: "Health Score Dashboard",
    submissions: "Submissions",
    customers: "Customers",
    doctor: "Clinical review",
    orders: "Shopify orders",
    crm_orders: "CRM orders",
    order_create: "Create order",
    shipments: "Shipments",
    marketing: "Marketing analytics",
    admin: "Roles & users",
    settings: "Settings",
  };
  return (
    <div className="crumb">
      <Icon name="home" size={14} />
      <span>{roleDef?.label || "SehatUp"}</span>
      <span className="sep">/</span>
      <span className="cur">{labels[route.key]}</span>
    </div>
  );
}

function PrescriptionsScreen({ me }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const isAdmin = me?.role === 'admin';

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const uid = me?.uid;

    console.group('%c[MyPrescriptions] Mount', 'color:#a78bfa;font-weight:bold');
    console.log('me object:', me);
    console.log('uid:', uid);
    console.log('role:', me?.role);

    if (!uid) {
      console.warn('[MyPrescriptions] No UID found — cannot fetch. me =', me);
      console.groupEnd();
      setLoading(false);
      return;
    }

    console.log('[MyPrescriptions] Attaching onSnapshot on prescriptions where doctorUid ==', uid);
    console.groupEnd();

    const q = query(collection(db, 'prescriptions'), where('doctorUid', '==', uid));
    const unsub = onSnapshot(q, snap => {
      console.group('%c[MyPrescriptions] Snapshot received', 'color:#34d399;font-weight:bold');
      console.log('Total docs returned by Firestore:', snap.docs.length);
      console.log('docId list:', snap.docs.map(d => d.id));

      const list = snap.docs.map(d => {
        const data = d.data();
        console.log(`  doc ${d.id}:`, {
          patientName: data.patientName,
          prescriptionID: data.prescriptionID,
          doctorUid: data.doctorUid,
          consultationDate: data.consultationDate,
          timestamp: data.timestamp,
          savedAt: data.savedAt,
          prescriptionDownloadUrl: data.prescriptionDownloadUrl || '(none)',
        });
        return { id: d.id, ...data };
      });

      const getMs = p =>
        p.timestamp?.toMillis?.() ||
        p.savedAt?.toMillis?.() ||
        (p.consultationDate ? new Date(p.consultationDate).getTime() : 0);
      list.sort((a, b) => getMs(b) - getMs(a));

      console.log('After sort — first 5 patients:', list.slice(0, 5).map(p => ({
        id: p.id,
        patientName: p.patientName,
        prescriptionID: p.prescriptionID,
        date: p.consultationDate || p.timestamp,
      })));
      console.groupEnd();

      setPrescriptions(list);
      setLoading(false);
    }, (err) => {
      console.group('%c[MyPrescriptions] Snapshot ERROR', 'color:#f87171;font-weight:bold');
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);
      console.error('Full error:', err);
      console.log('This is often a missing Firestore index. Check the message above for a direct link to create it.');
      console.groupEnd();
      setLoading(false);
    });
    return unsub;
  }, [me?.uid]);

  const filtered = useMemo(() => {
    if (!search.trim()) return prescriptions;
    const q = search.toLowerCase();
    return prescriptions.filter(p => {
      const doctorName = p.doctors?.[0]?.name || p.consultedByName || '';
      return (
        (p.patientName || '').toLowerCase().includes(q) ||
        (p.prescriptionID || '').toLowerCase().includes(q) ||
        (p.phone || '').includes(q) ||
        doctorName.toLowerCase().includes(q)
      );
    });
  }, [prescriptions, search]);

  const getDoctorName = (p) => p.doctors?.[0]?.name || p.consultedByName || '—';

  const fmt = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleCopy = (url, id) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="col fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">My Prescriptions</h1>
          <p className="page-sub">{loading ? 'Loading…' : `${prescriptions.length} prescription${prescriptions.length !== 1 ? 's' : ''}`}</p>
        </div>
      </div>

      <div className="grid-12" style={{ flex: 1, minHeight: 0 }}>
        {/* List */}
        <div className="span-4 card" style={{ padding: 0, display: 'flex', flexDirection: 'column', maxHeight: 720 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 9, top: 9, color: 'var(--muted)', display: 'flex' }}><Icon name="search" size={14} /></div>
              <input className="input" style={{ paddingLeft: 30 }} placeholder="Search name, ID, doctor…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}
            {!loading && filtered.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No prescriptions found.</div>}
            {filtered.map(p => (
              <div key={p.id} onClick={() => setSelected(p)} style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: selected?.id === p.id ? 'var(--accent-soft)' : 'transparent', borderLeft: selected?.id === p.id ? '2px solid var(--accent)' : '2px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                    <Icon name="clipboard" size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="fw5" style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.patientName || 'Unknown'}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>{p.prescriptionID || '—'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{fmt(p.timestamp || p.savedAt || p.consultationDate)}</div>
                    {isAdmin && (
                      <div style={{ fontSize: 10.5, color: 'var(--fg-soft)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="user" size={9} /> {getDoctorName(p)}
                      </div>
                    )}
                  </div>
                  {/* PDF status dot */}
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.prescriptionDownloadUrl ? 'var(--risk-low)' : 'var(--risk-moderate)', flexShrink: 0 }} title={p.prescriptionDownloadUrl ? 'PDF ready' : 'Generating…'} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="span-8">
          {!selected ? (
            <div className="card" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'var(--muted)' }}>
              <Icon name="pill" size={32} />
              <div style={{ fontSize: 13 }}>Select a prescription to view details</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 720 }}>
              {/* Header */}
              <div style={{ padding: '14px 20px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.patientName}</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{selected.prescriptionID} · {fmt(selected.timestamp || selected.savedAt || selected.consultationDate)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {selected.prescriptionDownloadUrl ? (
                    <>
                      <a href={selected.prescriptionDownloadUrl} target="_blank" rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 12.5, fontWeight: 600, textDecoration: 'none' }}>
                        <Icon name="clipboard" size={13} /> View PDF
                      </a>
                      <button onClick={() => handleCopy(selected.prescriptionDownloadUrl, selected.id)}
                        style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.14)', border: 'none', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                        title="Copy PDF link">
                        <Icon name={copiedId === selected.id ? 'check' : 'copy'} size={13} />
                      </button>
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
                      <Icon name="refresh" size={12} className="spin" /> Generating…
                    </div>
                  )}
                  <button className="btn sm ghost" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: 'none' }} onClick={() => setSelected(null)}><Icon name="x" size={14} /></button>
                </div>
              </div>

              <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Patient info */}
                <div className="card flat" style={{ background: 'var(--surface-2)' }}>
                  <div className="grid-12" style={{ gap: 12 }}>
                    {[
                      ['Patient', selected.patientName],
                      ['Gender', selected.patientGender],
                      ['Age', selected.patientAge ? `${selected.patientAge} yrs` : '—'],
                      ['Phone', selected.phone || '—'],
                      ['Consultation', fmt(selected.consultationDate || selected.timestamp)],
                      ['Follow-up', selected.followUpDate ? fmt(selected.followUpDate) : '—'],
                      ['Prescribed by', getDoctorName(selected)],
                      ['Template', selected.prescriptionTemplate || 'None'],
                    ].map(([label, val]) => (
                      <div key={label} className="span-3">
                        <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Diagnosis */}
                {(selected.primaryDiagnosis || selected.clinicalFindings) && (
                  <div>
                    <div className="section-title" style={{ marginBottom: 8 }}>Clinical Diagnosis</div>
                    <div className="grid-12" style={{ gap: 12 }}>
                      {selected.primaryDiagnosis && (
                        <div className="span-6 card flat" style={{ background: 'var(--surface-2)' }}>
                          <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Primary Diagnosis</div>
                          <div style={{ fontSize: 13 }}>{selected.primaryDiagnosis}</div>
                        </div>
                      )}
                      {selected.clinicalFindings && (
                        <div className="span-6 card flat" style={{ background: 'var(--surface-2)' }}>
                          <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Clinical Findings</div>
                          <div style={{ fontSize: 13 }}>{selected.clinicalFindings}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Lifestyle advice */}
                {selected.lifestyleChanges?.length > 0 && (
                  <div>
                    <div className="section-title" style={{ marginBottom: 8 }}>Lifestyle & Dietary Advice</div>
                    <div className="grid-12" style={{ gap: 8 }}>
                      {selected.lifestyleChanges.map((l, i) => (
                        <div key={i} className="span-6" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 5 }} />
                          <span style={{ fontSize: 12.5 }}>{l.text || l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Medications */}
                {selected.recommendedProducts?.length > 0 && (
                  <div>
                    <div className="section-title" style={{ marginBottom: 8 }}>Medications</div>
                    <div className="col" style={{ gap: 8 }}>
                      {selected.recommendedProducts.map((med, i) => (
                        <div key={i} className="card flat" style={{ background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 12 }}>
                          {med.image && <img src={med.image} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }} />}
                          <div style={{ flex: 1 }}>
                            <div className="fw5" style={{ fontSize: 13 }}>{med.name}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                              {[med.type, med.timing, med.frequency, `${med.durationValue || med.duration || ''}`].filter(Boolean).join(' · ')}
                            </div>
                            {med.instruction && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{med.instruction}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Screen({ route, setRoute, tweaks, openCustomer, openSubmission, setSubmissionsCount, me }) {
  switch (route.key) {
    case "home":         return <Dashboard tweaks={tweaks} openCustomer={openCustomer} openSubmission={openSubmission} setRoute={setRoute} />;
    case "submissions":  return <SubmissionsScreen openCustomer={openCustomer} openSubmission={openSubmission} setSubmissionsCount={setSubmissionsCount} />;
    case "customers":      return <CustomersList openCustomer={openCustomer} openSubmission={openSubmission} />;
    case "prescriptions":  return <PrescriptionsScreen me={me} />;
    case "doctor":         return <DoctorScreen openCustomer={openCustomer} openSubmission={openSubmission} context={route.ctx} />;
    case "orders":       return <OrdersHistory setRoute={setRoute} openCustomer={openCustomer} />;
    case "crm_orders":   return <CRMOrders setRoute={setRoute} openCustomer={openCustomer} />;
    case "order_create": return <OrderCreate context={route.ctx} setRoute={setRoute} />;
    case "shipments":    return <ShipmentsScreen />;
    case "marketing":    return <MarketingScreen />;
    case "admin":        return <AdminScreen />;
    case "settings":     return <SettingsScreen tweaks={tweaks} me={me} />;
    default:             return <Dashboard tweaks={tweaks} openCustomer={openCustomer} openSubmission={openSubmission} setRoute={setRoute} />;
  }
}

function HeartLottieLogo() {
  return (
    <div style={{
      width: 38, height: 38,
      background: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)',
      borderRadius: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', flexShrink: 0,
      boxShadow: '0 2px 10px rgba(244,63,94,0.4)'
    }}>
      {/* Scrolling ECG line */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: 0.32 }}>
        <svg viewBox="0 0 76 38" preserveAspectRatio="none"
          style={{ position: 'absolute', top: 0, left: 0, width: '200%', height: '100%', animation: 'ecgScroll 1.8s linear infinite' }}>
          {/* Pattern repeats twice for seamless loop: each cycle is 38 units wide */}
          <polyline
            points="0,19 7,19 11,4 15,34 19,19 28,19 31,14 34,24 37,19 38,19 45,19 49,4 53,34 57,19 66,19 69,14 72,24 75,19 76,19"
            fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </div>
      {/* Beating heart */}
      <svg viewBox="0 0 24 24" width="17" height="17" fill="white"
        style={{ position: 'relative', zIndex: 1, animation: 'heartBeat 1.2s ease-in-out infinite', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.25))' }}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </div>
  );
}

export default App;
