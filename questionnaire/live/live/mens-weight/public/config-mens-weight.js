// config-mens-weight.js
// Bilingual (en / hi). Questions/options carry `hi`; futureRisksMapping values
// are { en, hi }; timeline entries carry hi/hiDesc; uiTranslations holds all
// static UI strings. causeMapping & lifestyleTips stay English (saved-only,
// not shown on the result page).

// ─── Full UI string table (en / hi) ─────────────────────────────────────────
const uiTranslations = {
  en: {
    'main-title': "Men's Weight Management Score",
    'welcome-title': "Welcome to the Men’s Weight & Metabolic Quiz!",
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
    'metrics-title': "Enter your body measurements for personalized health metrics.",
    'label-height': "Height (in cm):",
    'placeholder-height': "e.g. 165",
    'label-current-weight': "Current Weight (in kg):",
    'placeholder-current-weight': "e.g. 75",
    'label-target-weight': "Target Weight (in kg):",
    'placeholder-target-weight': "e.g. 60",
    'btn-prev': "Previous",
    'btn-next': "Next",
    'btn-back-to-quiz': "Back to Questionnaire",
    'report-title': "Assessment Report",
    'label-report-date': "Date:",
    'label-patient-name': "Name",
    'label-age': "Age",
    'label-category': "Category",
    'label-report-date-row': "Report Date",
    'report-category': "Men's Weight Management",
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
    'about-you': "About You & Metrics",
    'Health': "Health",
    'lifestyle': "Lifestyle",
    'medical': "Medical",
    'Weight Loss': "Weight Loss",
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
    'main-title': "पुरुष वज़न प्रबंधन स्कोर",
    'welcome-title': "पुरुष वज़न और मेटाबॉलिक प्रश्नोत्तरी में आपका स्वागत है!",
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
    'metrics-title': "व्यक्तिगत स्वास्थ्य मेट्रिक्स के लिए अपने शरीर के माप दर्ज करें।",
    'label-height': "ऊंचाई (सेमी में):",
    'placeholder-height': "जैसे 165",
    'label-current-weight': "वर्तमान वज़न (किग्रा में):",
    'placeholder-current-weight': "जैसे 75",
    'label-target-weight': "लक्ष्य वज़न (किग्रा में):",
    'placeholder-target-weight': "जैसे 60",
    'btn-prev': "पिछला",
    'btn-next': "अगला",
    'btn-back-to-quiz': "प्रश्नावली पर वापस जाएँ",
    'report-title': "आकलन रिपोर्ट",
    'label-report-date': "दिनांक:",
    'label-patient-name': "नाम",
    'label-age': "आयु",
    'label-category': "श्रेणी",
    'label-report-date-row': "रिपोर्ट दिनांक",
    'report-category': "पुरुष वज़न प्रबंधन",
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
    'about-you': "आपके बारे में और मेट्रिक्स",
    'Health': "स्वास्थ्य",
    'lifestyle': "जीवनशैली",
    'medical': "चिकित्सा",
    'Weight Loss': "वज़न घटाना",
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
  id: 'mens-weight',
  staticSteps: 2,
  uiTranslations: uiTranslations,
  questionGroups: [{
    step: 3,
    key: 'Health',
    questions: [{
      question: "Tick that applies for you (For long-term weight control)",
      hi: "जो आप पर लागू होता है उसे चुनें (दीर्घकालिक वज़न नियंत्रण के लिए)",
      options: [{
        text: "I definitely will not be able to devote 30 minutes daily to weight control.",
        hi: "मैं निश्चित रूप से वज़न नियंत्रण के लिए रोज़ 30 मिनट नहीं दे पाऊंगा।",
        score: 0
      }, {
        text: "I'm not sure if I can find 30 minutes daily for weight control.",
        hi: "मुझे यकीन नहीं है कि मैं वज़न नियंत्रण के लिए रोज़ 30 मिनट निकाल पाऊंगा।",
        score: 0
      }, {
        text: "I think I can probably find 30 minutes daily for weight control",
        hi: "मुझे लगता है कि मैं शायद वज़न नियंत्रण के लिए रोज़ 30 मिनट निकाल सकता हूं",
        score: 0
      }, {
        text: "I can definitely find 30 minutes daily for weight control",
        hi: "मैं निश्चित रूप से वज़न नियंत्रण के लिए रोज़ 30 मिनट निकाल सकता हूं",
        score: 0
      }, {
        text: "I can devote more than 30 minutes daily to weight control",
        hi: "मैं वज़न नियंत्रण के लिए रोज़ 30 मिनट से अधिक दे सकता हूं",
        score: 0
      },],
    }, {
      question: "What is your primary weight loss goal?",
      hi: "आपका मुख्य वज़न घटाने का लक्ष्य क्या है?",
      options: [{
        text: "Lose 1-5 kg", hi: "1-5 किग्रा घटाना",
        score: 0
      }, {
        text: "Lose 5-10 kg", hi: "5-10 किग्रा घटाना",
        score: 0
      }, {
        text: "Lose more than 10 kg", hi: "10 किग्रा से अधिक घटाना",
        score: 0
      },],
    }, {
      question: "Why do you want to lose weight?",
      hi: "आप वज़न क्यों घटाना चाहते हैं?",
      options: [{
        text: "health reasons", hi: "स्वास्थ्य कारणों से",
        score: 0
      }, {
        text: "improved looks", hi: "बेहतर दिखने के लिए",
        score: 0
      }, {
        text: "more energy", hi: "अधिक ऊर्जा के लिए",
        score: 0
      }, {
        text: "doctor advice", hi: "डॉक्टर की सलाह पर",
        score: 0
      }, {
        text: "others, please specify", hi: "अन्य, कृपया बताएं",
        score: 0
      },],
    },],
  }, {
    step: 4,
    key: 'lifestyle',
    questions: [{
      question: "How active are you daily?",
      hi: "आप रोज़ाना कितने सक्रिय रहते हैं?",
      options: [{
        text: "Sedentary (little or no exercise)",
        hi: "गतिहीन (बहुत कम या कोई व्यायाम नहीं)",
        score: 20
      }, {
        text: "Lightly active (1-3 days/week exercise)",
        hi: "हल्के सक्रिय (सप्ताह में 1-3 दिन व्यायाम)",
        score: 15
      }, {
        text: "Moderately active (4-5 days/week exercise)",
        hi: "मध्यम सक्रिय (सप्ताह में 4-5 दिन व्यायाम)",
        score: 10
      }, {
        text: "Very active (daily exercise or physical job)",
        hi: "बहुत सक्रिय (रोज़ व्यायाम या शारीरिक काम)",
        score: 5
      },],
    }, {
      question: "During the past 6 months my weight has increased by.",
      hi: "पिछले 6 महीनों में मेरा वज़न इतना बढ़ा है।",
      options: [{
        text: "1-3Kg", hi: "1-3 किग्रा",
        score: 1
      }, {
        text: "3-6Kg", hi: "3-6 किग्रा",
        score: 3
      }, {
        text: "6-10Kg", hi: "6-10 किग्रा",
        score: 5
      }, {
        text: "More than 10kg", hi: "10 किग्रा से अधिक",
        score: 10
      },],
    }, {
      question: "Which body type do you identify with?",
      hi: "आप किस शारीरिक प्रकार से जुड़ाव महसूस करते हैं?",
      options: [{
        text: "Normal weight", hi: "सामान्य वज़न",
        score: 1
      }, {
        text: "Over weight", hi: "अधिक वज़न",
        score: 5
      }, {
        text: "Obese class 1", hi: "मोटापा श्रेणी 1",
        score: 10
      }, {
        text: "Obese class 2", hi: "मोटापा श्रेणी 2",
        score: 15
      }, {
        text: "Obese class 3", hi: "मोटापा श्रेणी 3",
        score: 20
      },],
    }, {
      question: "How many hours do you sleep daily?",
      hi: "आप रोज़ कितने घंटे सोते हैं?",
      options: [{
        text: "Less than 5 hours", hi: "5 घंटे से कम",
        score: 1
      }, {
        text: "5-6 hours", hi: "5-6 घंटे",
        score: 10
      }, {
        text: "7-8 hours", hi: "7-8 घंटे",
        score: 6
      }, {
        text: "More than 8 hours", hi: "8 घंटे से अधिक",
        score: 3
      },],
    }, {
      question: "How often do you consume processed/junk food?",
      hi: "आप कितनी बार प्रोसेस्ड/जंक फूड खाते हैं?",
      options: [{
        text: "Rarely", hi: "कभी-कभार",
        score: 1
      }, {
        text: "Occasionally (1-2 times a week)", hi: "कभी-कभी (सप्ताह में 1-2 बार)",
        score: 3
      }, {
        text: "Frequently (3-5 times a week)", hi: "अक्सर (सप्ताह में 3-5 बार)",
        score: 6
      }, {
        text: "Daily", hi: "रोज़ाना",
        score: 10
      },],
    }, {
      question: "How often do you smoke or consume alcohol?",
      hi: "आप कितनी बार धूम्रपान या शराब का सेवन करते हैं?",
      options: [{
        text: "Never", hi: "कभी नहीं",
        score: 1
      }, {
        text: "rarely", hi: "कभी-कभार",
        score: 5
      }, {
        text: "Occasionally ", hi: "कभी-कभी",
        score: 6
      }, {
        text: "Frequently ", hi: "अक्सर",
        score: 10
      },],
    },],
  }, {
    step: 5,
    key: 'medical',
    questions: [{
      question: "Do you experience any of the following? (Select all that apply)",
      hi: "क्या आप निम्नलिखित में से किसी का अनुभव करते हैं? (सभी लागू चुनें)",
      multiple: true,
      options: [{
        text: "Erectile Dysfunction", hi: "इरेक्टाइल डिसफंक्शन",
        score: 2
      }, {
        text: "Thyroid Disorder", hi: "थायरॉइड विकार",
        score: 2
      }, {
        text: "Hypertension", hi: "उच्च रक्तचाप",
        score: 2
      }, {
        text: "Diabetes ", hi: "मधुमेह",
        score: 2
      }, {
        text: "Family history of obesity or metabolic disorders",
        hi: "मोटापे या मेटाबॉलिक विकारों का पारिवारिक इतिहास",
        score: 2
      }, {
        text: "Digestive Issues (IBS, Acidity, Constipation)",
        hi: "पाचन समस्याएं (IBS, अम्लता, कब्ज)",
        score: 2
      }, {
        text: "High Cholesterol", hi: "उच्च कोलेस्ट्रॉल",
        score: 2
      }, {
        text: "None ", hi: "कोई नहीं",
        score: 0
      },],
    }, {
      question: "How often do you feel stressed?",
      hi: "आप कितनी बार तनाव महसूस करते हैं?",
      options: [{
        text: "Rarely", hi: "कभी-कभार",
        score: 1
      }, {
        text: "Sometimes ", hi: "कभी-कभी",
        score: 3
      }, {
        text: "Often ", hi: "अक्सर",
        score: 6
      }, {
        text: "Always", hi: "हमेशा",
        score: 10
      },],
    }, {
      question: "Do you experience emotional eating ?",
      hi: "क्या आप भावनात्मक भोजन का अनुभव करते हैं?",
      options: [{
        text: "Never", hi: "कभी नहीं",
        score: 1
      }, {
        text: "Rarely", hi: "कभी-कभार",
        score: 3
      }, {
        text: "Sometimes", hi: "कभी-कभी",
        score: 10
      }, {
        text: "Often", hi: "अक्सर",
        score: 20
      },],
    }, {
      question: "What do you consider some of your barriers when it comes to managing your weight? (check all that apply)?",
      hi: "वज़न प्रबंधन में आपकी कुछ बाधाएं क्या हैं? (सभी लागू चुनें)",
      multiple: true,
      options: [{
        text: "Hunger", hi: "भूख",
        score: 0
      }, {
        text: "Cravings", hi: "लालसा",
        score: 0
      }, {
        text: "Fatigue", hi: "थकान",
        score: 0
      }, {
        text: "Finances", hi: "वित्तीय स्थिति",
        score: 0
      }, {
        text: "Time", hi: "समय",
        score: 0
      }, {
        text: "Boredom", hi: "ऊब",
        score: 0
      }, {
        text: "Stress", hi: "तनाव",
        score: 0
      }, {
        text: "Insomnia", hi: "अनिद्रा",
        score: 0
      }, {
        text: "Socializing", hi: "सामाजिक मेलजोल",
        score: 0
      },],
    },],
  }, {
    step: 6,
    key: 'Weight Loss',
    questions: [{
      question: "Have you tried weight loss before?",
      hi: "क्या आपने पहले वज़न घटाने की कोशिश की है?",
      options: [{
        text: "No", hi: "नहीं",
        score: 0
      }, {
        text: "Yes, but unsuccessful", hi: "हां, लेकिन असफल रहा",
        score: 0
      }, {
        text: "Yes, but regained weight", hi: "हां, लेकिन वज़न फिर बढ़ गया",
        score: 0
      },],
    }, {
      question: "Which weight loss method have you tried? (Select all that apply)",
      hi: "आपने वज़न घटाने का कौन सा तरीका आज़माया है? (सभी लागू चुनें)",
      multiple: true,
      options: [{
        text: "Dieting", hi: "डाइटिंग",
        score: 0
      }, {
        text: "Exercise ", hi: "व्यायाम",
        score: 0
      }, {
        text: "Supplements", hi: "सप्लीमेंट्स",
        score: 0
      }, {
        text: "Ayurvedic/Homeopathic treatment", hi: "आयुर्वेदिक/होम्योपैथिक उपचार",
        score: 0
      }, {
        text: "Allopathic medication", hi: "एलोपैथिक दवा",
        score: 0
      }, {
        text: "None", hi: "कोई नहीं",
        score: 0
      },],
    }, {
      question: "Are you currently on any weight loss medication or supplement? (Select all that apply)",
      hi: "क्या आप वर्तमान में कोई वज़न घटाने की दवा या सप्लीमेंट ले रहे हैं? (सभी लागू चुनें)",
      multiple: true,
      options: [{
        text: "No", hi: "नहीं",
        score: 0
      }, {
        text: "Yes, allopathic", hi: "हां, एलोपैथिक",
        score: 0
      }, {
        text: "Yes, ayurvedic", hi: "हां, आयुर्वेदिक",
        score: 0
      }, {
        text: "Yes, homeopathic", hi: "हां, होम्योपैथिक",
        score: 0
      },],
    },],
  },],
  productDatabase: window.productDatabase,
  causeMapping: {
    "How active are you daily?": {
      "Sedentary (little or no exercise)": "Sedentary lifestyle & lack of movement reduces calorie expenditure and leads to fat accumulation.",
      "Lightly active (1-3 days/week exercise)": "Light active exercises can help with minimal calorie burn. Not much enough to counter daily intake",
      "Moderately active (4-5 days/week exercise)": "Moderately active lifestyle is better than average, but may need more intensity or consistency to loose weight.",
      "Very active (daily exercise or physical job)": "Active lifestyle can have positive influence on metabolism and weight management",
    },
    "Which body type do you identify with?": {
      "Normal weight": "No body-type-related cause of weight issues",
      "Over weight": "Likely mild caloric surplus, metabolic resistance, sedentary habits",
      "Obese class 1": "Caloric excess, emotional eating, inactivity",
      "Obese class 2": "Metabolic syndrome, insulin resistance, hormonal imbalance",
      "Obese class 3": "Severe hormonal and lifestyle dysfunctions, genetic predisposition",
    },
    "How often do you consume processed/junk food?": {
      "Rarely": "No major dietary cause; likely hormonal or emotional contributors",
      "Occasionally (1-2 times a week)": "Moderate indulgence, processed food cravings",
      "Frequently (3-5 times a week)": "High refined carbs/fats, sugar addiction, gut imbalance",
      "Daily": "Daily consumption disrupts metabolism and promotes fat storage",
    },
    "Do you experience any of the following? (Select all that apply)": {
      "Erectile dysfunction": "Hormonal imbalance, poor circulation, metabolic syndrome",
      "thyroid disorder": "Hypothyroidism slows metabolism, fatigue, weight gain",
      "Hypertension": "Common with obesity, poor vascular elasticity, stress",
      "Diabetes": "Insulin resistance, excessive sugar intake, inflammation",
      "Family history of obesity or metabolic disorders": "Genetic predisposition to weight gain and insulin issues",
      "Digestive issues (IBS, Acidity, Constipation)": "Poor digestion, bloating, disrupted gut flora",
      "high cholesterol": "Poor fat metabolism, processed food intake, inactivity",
      "None": "Indicates lifestyle or emotional causes",
    },
    "How often do you feel stressed?": {
      "Rarely": "Healthy emotional regulation",
      "Sometimes": "Intermittent stress may affect food choices and sleep quality",
      "Often": "Chronic stress triggers cortisol, which increases fat accumulation, especially in the abdomen",
      "Always ": "Chronic stress triggers cortisol, which increases fat accumulation, especially in the abdomen",
    },
    "Do you experience emotional eating ?": {
      "Never": "Emotional stability; eating not driven by feelings",
      "Rarely": "Occasional stress-induced cravings",
      "Sometimes": "Emotional triggers lead to inconsistent eating patterns",
      "Often": "Major emotional dysregulation, cortisol elevation, sugar addiction",
    },
  },
  // futureRisksMapping values are { en, hi } so the result page can localise.
  futureRisksMapping: {
    "How active are you daily?": {
      "Sedentary (little or no exercise)": { en: "Increased risk of obesity, diabetes, cardiovascular diseases", hi: "मोटापा, मधुमेह और हृदय रोगों का बढ़ा हुआ खतरा" },
      "Lightly active (1-3 days/week exercise)": { en: "Risk of gradual weight gain and lowered metabolism", hi: "धीरे-धीरे वज़न बढ़ने और मेटाबॉलिज्म धीमा होने का खतरा" },
      "Moderately active (4-5 days/week exercise)": { en: "Moderate risk if diet isn’t managed well", hi: "यदि आहार ठीक से प्रबंधित न हो तो मध्यम खतरा" },
      "Very active (daily exercise or physical job)": { en: "Low risk; helps in maintaining ideal weight", hi: "कम खतरा; आदर्श वज़न बनाए रखने में मदद करता है" },
    },
    "Which body type do you identify with?": {
      "Normal weight": { en: "No future risk from body type alone", hi: "केवल शरीर के प्रकार से कोई भविष्य का खतरा नहीं" },
      "Over weight": { en: "Progression to obesity, increased risk of hypertension and diabetes", hi: "मोटापे की ओर बढ़ना, उच्च रक्तचाप और मधुमेह का बढ़ा खतरा" },
      "Obese class 1": { en: "Cardiovascular issues, sleep apnea, joint stress, metabolic syndrome", hi: "हृदय संबंधी समस्याएं, स्लीप एपनिया, जोड़ों पर दबाव, मेटाबॉलिक सिंड्रोम" },
      "Obese class 2": { en: "High risk of diabetes, PCOS, fatty liver, infertility", hi: "मधुमेह, PCOS, फैटी लीवर और बांझपन का उच्च खतरा" },
      "Obese class 3": { en: "Critical risk of heart disease, stroke, osteoarthritis, mobility limitations", hi: "हृदय रोग, स्ट्रोक, ऑस्टियोआर्थराइटिस और चलने-फिरने में सीमाओं का गंभीर खतरा" },
    },
    "How often do you consume processed/junk food?": {
      "Rarely": { en: "Low risk from this behavior; continue maintaining healthy food habits", hi: "इस आदत से कम खतरा; स्वस्थ खानपान जारी रखें" },
      "Occasionally (1-2 times a week)": { en: "If not balanced with activity, can contribute to slow weight gain over time", hi: "यदि गतिविधि से संतुलित न हो, तो समय के साथ धीरे-धीरे वज़न बढ़ सकता है" },
      "Frequently (3-5 times a week)": { en: "Leads to fat accumulation, insulin resistance, and digestive issues", hi: "वसा संचय, इंसुलिन प्रतिरोध और पाचन समस्याओं का कारण बनता है" },
      "Daily": { en: "High risk of obesity, metabolic syndrome, fatty liver, and hormonal imbalance", hi: "मोटापा, मेटाबॉलिक सिंड्रोम, फैटी लीवर और हार्मोनल असंतुलन का उच्च खतरा" },
    },
    "Do you experience any of the following? (Select all that apply)": {
      "Erectile dysfunction": { en: "Indicates systemic dysfunction, affects quality of life, emotional health", hi: "प्रणालीगत दुष्क्रिया का संकेत, जीवन की गुणवत्ता और भावनात्मक स्वास्थ्य को प्रभावित करता है" },
      "thyroid disorder": { en: "Chronic fatigue, infertility, severe weight gain, depression", hi: "दीर्घकालिक थकान, बांझपन, अत्यधिक वज़न वृद्धि, अवसाद" },
      "Hypertension": { en: "Heart disease, kidney failure, stroke", hi: "हृदय रोग, गुर्दे की विफलता, स्ट्रोक" },
      "Diabetes": { en: "Neuropathy, kidney damage, vision loss, obesity complications", hi: "न्यूरोपैथी, गुर्दे की क्षति, दृष्टि हानि, मोटापे की जटिलताएं" },
      "Family history of obesity or metabolic disorders": { en: "Earlier onset of lifestyle diseases, weight gain despite effort", hi: "जीवनशैली रोगों की जल्दी शुरुआत, प्रयास के बावजूद वज़न बढ़ना" },
      "Digestive issues (IBS, Acidity, Constipation)": { en: "Nutritional deficiencies, chronic inflammation, fatigue", hi: "पोषण की कमी, दीर्घकालिक सूजन, थकान" },
      "high cholesterol": { en: "Atherosclerosis, heart attacks, non-alcoholic fatty liver", hi: "एथेरोस्क्लेरोसिस, हृदयाघात, नॉन-अल्कोहलिक फैटी लीवर" },
      "None": { en: "Risk depends on habits; early prevention is key", hi: "खतरा आदतों पर निर्भर करता है; जल्दी रोकथाम महत्वपूर्ण है" },
    },
    "How often do you feel stressed?": {
      "Rarely": { en: "Minimal risk if overall lifestyle is balanced", hi: "यदि समग्र जीवनशैली संतुलित है तो न्यूनतम खतरा" },
      "Sometimes": { en: "Can progress into chronic stress or binge-eating patterns if unmanaged", hi: "यदि अनियंत्रित रहे तो दीर्घकालिक तनाव या अधिक खाने की आदत बन सकती है" },
      "Often": { en: "Long-term stress may cause emotional eating, hormonal imbalance, and fat gain", hi: "दीर्घकालिक तनाव भावनात्मक भोजन, हार्मोनल असंतुलन और वसा वृद्धि का कारण बन सकता है" },
      "Always ": { en: "Long-term stress may cause emotional eating, hormonal imbalance, and fat gain", hi: "दीर्घकालिक तनाव भावनात्मक भोजन, हार्मोनल असंतुलन और वसा वृद्धि का कारण बन सकता है" },
    },
    "Do you experience emotional eating ?": {
      "Never": { en: "No risk from emotional eating, though other causes may exist", hi: "भावनात्मक भोजन से कोई खतरा नहीं, हालांकि अन्य कारण हो सकते हैं" },
      "Rarely": { en: "Possible future coping dependency, mild weight fluctuations", hi: "भविष्य में निर्भरता की संभावना, हल्के वज़न उतार-चढ़ाव" },
      "Sometimes": { en: "High risk of binge cycles, poor weight control, mood instability", hi: "अधिक खाने के चक्र, खराब वज़न नियंत्रण और मनोदशा अस्थिरता का उच्च खतरा" },
      "Often": { en: "Chronic weight gain, eating disorders, anxiety, metabolic diseases", hi: "दीर्घकालिक वज़न वृद्धि, खाने के विकार, चिंता, मेटाबॉलिक रोग" },
    },
  },
  healthTimelineData: {
    "<25": {
      "erectile dysfunction": [{
        month: "Month 1", hi: "महीना 1",
        timelineDesc: "May feel lighter, mild boost in stamina",
        hiDesc: "हल्कापन महसूस हो सकता है, स्टैमिना में हल्की वृद्धि"
      }, {
        month: "Month 3", hi: "महीना 3",
        timelineDesc: "Better sleep, reduced anxiety around intimacy",
        hiDesc: "बेहतर नींद, नज़दीकी को लेकर कम चिंता"
      }, {
        month: "Month 6", hi: "महीना 6",
        timelineDesc: "Increased stamina, better self-esteem",
        hiDesc: "बढ़ा हुआ स्टैमिना, बेहतर आत्म-सम्मान"
      }],
      "thyroid disorder": [{
        month: "Month 1", hi: "महीना 1",
        timelineDesc: "Slight increase in energy, early relief in fatigue",
        hiDesc: "ऊर्जा में हल्की वृद्धि, थकान में जल्दी राहत"
      }, {
        month: "Month 3", hi: "महीना 3",
        timelineDesc: "Confidence may improve, mood becomes more stable",
        hiDesc: "आत्मविश्वास बेहतर हो सकता है, मनोदशा अधिक स्थिर"
      }, {
        month: "Month 6", hi: "महीना 6",
        timelineDesc: "TSH may improve; better energy, mood and control",
        hiDesc: "TSH बेहतर हो सकता है; बेहतर ऊर्जा, मनोदशा और नियंत्रण"
      }],
      "hypertension": [{
        month: "Month 1",
        timelineDesc: "May feel calmer, less heaviness, better sleep"
      }, {
        month: "Month 3",
        timelineDesc: "BP may start to settle, better daily rhythm"
      }, {
        month: "Month 6",
        timelineDesc: "Noticeable BP control, better response to activity"
      }],
      "diabetes": [{
        month: "Month 1",
        timelineDesc: "Sugar cravings may ease, energy steadier"
      }, {
        month: "Month 3",
        timelineDesc: "Early improvements in glucose levels and weight"
      }, {
        month: "Month 6",
        timelineDesc: "Insulin sensitivity improves, fatigue decreases"
      }],
      "metabolic disorders": [{
        month: "Month 1",
        timelineDesc: "Reduced bloating and food sensitivity"
      }, {
        month: "Month 3",
        timelineDesc: "Digestion and fat metabolism begin to stabilize"
      }, {
        month: "Month 6",
        timelineDesc: "Weight and sugar balance feel more manageable"
      }],
      "obesity": [{
        month: "Month 1", hi: "महीना 1",
        timelineDesc: "Reduced bloating and cravings",
        hiDesc: "सूजन और लालसा में कमी"
      }, {
        month: "Month 3", hi: "महीना 3",
        timelineDesc: "Weight loss becomes visible, better control",
        hiDesc: "वज़न घटना दिखने लगता है, बेहतर नियंत्रण"
      }, {
        month: "Month 6", hi: "महीना 6",
        timelineDesc: "Significant fat loss, hormone balance, stamina boost",
        hiDesc: "उल्लेखनीय वसा हानि, हार्मोन संतुलन, स्टैमिना में वृद्धि"
      }]
    },
    "25-60": {
      "erectile dysfunction": [{
        month: "Month 1", hi: "महीना 1",
        timelineDesc: "Less dependency on stimulants, mood uplift",
        hiDesc: "उत्तेजकों पर कम निर्भरता, मनोदशा में सुधार"
      }, {
        month: "Month 3", hi: "महीना 3",
        timelineDesc: "More stamina, less anxiety around intimacy",
        hiDesc: "अधिक स्टैमिना, नज़दीकी को लेकर कम चिंता"
      }, {
        month: "Month 6", hi: "महीना 6",
        timelineDesc: "Noticeable control and performance gains",
        hiDesc: "उल्लेखनीय नियंत्रण और प्रदर्शन में सुधार"
      }],
      "thyroid disorder": [{
        month: "Month 1", hi: "महीना 1",
        timelineDesc: "Improved energy, lesser brain fog and lethargy",
        hiDesc: "बेहतर ऊर्जा, कम मानसिक धुंधलापन और सुस्ती"
      }, {
        month: "Month 3", hi: "महीना 3",
        timelineDesc: "Mood stabilizes, mild hormonal balance begins",
        hiDesc: "मनोदशा स्थिर होती है, हल्का हार्मोनल संतुलन शुरू"
      }, {
        month: "Month 6", hi: "महीना 6",
        timelineDesc: "Sexual wellness and energy improve consistently",
        hiDesc: "यौन कल्याण और ऊर्जा में निरंतर सुधार"
      }],
      "hypertension": [{
        month: "Month 1",
        timelineDesc: "Slight dip in pressure sensation or headaches"
      }, {
        month: "Month 3",
        timelineDesc: "Better stress tolerance, early BP stability"
      }, {
        month: "Month 6",
        timelineDesc: "BP patterns more stable, less effort fatigue"
      }],
      "diabetes": [{
        month: "Month 1",
        timelineDesc: "Calmer digestion, slightly more energy"
      }, {
        month: "Month 3",
        timelineDesc: "Weight and sugar readings may begin to shift"
      }, {
        month: "Month 6",
        timelineDesc: "Fewer post-meal crashes, lighter and more energetic"
      }],
      "metabolic disorders": [{
        month: "Month 1",
        timelineDesc: "Appetite and cravings begin to regulate"
      }, {
        month: "Month 3",
        timelineDesc: "Cholesterol/sugar levels show positive trends"
      }, {
        month: "Month 6",
        timelineDesc: "Digestion, weight, and inflammation improve"
      }],
      "obesity": [{
        month: "Month 1", hi: "महीना 1",
        timelineDesc: "Appetite and mood begin to stabilize",
        hiDesc: "भूख और मनोदशा स्थिर होने लगती है"
      }, {
        month: "Month 3", hi: "महीना 3",
        timelineDesc: "Visible changes in weight and waistline",
        hiDesc: "वज़न और कमर में दिखने योग्य बदलाव"
      }, {
        month: "Month 6", hi: "महीना 6",
        timelineDesc: "Fat loss more sustainable, better energy and control",
        hiDesc: "वसा हानि अधिक टिकाऊ, बेहतर ऊर्जा और नियंत्रण"
      }]
    },
    "61-80": {
      "erectile dysfunction": [{
        month: "Month 1", hi: "महीना 1",
        timelineDesc: "More energetic mornings, better focus",
        hiDesc: "अधिक ऊर्जावान सुबह, बेहतर एकाग्रता"
      }, {
        month: "Month 3", hi: "महीना 3",
        timelineDesc: "Better control, increased morning stamina",
        hiDesc: "बेहतर नियंत्रण, सुबह की स्टैमिना में वृद्धि"
      }, {
        month: "Month 6", hi: "महीना 6",
        timelineDesc: "Higher stamina and emotional control",
        hiDesc: "अधिक स्टैमिना और भावनात्मक नियंत्रण"
      }],
      "thyroid disorder": [{
        month: "Month 1", hi: "महीना 1",
        timelineDesc: "Slight hormonal clarity, reduced sluggishness",
        hiDesc: "हल्की हार्मोनल स्पष्टता, कम सुस्ती"
      }, {
        month: "Month 3", hi: "महीना 3",
        timelineDesc: "TSH and thyroid functions begin to show balance",
        hiDesc: "TSH और थायरॉइड कार्य संतुलन दिखाने लगते हैं"
      }, {
        month: "Month 6", hi: "महीना 6",
        timelineDesc: "Hair, skin, and emotional health may improve",
        hiDesc: "बाल, त्वचा और भावनात्मक स्वास्थ्य बेहतर हो सकता है"
      }],
      "hypertension": [{
        month: "Month 1",
        timelineDesc: "BP may remain high but energy begins improving"
      }, {
        month: "Month 3",
        timelineDesc: "BP stabilizes slowly, less dizziness/fatigue"
      }, {
        month: "Month 6",
        timelineDesc: "Cardiovascular endurance builds up, better flow"
      }],
      "diabetes": [{
        month: "Month 1",
        timelineDesc: "Less bloating, sugar crashes reduce"
      }, {
        month: "Month 3",
        timelineDesc: "Glucose control better with consistent lifestyle"
      }, {
        month: "Month 6",
        timelineDesc: "Long-term glucose stability and lower cravings"
      }],
      "metabolic disorders": [{
        month: "Month 1",
        timelineDesc: "Improved digestion, easier hunger control"
      }, {
        month: "Month 3",
        timelineDesc: "Weight loss trends begin showing steadily"
      }, {
        month: "Month 6",
        timelineDesc: "Metabolism better tuned; cholesterol, sugar improve"
      }],
      "obesity": [{
        month: "Month 1", hi: "महीना 1",
        timelineDesc: "Minor weight reduction, better digestion, controlled eating",
        hiDesc: "मामूली वज़न कमी, बेहतर पाचन, नियंत्रित भोजन"
      }, {
        month: "Month 3", hi: "महीना 3",
        timelineDesc: "Sustained energy and motivation to exercise may improve",
        hiDesc: "निरंतर ऊर्जा और व्यायाम की प्रेरणा बेहतर हो सकती है"
      }, {
        month: "Month 6", hi: "महीना 6",
        timelineDesc: "Non-rebound fat loss and improved metabolic confidence",
        hiDesc: "बिना दोबारा बढ़े वसा हानि और बेहतर मेटाबॉलिक आत्मविश्वास"
      }]
    },
    "81+": {
      "erectile dysfunction": [{
        month: "Month 1", hi: "महीना 1",
        timelineDesc: "Feeling in control, consistent energy",
        hiDesc: "नियंत्रण की भावना, निरंतर ऊर्जा"
      }, {
        month: "Month 3", hi: "महीना 3",
        timelineDesc: "Healthier libido and natural confidence",
        hiDesc: "स्वस्थ कामेच्छा और स्वाभाविक आत्मविश्वास"
      }, {
        month: "Month 6", hi: "महीना 6",
        timelineDesc: "Consistent energy, long-term wellness",
        hiDesc: "निरंतर ऊर्जा, दीर्घकालिक कल्याण"
      }],
      "thyroid disorder": [{
        month: "Month 1", hi: "महीना 1",
        timelineDesc: "Energy and mood stay balanced",
        hiDesc: "ऊर्जा और मनोदशा संतुलित रहती है"
      }, {
        month: "Month 3", hi: "महीना 3",
        timelineDesc: "Wellness and hormonal balance continue improving",
        hiDesc: "कल्याण और हार्मोनल संतुलन में निरंतर सुधार"
      }, {
        month: "Month 6", hi: "महीना 6",
        timelineDesc: "Hormones well-managed, better skin/hair/weight",
        hiDesc: "हार्मोन अच्छी तरह प्रबंधित, बेहतर त्वचा/बाल/वज़न"
      }],
      "hypertension": [{
        month: "Month 1",
        timelineDesc: "Stable BP patterns, better alertness"
      }, {
        month: "Month 3",
        timelineDesc: "Calmness in body, better focus and blood flow"
      }, {
        month: "Month 6",
        timelineDesc: "Long-term BP control, endurance improves"
      }],
      "diabetes": [{
        month: "Month 1",
        timelineDesc: "Reduced food swings, stable energy"
      }, {
        month: "Month 3",
        timelineDesc: "Sugar balance maintained, more flexibility"
      }, {
        month: "Month 6",
        timelineDesc: "Blood sugar levels under control, fatigue minimal"
      }],
      "metabolic disorders": [{
        month: "Month 1",
        timelineDesc: "Digestion and metabolism feel consistent"
      }, {
        month: "Month 3",
        timelineDesc: "Healthy weight and cholesterol become sustainable"
      }, {
        month: "Month 6",
        timelineDesc: "Long-term stability in sugar, lipids, and digestion"
      }],
      "obesity": [{
        month: "Month 1", hi: "महीना 1",
        timelineDesc: "Continued balance in weight and energy",
        hiDesc: "वज़न और ऊर्जा में निरंतर संतुलन"
      }, {
        month: "Month 3", hi: "महीना 3",
        timelineDesc: "Lifestyle habits tend to solidify; metabolism and mood remain stable",
        hiDesc: "जीवनशैली की आदतें मज़बूत होती हैं; मेटाबॉलिज्म और मनोदशा स्थिर रहती है"
      }, {
        month: "Month 6", hi: "महीना 6",
        timelineDesc: "Maintenance of weight goals and prevention of imbalances",
        hiDesc: "वज़न लक्ष्यों का रखरखाव और असंतुलन की रोकथाम"
      }]
    }
  },
  lifestyleTips: {
    "GENERAL": ["Never skip your first meal—delayed or skipped breakfast can lead to belly fat and insulin resistance.", "Avoid calorie drinks—replace juices, energy drinks, and even smoothies with plain or lemon water.", "Combine carbs with protein—never eat carbs alone to avoid fat storage (e.g., roti with dal or paneer).", "Start meals with fiber—have raw salads or soaked nuts before meals to prevent sugar spikes.", "Maintain a 'metabolic window'—finish dinner at least 3 hours before bedtime for better fat metabolism.", "Stand up every 45 minutes—long sitting reduces testosterone and lymphatic flow. Take micro-breaks.",],
    "erectile dysfunction": ["Avoid alcohol, smoking, and fried food.", "Include zinc-rich foods: seeds, nuts, eggs, and greens.", "Walk daily to improve circulation and stamina.", "Ensure 7–8 hours of uninterrupted sleep.",],
    "thyroid disorder": ["Use iodized salt and eat whole grains, eggs, and dairy.", "Avoid excess soy, processed foods, and erratic meal times.", "Eat at regular intervals every 3–4 hours.", "Sleep and wake at fixed times to support hormonal rhythm.",],
    "hypertension": ["Limit salt; avoid pickles, papads, and processed snacks.", "Include potassium-rich foods: banana, spinach, tomatoes.", "Restrict tea/coffee to 1–2 cups per day.", "Walk daily and practice deep breathing exercises.",],
    "diabetes": ["Eat small, frequent meals with whole grains and vegetables.", "Avoid sweets, fruit juices, white rice, and refined flour.", "Walk 10–15 minutes after meals.", "Monitor blood sugar if advised.",],
    "family history of obesity or metabolic disorders": ["Avoid long gaps between meals and late dinners.", "Focus on homemade, low-oil meals with balanced portions.", "Stay active throughout the day, not just during workouts.", "Limit sugar, refined carbs, and processed snacks.",],
    "digestive issues (ibs, acidity, constipation)": ["Eat slowly and chew food thoroughly.", "Avoid spicy, oily, and very cold or hot foods.", "Use soaked raisins, jeera/ajwain water for gut support.", "Walk after meals to ease digestion and reduce bloating.",],
  },
  getRiskType: (healthScore) => {
    if (healthScore <= 30) return "Critical Risk";
    if (healthScore > 30 && healthScore <= 60) return "High Risk";
    if (healthScore > 60 && healthScore <= 84) return "Moderate Risk";
    return "Low Risk";
  },
  calculateScore: (allAnswers, userInfo, config) => {
    let totalQuestionScore = 0;
    let maxPossibleQuestionScore = 0;
    for (const groupKey in allAnswers) {
      allAnswers[groupKey].forEach(answer => {
        const questionConfig = config.questionGroups.find(g => g.key === groupKey)?.questions.find(q => q.question === answer.question);
        if (questionConfig) {
          let maxQuestionScore = 0;
          if (questionConfig.multiple) {
            maxQuestionScore = questionConfig.options.filter(opt => opt.score > 0).reduce((sum, opt) => sum + opt.score, 0);
            if (Array.isArray(answer.text)) {
              answer.text.forEach(selectedText => {
                const selectedOption = questionConfig.options.find(opt => opt.text === selectedText);
                if (selectedOption) {
                  totalQuestionScore += selectedOption.score;
                }
              });
            }
          } else {
            maxQuestionScore = questionConfig.options.reduce((max, option) => Math.max(max, option.score), 0);
            if (typeof answer.text === 'string') {
              const selectedOption = questionConfig.options.find(opt => opt.text === answer.text);
              if (selectedOption) {
                totalQuestionScore += selectedOption.score;
              }
            }
          }
          maxPossibleQuestionScore += maxQuestionScore;
        }
      });
    }
    const BASE_SCORE_MAX_RISK = maxPossibleQuestionScore > 0 ? maxPossibleQuestionScore : 110;
    const totalRiskScore = totalQuestionScore;
    const healthScore = 100 * (1 - (totalRiskScore / BASE_SCORE_MAX_RISK));
    return Math.max(0, Math.min(100, Math.round(healthScore)));
  },
  productRules: (score, allAnswers, productDatabase, userInfo, config) => {

    const answers = allAnswers;
    const productNames = new Set();
    const bmi = userInfo?.bmi || 22;

    /* -----------------------
       Helper Functions
    ------------------------ */

    const getAnswerTexts = (groupKey, questionText) => {
      const answerObj = answers[groupKey]?.find(a =>
        a.question.toLowerCase().includes(questionText.toLowerCase())
      );
      if (!answerObj) return [];
      return Array.isArray(answerObj.text) ?
        answerObj.text :
        [answerObj.text];
    };

    const checkAnswerIncludes = (groupKey, searchText) => {
      return answers[groupKey]?.some(a =>
        Array.isArray(a.text) ?
          a.text.some(t =>
            String(t).toLowerCase().includes(searchText.toLowerCase())
          ) :
          String(a.text).toLowerCase().includes(searchText.toLowerCase())
      ) || false;
    };

    /* -----------------------
       Flags
    ------------------------ */

    const medicalConditions = getAnswerTexts(
      'medical',
      'Do you experience any of the following?'
    );

    const barrierAnswers = getAnswerTexts(
      'medical',
      'What do you consider some of your barriers'
    );

    const stressAnswer = getAnswerTexts(
      'medical',
      'How often do you feel stressed?'
    );

    const hasThyroid = medicalConditions.some(t =>
      t.toLowerCase().includes('thyroid')
    );

    const hasFatigue = barrierAnswers.some(t =>
      t.toLowerCase().includes('fatigue')
    );

    const hasStress =
      stressAnswer.includes('Often') ||
      stressAnswer.includes('Always');

    const hasLowEnergy = hasFatigue || hasStress;

    const isHighBMI = bmi >= 30;

    const isObeseLifestyle =
      checkAnswerIncludes('lifestyle', 'Obese class 2') ||
      checkAnswerIncludes('lifestyle', 'Obese class 3');

    const hasBellyFatRisk = isHighBMI || isObeseLifestyle;

    /* =======================================================
       SCORE LOGIC
    ======================================================== */

    // 🔴 SCORE < 25
    if (score < 25) {
      productNames.add('ORLISTAT');
      productNames.add('IGNITE');
      productNames.add('METABOLIC_MULTI');
      productNames.add('SLIMTOX_RELAX_TEA');
    }
    else if (score >= 25 && score <= 60) {
      productNames.add('IGNITE');
      productNames.add('GARCINIA');
      productNames.add('SLIMTOX_RELAX_TEA');
      if (hasThyroid) {
        productNames.add('THYROIDINUM');
      }
      productNames.add('METABOLIC_MULTI');
      productNames.add('ORLISTAT');
    }
    else if (score >= 61 && score <= 80) {
      productNames.add('GARCINIA');
      productNames.add('SLIMTOX_RELAX_TEA');
      productNames.add('METABOLIC_MULTI');
      if (hasBellyFatRisk || hasLowEnergy) {
        productNames.add('IGNITE');
      }
      productNames.add('ORLISTAT');
    }
    else {
      productNames.add('SLIMTOX_RELAX_TEA');
      if (hasLowEnergy) {
        productNames.add('METABOLIC_MULTI');
      }
    }

    /* =======================================================
       FILTER ACTIVE SHOPIFY PRODUCTS
    ======================================================== */

    return [...productNames]
      .map(key => {
        const product = productDatabase[key];
        if (product && product.active === true) {
          return product;
        }
        return null;
      })
      .filter(Boolean);
  },
  resultRules: (score, allAnswers, config, userInfo) => {
    const getScoreBracket = (s) => {
      if (s < 25) return '<25';
      if (s <= 60) return '25-60';
      if (s <= 80) return '61-80';
      return '81+';
    };
    const getAnswerArray = (groupKey, questionIndex) => {
      const answer = (allAnswers[groupKey] || [])[questionIndex];
      if (!answer) return [];
      return Array.isArray(answer.text) ? answer.text : [answer.text];
    };
    const bracket = getScoreBracket(score);
    const bmi = userInfo?.bmi || 22;
    const weightGoal = (userInfo?.currentWeight && userInfo?.targetWeight) ? userInfo.currentWeight - userInfo.targetWeight : 0;
    let baseIssue = '';
    let baseIssueHi = '';
    if (score < 25) { baseIssue = 'Critical Metabolic Dysfunction & Weight Risk'; baseIssueHi = 'गंभीर मेटाबॉलिक दुष्क्रिया और वज़न जोखिम'; }
    else if (score <= 60) { baseIssue = 'High Weight Management Risk (Hormonal Factors)'; baseIssueHi = 'उच्च वज़न प्रबंधन जोखिम (हार्मोनल कारक)'; }
    else if (score <= 80) { baseIssue = 'Moderate Lifestyle Risk (Diet & Activity)'; baseIssueHi = 'मध्यम जीवनशैली जोखिम (आहार और गतिविधि)'; }
    else { baseIssue = 'Good Metabolic Health'; baseIssueHi = 'अच्छा मेटाबॉलिक स्वास्थ्य'; }
    let baseText = '';
    let baseTextHi = '';
    if (score < 25) {
      baseText = `Your BMI (${bmi.toFixed(1)}) indicates **${bmi >= 30 ? 'Obesity' : 'Overweight'}**, combined with severe metabolic and hormonal issues. Urgent intervention is needed to achieve your ${weightGoal.toFixed(1)} kg goal.`;
      baseTextHi = `आपका BMI (${bmi.toFixed(1)}) **${bmi >= 30 ? 'मोटापा' : 'अधिक वज़न'}** दर्शाता है, साथ ही गंभीर मेटाबॉलिक और हार्मोनल समस्याएं हैं। आपके ${weightGoal.toFixed(1)} किग्रा लक्ष्य को पाने के लिए तत्काल हस्तक्षेप आवश्यक है।`;
    } else if (score <= 60) {
      baseText = `Your BMI (${bmi.toFixed(1)}) suggests **Overweight** status. The weight gain is likely driven by underlying hormonal issues (PCOD/Thyroid) and stress.`;
      baseTextHi = `आपका BMI (${bmi.toFixed(1)}) **अधिक वज़न** की स्थिति दर्शाता है। वज़न बढ़ना संभवतः अंतर्निहित हार्मोनल समस्याओं (PCOD/थायरॉइड) और तनाव के कारण है।`;
    } else if (score <= 80) {
      baseText = `You have moderate risk for lifestyle-related weight gain (BMI ${bmi.toFixed(1)}). Focus is needed on exercise, sleep, and managing dietary indiscretions.`;
      baseTextHi = `आपको जीवनशैली से संबंधित वज़न वृद्धि का मध्यम जोखिम है (BMI ${bmi.toFixed(1)})। व्यायाम, नींद और आहार संबंधी गड़बड़ियों के प्रबंधन पर ध्यान देने की आवश्यकता है।`;
    } else {
      baseText = `Your metabolic health is good (BMI ${bmi.toFixed(1)}). Minor weight correction can be achieved through small lifestyle improvements.`;
      baseTextHi = `आपका मेटाबॉलिक स्वास्थ्य अच्छा है (BMI ${bmi.toFixed(1)})। छोटे जीवनशैली सुधारों से मामूली वज़न सुधार प्राप्त किया जा सकता है।`;
    }
    let conditionTextHTML = `<p>${baseText}</p>`;
    let conditionTextHTMLHi = `<p>${baseTextHi}</p>`;
    let futureRisks = [];
    let possibleCauses = [];
    let lifestyleConditions = [];
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
          if (qCauses && qCauses[text]) possibleCauses.push(qCauses[text]);
        });
      });
    }
    const medicalAnswers = getAnswerArray('medical', 0);
    if (medicalAnswers.includes('Erectile Dysfunction')) lifestyleConditions.push('erectile dysfunction');
    if (medicalAnswers.includes('Thyroid Disorder')) lifestyleConditions.push('thyroid disorder');
    if (medicalAnswers.includes('Hypertension')) lifestyleConditions.push('hypertension');
    if (medicalAnswers.includes('Diabetes')) lifestyleConditions.push('diabetes');
    if (medicalAnswers.includes('Family history of obesity or metabolic disorders')) lifestyleConditions.push('family history of obesity or metabolic disorders');
    if (medicalAnswers.includes('Digestive Issues (IBS, Acidity, Constipation)')) lifestyleConditions.push('digestive issues (ibs, acidity, constipation)');
    if (medicalAnswers.includes('High Cholesterol')) lifestyleConditions.push('high cholesterol');
    const generalTimelineKey = 'obesity';
    const general = config.healthTimelineData[bracket]?.[generalTimelineKey] || [];
    const extras = [];
    if (lifestyleConditions.includes('erectile dysfunction')) {
      extras.push({
        sectionTitle: 'Erectile Dysfunction Improvement',
        timeline: config.healthTimelineData[bracket]['erectile dysfunction'] || []
      });
    }
    if (lifestyleConditions.includes('thyroid disorder')) {
      extras.push({
        sectionTitle: 'Thyroid Support & Energy',
        timeline: config.healthTimelineData[bracket]['thyroid disorder'] || []
      });
    }
    return {
      issueTitle: baseIssue,
      issueTitleHi: baseIssueHi,
      conditionTextHTML,
      conditionTextHTMLHi,
      futureRisks: futureRisks,
      possibleCauses: [...new Set(possibleCauses)],
      timelineData: {
        general,
        extras
      },
      lifestyleConditions: [...new Set(lifestyleConditions)],
    };
  },
  saveSubmission: async (state, db, config) => {
    const userInfo = state.userInfo;
    const computedHealthScore = state.healthScore;
    const results = state.results;
    const allAnswers = state.allAnswers;
    const activeProducts = state.recommendedProducts.filter(p => p.active);
    const {
      general,
      extras
    } = results.timelineData;
    const timelineMap = new Map();
    general.forEach(entry => {
      timelineMap.set(entry.month, [entry.timelineDesc]);
    });
    extras.forEach(section => {
      section.timeline.forEach(entry => {
        if (!timelineMap.has(entry.month)) {
          timelineMap.set(entry.month, []);
        }
        timelineMap.get(entry.month).push(entry.timelineDesc);
      });
    });
    const combinedTimeline = Array.from(timelineMap.entries()).map(([month, descList]) => ({
      month,
      timelineDesc: descList.join(', '),
    }));
    const possibleCauses = (results.possibleCauses || []).map((cause) => ({
      text: cause,
    }));
    const allTips = config.lifestyleTips || {};
    const conditions = results.lifestyleConditions || [];
    let tipsToSend = [...(allTips.GENERAL || [])];
    conditions.forEach((conditionKey) => {
      let key = String(conditionKey).toLowerCase();
      if (allTips[key]) {
        tipsToSend = [...tipsToSend, ...allTips[key]];
      }
    });
    const uniqueTips = [...new Set(tipsToSend)];
    const lifestyleTipsArray = uniqueTips.map((tip) => ({
      text: tip
    }));
    const answers = [];
    for (const groupKey in allAnswers) {
      allAnswers[groupKey].forEach((ans) => {
        answers.push({
          question: ans.question,
          answer: Array.isArray(ans.text) ? ans.text.join(', ') : ans.text,
          score: ans.score,
        });
      });
    }
    const finalRecommendedProducts = activeProducts.map((p) => {
      return {
        name: p.name,
        nameHi: p.nameHi || '',
        salePrice: p.salePrice,
        image: p.image,
        whyPoints: (p.whyPoints || []).map((text) => ({
          text,
        })),
      };
    });
    const initialRiskType = config.getRiskType(computedHealthScore);
    // futureRisks may be { en, hi } objects or plain strings — normalise both.
    const futureRisks = (results.futureRisks || []).map((r) => {
      if (r && typeof r === 'object') {
        return { text: r.en || r.text || '', textHi: r.hi || '' };
      }
      return { text: r, textHi: '' };
    });
    const data = {
      reportDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
      userName: userInfo.name,
      dob: userInfo.dob,
      phone: userInfo.phone,
      healthScore: computedHealthScore,
      riskType: initialRiskType,
      issueTitle: results.issueTitle,
      issueTitleHi: results.issueTitleHi || '',
      height: userInfo.height,
      weight: userInfo.currentWeight,
      targetWeight: userInfo.targetWeight,
      bmi: userInfo.bmi || 0,
      lifestyleConditions: results.lifestyleConditions || [],
      possibleCauses: possibleCauses,
      lifestyleChanges: lifestyleTipsArray,
      timeline: combinedTimeline,
      concern: 'Mens Weight Loss',
      answers: answers,
      reportCategory: "Mens Weight Loss",
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
