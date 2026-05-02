# Diet & Lifestyle Plan — Full Implementation Plan

## What We Are Building

When a doctor creates a prescription, they can select a **diet plan template** from a dropdown.
Upon PDF generation, the system automatically injects the full structured diet & lifestyle plan
onto **Page 2** of the PDF (after all prescription content), with the **same header and patient
info bar** as page 1.

---

## System Architecture Overview

```
PrescriptionEditor.jsx (React UI)
        │
        │ saves prescriptionTemplate field to Firestore
        ▼
Firestore: prescriptions/{docId}
        │
        │ onCreate trigger
        ▼
index.js (Cloud Function)
   1. Reads prescriptionTemplate field
   2. Looks up DIET_PLANS[prescriptionTemplate]
   3. Sets data.dietPlan = <structured data>
   4. Sets data.hasDietPlan = true
        │
        │ injects into Handlebars template
        ▼
prescriptionTemplateV3.html
   Page 1: Prescription (existing layout)
   Page 2: {{#if hasDietPlan}} Diet Plan (new section with page-break-before: always)
        │
        ▼
Puppeteer → PDF (multi-page A4)
```

---

## Files to Change (3 files total)

| File | Change |
|------|--------|
| `sehatup-analytics/src/components/PrescriptionEditor.jsx` | Add 5th dropdown option, rename labels |
| `sehatup-firebase/functions/index.js` | Add DIET_PLANS data + injection logic |
| `sehatup-firebase/functions/templates/prescriptionTemplateV3.html` | Add Page 2 diet plan section |

---

## Part 1 — PrescriptionEditor.jsx

### Location
`PrescriptionEditor.jsx` lines 1370–1376 — the `<select>` for Prescription Template.

### Current State (4 options)
```jsx
<option value="">N/A (No Template)</option>
<option value="lean_to_weight_gain">Lean to Weight Gain</option>
<option value="weight_to_lean">Weight to Lean (Weight Loss)</option>
<option value="infertility_pcod_pcos">Infertility for Females (PCOD/PCOS)</option>
<option value="general_pcod_pcos">General for Females (PCOD/PCOS)</option>
```

### New State (5 options — rename + add)
```jsx
<option value="">N/A (No Template)</option>
<option value="lean_to_weight_gain">PCOD – Lean Type (Weight Gain)</option>
<option value="weight_to_lean">PCOD – Overweight Type (Weight Loss)</option>
<option value="infertility_pcod_pcos">PCOD – Infertility & Irregular Periods</option>
<option value="thyroid_diabetes_pcod">PCOD – Thyroid + Diabetes (Leucorrhea)</option>
<option value="general_pcod_pcos">PCOD – General (Irregular Periods)</option>
```

### What changes:
- Rename option 1: "Lean to Weight Gain" → "PCOD – Lean Type (Weight Gain)"
- Rename option 2: "Weight to Lean (Weight Loss)" → "PCOD – Overweight Type (Weight Loss)"
- Rename option 3: "Infertility for Females (PCOD/PCOS)" → "PCOD – Infertility & Irregular Periods"
- **Add NEW option 4**: value=`thyroid_diabetes_pcod`, label="PCOD – Thyroid + Diabetes (Leucorrhea)"
- Rename option 5: "General for Females (PCOD/PCOS)" → "PCOD – General (Irregular Periods)"

---

## Part 2 — index.js (Cloud Function)

### Where to Insert

After line 892 (after `data.guidelines = [...]`) and before the `generatePDF` call.

### What to Add

**Step A — Add `DIET_PLANS` constant** near the top of the file (after `require` statements):

This is a large JS object containing all 5 structured diet plans. Each plan has this shape:

