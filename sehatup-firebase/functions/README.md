# SehatUp Firebase Functions 🚀

This directory contains the Cloud Functions backend for SehatUp. It handles critical business logic including **Health Report Generation (PDF)**, **WhatsApp Automation**, and **OTP Verification**.

## 📱 WhatsApp Integration: QuickReply.ai

The system has been migrated from WATI to **QuickReply.ai** for all automated messaging.

### **Key Components:**
- **`sendReportOnQuickReply`**: Helper function that communicates with the QuickReply API to send template messages.
- **`CreatePDFOnFormSubmission`**: Automates the delivery of Health scores. It listens for new documents in `questionnaire_submissions`, generates a PDF, and then triggers the WhatsApp report.

### **Status Tracking Fields:**
Firestore documents in `questionnaire_submissions` include these fields for tracking:
- `isWhatsAppSent`: (Boolean) True if the message was successfully dispatched to QuickReply.
- `localMessageId`: The unique message ID for cross-referencing in the QuickReply dashboard.
- `quickReplyId`: Specifically tracks the QuickReply delivery.
- `wAMessageSentAt`: Timestamp of the successful dispatch.

---

## 🛠️ Configuration & Secrets

The functions rely on the following environment variables (Firebase Secrets). Ensure these are set in your environment:

| Secret Name | Description | Example |
| :--- | :--- | :--- |
| `QUICKREPLY_CLIENT_ID` | Your QuickReply.ai Client ID | `...` |
| `QUICKREPLY_SECRET_KEY` | Your QuickReply.ai Secret Key | `...` |
| `QUICKREPLY_REPORT_TEMPLATE_ID` | The Template ID for the Health Report | `send_code_1` |
| `TOTP_SECRET` | Secret key for OTP generation | `...` |

### **Setting Secrets:**
To set a secret (e.g., the Template ID), run:
```bash
firebase functions:config:set quickreply.report_template_id="YOUR_TEMPLATE_ID"
```

---

## 🧪 Deployment

To deploy the functions to production:
```bash
# In the functions directory
npm run deploy
```

## 🏗️ Architecture Flow

1. **Trigger**: `onDocumentCreated` on `questionnaire_submissions/{docId}`.
2. **PDF Gen**: Uses `puppeteer` to render the report and `handlebars` for data binding.
3. **Storage**: Saves PDF to Firebase Storage and generates a `downloadUrl`.
4. **WhatsApp**: Calls QuickReply API with the `downloadUrl`.
5. **Update**: Writes `isWhatsAppSent: true` back to the submission document.

---

*Last Updated: 06 April 2026*
