# Questionnaire Backend Data Documentation

This document provides a detailed view of the field-level data structure for all questionnaires across the SehatUp platform. This schema is used to save submissions into the **Firebase Firestore** backend.

## 1. Firestore Collections

| Collection Name | Purpose | Access / Trigger |
| :--- | :--- | :--- |
| `questionnaire_submissions` | Final assessment results, scores, and products. | Used by Doctor Dashboard & PDF Generator. Triggered on "Finish". |
| `partial_submissions` | Temporary data for incomplete quizzes. | Used for WhatsApp outreach. Triggered after "About You" step. |

---

## 2. Universal Schema (Core Fields)

All live questionnaires (`womens-wellness`, `mens-wellness`, `womens-weight`, `mens-weight`) save these fields:

| Field Key | Type | Description |
| :--- | :--- | :--- |
| `reportDate` | `string` | Human-readable date (e.g., "06-04-2026"). |
| `timestamp` | `timestamp` | Server-side Firestore timestamp for sorting. |
| `questionnaireId`| `string` | The unique ID (e.g., `womens-wellness`). |
| `userName` | `string` | Patient's full name. |
| `dob` | `string` | Date of birth (YYYY-MM-DD). |
| `phone` | `string` | 10-digit mobile number. |
| `healthScore` | `number` | Final score from 0 to 100. |
| `riskType` | `string` | "Critical", "High", "Moderate", or "Low". |
| `issueTitle` | `string` | Dynamic diagnosis title based on logic. |
| `reportCategory` | `string` | Fixed category name used for PDF templates. |
| `concern` | `string` | The primary area of concern. |

---

## 3. Detailed Data Objects (Lists)

| Field Key | Structure | Description |
| :--- | :--- | :--- |
| `answers` | `[{ question, answer, score }]` | Flattened list of every question and user's selected text. |
| `recommendedProducts` | `[{ name, salePrice, image, whyPoints: [{text}] }]` | Array of products chosen by the recommendation engine. |
| `timeline` | `[{ month, timelineDesc }]` | Predicted milestones based on score and condition. |
| `possibleCauses` | `[{ text }]` | List of likely causes derived from configuration rules. |
| `futureRisks` | `[{ text }]` | List of potential health risks if left untreated. |
| `lifestyleChanges` | `[{ text }]` | Recommended lifestyle modifications and tips. |

---

## 4. Specialized Fields by Assessment Type

| Category | Field Key | Type / Structure | Description |
| :--- | :--- | :--- | :--- |
| **Weight Management** | `height` | `number` | Patient's height in cm. |
| **Weight Management** | `weight` | `number` | Patient's current weight in kg. |
| **Weight Management** | `targetWeight` | `number` | Patient's goal weight in kg. |
| **Sexual Wellness** | `sexualHealthAnswers` | `array` | Specific answers related to ED/PE function. |
| **Sexual Wellness** | `lifestyleComorbiditiesAnswers` | `array` | Answers regarding linked health habits. |

---

## 5. Developer Meta & Support Fields

| Field Key | Purpose | Note |
| :--- | :--- | :--- |
| `rawState` | Contains original `allAnswers` and `results` objects. | Useful for debugging or reprocessing logic. |
| `status` (Partial) | In-progress marker for `partial_submissions`. | Usually set to "incomplete". |
| `reminderSent` (Partial) | Tracks if follow-up was triggered. | Boolean flag for marketing automation. |

---

## 6. Real-world Data Example (Archi patel)

Below is how a specific "Critical Risk" document (ID: `qUtRMXqXmwkwt6rHU6KT`) is structured for the **Women's Wellness** questionnaire.

### **Submission Summary**
| Field | Value |
| :--- | :--- |
| **User Name** | Archi patel |
| **Health Score** | 25 |
| **Issue Title** | High Hormonal Disturbance |
| **Risk Type** | Critical Risk |

