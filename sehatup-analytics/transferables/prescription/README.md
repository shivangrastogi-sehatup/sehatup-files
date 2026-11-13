# sehatUP prescription: handoff

This folder has everything the live prescription PDF is built from: the template, the images it loads, the diet plans, and a script to look at the result.

## What is in here

| Path | What it is |
|---|---|
| `prescription-template.html` | The prescription page (Handlebars + CSS). Same layout and wording as the live template. |
| `assets/functions-assets/Logo.png` | The logo. The server turns it into a base64 image and passes it in as `logoBase64`. |
| `assets/hosting/PDF-Assets/prescription/` | Three icons used on the diet plan page: `celebration.png`, `hydration.png`, `calendar.png`. |
| `diet-plans/` | The six diet plans, one JSON file each, plus `_all.json`, `labels.json` (the names shown in the CRM dropdown) and `diet-plans.source.js` (the same plans as they sit in the code). |
| `sample-data.json` | Made-up patient, doctor and medicines, so the template can be filled without the real system. |
| `preview.js`, `package.json` | Builds one HTML page per diet plan so you can look at the result. |
| `reference/` | Code copied from the live system, only to show how the template gets its data. It does not run on its own. |

## How a prescription is made

1. A doctor fills in the prescription in the CRM (`sehatup-analytics`). Saving it writes a document to the `prescriptions` collection in Firestore. The fields saved are in `reference/crm-saved-fields.jsx`.
2. That write starts the Cloud Function `CreatePrescriptionPDFOnTrigger` (`sehatup-firebase/functions/index.js`, copied to `reference/live-pdf-pipeline.js`).
3. The function adds the logo, the cart link, the guidelines list and, if the doctor picked one, the diet plan. It fills the template and renders the page to a PDF with puppeteer.
4. The PDF is stored in Firebase Storage and its link is written back to the prescription.

## What the template needs

Top level:

| Field | Notes |
|---|---|
| `patientName`, `patientAge`, `patientGender` | |
| `prescriptionID` | for example `RX-1393` |
| `consultationDate` | already formatted, for example `03 Nov 2026` |
| `primaryDiagnosis` | |
| `clinicalFindings` | optional |
| `recommendedProducts` | list of medicines, see below |
| `cartLink` | link behind the "Buy now medicines" button. Falls back to `https://sehatup.com/` |
| `guidelines` | list of plain text lines |
| `doctors` | list, see below |
| `logoBase64` | `data:image/png;base64,...` |
| `baseUrl` | where the three icons are served from. Live it is the Firebase Hosting site, `https://sehatup-f96b5.web.app` |
| `hasDietPlan`, `dietPlan` | the second page is only printed when `hasDietPlan` is true |

Each medicine in `recommendedProducts`: `name`, `contains` (optional), `type`, `timing`, `instruction`, `duration`, and one of:
- `dosageType: "schedule"` with `dosage`, four values for morning, afternoon, evening, night, for example `["1","0","0","1"]`
- `dosageType: "drops"` with `dosageValue` and `dosageFrequency`
- any other `dosageType` (for example `"topical"`) with `dosageValue` as free text

Each doctor in `doctors`: `name`, `qualification` (line breaks are kept), `registrationNo` (optional), `signatures` (list of image links, may be empty). The signature images come from the doctor's profile in the CRM, not from this folder.

The template uses five Handlebars helpers: `lt`, `gt`, `eq`, `len`, `add`. They are in `reference/live-pdf-pipeline.js` and registered again in `preview.js`.

## Diet plans

The doctor picks one in the CRM. Its key is saved as `prescriptionTemplate`, and the function copies the matching plan into `dietPlan`.

| Key | Name in the CRM |
|---|---|
| `lean_to_weight_gain` | PCOD - Lean Type (Weight Gain) |
| `weight_to_lean` | PCOD - Overweight Type (Weight Loss) |
| `infertility_pcod_pcos` | PCOD - Infertility & Irregular Periods |
| `thyroid_diabetes_pcod` | PCOD - Thyroid + Diabetes (Leucorrhea) |
| `pcod_mood_anxiety_insomnia` | PCOD - Mood Swings, Anxiety & Insomnia |
| `general_pcod_pcos` | PCOD - General (Irregular Periods) |

A plan has: `condition`, `subtitle`, `meals` (each with `time`, and `food` or `items`, and `benefit`), `lifestyle`, and these optional parts: `dailyAddons`, `specialFocus`, `avoidFoods`, `hydration`, `followUp`, `note`, `understandingItems`, `advancedTips`. The template skips any part a plan does not have.

To add a plan: add it to `DIET_PLANS` in `sehatup-firebase/functions/index.js`, add the same key and name to `DIET_TEMPLATES` in `sehatup-analytics/src/NewUI.jsx`, then deploy the functions.

## Looking at it

```
npm install
node preview.js
```

Open `preview/index.html`. There is one page with no diet plan and one for each plan. To save a page as a PDF, press Ctrl+P and switch on "Background graphics".

## Good to know

- The font is Montserrat, loaded from Google Fonts by a link at the top of the template. The PDF server needs internet access for it.
- The server also passes `signatureBase64`, `backgroundBase64` and `qrCodeData`. This template does not use them.
- The diet plan page has a fixed line, "Prepared by: Dr. Somya Sharma (BHMS, Dietician)", and a fixed "Worth ₹1500" in the banner. Both are written in the template.
- The page is A4 wide. The PDF height is set from the content, so the prescription is one long page rather than several A4 sheets.
- This template was tidied up for handover: comments removed, repeated inline styles moved into the stylesheet, and unused CSS deleted. It was compared against the live template for every diet plan, with one, two and three doctors and each dosage type: the text, links, images and table are identical. It was not compared pixel by pixel in a browser, so look at the preview before replacing the live file.
- `prescription-templates/` at the top of the repository is an older working copy with a small visual edit. Use this folder instead.
