/**
 * config-womens-weight.js — Bilingual (en / hi).
 * Questions/options carry `hi`; futureRisksMapping values are { en, hi };
 * conditionTimelineData entries carry hi/hiDesc; uiTranslations holds all
 * static UI strings. causeMapping & lifestyleTips stay English (saved-only).
 */

// ─── Internal Helper Functions ───────────────────────────────────────────────

const _calculateAge = (dobString) => {
    if (!dobString) return 0;
    const dob = new Date(dobString);
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
};

const _calculateBmi = (height, weight) => {
    if (!height || !weight || height === 0 || weight === 0) return 0;
    const heightInMeters = parseFloat(height) / 100;
    return parseFloat(weight) / (heightInMeters * heightInMeters);
};

const _getBmiClass = (bmi) => {
    if (bmi < 18.5) return "Underweight";
    if (bmi <= 24.9) return "Normal weight";
    if (bmi <= 29.9) return "Overweight";
    if (bmi <= 34.9) return "Obese Class I";
    if (bmi <= 39.9) return "Obese Class II";
    return "Obese Class III";
};

const _bmiClassHi = {
    "Underweight": "कम वज़न",
    "Normal weight": "सामान्य वज़न",
    "Overweight": "अधिक वज़न",
    "Obese Class I": "मोटापा श्रेणी I",
    "Obese Class II": "मोटापा श्रेणी II",
    "Obese Class III": "मोटापा श्रेणी III",
};

const _monthHi = { "Month 1": "महीना 1", "Month 3": "महीना 3", "Month 6": "महीना 6" };

const _hasAnswer = (allAnswers, groupKey, answerText) => {
    const group = allAnswers[groupKey];
    if (!group) return false;
    const lowerAnswerText = answerText.toLowerCase();
    return group.some(answer => {
        if (Array.isArray(answer.text)) {
            return answer.text.some(text => String(text).toLowerCase().includes(lowerAnswerText));
        } else {
            return String(answer.text).toLowerCase().includes(lowerAnswerText);
        }
    });
};

