# Prescription and diet templates

Copied from the code on 2026-10-27. These are copies for reading and editing. Changing them here changes nothing live until they are put back into the code.

## Files
- `prescription-template.html`: the prescription PDF layout (Handlebars). Source: `sehatup-firebase/functions/templates/prescriptionTemplateV3.html`. It is filled with the patient, doctor, medicines and the chosen diet plan.
- `diet-plans/<key>.json`: one diet and lifestyle plan each (condition, subtitle, meals, foods to avoid, lifestyle, follow-up).
- `diet-plans/_all.json`: all of them in one file.

## Diet and lifestyle plans
| Key | Name in the app | Meals | Lifestyle lines |
|---|---|---|---|
| `lean_to_weight_gain` | PCOD - Lean Type (Weight Gain) | 6 | 3 |
| `weight_to_lean` | PCOD - Overweight Type (Weight Loss) | 6 | 3 |
| `infertility_pcod_pcos` | PCOD - Infertility & Irregular Periods | 6 | 4 |
| `thyroid_diabetes_pcod` | PCOD - Thyroid + Diabetes (Leucorrhea) | 6 | 3 |
| `general_pcod_pcos` | PCOD - General (Irregular Periods) | 6 | 4 |
| `pcod_mood_anxiety_insomnia` | PCOD - Mood Swings, Anxiety & Insomnia | 6 | 2 |

## Where they live in the code
- The plan text: `DIET_PLANS` in `sehatup-firebase/functions/index.js`. `injectDietPlan` picks one by the `prescriptionTemplate` key and puts it into the prescription as `dietPlan`.
- The dropdown labels: `DIET_TEMPLATES` in `sehatup-analytics/src/NewUI.jsx` (the live app) and the `<select>` in `PrescriptionEditor.jsx`.
- To add or change a plan, edit `DIET_PLANS` in `index.js` and add the same key and label to `DIET_TEMPLATES` in `NewUI.jsx`, then deploy the functions.

## See it working
Run `node preview.js` in this folder. It writes a `preview/` folder with one prescription page for each diet plan, filled with sample patient and medicine data. Open `preview/index.html` in a browser. To save a page as PDF, press Ctrl+P and turn on "Background graphics". After editing `prescription-template.html` or a `diet-plans/*.json` file, run the command again and refresh the browser. It needs no install, since it uses the Handlebars already in `sehatup-firebase/functions/node_modules`.