```js
const DIET_PLANS = {
  lean_to_weight_gain: {
    condition: "PCOD (Lean Type) with Hairfall, Weakness, Heavy Periods",
    subtitle: "Diet planned considering hormonal imbalance, nutritional deficiency & low body weight",
    meals: [
      {
        time: "Early Morning (7:00–8:00 AM)",
        food: "1 glass lukewarm water + 5 soaked almonds + 2 walnuts + 5–6 soaked black raisins",
        benefit: "Helps improve energy levels, supports hair growth & reduces weakness caused by heavy periods"
      },
      {
        time: "Breakfast (8:30–9:30 AM)",
        food: "Option 1: Paneer sandwich (multigrain bread)  |  Option 2: 2 eggs + 1 toast  |  Option 3: Vegetable poha with peanuts",
        benefit: "High protein + healthy fats help in weight gain, reduce hairfall & support hormonal balance"
      },
      {
        time: "Mid-Morning (11:00–12:00 PM)",
        food: "1 banana / chikoo / mango (seasonal)",
        benefit: "Supports healthy weight gain & maintains energy throughout the day"
      },
      {
        time: "Lunch (1:30–2:30 PM)",
        food: "2 multigrain roti + 1 bowl sabzi + 1 bowl dal/paneer + 1 bowl curd  |  Small portion salad before meal",
        benefit: "Balanced nutrition improves digestion, supports hormones & reduces weakness"
      },
      {
        time: "Evening Snack (5:00–6:00 PM)",
        food: "Tea (light) + peanut chaat / roasted chana  |  OR coconut water + handful makhana",
        benefit: "Maintains energy levels & reduces muscle fatigue"
      },
      {
        time: "Dinner (7:30–8:30 PM)",
        food: "2 roti + sabzi + paneer/dal",
        benefit: "No restriction on dinner quantity – focus on nourishment & recovery"
      }
    ],
    dailyAddons: {
      food: "1 tsp seeds mix (flax + pumpkin) + 1–2 tsp ghee daily",
      benefit: "Improves hormonal balance, hair health & supports weight gain"
    },
    specialFocus: {
      title: "Heavy Periods & Weakness",
      food: "Include beetroot, spinach, black raisins regularly",
      benefit: "Helps improve blood levels & reduces fatigue"
    },
    avoidFoods: [
      "Avoid junk, packaged food, excess sugar",
      "Limit tea/coffee (max 1–2 cups)",
      "Prevents further hormonal imbalance"
    ],
    hydration: "2.5–3 litres water daily",
    lifestyle: [
      "30 minutes light exercise or walk",
      "Proper sleep (7–8 hours)",
      "Avoid stress & late night eating"
    ],
    followUp: "Review after 15 days for weight and symptom improvement",
    note: "This diet is specifically designed for lean PCOD patients with weakness and heavy menstrual flow. Focus is on improving nutritional status, hormonal balance & gradual healthy weight gain."
  },

  weight_to_lean: {
    condition: "PCOD with Weight Gain, Acne, Hairfall & Irregular Periods",
    subtitle: "Diet planned considering hormonal imbalance, metabolism disturbance & digestive issues",
    meals: [
      {
        time: "Early Morning (7:00–8:00 AM)",
        food: "1 glass lukewarm water + lemon (without sugar) + 1 tsp soaked methi seeds",
        benefit: "Helps improve digestion, reduce bloating & support fat metabolism"
      },
      {
        time: "Breakfast (8:30–9:30 AM)",
        food: "Option 1: 2 besan chilla + curd  |  Option 2: Vegetable oats + seeds mix  |  Option 3: 2 eggs + 1 multigrain toast",
        benefit: "High protein breakfast helps reduce acne, hairfall & controls cravings"
      },
      {
        time: "Mid-Morning (11:00–12:00 PM)",
        food: "1 fruit (apple/guava/papaya)",
        benefit: "Maintains energy levels & prevents overeating"
      },
      {
        time: "Lunch (1:30–2:30 PM)",
        food: "2 multigrain roti + 1 bowl sabzi + 1 bowl dal/paneer + salad before meal",
        benefit: "Balanced meal supports hormonal balance & weight control"
      },
      {
        time: "Evening Snack (5:00–6:00 PM)",
        food: "Green tea / normal tea (without sugar) + roasted chana / makhana",
        benefit: "Controls cravings & supports metabolism"
      },
      {
        time: "Dinner (7:30–8:30 PM)",
        food: "1–2 roti + sabzi OR vegetable soup + paneer",
        benefit: "Light dinner helps reduce bloating & supports fat loss"
      }
    ],
    dailyAddons: {
      food: "Flax seeds – 1 tsp, Pumpkin seeds – 1 tsp, 2 walnuts",
      benefit: "Supports hormonal balance, reduces acne & hairfall"
    },
    avoidFoods: [
      "Avoid sugar, bakery, fried & packaged food",
      "Limit rice, potato, banana, mango",
      "Reduce excess tea/coffee"
    ],
    hydration: "2.5–3 litres water daily",
    lifestyle: [
      "30–40 min daily walk/exercise",
      "Proper sleep (7–8 hrs)",
      "Avoid late night eating"
    ],
    followUp: "Review after 15 days",
    note: "This diet focuses on hormonal balance, weight reduction & improvement in skin and hair health."
  },

  infertility_pcod_pcos: {
    condition: "PCOD with Irregular Periods & Infertility Concerns",
    subtitle: "Diet planned considering hormonal imbalance, ovulation support & reproductive health",
    meals: [
      {
        time: "Early Morning (7:00–8:00 AM)",
        food: "Lukewarm water + 1 tsp soaked methi seeds OR 2 walnuts",
        benefit: "Supports hormonal balance & ovulation function"
      },
      {
        time: "Breakfast (High Protein)",
        food: "Besan chilla + curd  /  Eggs + toast  /  Oats + seeds",
        benefit: "Improves egg quality & stabilizes hormones"
      },
      {
        time: "Mid-Morning",
        food: "1 fruit (apple/guava/papaya)",
        benefit: "Maintains energy & prevents hormonal fluctuations"
      },
      {
        time: "Lunch",
        food: "2 roti + sabzi + dal/paneer + salad",
        benefit: "Balanced nutrition supports reproductive system"
      },
      {
        time: "Evening Snack",
        food: "Green tea / normal tea (no sugar) + roasted chana/makhana",
        benefit: "Controls cravings & supports metabolism"
      },
      {
        time: "Dinner (Light & Early)",
        food: "1–2 roti + sabzi OR soup + paneer",
        benefit: "Improves digestion & supports hormonal recovery"
      }
    ],
    dailyAddons: {
      food: "Flax seeds, pumpkin seeds, walnuts",
      benefit: "Supports ovulation, hormone balance & fertility"
    },
    specialFocus: {
      title: "Reproductive Health",
      food: "Include leafy greens, beetroot, nuts, seeds regularly",
      benefit: "Improves blood flow & reproductive health"
    },
    avoidFoods: [
      "Sugar, junk food, packaged food, excess caffeine",
      "Prevents hormonal imbalance"
    ],
    lifestyle: [
      "30–40 min walk daily",
      "Stress management",
      "Proper sleep",
      "Regular cycle support is essential"
    ],
    followUp: "Review after 15 days"
  },

  thyroid_diabetes_pcod: {
    condition: "PCOD with Thyroid Imbalance, Sugar Tendency, Leucorrhea & Weakness",
    subtitle: "Diet planned considering hormonal imbalance, metabolism disturbance & nutritional deficiency",
    meals: [
      {
        time: "Early Morning (7:00–8:00 AM)",
        food: "Lukewarm water + 1 tsp soaked methi seeds",
        benefit: "Helps control sugar levels & supports hormonal balance"
      },
      {
        time: "Breakfast (High Protein)",
        food: "Besan chilla + curd  /  Eggs + toast  /  Vegetable oats + seeds",
        benefit: "Supports thyroid, reduces hairfall & controls cravings"
      },
      {
        time: "Mid-Morning",
        food: "1 fruit (apple/guava/papaya)",
        benefit: "Maintains steady energy levels"
      },
      {
        time: "Lunch",
        food: "2 roti + sabzi + dal/paneer + salad",
        benefit: "Improves digestion & supports hormones"
      },
      {
        time: "Evening Snack",
        food: "Tea (no sugar) + roasted chana/makhana",
        benefit: "Prevents weakness & cravings"
      },
      {
        time: "Dinner",
        food: "1–2 roti + sabzi OR soup + paneer",
        benefit: "Light dinner improves metabolism & reduces bloating"
      }
    ],
    dailyAddons: {
      food: "Flax seeds, pumpkin seeds, walnuts, black raisins",
      benefit: "Helps in hairfall, weakness & hormonal balance"
    },
    specialFocus: {
      title: "Leucorrhea & Overall Health",
      food: "Curd (daytime), coconut water, green vegetables",
      benefit: "Supports leucorrhea & overall health"
    },
    avoidFoods: [
      "Sugar, junk food, packaged food",
      "Limit tea/coffee"
    ],
    lifestyle: [
      "Daily walk",
      "Proper sleep",
      "Stress management"
    ],
    followUp: "Review after 15 days"
  },

  general_pcod_pcos: {
    condition: "PCOD with Irregular Periods (General Type)",
    subtitle: "Plan focuses on regulating hormones, improving ovulation and stabilizing insulin levels",
    understandingItems: [
      "Irregular periods are mainly due to hormonal imbalance.",
      "This plan focuses on regulating hormones, improving ovulation and stabilizing insulin levels."
    ],
    meals: [
      {
        time: "Morning Hormone Reset Routine",
        items: [
          "Warm water with soaked methi seeds (4–5 seeds, 4 times/week)",
          "2 soaked walnuts + 5 almonds",
          "10–15 min sunlight exposure for Vitamin D",
          "Light stretching or breathing exercises"
        ]
      },
      {
        time: "Breakfast (High Protein – Must)",
        items: [
          "Paneer bhurji / Eggs / Moong dal chilla",
          "Add 1 tsp flaxseed powder (estrogen balance)",
          "Avoid bread, biscuits, sugary cereals",
          "Tea/coffee without excess sugar"
        ]
      },
      {
        time: "Mid-Morning Hormone Snack",
        items: [
          "Low GI fruit: Apple / Guava / Papaya",
          "1 tsp pumpkin seeds (zinc for hormone support)",
          "Avoid fruit juices"
        ]
      },
      {
        time: "Lunch (Balanced Plate)",
        items: [
          "1–2 roti (multigrain) + sabzi + dal",
          "Include leafy greens (spinach, methi)",
          "1 bowl curd (skip if white discharge)",
          "Avoid fried/oily food"
        ]
      },
      {
        time: "Evening Cortisol Control Snack",
        items: [
          "Herbal tea (cinnamon + tulsi)",
          "Roasted chana / makhana",
          "Avoid biscuits, namkeen"
        ]
      },
      {
        time: "Dinner (Light & Early)",
        items: [
          "Dal + sabzi + 1 roti",
          "1 tsp sesame seeds (cycle regulation)",
          "Finish dinner before 8:30 PM",
          "Avoid heavy carbs at night"
        ]
      }
    ],
    advancedTips: [
      "Seed Cycling: flax + pumpkin (first half cycle), sesame + sunflower (second half)",
      "Protein in every meal improves ovulation",
      "Avoid cold foods during periods",
      "Sleep before 11 PM (melatonin-hormone link)",
      "Daily 20–30 min walk"
    ],
    lifestyle: [
      "Manage stress (yoga, breathing, journaling)",
      "Avoid late nights",
      "Stay hydrated (2–3 litres water)",
      "Consistency is key for results"
    ],
    note: "This is a general plan. Follow consistently for 6–8 weeks for visible results."
  }
};
```

