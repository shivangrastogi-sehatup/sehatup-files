# Questionnaire Data Architecture & Redundancy Analysis

This document outlines the structure of data saved to Firestore from the questionnaire system and identifies areas of redundancy for future optimization.

## Data Structure Overview

When a questionnaire is submitted, a `data` object is sent to the `questionnaire_submissions` collection in Firestore. This object contains both **flattened, ready-to-use fields** and a **raw backup** (`rawState`).

### Root-Level Fields (Flattened)
These fields are optimized for the PDF generator and the React frontend:
- `healthScore`: Computed numerical score (0-100).
- `riskType`: Category (Low, Moderate, High, Critical).
- `answers`: Flat array of `{question, answer, score}`.
- `possibleCauses`: Array of potential health causes.
- `lifestyleChanges`: Array of recommended health tips.
- `timeline`: Merged monthly progress roadmap.
- `futureRisks`: Potential long-term complications.
- `recommendedProducts`: Filtered list of relevant products with pricing and images.

---

## Redundancy Analysis: `rawState`

The `rawState` field currently stores a copy of the entire input and middle-ware calculation state. This is **redundant** because almost all of its contents are already present in the root-level fields.

### Duplicated Data Summary

| Root Field | Source in `rawState` | Redundancy Level |
| :--- | :--- | :--- |
| **`answers`** | `rawState.allAnswers` | **High**: Duplicate of raw user choices. |
| **`possibleCauses`** | `rawState.results.possibleCauses` | **100%**: Identical string arrays. |
| **`futureRisks`** | `rawState.results.futureRisks` | **100%**: Identical string arrays. |
| **`timeline`** | `rawState.results.timelineData` | **100%**: Merged version of the same data. |
| **`issueTitle`** | `rawState.results.issueTitle` | **100%**: Calculated title is duplicated. |

### Architectural Recommendations

1. **Storage Optimization**: Remove `rawState` entirely to reduce Firestore document size by **40% to 60%**. The root fields are sufficient for all current reporting and display needs.
2. **"Re-hydration" Logic**: Only keep `rawState.allAnswers` IF you need to allow users to return to a partial questionnaire. The `results` part should never be stored raw, as it can be re-calculated from the answers at any time.
3. **Standardization**: Some questionnaires (like Men's Weight) have additional category fields (e.g., `medicalAnswers`). These should be streamlined to avoid triple-redundancy.

---

*Last Updated: April 6, 2026*
