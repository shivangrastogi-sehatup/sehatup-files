# SehatUp Firestore Master Blueprint (FULL SCHEMA)

## 1. Global Questionnaire Schema (Root Fields)
**Collection**: `questionnaires` (or `questionnaire_submissions`)

| Field Name | Firestore Type | Description |
| :--- | :--- | :--- |
| `userName` | `string` | Full name of the user |
| `phone` | `string` | Formatted contact number |
| `dob` | `string` | Date of Birth (YYYY-MM-DD) |
| `concern` | `string` | Display Category (e.g., "ED", "Mens Weight") |
| `questionnaireId` | `string` | `womens-weight` | `mens-weight` | `womens-wellness` | `mens-wellness` |
| `healthScore` | `number (int64)` | Calculated wellness score (0-100) |
| `height` | `number (int64)` | Height in centimeters |
| `weight` | `number (int64)` | Initial/Current weight in kg |
| `targetWeight` | `number (int64)` | Goal weight in kg |
| `bmi` | `number (double)` | Calculated Body Mass Index |
| `issueTitle` | `string` | Snapshot summary (e.g., "Normal weight + Hormonal Imbalance") |
| `riskClass` | `string` | lowercase classification (`high`, `moderate`, `low`) |
| `riskType` | `string` | UI classification (`High Risk`, `Moderate Risk`) |
| `riskDescription` | `string` | Detailed analysis text from engine |
| `reportCategory` | `string` | PDF template selection key |
| `reportDate` | `string` | DD-MM-YYYY format |
| `reportDownloadUrl` | `string` | Public/Signed URI to PDF |
| `reportStoragePath` | `string` | Internal Storage reference (`gs://...`) |
| `peerAverage` | `number (int64)` | Regional average for age group |
| `peerComparison` | `string` | Dynamic text summary of comparisons |
| `timestamp` | `timestamp` | Submission creation time |
| `pdfGeneratedAt` | `timestamp` | Time PDF was synced back to Firestore |
| `isWhatsAppSent` | `boolean` | Flag to track WhatsApp report delivery status (`false` by default) |

---

## 2. Individual Questionnaire Backend Data (FULL JSON)

### 🔥 Women's Weight Management (`womens-weight`)
```json
{
  "userName": "Shivang",
  "phone": "7300978845",
  "dob": "2002-08-12",
  "concern": "Women's Weight Management",
  "questionnaireId": "womens-weight",
  "healthScore": 62,
  "height": 180,
  "weight": 80,
  "targetWeight": 70,
  "issueTitle": "Normal weight + Hormonal Imbalance",
  "riskClass": "moderate",
  "riskType": "Moderate Risk",
  "riskDescription": "Your score suggests that your health is somewhat compromised...",
  "reportCategory": "Womens Weight Management",
  "reportDate": "07-04-2026",
  "peerAverage": 90,
  "peerComparison": "Your score is lower than 20% of people...",
  "answers": [
    { "question": "Tick that applies for long-term weight control?", "answer": "not able to devote 30 mins daily", "score": 0 },
    { "question": "What is your primary weight loss goal?", "answer": "fat loss", "score": 0 },
    { "question": "How active are you daily?", "answer": "Sedentary (little or no exercise)", "score": 10 },
    { "question": "How many hours do you sleep daily?", "answer": "Less than 5 hours", "score": 6 },
    { "question": "Experience any of the following? (Select all that apply)", "answer": "PCOS/PCOD", "score": 2 },
    { "question": "Currently on birth control or hormone therapy?", "answer": "Yes", "score": 5 }
  ],
  "lifestyleChanges": [
    { "text": "Follow fixed meal timings with low-GI grains." },
    { "text": "Prioritize protein in the first meal — skipping breakfast worsens insulin resistance." }
  ],
  "futureRisks": [
    { "text": "Increased risk of obesity, diabetes, cardiovascular diseases" }
  ],
  "possibleCauses": [
    { "text": "PCOS causes hormonal imbalance that affects insulin and fat storage." }
  ],
  "recommendedProducts": [
    { "name": "Garcinia Cambogia Drops - sehatUP", "salePrice": 499, "whyPoints": [{"text":"Reduces appetite"}] }
  ],
  "timeline": [
    { "month": "Month 1", "timelineDesc": "Light digestion, fewer cravings, bloating ease" }
  ],
  "lifestyleConditions": ["pcos/pcod"],
  "isWhatsAppSent": false
}
```