// ─── Full UI string table (en / hi) ─────────────────────────────────────────
const uiTranslations = {
    en: {
        'main-title': "Women's Weight Management Score",
        'welcome-title': "Welcome to the Women’s Weight & Metabolic Quiz!",
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
        'report-category': "Women's Weight Management",
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
        'health': "Health",
        'lifestyle': "Lifestyle",
        'medical': "Medical",
        'weightLoss': "Weight Loss",
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
        'main-title': "महिला वज़न प्रबंधन स्कोर",
        'welcome-title': "महिला वज़न और मेटाबॉलिक प्रश्नोत्तरी में आपका स्वागत है!",
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
        'report-category': "महिला वज़न प्रबंधन",
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
        'health': "स्वास्थ्य",
        'lifestyle': "जीवनशैली",
        'medical': "चिकित्सा",
        'weightLoss': "वज़न घटाना",
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
    id: 'womens-weight',
    staticSteps: 2,
    uiTranslations: uiTranslations,
    questionGroups: [
        {
            step: 3,
            key: 'health',
            questions: [
                {
                    question: "Tick that applies for you (For long-term weight control)",
                    hi: "जो आप पर लागू होता है उसे चुनें (दीर्घकालिक वज़न नियंत्रण के लिए)",
                    options: [
                        { text: "I definitely will not be able to devote 30 minutes daily to weight control.", hi: "मैं निश्चित रूप से वज़न नियंत्रण के लिए रोज़ 30 मिनट नहीं दे पाऊंगी।", score: 0 },
                        { text: "I'm not sure if I can find 30 minutes daily for weight control.", hi: "मुझे यकीन नहीं है कि मैं वज़न नियंत्रण के लिए रोज़ 30 मिनट निकाल पाऊंगी।", score: 0 },
                        { text: "I think I can probably find 30 minutes daily for weight control", hi: "मुझे लगता है कि मैं शायद वज़न नियंत्रण के लिए रोज़ 30 मिनट निकाल सकती हूं", score: 0 },
                        { text: "I can definitely find 30 minutes daily for weight control", hi: "मैं निश्चित रूप से वज़न नियंत्रण के लिए रोज़ 30 मिनट निकाल सकती हूं", score: 0 },
                        { text: "I can devote more than 30 minutes daily to weight control", hi: "मैं वज़न नियंत्रण के लिए रोज़ 30 मिनट से अधिक दे सकती हूं", score: 0 },
                    ],
                },
                {
                    question: "What is your primary weight loss goal?",
                    hi: "आपका मुख्य वज़न घटाने का लक्ष्य क्या है?",
                    options: [
                        { text: "fat loss", hi: "वसा घटाना", score: 0 },
                        { text: "toning", hi: "टोनिंग", score: 0 },
                        { text: "increased energy", hi: "बढ़ी हुई ऊर्जा", score: 0 },
                        { text: "improved hormonal balance", hi: "बेहतर हार्मोनल संतुलन", score: 0 },
                        { text: "others, please specify", hi: "अन्य, कृपया बताएं", score: 0 },
                    ],
                },
            ]
        },
        {
            step: 4,
            key: 'lifestyle',
            questions: [
                {
                    question: "How active are you daily?",
                    hi: "आप रोज़ाना कितनी सक्रिय रहती हैं?",
                    options: [
                        { text: "Sedentary (little or no exercise)", hi: "गतिहीन (बहुत कम या कोई व्यायाम नहीं)", score: 10 },
                        { text: "Lightly active (1-3 days/week exercise)", hi: "हल्के सक्रिय (सप्ताह में 1-3 दिन व्यायाम)", score: 6 },
                        { text: "Moderately active (4-5 days/week exercise)", hi: "मध्यम सक्रिय (सप्ताह में 4-5 दिन व्यायाम)", score: 3 },
                        { text: "Very active (daily exercise or physical job)", hi: "बहुत सक्रिय (रोज़ व्यायाम या शारीरिक काम)", score: 0 },
                    ],
                },
                {
                    question: "During the past 6 months my weight has increased by.",
                    hi: "पिछले 6 महीनों में मेरा वज़न इतना बढ़ा है।",
                    options: [
                        { text: "1-3Kg", hi: "1-3 किग्रा", score: 0 },
                        { text: "3-6Kg", hi: "3-6 किग्रा", score: 3 },
                        { text: "6-10Kg", hi: "6-10 किग्रा", score: 6 },
                        { text: "More than 10kg", hi: "10 किग्रा से अधिक", score: 10 },
                    ],
                },
                {
                    question: "Which body type do you identify with?",
                    hi: "आप किस शारीरिक प्रकार से जुड़ाव महसूस करती हैं?",
                    options: [
                        { text: "Normal weight", hi: "सामान्य वज़न", score: 1 },
                        { text: "Over weight", hi: "अधिक वज़न", score: 3 },
                        { text: "Obese class 1", hi: "मोटापा श्रेणी 1", score: 6 },
                        { text: "Obese class 2", hi: "मोटापा श्रेणी 2", score: 8 },
                        { text: "Obese class 3", hi: "मोटापा श्रेणी 3", score: 15 },
                    ],
                },
                {
                    question: "How many hours do you sleep daily?",
                    hi: "आप रोज़ कितने घंटे सोती हैं?",
                    options: [
                        { text: "Less than 5 hours", hi: "5 घंटे से कम", score: 6 },
                        { text: "5-6 hours", hi: "5-6 घंटे", score: 3 },
                        { text: "7-8 hours", hi: "7-8 घंटे", score: 1 },
                        { text: "More than 8 hours", hi: "8 घंटे से अधिक", score: 10 },
                    ],
                },
                {
                    question: "How often do you consume processed/junk food?",
                    hi: "आप कितनी बार प्रोसेस्ड/जंक फूड खाती हैं?",
                    options: [
                        { text: "Rarely", hi: "कभी-कभार", score: 1 },
                        { text: "Occasionally (1-2 times a week)", hi: "कभी-कभी (सप्ताह में 1-2 बार)", score: 3 },
                        { text: "Frequently (3-5 times a week)", hi: "अक्सर (सप्ताह में 3-5 बार)", score: 6 },
                        { text: "Daily", hi: "रोज़ाना", score: 10 },
                    ],
                },
                {
                    question: "How often do you smoke or consume alcohol?",
                    hi: "आप कितनी बार धूम्रपान या शराब का सेवन करती हैं?",
                    options: [
                        { text: "Never", hi: "कभी नहीं", score: 1 },
                        { text: "rarely", hi: "कभी-कभार", score: 5 },
                        { text: "Occasionally ", hi: "कभी-कभी", score: 6 },
                        { text: "Frequently ", hi: "अक्सर", score: 10 },
                    ],
                },
            ]
        },
        {
            step: 5,
            key: 'medical',
            questions: [
                {
                    question: "Do you experience any of the following? (Select all that apply)",
                    hi: "क्या आप निम्नलिखित में से किसी का अनुभव करती हैं? (सभी लागू चुनें)",
                    multiple: true,
                    options: [
                        { text: "PCOS/PCOD", hi: "PCOS/PCOD", score: 2 },
                        { text: "Irregular periods", hi: "अनियमित मासिक धर्म", score: 2 },
                        { text: "Hypertension", hi: "उच्च रक्तचाप", score: 2 },
                        { text: "Diabetes", hi: "मधुमेह", score: 2 },
                        { text: "Family history of obesity or metabolic disorders", hi: "मोटापे या मेटाबॉलिक विकारों का पारिवारिक इतिहास", score: 2 },
                        { text: "Digestive issues (IBS, Acidity, Constipation)", hi: "पाचन समस्याएं (IBS, अम्लता, कब्ज)", score: 2 },
                        { text: "Thyroid disorder", hi: "थायरॉइड विकार", score: 2 },
                        { text: "None", hi: "कोई नहीं", score: 0 },
                    ],
                },
                {
                    question: "How often do you feel stressed?",
                    hi: "आप कितनी बार तनाव महसूस करती हैं?",
                    options: [
                        { text: "Rarely", hi: "कभी-कभार", score: 1 },
                        { text: "Sometimes", hi: "कभी-कभी", score: 3 },
                        { text: "Often", hi: "अक्सर", score: 6 },
                        { text: "Always", hi: "हमेशा", score: 10 },
                    ],
                },
                {
                    question: "Are you currently on birth control or hormone therapy?",
                    hi: "क्या आप वर्तमान में गर्भनिरोधक या हार्मोन थेरेपी ले रही हैं?",
                    options: [
                        { text: "No", hi: "नहीं", score: 1 },
                        { text: "Yes", hi: "हां", score: 5 },
                    ],
                },
                {
                    question: "Have you recently been pregnant or breastfeeding?",
                    hi: "क्या आप हाल ही में गर्भवती रही हैं या स्तनपान करा रही हैं?",
                    options: [
                        { text: "No", hi: "नहीं", score: 1 },
                        { text: "Yes", hi: "हां", score: 5 },
                    ],
                },
                {
                    question: "Do you have any history of pregnancy complications or significant weight gain during pregnancy?",
                    hi: "क्या आपका गर्भावस्था संबंधी जटिलताओं या गर्भावस्था के दौरान अधिक वज़न बढ़ने का कोई इतिहास है?",
                    options: [
                        { text: "No", hi: "नहीं", score: 5 },
                        { text: "Yes", hi: "हां", score: 1 },
                    ],
                },
                {
                    question: "Do you experience emotional eating ?",
                    hi: "क्या आप भावनात्मक भोजन का अनुभव करती हैं?",
                    options: [
                        { text: "Never", hi: "कभी नहीं", score: 1 },
                        { text: "Rarely", hi: "कभी-कभार", score: 3 },
                        { text: "Sometimes", hi: "कभी-कभी", score: 5 },
                        { text: "Often", hi: "अक्सर", score: 10 },
                    ],
                },
                {
                    question: "What do you consider some of your barriers when it comes to managing your weight? (check all that apply)?",
                    hi: "वज़न प्रबंधन में आपकी कुछ बाधाएं क्या हैं? (सभी लागू चुनें)",
                    multiple: true,
                    options: [
                        { text: "Hunger", hi: "भूख", score: 0 },
                        { text: "Cravings", hi: "लालसा", score: 0 },
                        { text: "Fatigue", hi: "थकान", score: 0 },
                        { text: "Finances", hi: "वित्तीय स्थिति", score: 0 },
                        { text: "Time", hi: "समय", score: 0 },
                        { text: "Boredom", hi: "ऊब", score: 0 },
                        { text: "Stress", hi: "तनाव", score: 0 },
                        { text: "Insomnia", hi: "अनिद्रा", score: 0 },
                        { text: "Socializing", hi: "सामाजिक मेलजोल", score: 0 },
                    ],
                },
            ]
        },
        {
            step: 6,
            key: 'weightLoss',
            questions: [
                {
                    question: "Have you tried weight loss before?",
                    hi: "क्या आपने पहले वज़न घटाने की कोशिश की है?",
                    options: [
                        { text: "No", hi: "नहीं", score: 0 },
                        { text: "Yes, but unsuccessful", hi: "हां, लेकिन असफल रही", score: 0 },
                        { text: "Yes, but regained weight", hi: "हां, लेकिन वज़न फिर बढ़ गया", score: 0 },
                    ],
                },
                {
                    question: "Which weight loss method have you tried? (Select all that apply)",
                    hi: "आपने वज़न घटाने का कौन सा तरीका आज़माया है? (सभी लागू चुनें)",
                    multiple: true,
                    options: [
                        { text: "Dieting", hi: "डाइटिंग", score: 0 },
                        { text: "Exercise", hi: "व्यायाम", score: 0 },
                        { text: "Supplements", hi: "सप्लीमेंट्स", score: 0 },
                        { text: "Ayurvedic/Homeopathic treatment", hi: "आयुर्वेदिक/होम्योपैथिक उपचार", score: 0 },
                        { text: "Allopathic medication", hi: "एलोपैथिक दवा", score: 0 },
                        { text: "None", hi: "कोई नहीं", score: 0 },
                    ],
                },
                {
                    question: "Are you currently on any weight loss medication or supplement? (Select all that apply)",
                    hi: "क्या आप वर्तमान में कोई वज़न घटाने की दवा या सप्लीमेंट ले रही हैं? (सभी लागू चुनें)",
                    multiple: true,
                    options: [
                        { text: "No", hi: "नहीं", score: 0 },
                        { text: "Yes, allopathic", hi: "हां, एलोपैथिक", score: 0 },
                        { text: "Yes, ayurvedic", hi: "हां, आयुर्वेदिक", score: 0 },
                        { text: "Yes, homeopathic", hi: "हां, होम्योपैथिक", score: 0 },
                    ],
                },
            ]
        },
    ],

    productDatabase: window.productDatabase,

    causeMapping: {
        "How active are you daily?": {
            "Sedentary (little or no exercise)": "Sedentary lifestyle & lack of movement reduces calorie expenditure and leads to fat accumulation.",
            "Lightly active (1-3 days/week exercise)": "Light active exercises can help with minimal calorie burn.",
            "Moderately active (4-5 days/week exercise)": "Moderately active lifestyle is better than average, but may need more intensity or consistency.",
            "Very active (daily exercise or physical job)": "Active lifestyle can have positive influence on metabolism.",
        },
        "How often do you consume processed/junk food?": {
            "Rarely": "Minimal intake of processed food so not a significant factor.",
            "Occasionally (1-2 times a week)": "Occasional indulgence may lead to minor calorie surpluses.",
            "Frequently (3-5 times a week)": "High intake of processed food increases calorie load.",
            "Daily": "Daily consumption disrupts metabolism and promotes fat storage.",
        },
        "Do you experience any of the following? (Select all that apply)": {
            "PCOS/PCOD": "PCOS causes hormonal imbalance that affects insulin and fat storage.",
            "Irregular periods": "Irregular periods can be a sign of underlying hormonal issues that affect weight.",
            "Hypertension": "Often associated with poor diet, stress, and visceral fat.",
            "Diabetes": "Impaired glucose metabolism causes fat accumulation.",
            "Family history of obesity or metabolic disorders": "Genetic predisposition may affect metabolism.",
            "Digestive issues (IBS, Acidity, Constipation)": "Poor digestion may impact nutrient absorption and increase bloating.",
            "Thyroid disorder": "Hormonal imbalance due to thyroid issues.",
            "None": "No known medical conditions reported.",
        },
        "Do you experience emotional eating ?": {
            "Never": "Emotional stability; eating not driven by feelings.",
            "Rarely": "Occasional stress-induced cravings.",
            "Sometimes": "Emotional triggers lead to inconsistent eating patterns.",
            "Often": "Major emotional dysregulation, cortisol elevation, sugar addiction.",
        },
        "How often do you feel stressed?": {
            "Rarely": "Healthy emotional regulation.",
            "Sometimes": "Intermittent stress may affect food choices.",
            "Often": "Chronic stress triggers cortisol, which increases fat accumulation.",
            "Always": "Chronic stress triggers cortisol, which increases fat accumulation.",
        },
        "Are you currently on birth control or hormone therapy?": {
            "No": "Hormonal weight fluctuations are less likely.",
            "Yes": "Hormonal therapies can influence fat distribution and appetite.",
        },
    },

    // futureRisksMapping values are { en, hi } so the result page can localise.
    futureRisksMapping: {
        "How active are you daily?": {
            "Sedentary (little or no exercise)": { en: "Increased risk of obesity, diabetes, cardiovascular diseases", hi: "मोटापा, मधुमेह और हृदय रोगों का बढ़ा हुआ खतरा" },
            "Lightly active (1-3 days/week exercise)": { en: "Risk of gradual weight gain and lowered metabolism", hi: "धीरे-धीरे वज़न बढ़ने और मेटाबॉलिज्म धीमा होने का खतरा" },
            "Moderately active (4-5 days/week exercise)": { en: "Moderate risk if diet isn’t managed well", hi: "यदि आहार ठीक से प्रबंधित न हो तो मध्यम खतरा" },
            "Very active (daily exercise or physical job)": { en: "Low risk helps in maintaining ideal weight", hi: "कम खतरा, आदर्श वज़न बनाए रखने में मदद करता है" },
        },
        "How often do you consume processed/junk food?": {
            "Rarely": { en: "Low risk; continue maintaining healthy food habits.", hi: "कम खतरा; स्वस्थ खानपान जारी रखें।" },
            "Occasionally (1-2 times a week)": { en: "Can contribute to slow weight gain over time.", hi: "समय के साथ धीरे-धीरे वज़न बढ़ा सकता है।" },
            "Frequently (3-5 times a week)": { en: "Leads to fat accumulation and insulin resistance.", hi: "वसा संचय और इंसुलिन प्रतिरोध का कारण बनता है।" },
            "Daily": { en: "High risk of obesity, metabolic syndrome, and fatty liver.", hi: "मोटापा, मेटाबॉलिक सिंड्रोम और फैटी लीवर का उच्च खतरा।" },
        },
        "Do you experience any of the following? (Select all that apply)": {
            "PCOS/PCOD": { en: "Increased risk of infertility and chronic weight retention.", hi: "बांझपन और दीर्घकालिक वज़न बने रहने का बढ़ा खतरा।" },
            "Irregular periods": { en: "Can lead to obesity, mood changes, and menstrual issues.", hi: "मोटापा, मनोदशा परिवर्तन और मासिक धर्म समस्याओं का कारण बन सकता है।" },
            "Hypertension": { en: "Elevated risk of heart disease and stroke.", hi: "हृदय रोग और स्ट्रोक का बढ़ा खतरा।" },
            "Diabetes": { en: "High risk of cardiovascular disease and organ complications.", hi: "हृदय रोग और अंग जटिलताओं का उच्च खतरा।" },
            "Family history of obesity or metabolic disorders": { en: "Increased lifetime risk of obesity and diabetes.", hi: "मोटापे और मधुमेह का जीवनभर बढ़ा खतरा।" },
            "Digestive issues (IBS, Acidity, Constipation)": { en: "Long-term gut inflammation and fatigue.", hi: "दीर्घकालिक आंत सूजन और थकान।" },
            "Thyroid disorder": { en: "Chronic fatigue and severe weight gain.", hi: "दीर्घकालिक थकान और अत्यधिक वज़न वृद्धि।" },
            "None": { en: "Encouraging sign; focus on lifestyle and nutrition.", hi: "उत्साहजनक संकेत; जीवनशैली और पोषण पर ध्यान दें।" },
        },
        "How often do you feel stressed?": {
            "Rarely": { en: "Minimal risk if overall lifestyle is balanced.", hi: "यदि समग्र जीवनशैली संतुलित है तो न्यूनतम खतरा।" },
            "Sometimes": { en: "Can progress into chronic stress if unmanaged.", hi: "यदि अनियंत्रित रहे तो दीर्घकालिक तनाव बन सकता है।" },
            "Often": { en: "Long-term stress may cause hormonal imbalance and fat gain.", hi: "दीर्घकालिक तनाव हार्मोनल असंतुलन और वसा वृद्धि का कारण बन सकता है।" },
            "Always": { en: "Long-term stress may cause hormonal imbalance and fat gain.", hi: "दीर्घकालिक तनाव हार्मोनल असंतुलन और वसा वृद्धि का कारण बन सकता है।" },
        },
        "Are you currently on birth control or hormone therapy?": {
            "No": { en: "Current weight patterns likely due to lifestyle or metabolism.", hi: "वर्तमान वज़न पैटर्न संभवतः जीवनशैली या मेटाबॉलिज्म के कारण।" },
            "Yes": { en: "May lead to weight gain and mood swings if not monitored.", hi: "यदि निगरानी न की जाए तो वज़न वृद्धि और मूड स्विंग्स हो सकते हैं।" },
        },
        "Do you experience emotional eating ?": {
            "Never": { en: "Low risk from emotional triggers.", hi: "भावनात्मक ट्रिगर्स से कम खतरा।" },
            "Rarely": { en: "Can evolve into a habit during high-stress periods.", hi: "उच्च तनाव की अवधि में आदत बन सकती है।" },
            "Sometimes": { en: "Can promote fat gain and digestive distress.", hi: "वसा वृद्धि और पाचन परेशानी को बढ़ावा दे सकता है।" },
            "Often": { en: "Increased risk of obesity and metabolic syndrome.", hi: "मोटापे और मेटाबॉलिक सिंड्रोम का बढ़ा खतरा।" },
        },
    },

    lifestyleTips: {
        "general": [
            "Prioritize protein in the first meal — skipping breakfast worsens insulin resistance.",
            "Avoid calorie-dense drinks — replace juices with plain or lemon water.",
            "Always pair carbs with protein or fiber to avoid blood sugar spikes.",
            "Start lunch/dinner with raw salad to reduce post-meal insulin load.",
            "Avoid eating after 8:30 PM — night eating worsens fat storage.",
            "Include 25–30 minutes of movement daily (walks, yoga).",
        ],
        "pcos/pcod": [
            "Follow fixed meal timings with low-GI grains.",
            "Limit dairy, sugar, and refined foods.",
            "Include flaxseeds and leafy greens.",
            "Manage stress with yoga.",
        ],
        "thyroid disorder": [
            "Use iodized salt and eat whole grains.",
            "Avoid excess soy and processed foods.",
            "Eat at regular intervals every 3–4 hours.",
            "Sleep and wake at fixed times.",
        ],
        "hypertension": [
            "Limit salt; avoid pickles and processed snacks.",
            "Include potassium-rich foods: banana, spinach.",
            "Restrict tea/coffee to 1–2 cups per day.",
            "Walk daily and practice deep breathing.",
        ],
        "diabetes": [
            "Eat small, frequent meals with whole grains.",
            "Avoid sweets and refined flour.",
            "Walk 10–15 minutes after meals.",
            "Monitor blood sugar if advised.",
        ],
        "family history of obesity or metabolic disorders": [
            "Avoid long gaps between meals and late dinners.",
            "Focus on homemade, low-oil meals.",
            "Stay active throughout the day.",
            "Limit sugar and refined carbs.",
        ],
        "digestive issues (ibs, acidity, constipation)": [
            "Eat slowly and chew food thoroughly.",
            "Avoid spicy, oily, and very cold or hot foods.",
            "Use jeera/ajwain water for gut support.",
            "Walk after meals to ease digestion.",
        ],
        "irregular periods": [
            "Eat balanced meals; avoid fasting.",
            "Reduce sugar and packaged foods.",
            "Maintain regular sleep.",
            "Add seeds and healthy fats like ghee.",
        ],
    },

    conditionTimelineData: {
        '<25': {
            "pcos/pcod": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Bloating, mood improve", hiDesc: "सूजन, मनोदशा में सुधार" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Cycles begin regulating", hiDesc: "मासिक चक्र नियमित होने लगता है" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "Ovulation regularises", hiDesc: "ओव्यूलेशन नियमित होता है" }
            ],
            "thyroid disorder": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Morning energy rises", hiDesc: "सुबह की ऊर्जा बढ़ती है" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Focus, fatigue improve", hiDesc: "एकाग्रता, थकान में सुधार" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "Stable energy and mood", hiDesc: "स्थिर ऊर्जा और मनोदशा" }
            ],
            "hypertension": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Heaviness reduces", hiDesc: "भारीपन कम होता है" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "BP shows improvement", hiDesc: "रक्तचाप में सुधार दिखता है" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "BP easier to manage", hiDesc: "रक्तचाप प्रबंधित करना आसान" }
            ],
            "diabetes": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Cravings reduce", hiDesc: "लालसा कम होती है" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Sugar response improves", hiDesc: "शुगर प्रतिक्रिया में सुधार" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "Sugar levels stabilise", hiDesc: "शुगर स्तर स्थिर होता है" }
            ],
            "family history of obesity or metabolic disorders": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Digestion improves", hiDesc: "पाचन में सुधार" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Belly fat begins reducing", hiDesc: "पेट की चर्बी कम होने लगती है" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "Liver health, energy improve", hiDesc: "लीवर स्वास्थ्य, ऊर्जा में सुधार" }
            ],
            "obesity": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Initial reduction in bloating, better energy, appetite and digestion.", hiDesc: "सूजन में शुरुआती कमी, बेहतर ऊर्जा, भूख और पाचन।" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Visible inch loss, better sleep, sustained stamina and improved metabolic rhythm.", hiDesc: "दिखने योग्य इंच लॉस, बेहतर नींद, निरंतर स्टैमिना और बेहतर मेटाबॉलिक लय।" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "Improved tone, weight, control over eating and energy, enhanced daily functioning.", hiDesc: "बेहतर टोन, वज़न, खानपान और ऊर्जा पर नियंत्रण, बेहतर दैनिक कार्यक्षमता।" }
            ]
        },
        '25-60': {
            "pcos/pcod": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Period discomfort reduces", hiDesc: "मासिक धर्म की असुविधा कम होती है" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Cycles get regular", hiDesc: "मासिक चक्र नियमित होता है" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "PMS and mood swings ease", hiDesc: "PMS और मूड स्विंग्स में राहत" }
            ],
            "thyroid disorder": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Sleep, bowels improve", hiDesc: "नींद, मल त्याग में सुधार" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Hair, weight improve", hiDesc: "बाल, वज़न में सुधार" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "Skin, hair healthier", hiDesc: "त्वचा, बाल अधिक स्वस्थ" }
            ],
            "hypertension": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Puffiness lessens", hiDesc: "सूजन कम होती है" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "BP starts stabilising", hiDesc: "रक्तचाप स्थिर होने लगता है" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "BP becomes manageable", hiDesc: "रक्तचाप प्रबंधनीय हो जाता है" }
            ],
            "diabetes": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Less fatigue after meals", hiDesc: "भोजन के बाद कम थकान" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Sugar control improves", hiDesc: "शुगर नियंत्रण में सुधार" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "Rare sugar dips", hiDesc: "शुगर का गिरना दुर्लभ" }
            ],
            "family history of obesity or metabolic disorders": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Cravings begin decreasing", hiDesc: "लालसा कम होने लगती है" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Digestion, bloating reduce", hiDesc: "पाचन में सुधार, सूजन कम" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "Liver and cholesterol improve", hiDesc: "लीवर और कोलेस्ट्रॉल में सुधार" }
            ],
            "obesity": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Appetite settles, reduced snacking, better digestion and sleep.", hiDesc: "भूख स्थिर होती है, कम स्नैकिंग, बेहतर पाचन और नींद।" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Fat loss becomes visible, stamina rises, sleep deepens.", hiDesc: "वसा हानि दिखने लगती है, स्टैमिना बढ़ता है, नींद गहरी होती है।" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "Noticeable inch loss, better metabolism, alertness, and physical ease.", hiDesc: "उल्लेखनीय इंच लॉस, बेहतर मेटाबॉलिज्म, सतर्कता और शारीरिक सहजता।" }
            ]
        },
        '61-80': {
            "pcos/pcod": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Acne, bloating ease", hiDesc: "मुंहासे, सूजन में राहत" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Periods more predictable", hiDesc: "मासिक धर्म अधिक अनुमानित" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "PMS manageable", hiDesc: "PMS प्रबंधनीय" },
            ],
            "thyroid disorder": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Mood improves", hiDesc: "मनोदशा में सुधार" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Hair, focus better", hiDesc: "बाल, एकाग्रता बेहतर" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "Hormonal rhythm stable", hiDesc: "हार्मोनल लय स्थिर" },
            ],
            "hypertension": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Puffiness reduces", hiDesc: "सूजन कम होती है" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "BP readings stabilise", hiDesc: "रक्तचाप रीडिंग स्थिर" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "BP stays steady", hiDesc: "रक्तचाप स्थिर रहता है" },
            ],
            "diabetes": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Sugar crashes decline", hiDesc: "शुगर का अचानक गिरना कम" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Sugar levels even out", hiDesc: "शुगर स्तर संतुलित" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "Appetite remains balanced", hiDesc: "भूख संतुलित रहती है" },
            ],
            "family history of obesity or metabolic disorders": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Junk cravings reduce", hiDesc: "जंक फूड की लालसा कम" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Fat shifts, digestion improves", hiDesc: "वसा घटती है, पाचन सुधरता है" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "Body lighter, more resilient", hiDesc: "शरीर हल्का, अधिक मज़बूत" },
            ],
            "obesity": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Light digestion, fewer cravings, mild sleep and energy improvement.", hiDesc: "हल्का पाचन, कम लालसा, नींद और ऊर्जा में हल्का सुधार।" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Energy improves, movement feels easier, eating becomes structured.", hiDesc: "ऊर्जा बढ़ती है, चलना-फिरना आसान लगता है, खानपान व्यवस्थित होता है।" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "Better body tone, control over habits, lighter feeling.", hiDesc: "बेहतर बॉडी टोन, आदतों पर नियंत्रण, हल्कापन महसूस।" },
            ]
        },
        '81+': {
            "pcos/pcod": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Skin, mood stable", hiDesc: "त्वचा, मनोदशा स्थिर" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Cycles consistent", hiDesc: "मासिक चक्र सुसंगत" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "PMS under control", hiDesc: "PMS नियंत्रण में" },
            ],
            "thyroid disorder": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Less daytime fatigue", hiDesc: "दिन में कम थकान" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Focus, alertness stable", hiDesc: "एकाग्रता, सतर्कता स्थिर" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "Thyroid function steady", hiDesc: "थायरॉइड कार्य स्थिर" },
            ],
            "hypertension": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Mood, puffiness balanced", hiDesc: "मनोदशा, सूजन संतुलित" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "BP remains controlled", hiDesc: "रक्तचाप नियंत्रित रहता है" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "BP under long-term control", hiDesc: "रक्तचाप दीर्घकालिक नियंत्रण में" },
            ],
            "diabetes": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Cravings under control", hiDesc: "लालसा नियंत्रण में" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Sugar control sustained", hiDesc: "शुगर नियंत्रण बना रहता है" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "Appetite, sugar balanced", hiDesc: "भूख, शुगर संतुलित" },
            ],
            "family history of obesity or metabolic disorders": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Digestion remains smooth", hiDesc: "पाचन सुचारू रहता है" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Lipids, liver stay normal", hiDesc: "लिपिड, लीवर सामान्य रहते हैं" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "Long-term wellness sustained", hiDesc: "दीर्घकालिक कल्याण बना रहता है" },
            ],
            "obesity": [
                { month: "Month 1", hi: "महीना 1", timelineDesc: "Weight stable, digestion light, energy and food control consistent.", hiDesc: "वज़न स्थिर, पाचन हल्का, ऊर्जा और भोजन नियंत्रण सुसंगत।" },
                { month: "Month 3", hi: "महीना 3", timelineDesc: "Agility improves, immune recovery and tone maintained.", hiDesc: "फुर्ती बढ़ती है, प्रतिरक्षा रिकवरी और टोन बनी रहती है।" },
                { month: "Month 6", hi: "महीना 6", timelineDesc: "Metabolism, body shape, and stamina stay balanced and sustained.", hiDesc: "मेटाबॉलिज्म, शरीर का आकार और स्टैमिना संतुलित और बना रहता है।" },
            ]
        }
    },

    getRiskType: (healthScore) => {
        if (healthScore <= 30) return "Critical Risk";
        if (healthScore > 30 && healthScore <= 60) return "High Risk";
        if (healthScore > 60 && healthScore <= 84) return "Moderate Risk";
        return "Low Risk";
    },
    calculateScore: (allAnswers, userInfo) => {
        let totalAnswerScore = 0;
        for (const groupKey in allAnswers) {
            allAnswers[groupKey].forEach(answer => {
                totalAnswerScore += answer.score || 0;
            });
        }
        const baseScore = 100 - totalAnswerScore;
        const bmi = _calculateBmi(userInfo.height, userInfo.currentWeight);

        let deductions = 0;
        if (bmi >= 30) deductions += 10;
        else if (bmi >= 25) deductions += 5;

        return Math.max(0, baseScore - deductions);
    },

    productRules: (score, allAnswers, productDatabase) => {
        const selectedKeys = [];
        const hasPCOS = _hasAnswer(allAnswers, 'medical', 'PCOS/PCOD');
        const hasThyroid = _hasAnswer(allAnswers, 'medical', 'Thyroid disorder');
        const hasBellyFat = _hasAnswer(allAnswers, 'lifestyle', 'Over weight') || _hasAnswer(allAnswers, 'lifestyle', 'Obese class');
        const hasLowEnergy = _hasAnswer(allAnswers, 'medical', 'Fatigue') || _hasAnswer(allAnswers, 'medical', 'Stress');

        if (score < 25) {
            selectedKeys.push("ORLISTAT", "IGNITE", "METABOLIC_MULTI", "SLIMTOX_ENERGY_TEA");
            if (hasPCOS) selectedKeys.push("GARCINIA");
        } else if (score <= 60) {
            selectedKeys.push("IGNITE", "GARCINIA", "SLIMTOX_ENERGY_TEA", "METABOLIC_MULTI", "ORLISTAT");
            if (hasThyroid) selectedKeys.push("THYROIDINUM");
        } else if (score <= 80) {
            selectedKeys.push("GARCINIA", "SLIMTOX_ENERGY_TEA", "METABOLIC_MULTI", "ORLISTAT");
            if (hasBellyFat || hasLowEnergy) selectedKeys.push("IGNITE");
        } else {
            selectedKeys.push("SLIMTOX_ENERGY_TEA");
            if (hasLowEnergy) selectedKeys.push("METABOLIC_MULTI");
        }

        return [...new Set(selectedKeys)]
            .map(key => productDatabase[key])
            .filter(Boolean);
    },

    resultRules: (score, allAnswers, config, userInfo) => {
        const bmi = _calculateBmi(userInfo.height, userInfo.currentWeight);
        const bmiClass = _getBmiClass(bmi);

        let issueTitle = bmiClass;
        let issueTitleHi = _bmiClassHi[bmiClass] || bmiClass;
        const medicalAnswersText = (allAnswers.medical || []).flatMap(ans =>
            Array.isArray(ans.text) ? ans.text.map(t => t.toLowerCase()) : [String(ans.text).toLowerCase()]
        );

        if (medicalAnswersText.includes("diabetes")) { issueTitle += " + Metabolic Dysfunction"; issueTitleHi += " + मेटाबॉलिक दुष्क्रिया"; }
        if (medicalAnswersText.includes("hypertension")) { issueTitle += " + Hypertension"; issueTitleHi += " + उच्च रक्तचाप"; }
        if (medicalAnswersText.includes("pcos/pcod")) { issueTitle += " + Hormonal Imbalance"; issueTitleHi += " + हार्मोनल असंतुलन"; }
        if (medicalAnswersText.includes("thyroid disorder")) { issueTitle += " + Thyroid Dysfunction"; issueTitleHi += " + थायरॉइड दुष्क्रिया"; }

        let conditionTextHTML = "";
        let conditionTextHTMLHi = "";
        if (score < 25) {
            conditionTextHTML = "<p>Your health metrics indicate a need for major lifestyle changes and a SEHAT UP doctor-guided program.</p>";
            conditionTextHTMLHi = "<p>आपके स्वास्थ्य मेट्रिक्स बड़े जीवनशैली बदलावों और SEHAT UP डॉक्टर-निर्देशित कार्यक्रम की आवश्यकता दर्शाते हैं।</p>";
        } else if (score <= 60) {
            conditionTextHTML = "<p>You need focused lifestyle correction, balanced meals, and targeted support for your conditions.</p>";
            conditionTextHTMLHi = "<p>आपको केंद्रित जीवनशैली सुधार, संतुलित भोजन और अपनी स्थितियों के लिए लक्षित सहायता की आवश्यकता है।</p>";
        } else if (score <= 80) {
            conditionTextHTML = "<p>You’re doing better, but still need discipline in eating habits and regular physical activity.</p>";
            conditionTextHTMLHi = "<p>आप बेहतर कर रही हैं, लेकिन फिर भी खानपान की आदतों में अनुशासन और नियमित शारीरिक गतिविधि की आवश्यकता है।</p>";
        } else {
            conditionTextHTML = "<p>Great job! Just focus on sustaining your healthy routine and staying consistent.</p>";
            conditionTextHTMLHi = "<p>बहुत बढ़िया! बस अपनी स्वस्थ दिनचर्या बनाए रखने और निरंतरता पर ध्यान दें।</p>";
        }

        let futureRisks = [];
        let possibleCauses = [];
        const seenRisks = new Set();
        for (const groupKey in allAnswers) {
            allAnswers[groupKey].forEach(answer => {
                const qRisks = config.futureRisksMapping[answer.question];
                if (qRisks) {
                    const texts = Array.isArray(answer.text) ? answer.text : [answer.text];
                    texts.forEach(text => {
                        const risk = qRisks[text];
                        if (risk) {
                            const key = risk.en || risk;
                            if (!seenRisks.has(key)) { seenRisks.add(key); futureRisks.push(risk); }
                        }
                    });
                }
                const qCauses = config.causeMapping[answer.question];
                if (qCauses) {
                    const texts = Array.isArray(answer.text) ? answer.text : [answer.text];
                    texts.forEach(text => {
                        const cause = qCauses[text];
                        if (cause && !possibleCauses.includes(cause)) possibleCauses.push(cause);
                    });
                }
            });
        }

        const scoreBracket = score < 25 ? '<25' : score <= 60 ? '25-60' : score <= 80 ? '61-80' : '81+';
        const timelineData = config.conditionTimelineData;
        let timelineDescMap = { "Month 1": "", "Month 3": "", "Month 6": "" };
        let timelineHiMap = { "Month 1": "", "Month 3": "", "Month 6": "" };

        const baseTimeline = (timelineData[scoreBracket] && timelineData[scoreBracket]["obesity"]) || [];
        baseTimeline.forEach(item => {
            if (timelineDescMap[item.month] !== undefined) {
                timelineDescMap[item.month] = item.timelineDesc;
                timelineHiMap[item.month] = item.hiDesc || item.timelineDesc;
            }
        });

        medicalAnswersText.forEach(conditionKey => {
            const conditionTimeline = (timelineData[scoreBracket] && timelineData[scoreBracket][conditionKey.toLowerCase()]);
            if (conditionTimeline) {
                conditionTimeline.forEach(item => {
                    if (timelineDescMap[item.month] !== undefined) {
                        const existing = timelineDescMap[item.month];
                        timelineDescMap[item.month] = existing ? `${existing}, ${item.timelineDesc.toLowerCase()}` : item.timelineDesc;
                        const existingHi = timelineHiMap[item.month];
                        const hiDesc = item.hiDesc || item.timelineDesc;
                        timelineHiMap[item.month] = existingHi ? `${existingHi}, ${hiDesc}` : hiDesc;
                    }
                });
            }
        });

        const finalTimeline = Object.keys(timelineDescMap).map((month) => ({
            month,
            hi: _monthHi[month] || month,
            timelineDesc: timelineDescMap[month],
            hiDesc: timelineHiMap[month],
        }));

        let lifestyleConditions = [];
        (allAnswers.medical || []).forEach(answer => {
            const texts = Array.isArray(answer.text) ? answer.text : [answer.text];
            texts.forEach(text => {
                const key = String(text).toLowerCase();
                if (config.lifestyleTips[key]) lifestyleConditions.push(key);
            });
        });

        return {
            issueTitle,
            issueTitleHi,
            conditionTextHTML,
            conditionTextHTMLHi,
            futureRisks,
            possibleCauses,
            timelineData: { general: finalTimeline, extras: [] },
            lifestyleConditions: [...new Set(lifestyleConditions)]
        };
    },

    saveSubmission: async (state, db, config) => {
        const userInfo = state.userInfo;
        const computedHealthScore = state.healthScore || 0;
        const results = state.results;
        const allAnswers = state.allAnswers;
        const activeProducts = state.recommendedProducts.filter(p => p.active);

        const answers = [];
        for (const groupKey in allAnswers) {
            allAnswers[groupKey].forEach(answer => {
                answers.push({
                    question: answer.question,
                    answer: Array.isArray(answer.text) ? answer.text.join(', ') : answer.text,
                    score: answer.score
                });
            });
        }

        const lifestyleTipsArray = (results.lifestyleConditions || []).flatMap(condition => {
            const tips = config.lifestyleTips[condition] || [];
            return tips.map(text => ({ text }));
        });

        if (config.lifestyleTips["general"]) {
            config.lifestyleTips["general"].forEach(tip => lifestyleTipsArray.push({ text: tip }));
        }

        const combinedTimeline = (results.timelineData?.general || []).map(item => ({
            month: item.month,
            timelineDesc: item.timelineDesc,
            timelineDescHi: item.hiDesc || ''
        }));

        const finalRecommendedProducts = activeProducts.map(p => ({
            name: p.name,
            nameHi: p.nameHi || '',
            salePrice: p.salePrice,
            image: p.image,
            whyPoints: (p.whyPoints || []).map(text => ({ text })),
        }));

        // futureRisks may be { en, hi } objects or plain strings — normalise both.
        const futureRisks = (results.futureRisks || []).map((r) => {
            if (r && typeof r === 'object') {
                return { text: r.en || r.text || '', textHi: r.hi || '' };
            }
            return { text: r, textHi: '' };
        });

        const initialRiskType = config.getRiskType(computedHealthScore);
        const data = {
            reportDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
            userName: userInfo.name,
            dob: userInfo.dob,
            phone: userInfo.phone,
            riskType: initialRiskType,
            height: userInfo.height,
            weight: userInfo.currentWeight,
            targetWeight: userInfo.targetWeight,
            bmi: userInfo.bmi || 0,
            healthScore: computedHealthScore,
            issueTitle: results.issueTitle,
            issueTitleHi: results.issueTitleHi || '',
            concern: "Women's Weight Management",
            reportCategory: "Womens Weight Management",
            lifestyleConditions: results.lifestyleConditions || [],
            lifestyleChanges: lifestyleTipsArray,
            timeline: combinedTimeline,
            answers: answers,
            questionnaireId: config.id,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            isWhatsAppSent: false,
            futureRisks: futureRisks,
            possibleCauses: (results.possibleCauses || []).map(text => ({ text })),
            recommendedProducts: finalRecommendedProducts,
        };

        try {
            const docRef = await db.collection('questionnaire_submissions').add(data);
            return docRef.id;
        } catch (e) {
            console.error('Error saving to Firebase:', e);
            throw e;
        }
    }
};
