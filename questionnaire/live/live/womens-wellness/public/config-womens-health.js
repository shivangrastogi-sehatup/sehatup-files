// assets/config-womens-health.js — Bilingual (en / hi).
// Questions/options carry `hi`; futureRisksMapping values are { en, hi };
// femaleGeneralTimeline entries carry hi/hiDesc; uiTranslations holds all
// static UI strings. causeMapping, lifestyleTips and the extra timelines stay
// English (saved-only, not shown on the result page).

const _monthHi = { "Month 1": "महीना 1", "Month 2": "महीना 2", "Month 3": "महीना 3", "Month 6": "महीना 6" };

const uiTranslations = {
  en: {
    'main-title': "Women's Wellness Health Score",
    'welcome-title': "Welcome to the Women’s Sexual Health Quiz!",
    'welcome-point-1': "Takes just a few minutes",
    'welcome-point-2': "100% private and secure",
    'welcome-point-3': "You must be 18 or older to participate",
    'btn-start': "Start Questionnaire",
    'btn-prev-report': "Show Previous Report",
    'personal-info-title': "Tell us a bit about yourself to personalize your experience.",
    'label-name': "Enter Your Full Name:",
    'placeholder-name': "Your name",
    'label-dob': "Enter Your Date of Birth:",
    'label-phone': "Enter Your Phone Number:",
    'placeholder-phone': "Phone",
    'btn-prev': "Previous",
    'btn-next': "Next",
    'btn-back-to-quiz': "Back to Questionnaire",
    'report-title': "Assessment Report",
    'label-report-date': "Date:",
    'label-patient-name': "Name",
    'label-age': "Age",
    'label-category': "Category",
    'label-report-date-row': "Report Date",
    'report-category': "Women's Wellness",
    'future-risk-heading': "Potential Health Risks If Ignored",
    'future-risk-desc': "If left untreated, these conditions may gradually impact your health and wellbeing.",
    'reassurance-text': "Early treatment can significantly improve outcomes through lifestyle correction, medication, and guided therapy.",
    'cta-title': "Get Your Detailed HealthScore 360 Report",
    'cta-desc': "Receive your comprehensive 360° health analysis and personalized recovery roadmap directly on WhatsApp.",
    'btn-whatsapp-report': "Get My Report on WhatsApp",
    'trust-private': "Private & Confidential",
    'trust-experts': "Reviewed by Experts",
    'trust-time': "Takes < 2 mins",
    'timeline-goal': 'Start Seeing Results In <span class="highlight-text">6 Months</span>',
    'included-plan-title': "Your Treatment Inclusions",
    'treat-doctor': "Expert Doctor Consultation",
    'treat-kit': "Personalized Integrated Kit",
    'treat-diet': "Custom Diet & Lifestyle Plan",
    'recommended-treatment': "Recommended Treatment",
    'label-subtotal': "Subtotal (MRP):",
    'label-product-discount': "Product Discount:",
    'coupon-note': 'Use coupon <strong style="color: #4f46e5;">SEHAT10</strong> and get <strong>10% extra off</strong> on your first order',
    'label-total-payable': "Total Payable:",
    'label-gst-included': "(GST included)",
    'btn-buy-now': "Buy Now",
    'reviews-title': "Customer Reviews",
    'exit-title': "Get Extra Off Your Order!",
    'exit-desc': "Use the coupon code below to avail an extra discount:",
    'btn-copy': "Copy",
    'copied-feedback': "Copied!",
    'great-job': "Great Job!",
    'thank-you-msg': "Thank you for completing the assessment.<br>We are now generating your personalized report.",
    'redirecting': "Redirecting...",
    'calculating-health-report': "Calculating your personalized health report... 😊",
    'wait-moment': "Please wait a moment while we analyze your responses.",
    'currency-symbol': "Rs.",
    'about-you': "About You",
    'health': "Health",
    'lifestyle': "Lifestyle",
    'hygiene': "Hygiene",
    'hormonal': "Hormonal",
    'Critical Risk': "Critical Risk",
    'High Risk': "High Risk",
    'Moderate Risk': "Moderate Risk",
    'Low Risk': "Low Risk",
    'otp-title-1': "Confirm your number",
    'otp-msg-1': "We'll send a WhatsApp report after verification.",
    'otp-placeholder-phone': "Enter 10-digit phone number",
    'otp-btn-send': "Send OTP",
    'otp-title-2': "Verify with OTP",
    'otp-msg-2': "Please enter the OTP sent to your phone.",
    'otp-resend-text': "Didn't receive the OTP?",
    'otp-resend-link': "RESEND OTP",
    'otp-btn-verify': "Verify",
    'phone-warning': "Phone number must be exactly 10 digits.",
    'verifying': "Verifying...",
  },
  hi: {
    'main-title': "महिला स्वास्थ्य स्कोर",
    'welcome-title': "महिला यौन स्वास्थ्य प्रश्नोत्तरी में आपका स्वागत है!",
    'welcome-point-1': "इसमें केवल कुछ मिनट लगते हैं",
    'welcome-point-2': "100% निजी और सुरक्षित",
    'welcome-point-3': "भाग लेने के लिए आपकी आयु 18 वर्ष या उससे अधिक होनी चाहिए",
    'btn-start': "प्रश्नावली शुरू करें",
    'btn-prev-report': "पिछली रिपोर्ट दिखाएं",
    'personal-info-title': "अपने अनुभव को व्यक्तिगत बनाने के लिए हमें अपने बारे में थोड़ा बताएं।",
    'label-name': "अपना पूरा नाम दर्ज करें:",
    'placeholder-name': "आपका नाम",
    'label-dob': "अपनी जन्म तिथि दर्ज करें:",
    'label-phone': "अपना फोन नंबर दर्ज करें:",
    'placeholder-phone': "फ़ोन नंबर",
    'btn-prev': "पिछला",
    'btn-next': "अगला",
    'btn-back-to-quiz': "प्रश्नावली पर वापस जाएँ",
    'report-title': "आकलन रिपोर्ट",
    'label-report-date': "दिनांक:",
    'label-patient-name': "नाम",
    'label-age': "आयु",
    'label-category': "श्रेणी",
    'label-report-date-row': "रिपोर्ट दिनांक",
    'report-category': "महिला कल्याण",
    'future-risk-heading': "नज़रअंदाज़ करने पर संभावित स्वास्थ्य जोखिम",
    'future-risk-desc': "यदि उपचार न किया जाए, तो ये स्थितियाँ धीरे-धीरे आपके स्वास्थ्य और कल्याण को प्रभावित कर सकती हैं।",
    'reassurance-text': "जल्दी उपचार से जीवनशैली सुधार, दवा और मार्गदर्शित थेरेपी के माध्यम से परिणाम काफ़ी बेहतर हो सकते हैं।",
    'cta-title': "अपनी विस्तृत HealthScore 360 रिपोर्ट प्राप्त करें",
    'cta-desc': "अपना संपूर्ण 360° स्वास्थ्य विश्लेषण और व्यक्तिगत रिकवरी रोडमैप सीधे व्हाट्सएप पर प्राप्त करें।",
    'btn-whatsapp-report': "व्हाट्सएप पर मेरी रिपोर्ट प्राप्त करें",
    'trust-private': "निजी और गोपनीय",
    'trust-experts': "विशेषज्ञों द्वारा समीक्षित",
    'trust-time': "2 मिनट से कम समय",
    'timeline-goal': '<span class="highlight-text">6 महीनों</span> में परिणाम देखना शुरू करें',
    'included-plan-title': "आपके उपचार में क्या शामिल है",
    'treat-doctor': "विशेषज्ञ डॉक्टर परामर्श",
    'treat-kit': "व्यक्तिगत इंटीग्रेटेड किट",
    'treat-diet': "कस्टम डाइट और जीवनशैली योजना",
    'recommended-treatment': "अनुशंसित उपचार",
    'label-subtotal': "उप-योग (MRP):",
    'label-product-discount': "उत्पाद छूट:",
    'coupon-note': 'कूपन <strong style="color: #4f46e5;">SEHAT10</strong> का उपयोग करें और अपने पहले ऑर्डर पर <strong>10% अतिरिक्त छूट</strong> पाएं',
    'label-total-payable': "कुल देय राशि:",
    'label-gst-included': "(GST शामिल)",
    'btn-buy-now': "अभी खरीदें",
    'reviews-title': "ग्राहकों की समीक्षा",
    'exit-title': "अपने ऑर्डर पर अतिरिक्त छूट पाएं!",
    'exit-desc': "अतिरिक्त छूट पाने के लिए नीचे दिया गया कूपन कोड उपयोग करें:",
    'btn-copy': "कॉपी करें",
    'copied-feedback': "कॉपी हो गया!",
    'great-job': "बहुत बढ़िया!",
    'thank-you-msg': "आकलन पूरा करने के लिए धन्यवाद।<br>हम अब आपकी व्यक्तिगत रिपोर्ट तैयार कर रहे हैं।",
    'redirecting': "रीडायरेक्ट किया जा रहा है...",
    'calculating-health-report': "आपकी व्यक्तिगत स्वास्थ्य रिपोर्ट तैयार की जा रही है... 😊",
    'wait-moment': "कृपया कुछ क्षण प्रतीक्षा करें जब तक हम आपके उत्तरों का विश्लेषण कर रहे हैं।",
    'currency-symbol': "रु.",
    'about-you': "आपके बारे में",
    'health': "स्वास्थ्य",
    'lifestyle': "जीवनशैली",
    'hygiene': "स्वच्छता",
    'hormonal': "हार्मोनल",
    'Critical Risk': "गंभीर जोखिम",
    'High Risk': "उच्च जोखिम",
    'Moderate Risk': "मध्यम जोखिम",
    'Low Risk': "कम जोखिम",
    'otp-title-1': "अपना नंबर पुष्टि करें",
    'otp-msg-1': "सत्यापन के बाद हम व्हाट्सएप पर रिपोर्ट भेजेंगे।",
    'otp-placeholder-phone': "10-अंकीय फोन नंबर दर्ज करें",
    'otp-btn-send': "OTP भेजें",
    'otp-title-2': "OTP से सत्यापित करें",
    'otp-msg-2': "कृपया अपने फोन पर भेजा गया OTP दर्ज करें।",
    'otp-resend-text': "OTP प्राप्त नहीं हुआ?",
    'otp-resend-link': "OTP पुनः भेजें",
    'otp-btn-verify': "सत्यापित करें",
    'phone-warning': "फोन नंबर बिल्कुल 10 अंकों का होना चाहिए।",
    'verifying': "सत्यापित किया जा रहा है...",
  },
};