### 🔥 Men's Weight Loss (`mens-weight`)
```json
{
  "userName": "Shivang",
  "phone": "7300978845",
  "currentWeight": 80,
  "bmi": 24.7,
  "questionnaireId": "mens-weight",
  "healthScore": 77,
  "issueTitle": "Moderate Lifestyle Risk (Diet & Activity)",
  "riskClass": "moderate",
  "answers": [
    { "question": "How active are you daily?", "answer": "Sedentary", "score": 20 },
    { "question": "Do you experience any of the following?", "answer": "Erectile Dysfunction", "score": 2 }
  ],
  "lifestyleChanges": [
    { "text": "Never skip your first meal—delayed breakfast can lead to belly fat." },
    { "text": "Stand up every 45 minutes—long sitting reduces testosterone." }
  ],
  "futureRisks": [
    { "text": "Increased risk of obesity and diabetes" }
  ],
  "lifestyleConditions": ["erectile dysfunction"],
  "isWhatsAppSent": false
}
```

### 🔥 Women's Wellness (`womens-wellness`)
```json
{
  "userName": "Shivang",
  "questionnaireId": "womens-wellness",
  "healthScore": 62,
  "reportCategory": "Womens Sexual Wellness",
  "issueTitle": "Mild Hormonal Disturbance",
  "answers": [
    { "question": "Regular menstrual cycle?", "answer": "Slightly irregular", "score": 5 },
    { "question": "Diagnosed with PCOD or PCOS?", "answer": "Yes, but it’s under control", "score": 5 }
  ],
  "lifestyleChanges": [
    { "text": "Eat balanced meals; avoid fasting or skipping." },
    { "text": "Add seeds and healthy fats like ghee or nuts" }
  ],
  "possibleCauses": [
    { "text": "Mild hormonal fluctuations, stress, or lifestyle shifts." }
  ],
  "isWhatsAppSent": false
}
```

### 🔥 Men's Wellness / ED (`mens-wellness`)
```json
{
  "userName": "Shivang",
  "concern": "ED",
  "healthScore": 46,
  "riskClass": "high",
  "riskType": "High Risk",
  "issueTitle": "Erectile Dysfunction",
  "answers": [
    { "question": "Is staying hard ever a challenge?", "answer": "Everytime", "score": 10 },
    { "question": " struggle to stay hard?", "answer": "Less than 1 minute", "score": 10 }
  ],
  "recommendedProducts": [
    { "name": "Pure Himalayan Shilajit Resin", "salePrice": 1349, "whyPoints": [{"text":"Enhances testosterone"}] }
  ],
  "possibleCauses": [
    { "text": "Psychological triggers" },
    { "text": "Vascular deficiency" }
  ],
  "isWhatsAppSent": false
}
```

---

## 3. Subcollection: `whatsapp_requests`
**Hierarchy**: `questionnaires/{docId}/whatsapp_requests/{reqId}`

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `answers` | `array<map>` | Full snapshot of parent answers for the bot |
| `status` | `string` | `sent` \| `pending` |
| `sent` | `boolean` | Success flag |
| `timestamp` | `timestamp` | Creation time |

---

## 4. Security Rules & Admin Function

```javascript
// Firestore Rules
match /questionnaires/{id} {
  allow create: if true;
  match /whatsapp_requests/{waId} { allow read, write: if request.auth != null; }
}

// Node.js Batched Insert
async function save(payload) {
  const batch = db.batch();
  const ref = db.collection('questionnaires').doc();
  batch.set(ref, { ...payload, timestamp: admin.firestore.FieldValue.serverTimestamp() });
  await batch.commit();
}
```