**Step B — Inject diet plan data** (after `data.guidelines` line):

```js
// Inject Diet Plan Template if selected
const selectedTemplate = data.prescriptionTemplate;
if (selectedTemplate && DIET_PLANS[selectedTemplate]) {
  data.dietPlan = DIET_PLANS[selectedTemplate];
  data.hasDietPlan = true;
} else {
  data.hasDietPlan = false;
}
```

### How the data flows:
- `prescriptionTemplate` = e.g. `"lean_to_weight_gain"` (saved by PrescriptionEditor.jsx)
- Looks up in `DIET_PLANS` constant
- Sets `data.dietPlan` with the full structured plan
- Sets `data.hasDietPlan = true`
- Handlebars template uses `{{#if hasDietPlan}}` to conditionally render Page 2

---

## Part 3 — prescriptionTemplateV3.html

### Page Break Logic

CSS `page-break-before: always; break-before: page;` forces the diet plan to always start
on a new page, regardless of whether the prescription is 1 page or 2 pages.

Puppeteer uses `@page { size: A4 }` from the CSS (via `preferCSSPageSize: true` in the
Cloud Function). This means page breaks work correctly and the PDF will have:
- Page 1 (or pages 1–2): Prescription content
- Next page: Diet & Lifestyle Plan

### New Section to Add (at end of `<body>`, before `</body>`)