### **Full Document JSON (Complete Structured View)**
```json
{
	"documentId": "qUtRMXqXmwkwt6rHU6KT",
	"profile": {
		"userName": "Archi patel",
		"phone": "8128291855",
		"dob": "2002-03-17",
		"reportDate": "05-04-2026"
	},
	"assessment": {
		"questionnaireId": "womens-wellness",
		"concern": "Women's Wellness",
		"reportCategory": "Womens Sexual Wellness",
		"healthScore": 25,
		"riskType": "Critical Risk",
		"issueTitle": "High Hormonal Disturbance",
		"peerAverage": 85,
		"peerComparison": "Your score is lower than 80% of people in your age group."
	},
	"answers": [
		{ "question": "How regular is your menstrual cycle?", "answer": "Highly unpredictable or absent", "score": 10 },
		{ "question": "How severe are your menstrual cramps?", "answer": "Mild discomfort, manageable without medication", "score": 5 },
		{ "question": "How would you describe your period flow?", "answer": "Heavy for 1–2 days, then manageable", "score": 5 },
		{ "question": "Have you been diagnosed with PCOD or PCOS?", "answer": "Yes, and it’s not well-managed", "score": 10 },
		{ "question": "Do you experience any symptoms? (Acne, Mood swings)", "answer": "Acne, Mood swings", "score": 0 },
		{ "question": "Balanced diet consumption?", "answer": "Occasionally", "score": 8 },
		{ "question": "Caffeinated beverage consumption?", "answer": "Daily, 1–2 servings", "score": 8 },
		{ "question": "Fatigue during period?", "answer": "Always", "score": 10 },
		{ "question": "Alcohol or cigarettes?", "answer": "Rarely or never", "score": 0 },
		{ "question": "Mentioned health problems? (PCOD/PCOS)", "answer": "PCOD/PCOS", "score": 0 },
		{ "question": "Itching or irritation in intimate area?", "answer": "Rarely or never", "score": 3 },
		{ "question": "Bad odor or discharge?", "answer": "Rarely or never", "score": 3 },
		{ "question": "Hormonal imbalance symptoms?", "answer": "Always", "score": 10 },
		{ "question": "Estrogen dominance diagnosis?", "answer": "No", "score": 3 }
	],
	"possibleCauses": [
		{ "text": "Severe hormonal imbalance, PCOS, thyroid issues, chronic stress." },
		{ "text": "Slight prostaglandin activity, occasional stress." },
		{ "text": "Insulin resistance, hormonal imbalance, genetic factors." },
		{ "text": "Good hygiene, balanced vaginal flora, no infection." },
		{ "text": "Severe hormonal imbalance, often PCOS or thyroid-related." }
	],
	"futureRisks": [
		{ "text": "High risk of infertility, endometrial hyperplasia, or metabolic disorders." },
		{ "text": "Low risk. Could worsen if lifestyle becomes unbalanced." },
		{ "text": "Irregular periods, infertility, diabetes, heart disease risk." },
		{ "text": "No immediate risks. Continue good hygiene practices." },
		{ "text": "Risk of infertility, diabetes, obesity, and mood disorders if left untreated." }
	],
	"lifestyleChanges": [
		{ "text": "Eat balanced meals; avoid fasting or skipping." },
		{ "text": "Reduce sugar and packaged foods" },
		{ "text": "Maintain regular sleep and daily movement" },
		{ "text": "Add seeds and healthy fats like ghee or nuts" }
	],
	"recommendedProducts": [
		{
			"name": "Her Menses (For Rhythmic Relief & Hormonal Harmony)",
			"salePrice": 499,
			"image": "https://...",
			"whyPoints": [
				{ "text": "Helps fix irregular or missed periods." },
				{ "text": "Soothes pain, irritability, and emotional ups and downs." },
				{ "text": "Useful in PCOS, delayed or painful periods." }
			]
		},
		{
			"name": "Zencal D3K2",
			"salePrice": 499,
			"image": "https://...",
			"whyPoints": [
				{ "text": "Boosts metabolism and supports fat breakdown." },
				{ "text": "Helps reduce fatigue and balance mood." }
			]
		},
		{
			"name": "HormoniHerb | Herbal Blue Tea",
			"salePrice": 399,
			"image": "https://...",
			"whyPoints": [
				{ "text": "Relax muscles and reduce cramping." },
				{ "text": "Support hormonal balance." }
			]
		}
	],
	"timeline": [
		{ "month": "Month 1", "timelineDesc": "Mild improvement in cycle timing, Mood steadier, acne reduces, Pain and bloating ease" },
		{ "month": "Month 2", "timelineDesc": "Cycles more predictable, Facial hair slows, emotional stability, PMS improves" },
		{ "month": "Month 3", "timelineDesc": "Periods regular and lighter, Skin texture better, weight balanced, Rare cramps, better focus" }
	]
}
```


---

_Last Updated: 06-04-2026_