const questionnaireConfig = {
  id: 'womens-wellness',
  staticSteps: 2, // 1. Welcome, 2. About You. Questions start at step 3.
  uiTranslations: uiTranslations,

  questionGroups: [
    {
      step: 3,
      key: 'health',
      questions: [
        {
          question: 'How regular is your menstrual cycle?',
          hi: 'आपका मासिक चक्र कितना नियमित है?',
          options: [
            { text: 'Very regular (28–30 days)', hi: 'बहुत नियमित (28–30 दिन)', score: 3 },
            { text: 'Slightly irregular (varies by a few days)', hi: 'थोड़ा अनियमित (कुछ दिनों का अंतर)', score: 5 },
            { text: 'Irregular (varies significantly)', hi: 'अनियमित (काफ़ी अंतर)', score: 8 },
            { text: 'Highly unpredictable or absent', hi: 'अत्यधिक अनिश्चित या अनुपस्थित', score: 10 },
          ],
        },
        {
          question: 'How severe are your menstrual cramps?',
          hi: 'आपके मासिक धर्म के दर्द कितने गंभीर हैं?',
          options: [
            { text: 'I don’t experience cramps', hi: 'मुझे दर्द नहीं होता', score: 3 },
            { text: 'Mild discomfort, manageable without medication', hi: 'हल्की असुविधा, बिना दवा के प्रबंधनीय', score: 5 },
            { text: 'Moderate pain, occasionally need medication', hi: 'मध्यम दर्द, कभी-कभी दवा की आवश्यकता', score: 8 },
            { text: 'Severe pain, regularly need medication', hi: 'गंभीर दर्द, नियमित रूप से दवा की आवश्यकता', score: 10 },
          ],
        },
        {
          question: 'How would you describe your period flow?',
          hi: 'आप अपने मासिक प्रवाह का वर्णन कैसे करेंगी?',
          options: [
            { text: 'Light to moderate', hi: 'हल्का से मध्यम', score: 3 },
            { text: 'Heavy for 1–2 days, then manageable', hi: '1–2 दिन भारी, फिर प्रबंधनीय', score: 5 },
            { text: 'Heavy for most of the cycle', hi: 'अधिकांश चक्र के दौरान भारी', score: 8 },
            { text: 'Extremely heavy and difficult to manage', hi: 'अत्यधिक भारी और प्रबंधन में कठिन', score: 10 },
          ],
        },
        {
          question: 'Have you been diagnosed with PCOD or PCOS?',
          hi: 'क्या आपको PCOD या PCOS का निदान हुआ है?',
          options: [
            { text: 'No', hi: 'नहीं', score: 0 },
            { text: 'Yes, but it’s under control', hi: 'हां, लेकिन यह नियंत्रण में है', score: 5 },
            { text: 'Yes, and I’m managing it', hi: 'हां, और मैं इसे प्रबंधित कर रही हूं', score: 8 },
            { text: 'Yes, and it’s not well-managed', hi: 'हां, और यह ठीक से प्रबंधित नहीं है', score: 10 },
          ],
        },
        {
          question: 'Do you experience any symptoms given below during or just before your menstrual cycle? (Select all that apply)',
          hi: 'क्या आप अपने मासिक चक्र के दौरान या ठीक पहले नीचे दिए गए किसी लक्षण का अनुभव करती हैं? (सभी लागू चुनें)',
          multiple: true,
          options: [
            { text: 'Bloating', hi: 'सूजन', score: 0 },
            { text: 'Constipation', hi: 'कब्ज', score: 0 },
            { text: 'Diarrhea', hi: 'दस्त', score: 0 },
            { text: 'Acne', hi: 'मुंहासे', score: 0 },
            { text: 'Mood swings', hi: 'मूड स्विंग्स', score: 0 },
            { text: 'Headache', hi: 'सिरदर्द', score: 0 },
            { text: 'None', hi: 'कोई नहीं', score: 0 },
          ],
        },
      ],
    },
    {
      step: 4,
      key: 'lifestyle',
      questions: [
        {
          question: 'How often do you consume a balanced diet with fruits, vegetables, and calcium or Vitamin D-rich foods?',
          hi: 'आप कितनी बार फलों, सब्जियों और कैल्शियम या विटामिन D युक्त खाद्य पदार्थों के साथ संतुलित आहार लेती हैं?',
          options: [
            { text: 'Daily', hi: 'रोज़ाना', score: 3 },
            { text: 'Most days', hi: 'अधिकांश दिन', score: 5 },
            { text: 'Occasionally', hi: 'कभी-कभी', score: 8 },
            { text: 'Rarely', hi: 'कभी-कभार', score: 10 },
          ],
        },
        {
          question: 'How often do you consume caffeinated beverages (e.g., coffee, tea, energy drinks, soda)?',
          hi: 'आप कितनी बार कैफीनयुक्त पेय (जैसे कॉफी, चाय, एनर्जी ड्रिंक, सोडा) का सेवन करती हैं?',
          options: [
            { text: 'Rarely or never', hi: 'कभी-कभार या कभी नहीं', score: 0 },
            { text: 'Occasionally, a few times a week', hi: 'कभी-कभी, सप्ताह में कुछ बार', score: 5 },
            { text: 'Daily, 1–2 servings', hi: 'रोज़ाना, 1–2 बार', score: 8 },
            { text: 'Daily, more than 3 servings', hi: 'रोज़ाना, 3 से अधिक बार', score: 10 },
          ],
        },
        {
          question: 'How often do you feel fatigued or low in energy during your period?',
          hi: 'मासिक धर्म के दौरान आप कितनी बार थकान या ऊर्जा की कमी महसूस करती हैं?',
          options: [
            { text: 'Rarely or never', hi: 'कभी-कभार या कभी नहीं', score: 3 },
            { text: 'Occasionally', hi: 'कभी-कभी', score: 5 },
            { text: 'Frequently', hi: 'अक्सर', score: 8 },
            { text: 'Always', hi: 'हमेशा', score: 10 },
          ],
        },
        {
          question: 'How often do you consume alcohol or cigarettes?',
          hi: 'आप कितनी बार शराब या सिगरेट का सेवन करती हैं?',
          options: [
            { text: 'Rarely', hi: 'कभी-कभार', score: 0 },
            { text: 'Occasionally', hi: 'कभी-कभी', score: 0 },
            { text: '2–3 times a week', hi: 'सप्ताह में 2–3 बार', score: 0 },
            { text: 'Daily', hi: 'रोज़ाना', score: 0 },
          ],
        },
        {
          question: 'Do you have any of the mentioned health problems? (Select all that apply)',
          hi: 'क्या आपको उल्लिखित में से कोई स्वास्थ्य समस्या है? (सभी लागू चुनें)',
          multiple: true,
          options: [
            { text: 'Endometriosis / Fibroids', hi: 'एंडोमेट्रियोसिस / फाइब्रॉइड', score: 0 },
            { text: 'Depression/Anxiety', hi: 'अवसाद/चिंता', score: 0 },
            { text: 'Thyroid disorder', hi: 'थायरॉइड विकार', score: 0 },
            { text: 'PCOD/PCOS', hi: 'PCOD/PCOS', score: 0 },
            { text: 'Diabetes', hi: 'मधुमेह', score: 0 },
            { text: 'None', hi: 'कोई नहीं', score: 0 },
          ],
        },
      ],
    },
    {
      step: 5,
      key: 'hygiene',
      questions: [
        {
          question: 'Do you experience itching, irritation, or discomfort in the intimate area?',
          hi: 'क्या आप अंतरंग क्षेत्र में खुजली, जलन या असुविधा का अनुभव करती हैं?',
          options: [
            { text: 'Rarely or never', hi: 'कभी-कभार या कभी नहीं', score: 3 },
            { text: 'Occasionally', hi: 'कभी-कभी', score: 5 },
            { text: 'Frequently', hi: 'अक्सर', score: 8 },
            { text: 'Always', hi: 'हमेशा', score: 10 },
          ],
        },
        {
          question: 'Do you experience any bad odor or discharge from your genitalia?',
          hi: 'क्या आप अपने जननांग से कोई दुर्गंध या स्राव अनुभव करती हैं?',
          options: [
            { text: 'Rarely or never', hi: 'कभी-कभार या कभी नहीं', score: 3 },
            { text: 'Occasionally', hi: 'कभी-कभी', score: 5 },
            { text: 'Frequently', hi: 'अक्सर', score: 8 },
            { text: 'Always', hi: 'हमेशा', score: 10 },
          ],
        },
      ],
    },
    {
      step: 6,
      key: 'hormonal',
      questions: [
        {
          question: 'Do you experience hormonal imbalance symptoms such as acne, mood swings, facial hair or weight changes?',
          hi: 'क्या आप मुंहासे, मूड स्विंग्स, चेहरे के बाल या वज़न परिवर्तन जैसे हार्मोनल असंतुलन के लक्षण अनुभव करती हैं?',
          options: [
            { text: 'Rarely or never', hi: 'कभी-कभार या कभी नहीं', score: 3 },
            { text: 'Occasionally', hi: 'कभी-कभी', score: 5 },
            { text: 'Frequently', hi: 'अक्सर', score: 8 },
            { text: 'Always', hi: 'हमेशा', score: 10 },
          ],
        },
        {
          question: 'Have you ever been diagnosed with estrogen dominance or related conditions?',
          hi: 'क्या आपको कभी एस्ट्रोजन प्रभुत्व या संबंधित स्थितियों का निदान हुआ है?',
          options: [
            { text: 'No', hi: 'नहीं', score: 3 },
            { text: 'Yes, but it’s under control', hi: 'हां, लेकिन यह नियंत्रण में है', score: 5 },
            { text: 'Yes, and I’m managing it', hi: 'हां, और मैं इसे प्रबंधित कर रही हूं', score: 8 },
            { text: 'Yes and it’s uncontrolled', hi: 'हां और यह अनियंत्रित है', score: 10 },
          ],
        },
      ],
    },
  ],

  productDatabase: window.productDatabase,

  causeMapping: {
    'How regular is your menstrual cycle?': {
      'Very regular (28–30 days)': 'Balanced hormones, healthy lifestyle, no major reproductive issues.',
      'Slightly irregular (varies by a few days)': 'Mild hormonal fluctuations, stress, or lifestyle shifts.',
      'Irregular (varies significantly)': 'PCOS, thyroid imbalance, stress, poor nutrition.',
      'Highly unpredictable or absent': 'Severe hormonal imbalance, PCOS, thyroid issues, chronic stress.',
    },
    'How severe are your menstrual cramps?': {
      'I don’t experience cramps': 'Good hormonal balance, no underlying uterine conditions.',
      'Mild discomfort, manageable without medication': 'Slight prostaglandin activity, occasional stress.',
      'Moderate pain, occasionally need medication': 'Possible underlying inflammation, early endometriosis or fibroids.',
      'Severe pain, regularly need medication': 'Endometriosis, fibroids, pelvic inflammation.',
    },
    'Do you have any of the mentioned health problems? (Select all that apply)': {
      'Endometriosis / Fibroids': 'Hormonal imbalance, abnormal tissue growth in uterus.',
      'Depression/Anxiety': 'Neurotransmitter imbalance, stress, hormonal fluctuations.',
      'Thyroid disorder': 'Hypo- or hyperthyroidism affecting metabolism and hormones.',
      'PCOD/PCOS': 'Insulin resistance, hormonal imbalance, genetic factors.',
      'Diabetes': 'High blood sugar, insulin resistance.',
    },
    'Do you experience itching, irritation, or discomfort in the intimate area?': {
      'Rarely or never': 'Good hygiene, balanced vaginal flora, no infection.',
      'Occasionally': 'Mild infection, temporary irritation, hygiene product reaction.',
      'Frequently': 'Recurrent yeast or bacterial infections, allergies, hormonal imbalance.',
      'Always': 'Persistent infection, possibly due to poor hygiene, diabetes, or underlying condition.',
    },
    'Do you experience hormonal imbalance symptoms such as acne, mood swings, facial hair or weight changes?': {
      'Rarely or never': 'Stable hormonal profile, low stress, healthy metabolism.',
      'Occasionally': 'Minor hormonal fluctuation due to stress, diet, or sleep issues.',
      'Frequently': 'PCOS, thyroid dysfunction, stress, poor nutrition.',
      'Always': 'Severe hormonal imbalance, often PCOS or thyroid-related.',
    },
  },

  // futureRisksMapping values are { en, hi } so the result page can localise.
  futureRisksMapping: {
    'How regular is your menstrual cycle?': {
      'Very regular (28–30 days)': { en: 'Minimal risk. Keep maintaining healthy habits.', hi: 'न्यूनतम खतरा। स्वस्थ आदतें बनाए रखें।' },
      'Slightly irregular (varies by a few days)': { en: 'May cause delayed ovulation or mild fertility issues if unchecked.', hi: 'यदि अनदेखा किया जाए तो विलंबित ओव्यूलेशन या हल्की प्रजनन समस्याएं हो सकती हैं।' },
      'Irregular (varies significantly)': { en: 'Increased risk of infertility, hormonal disorders, and endometrial issues.', hi: 'बांझपन, हार्मोनल विकारों और एंडोमेट्रियल समस्याओं का बढ़ा खतरा।' },
      'Highly unpredictable or absent': { en: 'High risk of infertility, endometrial hyperplasia, or metabolic disorders.', hi: 'बांझपन, एंडोमेट्रियल हाइपरप्लासिया या मेटाबॉलिक विकारों का उच्च खतरा।' },
    },
    'How severe are your menstrual cramps?': {
      'I don’t experience cramps': { en: 'No risk. Maintain current health.', hi: 'कोई खतरा नहीं। वर्तमान स्वास्थ्य बनाए रखें।' },
      'Mild discomfort, manageable without medication': { en: 'Low risk. Could worsen if lifestyle becomes unbalanced.', hi: 'कम खतरा। यदि जीवनशैली असंतुलित हो जाए तो बिगड़ सकता है।' },
      'Moderate pain, occasionally need medication': { en: 'May progress to chronic pelvic pain or severe endometriosis.', hi: 'दीर्घकालिक पेल्विक दर्द या गंभीर एंडोमेट्रियोसिस की ओर बढ़ सकता है।' },
      'Severe pain, regularly need medication': { en: 'Chronic pain, infertility, need for surgery if untreated.', hi: 'दीर्घकालिक दर्द, बांझपन, उपचार न होने पर सर्जरी की आवश्यकता।' },
    },
    'Do you have any of the mentioned health problems? (Select all that apply)': {
      'Endometriosis / Fibroids': { en: 'Infertility, chronic pain, heavy bleeding, need for surgery.', hi: 'बांझपन, दीर्घकालिक दर्द, भारी रक्तस्राव, सर्जरी की आवश्यकता।' },
      'Depression/Anxiety': { en: 'Emotional burnout, sleep disorders, hormonal imbalance, weight gain.', hi: 'भावनात्मक थकावट, नींद विकार, हार्मोनल असंतुलन, वज़न वृद्धि।' },
      'Thyroid disorder': { en: 'Irregular cycles, fatigue, weight changes, fertility issues.', hi: 'अनियमित चक्र, थकान, वज़न परिवर्तन, प्रजनन समस्याएं।' },
      'PCOD/PCOS': { en: 'Irregular periods, infertility, diabetes, heart disease risk.', hi: 'अनियमित मासिक धर्म, बांझपन, मधुमेह, हृदय रोग का खतरा।' },
      'Diabetes': { en: 'Hormonal disruption, menstrual irregularities, fertility issues, chronic complications.', hi: 'हार्मोनल गड़बड़ी, मासिक अनियमितताएं, प्रजनन समस्याएं, दीर्घकालिक जटिलताएं।' },
    },
    'Do you experience itching, irritation, or discomfort in the intimate area?': {
      'Rarely or never': { en: 'No immediate risks. Continue good hygiene practices.', hi: 'कोई तत्काल खतरा नहीं। अच्छी स्वच्छता बनाए रखें।' },
      'Occasionally': { en: 'May lead to recurrent infections or inflammation if ignored.', hi: 'यदि अनदेखा किया जाए तो बार-बार संक्रमण या सूजन हो सकती है।' },
      'Frequently': { en: 'Risk of chronic infections, discomfort, or pelvic inflammation.', hi: 'दीर्घकालिक संक्रमण, असुविधा या पेल्विक सूजन का खतरा।' },
      'Always': { en: 'High risk of chronic inflammation, sexual health issues, or reproductive tract damage.', hi: 'दीर्घकालिक सूजन, यौन स्वास्थ्य समस्याओं या प्रजनन तंत्र क्षति का उच्च खतरा।' },
    },
    'Do you experience hormonal imbalance symptoms such as acne, mood swings, facial hair or weight changes?': {
      'Rarely or never': { en: 'No major risks. Maintain current routine.', hi: 'कोई बड़ा खतरा नहीं। वर्तमान दिनचर्या बनाए रखें।' },
      'Occasionally': { en: 'Risk of worsening imbalance if lifestyle isn’t improved.', hi: 'यदि जीवनशैली में सुधार न हो तो असंतुलन बिगड़ने का खतरा।' },
      'Frequently': { en: 'May cause cycle irregularity, skin issues, weight gain, emotional distress.', hi: 'चक्र अनियमितता, त्वचा समस्याएं, वज़न वृद्धि, भावनात्मक परेशानी का कारण बन सकता है।' },
      'Always': { en: 'Risk of infertility, diabetes, obesity, and mood disorders if left untreated.', hi: 'उपचार न होने पर बांझपन, मधुमेह, मोटापा और मनोदशा विकारों का खतरा।' },
    },
  },

  femaleGeneralTimeline: {
    '<25': [
      { month: 'Month 1', timelineDesc: 'Cycle begins to respond', hiDesc: 'चक्र प्रतिक्रिया देना शुरू करता है' },
      { month: 'Month 2', timelineDesc: 'Periods become more predictable', hiDesc: 'मासिक धर्म अधिक अनुमानित हो जाता है' },
      { month: 'Month 3', timelineDesc: 'Regular cycles (within 3–5 days)', hiDesc: 'नियमित चक्र (3–5 दिनों के भीतर)' },
      { month: 'Month 6', timelineDesc: 'Smooth and timely cycles', hiDesc: 'सुचारू और समय पर चक्र' },
    ],
    '25-60': [
      { month: 'Month 1', timelineDesc: 'Mild improvement in cycle timing', hiDesc: 'चक्र समय में हल्का सुधार' },
      { month: 'Month 2', timelineDesc: 'Cycles more predictable', hiDesc: 'चक्र अधिक अनुमानित' },
      { month: 'Month 3', timelineDesc: 'Periods regular and lighter', hiDesc: 'मासिक धर्म नियमित और हल्का' },
      { month: 'Month 6', timelineDesc: 'Healthy cycle pattern maintained', hiDesc: 'स्वस्थ चक्र पैटर्न बना रहता है' },
    ],
    '61-80': [
      { month: 'Month 1', timelineDesc: 'Slight improvement in timing', hiDesc: 'समय में हल्का सुधार' },
      { month: 'Month 2', timelineDesc: 'Regular and balanced cycles', hiDesc: 'नियमित और संतुलित चक्र' },
      { month: 'Month 3', timelineDesc: 'Fully predictable periods', hiDesc: 'पूरी तरह अनुमानित मासिक धर्म' },
      { month: 'Month 6', timelineDesc: 'Cycles easy and on time', hiDesc: 'चक्र आसान और समय पर' },
    ],
    '81+': [
      { month: 'Month 1', timelineDesc: 'Cycles stay smooth and regular', hiDesc: 'चक्र सुचारू और नियमित रहते हैं' },
      { month: 'Month 2', timelineDesc: 'Healthy rhythm continues', hiDesc: 'स्वस्थ लय जारी रहती है' },
      { month: 'Month 3', timelineDesc: 'Consistent and healthy periods', hiDesc: 'सुसंगत और स्वस्थ मासिक धर्म' },
      { month: 'Month 6', timelineDesc: 'Long-term menstrual wellness', hiDesc: 'दीर्घकालिक मासिक कल्याण' },
    ],
  },
  hormonalTimelineByScore: {
    '<25': [
      { month: 'Month 1', timelineDesc: 'Slight improvement in Acne, mood, and bloating' },
      { month: 'Month 2', timelineDesc: 'Slow growth of facial hair, better skin' },
      { month: 'Month 3', timelineDesc: 'Skin clears, improvement in mood, weight shifts' },
      { month: 'Month 6', timelineDesc: 'Balanced hormones, stable weight and energy' },
    ],
    '25-60': [
      { month: 'Month 1', timelineDesc: 'Mood steadier, acne reduces' },
      { month: 'Month 2', timelineDesc: 'Facial hair slows, emotional stability' },
      { month: 'Month 3', timelineDesc: 'Skin texture better, weight balanced' },
      { month: 'Month 6', timelineDesc: 'No mood swings, better skin and stamina' },
    ],
    '61-80': [
      { month: 'Month 1', timelineDesc: 'Mild bloating or acne relief' },
      { month: 'Month 2', timelineDesc: 'Mood and hair improve' },
      { month: 'Month 3', timelineDesc: 'Hormones steady, body feels lighter' },
      { month: 'Month 6', timelineDesc: 'Balanced energy and skin' },
    ],
    '81+': [
      { month: 'Month 1', timelineDesc: 'Stable mood and acne' },
      { month: 'Month 2', timelineDesc: 'High energy, clear skin' },
      { month: 'Month 3', timelineDesc: 'Hormones stay balanced' },
      { month: 'Month 6', timelineDesc: 'Full hormonal harmony' },
    ],
  },
  pmsTimelineByScore: {
    '<25': [
      { month: 'Month 1', timelineDesc: 'Cramp relief begins, energy rises' },
      { month: 'Month 2', timelineDesc: 'PMS and heaviness reduce' },
      { month: 'Month 3', timelineDesc: 'Mild Cramps, periods more comfortable' },
      { month: 'Month 6', timelineDesc: 'PMS barely noticeable' },
    ],
    '25-60': [
      { month: 'Month 1', timelineDesc: 'Pain and bloating ease' },
      { month: 'Month 2', timelineDesc: 'PMS improves' },
      { month: 'Month 3', timelineDesc: 'Rare cramps, better focus' },
      { month: 'Month 6', timelineDesc: 'PMS gone or minimal' },
    ],
    '61-80': [
      { month: 'Month 1', timelineDesc: 'Lighter periods, less discomfort' },
      { month: 'Month 2', timelineDesc: 'Very mild PMS' },
      { month: 'Month 3', timelineDesc: 'Pain-free periods' },
      { month: 'Month 6', timelineDesc: 'PMS-free cycles' },
    ],
    '81+': [
      { month: 'Month 1', timelineDesc: 'No bloating or pain' },
      { month: 'Month 2', timelineDesc: 'Zero PMS signs' },
      { month: 'Month 3', timelineDesc: 'Sustained relief' },
      { month: 'Month 6', timelineDesc: 'PMS-free and active life' },
    ],
  },
  vaginalHealthTimelineByScore: {
    '<25': [
      { month: 'Month 1', timelineDesc: 'Itching and discharge reduce' },
      { month: 'Month 2', timelineDesc: 'Discharge and odor improve' },
      { month: 'Month 3', timelineDesc: 'Vaginal comfort improves further' },
      { month: 'Month 6', timelineDesc: 'Long-term freshness and balance' },
    ],
    '25-60': [
      { month: 'Month 1', timelineDesc: 'Discharge and irritation reduce' },
      { month: 'Month 2', timelineDesc: 'Odor fades, pH improves' },
      { month: 'Month 3', timelineDesc: 'No abnormal discharge' },
      { month: 'Month 6', timelineDesc: 'Consistent freshness and balance' },
    ],
    '61-80': [
      { month: 'Month 1', timelineDesc: 'Occasional itching improves' },
      { month: 'Month 2', timelineDesc: 'No odor or discomfort' },
      { month: 'Month 3', timelineDesc: 'Clean and balanced hygiene' },
      { month: 'Month 6', timelineDesc: 'pH maintained, no discharge issues' },
    ],
    '81+': [
      { month: 'Month 1', timelineDesc: 'Clean, fresh, and balanced' },
      { month: 'Month 2', timelineDesc: 'No complaints' },
      { month: 'Month 3', timelineDesc: 'Hygiene feels natural' },
      { month: 'Month 6', timelineDesc: 'Intimate health optimal' },
    ],
  },
  estrogenPCOSTimelineByScore: {
    '<25': [
      { month: 'Month 1', timelineDesc: 'Bloating and soreness lessen' },
      { month: 'Month 2', timelineDesc: 'Ovulation symptoms reappear' },
      { month: 'Month 3', timelineDesc: 'Ovulation becomes regular' },
      { month: 'Month 6', timelineDesc: 'Improved symptoms of PCOS ' },
    ],
    '25-60': [
      { month: 'Month 1', timelineDesc: 'Hormonal swelling reduces' },
      { month: 'Month 2', timelineDesc: 'Better mid-cycle flow' },
      { month: 'Month 3', timelineDesc: 'Hormone profile improves' },
      { month: 'Month 6', timelineDesc: 'PCOS signs well-managed' },
    ],
    '61-80': [
      { month: 'Month 1', timelineDesc: 'Estrogen balance starts' },
      { month: 'Month 2', timelineDesc: 'Ovulation clearer' },
      { month: 'Month 3', timelineDesc: 'Hormones self-regulate' },
      { month: 'Month 6', timelineDesc: 'Stable and symptom-free' },
    ],
    '81+': [
      { month: 'Month 1', timelineDesc: 'Estrogen under control' },
      { month: 'Month 2', timelineDesc: 'Balanced cycle maintained' },
      { month: 'Month 3', timelineDesc: 'Hormonal rhythm stable' },
      { month: 'Month 6', timelineDesc: 'No PCOS risk or relapse' },
    ],
  },

  productWhyPoints: {
    'Zencal D3K2': [
      'Boosts metabolism and supports fat breakdown.',
      'Helps D3 work better and keeps calcium in bones, not in fat cells.',
      'Helps reduce fatigue and balance mood, making it easier to stay active and eat right',
    ],
    'Her Menses': [
      'Helps fix irregular or missed periods.',
      'Soothes pain, irritability, and emotional ups and downs.',
      'Useful in PCOS, delayed or painful periods.',
    ],
    'EstroEssentia': [
      'Helps the body get rid of hormone buildup.',
      'Reduces symptoms like bloating, breast tenderness, and irritability.',
      'Helps regulate cycles and reduce heavy or painful periods.',
    ],
    'HormoniHerb Tea': [
      'Relax muscles and reduce cramping.',
      'Reduce inflammation and ease pain.',
      'Reduce bloating and water retention.',
      'Support hormonal balance and menstrual flow.',
      'Boost iron and energy during periods.',
    ],
    'Aloezy Wash': [
      'Soothe and calm the skin.',
      'Give a fresh, cooling feel.',
      'Maintains healthy pH balance.',
      'Protects against germs.',
      'Gentle and safe for daily use.',
    ],
    'Thyrostatin 3X': [
      'Helps if you have a slow (underactive) thyroid, which can cause weight gain',
      'Supports fat burning and energy use.',
      'Helps fight tiredness that makes you less active.',
    ],
  },
  lifestyleTips: {
    GENERAL: [
      'Eat a balanced diet',
      'Limit sugar and refined carbs',
      'Include healthy fats (Flaxseeds, fatty fish)',
      'Engage in regular exercise',
      'Prioritize quality sleep',
      'Stress Management',
      'Follow fixed meal timings with low-GI grains',
      'Limit dairy, sugar, and refined foods',
      'Include flaxseeds, leafy greens, and soaked nuts',
      'Manage stress with yoga, deep breathing',
    ],
    'thyroid disorder': [
      'Use iodized salt and eat whole grains, eggs, and dairy',
      'Avoid excess soy, processed foods, and erratic meals',
      'Maintain regular meal times every 3–4 hours',
      'Sleep and wake at fixed times to support hormonal rhythm',
    ],
    'diabetes': [
      'Eat small, frequent meals with whole grains and vegetables.',
      'Avoid sweets, fruit juices, white rice, and refined flour.',
      'Walk 10–15 minutes after meals.',
      'Monitor blood sugar if advised.',
    ],
    'irregular periods': [
      'Eat balanced meals; avoid fasting or skipping.',
      'Reduce sugar and packaged foods',
      'Maintain regular sleep and daily movement',
      'Add seeds and healthy fats like ghee or nuts',
    ],
  },

  /**
   * ALL LOGIC & RULES
   */
  getRiskType: (healthScore) => {
    if (healthScore <= 30) return "Critical Risk";
    if (healthScore > 30 && healthScore <= 60) return "High Risk";
    if (healthScore > 60 && healthScore <= 84) return "Moderate Risk";
    return "Low Risk";
  },
  calculateScore: (allAnswers, userInfo, config) => {
    let totalScore = 0;
    for (const groupKey in allAnswers) {
      allAnswers[groupKey].forEach((answer) => {
        totalScore += answer.score || 0;
      });
    }
    // Wellness quiz doesn't use BMI, so no extra deductions.
    return Math.max(0, 100 - totalScore);
  },

  productRules: (score, allAnswers, productDatabase, userInfo, config) => {
    const answers = allAnswers;
    const hasAnswer = (group, text) => {
      return (
        answers[group]?.some(
          (a) => typeof a.text === 'string' && a.text.toLowerCase().includes(text.toLowerCase())
        ) || false
      );
    };
    const hasMultiAnswer = (group, text) => {
      return (
        answers[group]?.some(
          (a) =>
            Array.isArray(a.text) &&
            a.text.some((t) => typeof t === 'string' && t.toLowerCase().includes(text.toLowerCase()))
        ) || false
      );
    };

    let baseProductKeys = [];
    if (score < 25) {
      baseProductKeys = ['HER_MENSES', 'ESTROGEN_BALANCE', 'D3K2'];
    } else if (score >= 25 && score <= 60) {
      baseProductKeys = ['HER_MENSES', 'ESTROGEN_BALANCE', 'D3K2'];
    } else if (score >= 61 && score <= 80) {
      baseProductKeys = ['HER_MENSES', 'ESTROGEN_BALANCE', 'D3K2'];
    } else {
      baseProductKeys = ['D3K2'];
    }

    let extraProductKeys = [];
    const hasPMS =
      hasMultiAnswer('health', 'Bloating') ||
      hasMultiAnswer('health', 'Acne') ||
      hasMultiAnswer('health', 'Headache');

    const hygieneQ2Answer = (allAnswers['hygiene'] && allAnswers['hygiene'][1]) ? allAnswers['hygiene'][1].text.toLowerCase() : '';
    const hasBadOdor =
      hygieneQ2Answer.includes('occasionally') ||
      hygieneQ2Answer.includes('frequently') ||
      hygieneQ2Answer.includes('always');

    const hasComorbidities =
      hasMultiAnswer('lifestyle', 'Diabetes') ||
      hasMultiAnswer('lifestyle', 'Thyroid disorder') ||
      hasMultiAnswer('lifestyle', 'Depression/Anxiety') ||
      hasMultiAnswer('lifestyle', 'Endometriosis / Fibroids');

    if (hasPMS) extraProductKeys.push('HORMONIHERB_TEA');
    if (hasBadOdor) extraProductKeys.push('INTIMATE_WASH');
    if (hasComorbidities) extraProductKeys.push('THYROIDINUM');

    const allKeys = [...new Set([...baseProductKeys, ...extraProductKeys])];
    return allKeys.map((key) => productDatabase[key]).filter(Boolean);
  },

  resultRules: (score, allAnswers, config, userInfo) => {
    const getScoreBracket = (s) => {
      if (s < 25) return '<25';
      if (s <= 60) return '25-60';
      if (s <= 80) return '61-80';
      return '81+';
    };
    const getAnswerText = (groupKey, questionIndex) => {
      const answer = (allAnswers[groupKey] || [])[questionIndex];
      if (!answer) return '';
      return Array.isArray(answer.text) ? answer.text.join(',') : answer.text;
    };
    const getAnswerArray = (groupKey, questionIndex) => {
      const answer = (allAnswers[groupKey] || [])[questionIndex];
      if (!answer) return [];
      return Array.isArray(answer.text) ? answer.text : [answer.text];
    };

    const bracket = getScoreBracket(score);
    let baseIssue = '';
    let baseIssueHi = '';
    if (score < 25) { baseIssue = 'Critical Hormonal Disturbance'; baseIssueHi = 'गंभीर हार्मोनल गड़बड़ी'; }
    else if (score <= 60) { baseIssue = 'High Hormonal Disturbance'; baseIssueHi = 'उच्च हार्मोनल गड़बड़ी'; }
    else if (score <= 80) { baseIssue = 'Mild Hormonal Disturbance'; baseIssueHi = 'हल्की हार्मोनल गड़बड़ी'; }
    else { baseIssue = 'Good Hormonal Health'; baseIssueHi = 'अच्छा हार्मोनल स्वास्थ्य'; }

    // Get answers from Lifestyle, Q5 ('Do you have any of the mentioned health problems?')
    let lifestyleConditions = getAnswerArray('lifestyle', 4);
    // Get answers from Hygiene, Q2 ('Do you experience any bad odor...')
    const hygieneAnswer = getAnswerText('hygiene', 1);

    let extraIssues = [];
    let extraIssuesHi = [];
    if (lifestyleConditions.includes('Diabetes')) { extraIssues.push('Metabolic Dysfunction'); extraIssuesHi.push('मेटाबॉलिक दुष्क्रिया'); }
    if (lifestyleConditions.includes('Thyroid disorder')) { extraIssues.push('Thyroid Dysfunction'); extraIssuesHi.push('थायरॉइड दुष्क्रिया'); }
    if (lifestyleConditions.includes('Depression/Anxiety')) { extraIssues.push('PMS-linked Mood Disorder'); extraIssuesHi.push('PMS-संबंधित मनोदशा विकार'); }
    if (lifestyleConditions.includes('Endometriosis / Fibroids')) { extraIssues.push('Fibroids / Endometriosis'); extraIssuesHi.push('फाइब्रॉइड / एंडोमेट्रियोसिस'); }
    if (
      hygieneAnswer.includes('Occasionally') ||
      hygieneAnswer.includes('Frequently') ||
      hygieneAnswer.includes('Always')
    ) {
      extraIssues.push('Vaginal pH Imbalance');
      extraIssuesHi.push('योनि pH असंतुलन');
    }

    let issueTitle = baseIssue;
    let issueTitleHi = baseIssueHi;
    if (extraIssues.length > 0) {
      issueTitle += ', ' + extraIssues.join(', ');
      issueTitleHi += ', ' + extraIssuesHi.join(', ');
    }

    let baseText = '';
    let baseTextHi = '';
    if (score < 25) {
      baseText = 'Severe hormonal imbalance with disrupted menstrual health';
      baseTextHi = 'बाधित मासिक स्वास्थ्य के साथ गंभीर हार्मोनल असंतुलन';
    } else if (score <= 60) {
      baseText = 'Moderate Hormonal imbalance (if untreated, may disrupt fertility)';
      baseTextHi = 'मध्यम हार्मोनल असंतुलन (यदि उपचार न किया जाए, तो प्रजनन क्षमता बाधित हो सकती है)';
    } else if (score <= 80) {
      baseText = 'Slight hormonal irregularities triggered by lifestyle, stress or nutritional deficiency';
      baseTextHi = 'जीवनशैली, तनाव या पोषण की कमी से उत्पन्न हल्की हार्मोनल अनियमितताएं';
    } else {
      baseText = 'No major hormonal or PMS issue detected. Continue maintaining hormonal and menstrual wellness.';
      baseTextHi = 'कोई बड़ी हार्मोनल या PMS समस्या नहीं पाई गई। हार्मोनल और मासिक कल्याण बनाए रखना जारी रखें।';
    }

    let conditionTextHTML = `<p>${baseText}</p>`;
    let conditionTextHTMLHi = `<p>${baseTextHi}</p>`;

    let futureRisks = [];
    let possibleCauses = [];
    const seenRisks = new Set();

    for (const groupKey in allAnswers) {
      allAnswers[groupKey].forEach((answer) => {
        const qRisks = config.futureRisksMapping[answer.question];
        const qCauses = config.causeMapping[answer.question];
        const texts = Array.isArray(answer.text) ? answer.text : [answer.text];

        texts.forEach((text) => {
          if (qRisks && qRisks[text]) {
            const risk = qRisks[text];
            const key = risk.en || risk;
            if (!seenRisks.has(key)) { seenRisks.add(key); futureRisks.push(risk); }
          }
          if (qCauses && qCauses[text]) {
            const cause = qCauses[text];
            if (cause && !possibleCauses.includes(cause)) {
              possibleCauses.push(cause);
            }
          }
        });
      });
    }

    const general = config.femaleGeneralTimeline[bracket] || [];
    const extras = [];

    // --- Logic for conditional timelines ---
    const symptomTexts = (allAnswers['health']?.[4]?.text || []).map(s =>
      String(s).toLowerCase()
    );
    const hormonalAnswersText = (allAnswers['hormonal'] || []).map(a =>
      String(a.text).toLowerCase()
    );
    const hygieneAnswersText = (allAnswers['hygiene'] || []).map(a =>
      String(a.text).toLowerCase()
    );
    const healthAnswerText_Q2 = getAnswerText('health', 1).toLowerCase(); // Cramps question

    const hasHormonal =
      symptomTexts.some(s =>
        ['acne', 'mood swings', 'facial hair', 'weight changes'].includes(s)
      ) ||
      hormonalAnswersText.some(ans =>
        ['occasionally', 'frequently', 'always'].includes(ans)
      );

    const hasEstrogenDominance = hormonalAnswersText.some(ans =>
      ['yes, but it’s under control', 'yes, and i’m managing it', 'yes and it’s uncontrolled'].includes(ans)
    );

    const hasPMS =
      ['mild discomfort, manageable without medication',
        'moderate pain, occasionally need medication',
        'severe pain, regularly need medication'].some(opt =>
          healthAnswerText_Q2.includes(opt)
        ) ||
      ['bloating', 'headache'].some(sym =>
        symptomTexts.includes(sym)
      );

    const hasVaginal = hygieneAnswersText.some(ans =>
      ['frequently', 'always', 'occasionally'].some(opt => ans.includes(opt))
    );

    if (hasHormonal) {
      extras.push({
        sectionTitle: 'Hormonal Health',
        timeline: config.hormonalTimelineByScore[bracket] || [],
      });
    }
    if (hasPMS) {
      extras.push({
        sectionTitle: 'PMS & Cramps',
        timeline: config.pmsTimelineByScore[bracket] || [],
      });
    }
    if (hasVaginal) {
      extras.push({
        sectionTitle: 'Vaginal Health',
        timeline: config.vaginalHealthTimelineByScore[bracket] || [],
      });
    }
    if (hasEstrogenDominance) {
      extras.push({
        sectionTitle: 'Estrogen / PCOS',
        timeline: config.estrogenPCOSTimelineByScore[bracket] || [],
      });
    }

    lifestyleConditions = getAnswerArray('lifestyle', 4).map(c => c.toLowerCase().trim());
    const cycleAnswer = getAnswerText('health', 0).toLowerCase(); // Menstrual cycle Q (index 0)

    let allConditions = [...lifestyleConditions];

    if (cycleAnswer.includes('irregular') || cycleAnswer.includes('unpredictable')) {
      allConditions.push('irregular periods');
    }

    const conditionTipKeys = {
      'thyroid disorder': 'thyroid disorder',
      'diabetes': 'diabetes',
      'irregular periods': 'irregular periods',
    };

    const finalLifestyleKeys = allConditions
      .map(c => conditionTipKeys[c])
      .filter(Boolean);

    // Add the Hindi month label to the displayed (general) timeline.
    const generalLocalized = general.map(item => ({
      ...item,
      hi: _monthHi[item.month] || item.month,
    }));

    return {
      issueTitle,
      issueTitleHi,
      conditionTextHTML,
      conditionTextHTMLHi,
      futureRisks,
      possibleCauses,
      timelineData: { general: generalLocalized, extras },
      lifestyleConditions: [...new Set(finalLifestyleKeys)], // Pass the mapped keys
    };
  },

  async saveSubmission(state, db, config) {
    const userInfo = state.userInfo;
    const computedHealthScore = state.healthScore || 0;
    const results = state.results;
    const allAnswers = state.allAnswers;
    const activeProducts = state.recommendedProducts.filter(p => p.active);

    // 1. Prepare answers array for Firestore
    const answers = [];
    for (const groupKey in allAnswers) {
      allAnswers[groupKey].forEach((answer) => {
        answers.push({
          question: answer.question,
          answer: Array.isArray(answer.text) ? answer.text.join(', ') : answer.text,
          score: answer.score,
        });
      });
    }

    // 2. Prepare lifestyle changes (tips)
    const lifestyleTipsArray = (results.lifestyleConditions || []).flatMap((condition) => {
      const tips = config.lifestyleTips[condition] || [];
      return tips.map((text) => ({ text }));
    });

    if (config.lifestyleTips['general']) {
      config.lifestyleTips['general'].forEach((tip) => {
        lifestyleTipsArray.push({ text: tip });
      });
    }

    // 3. Prepare timelines (Merged by Month)
    const timelineMap = {
      'Month 1': [],
      'Month 2': [],
      'Month 3': [],
    };

    const addEntries = (list) => {
      (list || []).forEach((item) => {
        if (timelineMap[item.month]) {
          timelineMap[item.month].push(item.timelineDesc);
        }
      });
    };

    addEntries(results.timelineData?.general);
    (results.timelineData?.extras || []).forEach((extra) => addEntries(extra.timeline));

    const combinedTimeline = Object.entries(timelineMap)
      .map(([month, descriptions]) => ({
        month,
        timelineDesc: [...new Set(descriptions)].join(', '),
      }))
      .filter((item) => item.timelineDesc);

    // 4. Prepare Recommended Products
    const finalRecommendedProducts = activeProducts.map((p) => {
      return {
        name: p.name,
        nameHi: p.nameHi || '',
        salePrice: p.salePrice,
        image: p.image,
        whyPoints: (p.whyPoints || []).map((text) => ({
          text
        })),
      };
    });

    const possibleCauses = (results.possibleCauses || []).map((cause) => ({
      text: cause
    }));

    // futureRisks may be { en, hi } objects or plain strings — normalise both.
    const futureRisks = (results.futureRisks || []).map((r) => {
      if (r && typeof r === 'object') {
        return { text: r.en || r.text || '', textHi: r.hi || '' };
      }
      return { text: r, textHi: '' };
    });

    // 5. Build final data object
    const initialRiskType = config.getRiskType(computedHealthScore);
    const data = {
      reportDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
      userName: userInfo.name,
      dob: userInfo.dob,
      phone: userInfo.phone,
      healthScore: computedHealthScore,
      riskType: initialRiskType,
      issueTitle: results.issueTitle,
      issueTitleHi: results.issueTitleHi || '',
      concern: "Women's Wellness",
      reportCategory: "Womens Wellness",
      lifestyleConditions: results.lifestyleConditions || [],
      possibleCauses: possibleCauses,
      lifestyleChanges: lifestyleTipsArray,
      timeline: combinedTimeline,
      answers: answers,
      questionnaireId: config.id,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      isWhatsAppSent: false,
      futureRisks: futureRisks,
      recommendedProducts: finalRecommendedProducts,
    };

    try {
      const docRef = await db.collection('questionnaire_submissions').add(data);
      // console.log('Submission successful');
      return docRef.id;
    } catch (e) {
      console.error('Error saving to Firebase:', e);
      throw e;
    }
  },
};