```html
{{#if hasDietPlan}}
<div class="diet-plan-page" style="page-break-before: always; break-before: page; padding: 0 4mm 4mm 4mm;">

  <!-- ── SAME HEADER as Page 1 ── -->
  <div class="header" style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; border-bottom: 1px solid #F1F5F9; padding-bottom: 12px;">
    <div>
      <img src="{{logoBase64}}" alt="sehatUP" style="height: 38px; display: block;">
    </div>
    <div style="text-align: right;">
      <div style="font-size: 10px; font-weight: 700; color: #1E293B; margin-bottom: 3px;">www.sehatup.com</div>
      <div style="font-size: 9px; font-weight: 500; color: #64748B; margin-bottom: 2px;">support@sehatup.com</div>
      <div style="font-size: 9px; font-weight: 500; color: #64748B;">+91-9355539355</div>
    </div>
  </div>

  <!-- ── SAME PATIENT INFO BAR as Page 1 ── -->
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; background: #F9FAFB; padding: 12px 20px; border-radius: 16px; border: 1px solid #E5E7EB; margin-bottom: 20px;">
    <div><span class="label">Patient Name</span> <span class="val">{{patientName}}</span></div>
    <div><span class="label">Age / Gender</span> <span class="val">{{patientAge}} / {{patientGender}}</span></div>
    <div><span class="label">Date of Consultation</span> <span class="val">{{consultationDate}}</span></div>
    <div><span class="label">Prescription ID</span> <span class="val">{{prescriptionID}}</span></div>
  </div>

  <!-- ── DIET PLAN TITLE BANNER ── -->
  <div style="background: #2C2C2C; color: white; border-radius: 12px; padding: 14px 20px; margin-bottom: 16px;">
    <div style="font-size: 16px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px;">
      Detailed Diet &amp; Lifestyle Plan
    </div>
    <div style="font-size: 11px; font-weight: 600; color: #F12F46; margin-bottom: 3px;">
      Condition: {{dietPlan.condition}}
    </div>
    <div style="font-size: 10px; color: rgba(255,255,255,0.7);">
      Prepared by: Dr. Somya Sharma (BHMS, Dietician)
    </div>
    {{#if dietPlan.subtitle}}
    <div style="font-size: 10px; color: rgba(255,255,255,0.55); margin-top: 4px; font-style: italic;">
      {{dietPlan.subtitle}}
    </div>
    {{/if}}
  </div>

  <!-- ── UNDERSTANDING (only general_pcod_pcos plan) ── -->
  {{#if dietPlan.understandingItems}}
  <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 10px; padding: 12px 16px; margin-bottom: 14px;">
    <div style="font-size: 11px; font-weight: 800; color: #1D4ED8; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Understanding Your Condition</div>
    {{#each dietPlan.understandingItems}}
    <div style="font-size: 11px; color: #1E3A5F; margin-bottom: 3px; padding-left: 14px; position: relative;">
      <span style="position: absolute; left: 0; top: 5px; width: 5px; height: 5px; background: #1D4ED8; border-radius: 50%; display: inline-block;"></span>
      {{this}}
    </div>
    {{/each}}
  </div>
  {{/if}}

  <!-- ── MEAL CARDS GRID ── -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
    {{#each dietPlan.meals}}
    <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 10px; padding: 12px 14px; border-left: 4px solid #F12F46; break-inside: avoid;">
      <div style="font-size: 10px; font-weight: 800; color: #F12F46; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">{{this.time}}</div>
      {{#if this.food}}
      <div style="font-size: 11px; font-weight: 600; color: #1E293B; margin-bottom: 4px; line-height: 1.4;">{{this.food}}</div>
      {{/if}}
      {{#if this.items}}
      {{#each this.items}}
      <div style="font-size: 11px; color: #374151; margin-bottom: 2px; padding-left: 14px; position: relative; line-height: 1.4;">
        <span style="position: absolute; left: 0; font-weight: 700; color: #F12F46;">{{add @index 1}}.</span>
        {{this}}
      </div>
      {{/each}}
      {{/if}}
      {{#if this.benefit}}
      <div style="font-size: 9.5px; color: #6B7280; font-style: italic; margin-top: 5px; line-height: 1.3; border-top: 1px solid #F3F4F6; padding-top: 4px;">{{this.benefit}}</div>
      {{/if}}
    </div>
    {{/each}}
  </div>

  <!-- ── DAILY ADD-ONS & SPECIAL FOCUS ROW ── -->
  <div style="display: grid; grid-template-columns: {{#if dietPlan.specialFocus}}1fr 1fr{{else}}1fr{{/if}}; gap: 10px; margin-bottom: 14px;">
    {{#if dietPlan.dailyAddons}}
    <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 10px; padding: 12px 14px; break-inside: avoid;">
      <div style="font-size: 10px; font-weight: 800; color: #16A34A; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Daily Add-ons</div>
      <div style="font-size: 11px; font-weight: 600; color: #14532D; margin-bottom: 4px;">{{dietPlan.dailyAddons.food}}</div>
      <div style="font-size: 9.5px; color: #166534; font-style: italic;">{{dietPlan.dailyAddons.benefit}}</div>
    </div>
    {{/if}}
    {{#if dietPlan.specialFocus}}
    <div style="background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 10px; padding: 12px 14px; break-inside: avoid;">
      <div style="font-size: 10px; font-weight: 800; color: #EA580C; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Special Focus — {{dietPlan.specialFocus.title}}</div>
      <div style="font-size: 11px; font-weight: 600; color: #7C2D12; margin-bottom: 4px;">{{dietPlan.specialFocus.food}}</div>
      <div style="font-size: 9.5px; color: #9A3412; font-style: italic;">{{dietPlan.specialFocus.benefit}}</div>
    </div>
    {{/if}}
  </div>

  <!-- ── ADVANCED TIPS (general plan only) ── -->
  {{#if dietPlan.advancedTips}}
  <div style="background: #FAF5FF; border: 1px solid #E9D5FF; border-radius: 10px; padding: 12px 16px; margin-bottom: 14px; break-inside: avoid;">
    <div style="font-size: 10px; font-weight: 800; color: #7C3AED; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Advanced Dietician Tips (Important)</div>
    {{#each dietPlan.advancedTips}}
    <div style="font-size: 11px; color: #4C1D95; margin-bottom: 3px; padding-left: 18px; position: relative; line-height: 1.4;">
      <span style="position: absolute; left: 0; font-weight: 700; color: #7C3AED;">{{add @index 1}}.</span>
      {{this}}
    </div>
    {{/each}}
  </div>
  {{/if}}

  <!-- ── FOODS TO AVOID + LIFESTYLE ROW ── -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
    {{#if dietPlan.avoidFoods}}
    <div style="background: #FFF1F2; border: 1px solid #FECDD3; border-radius: 10px; padding: 12px 14px; break-inside: avoid;">
      <div style="font-size: 10px; font-weight: 800; color: #E11D48; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Foods to Avoid / Limit</div>
      {{#each dietPlan.avoidFoods}}
      <div style="font-size: 11px; color: #881337; margin-bottom: 3px; padding-left: 14px; position: relative; line-height: 1.4;">
        <span style="position: absolute; left: 0; top: 5px; width: 4px; height: 4px; background: #E11D48; border-radius: 50%; display: inline-block;"></span>
        {{this}}
      </div>
      {{/each}}
    </div>
    {{/if}}
    <div style="background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 10px; padding: 12px 14px; break-inside: avoid;">
      <div style="font-size: 10px; font-weight: 800; color: #0284C7; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Lifestyle Instructions</div>
      {{#each dietPlan.lifestyle}}
      <div style="font-size: 11px; color: #0C4A6E; margin-bottom: 3px; padding-left: 14px; position: relative; line-height: 1.4;">
        <span style="position: absolute; left: 0; top: 5px; width: 4px; height: 4px; background: #0284C7; border-radius: 50%; display: inline-block;"></span>
        {{this}}
      </div>
      {{/each}}
    </div>
  </div>

  <!-- ── HYDRATION + FOLLOW-UP ROW ── -->
  <div style="display: grid; grid-template-columns: {{#if dietPlan.hydration}}1fr 1fr{{else}}1fr{{/if}}; gap: 10px; margin-bottom: 16px;">
    {{#if dietPlan.hydration}}
    <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; gap: 10px; break-inside: avoid;">
      <div style="font-size: 22px;">💧</div>
      <div>
        <div style="font-size: 10px; font-weight: 800; color: #1D4ED8; text-transform: uppercase; margin-bottom: 2px;">Hydration</div>
        <div style="font-size: 11px; font-weight: 600; color: #1E3A5F;">{{dietPlan.hydration}}</div>
      </div>
    </div>
    {{/if}}
    {{#if dietPlan.followUp}}
    <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; gap: 10px; break-inside: avoid;">
      <div style="font-size: 22px;">📅</div>
      <div>
        <div style="font-size: 10px; font-weight: 800; color: #374151; text-transform: uppercase; margin-bottom: 2px;">Follow-Up</div>
        <div style="font-size: 11px; font-weight: 600; color: #111827;">{{dietPlan.followUp}}</div>
      </div>
    </div>
    {{/if}}
  </div>

  <!-- ── NOTE ── -->
  {{#if dietPlan.note}}
  <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 10px; padding: 12px 16px; break-inside: avoid;">
    <div style="font-size: 10px; font-weight: 800; color: #92400E; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Note</div>
    <div style="font-size: 11px; color: #78350F; line-height: 1.5; font-style: italic;">{{dietPlan.note}}</div>
  </div>
  {{/if}}

  <!-- ── FOOTER DISCLAIMER ── -->
  <div style="margin-top: 16px; border-top: 1px solid #F3F4F6; padding-top: 6px;">
    <p style="font-size: 7.5px; color: #9CA3AF; line-height: 1.4; margin: 0; font-weight: 400;">
      <span style="font-weight: 600; color: #6B7280; text-transform: uppercase; font-size: 7px; letter-spacing: 0.3px;">Disclaimer:</span>
      This dietary plan is issued as supplementary advice based on the patient's consultation. It is not a substitute for medical treatment. Results may vary by individual. Follow consistently for best results.
    </p>
  </div>

</div>
{{/if}}
```

### Handlebars Helper Required

Add this helper in `index.js` (where other helpers are registered via `handlebars.registerHelper`):

```js
handlebars.registerHelper('add', (a, b) => parseInt(a) + parseInt(b));
```

This is needed for the numbered list rendering inside the general_pcod_pcos meal cards.

---

## Implementation Order

1. **PrescriptionEditor.jsx** — add 5th option, rename 4 options (5 min change)
2. **index.js** — add `DIET_PLANS` constant + injection logic + `add` helper (30 min)
3. **prescriptionTemplateV3.html** — add the `{{#if hasDietPlan}}` section at end of body (20 min)
4. **Test** — create a prescription in the dashboard, select "PCOD – Thyroid + Diabetes",
   generate PDF, verify page 2 appears with correct content

---

## Data Flow Summary (end to end)

```
Doctor opens PrescriptionEditor
    → selects "PCOD – Thyroid + Diabetes (Leucorrhea)" from dropdown
    → prescriptionTemplate = "thyroid_diabetes_pcod"

Doctor clicks Save
    → Firestore: prescriptions/{docId}.prescriptionTemplate = "thyroid_diabetes_pcod"

Cloud Function triggers (onCreate)
    → reads data.prescriptionTemplate = "thyroid_diabetes_pcod"
    → looks up DIET_PLANS["thyroid_diabetes_pcod"]
    → sets data.dietPlan = { condition, meals, dailyAddons, ... }
    → sets data.hasDietPlan = true
    → calls htmlFromTemplate(data, "prescription")

Handlebars renders prescriptionTemplateV3.html
    → Page 1: normal prescription (diagnosis, medicines, signature)
    → {{#if hasDietPlan}} → renders Page 2:
        - same header (logo + contact)
        - same patient info bar (name, age, date, ID)
        - dark title banner (condition, prepared by)
        - meal cards grid (2 columns)
        - daily addons + special focus
        - avoid foods + lifestyle
        - hydration + follow-up
        - note

Puppeteer generates multi-page A4 PDF
    → PDF saved to Firebase Storage
    → Download URL updated in Firestore
```

---

## Notes & Edge Cases

- **N/A template selected** → `hasDietPlan = false` → only 1 page (current behavior unchanged)
- **Missing prescriptionTemplate field** (old prescriptions) → `hasDietPlan = false` → no page 2
- **Long prescription (2 pages)** → diet plan still starts on its OWN page via CSS `page-break-before: always`
- **general_pcod_pcos** has `items[]` per meal (numbered list) instead of single `food` string — template handles both with `{{#if this.food}}` / `{{#if this.items}}`
- **advancedTips** and **understandingItems** only exist on `general_pcod_pcos` — template uses `{{#if}}` guards so other plans are not affected
- The `add` Handlebars helper (1 + @index) must be registered in `index.js` for numbered list rendering
