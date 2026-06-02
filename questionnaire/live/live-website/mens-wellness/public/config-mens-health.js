// config-mens-health.js
// Bilingual (en / hi). Every question, option, result string and UI label has a
// `hi` counterpart. The engine renders q.hi / opt.hi when currentLanguage === 'hi'
// and reads config.uiTranslations for all static UI strings.

const questionBank = {
    ed: [{
        question: "Is getting or staying hard ever a challenge? How often?",
        hi: "क्या इरेक्शन पाना या बनाए रखना कभी चुनौती बनता है? कितनी बार?",
        options: [{
            text: "Everytime", hi: "हर बार",
            score: 10
        }, {
            text: "Sometimes", hi: "कभी-कभी",
            score: 6
        }, {
            text: "Rarely", hi: "कभी-कभार",
            score: 3
        }]
    }, {
        question: "How often do you struggle to stay hard?",
        hi: "आप आमतौर पर कितनी देर तक इरेक्शन बनाए रख पाते हैं?",
        options: [{
            text: "Less than 1 minute", hi: "1 मिनट से कम",
            score: 10
        }, {
            text: "1-5 minutes", hi: "1-5 मिनट",
            score: 8
        }, {
            text: "5-10 minutes", hi: "5-10 मिनट",
            score: 5
        }, {
            text: "More than 10 minutes", hi: "10 मिनट से अधिक",
            score: 3
        }]
    }, {
        question: "How often do you feel nervous about performance?",
        hi: "आप प्रदर्शन को लेकर कितनी घबराहट महसूस करते हैं?",
        options: [{
            text: "High", hi: "अधिक",
            score: 10
        }, {
            text: "Moderate", hi: "मध्यम",
            score: 8
        }, {
            text: "Low", hi: "कम",
            score: 5
        }, {
            text: "Very low", hi: "बहुत कम",
            score: 3
        }]
    }, {
        question: "Currently taking any medicine for current problem or lifestyle modification",
        hi: "क्या आप वर्तमान समस्या के लिए कोई दवा या जीवनशैली उपाय ले रहे हैं?",
        options: [{
            text: "Medicine", hi: "दवा",
            score: 0
        }, {
            text: "Gel", hi: "जेल",
            score: 0
        }, {
            text: "Spray", hi: "स्प्रे",
            score: 0
        }, {
            text: "None", hi: "कोई नहीं",
            score: 0
        }]
    }, {
        question: "For how long have you has this condition?",
        hi: "आपको यह समस्या कब से है?",
        options: [{
            text: "Less than a month", hi: "एक महीने से कम",
            score: 1
        }, {
            text: "Less than 6 months", hi: "6 महीने से कम",
            score: 2
        }, {
            text: "6 months - 1 year", hi: "6 महीने - 1 साल",
            score: 4
        }, {
            text: "1 year+", hi: "1 साल से अधिक",
            score: 5
        }]
    },],
    pe: [{
        question: "How often do you feel like you climax too quickly?",
        hi: "आपको कितनी बार लगता है कि आप बहुत जल्दी स्खलित हो जाते हैं?",
        options: [{
            text: "Always", hi: "हमेशा",
            score: 10
        }, {
            text: "Sometimes", hi: "कभी-कभी",
            score: 6
        }, {
            text: "Rarely", hi: "कभी-कभार",
            score: 10
        }]
    }, {
        question: "What do you believe is causing you to finish early?",
        hi: "आपके अनुसार जल्दी स्खलन का कारण क्या है?",
        options: [{
            text: "High Sensitivity", hi: "अधिक संवेदनशीलता",
            score: 10
        }, {
            text: "Anxiety", hi: "चिंता",
            score: 8
        }, {
            text: "Both", hi: "दोनों",
            score: 5
        }, {
            text: "I do not know", hi: "मुझे नहीं पता",
            score: 3
        }]
    }, {
        question: "How quickly do you typically finish during intercourse?",
        hi: "संभोग के दौरान आप आमतौर पर कितनी जल्दी स्खलित हो जाते हैं?",
        options: [{
            text: "Less than 1 minute", hi: "1 मिनट से कम",
            score: 10
        }, {
            text: "1-5 minutes", hi: "1-5 मिनट",
            score: 8
        }, {
            text: "5-10 minutes", hi: "5-10 मिनट",
            score: 5
        }, {
            text: "More than 10 minutes", hi: "10 मिनट से अधिक",
            score: 3
        }]
    }, {
        question: "Currently taking any med. for current problem or lifestyle modification",
        hi: "क्या आप वर्तमान समस्या के लिए कोई दवा या जीवनशैली उपाय ले रहे हैं?",
        options: [{
            text: "Medicine", hi: "दवा",
            score: 0
        }, {
            text: "Gel", hi: "जेल",
            score: 0
        }, {
            text: "Spray", hi: "स्प्रे",
            score: 0
        }, {
            text: "None", hi: "कोई नहीं",
            score: 0
        }]
    }, {
        question: "For how long have you has this condition?",
        hi: "आपको यह समस्या कब से है?",
        options: [{
            text: "Less than a month", hi: "एक महीने से कम",
            score: 1
        }, {
            text: "Less than 6 months", hi: "6 महीने से कम",
            score: 2
        }, {
            text: "6 months - 1 year", hi: "6 महीने - 1 साल",
            score: 4
        }, {
            text: "1 year+", hi: "1 साल से अधिक",
            score: 5
        }]
    },],
    both: [{
        question: "How often do you have trouble getting an erection or keeping an erection during sex?",
        hi: "सेक्स के दौरान आपको इरेक्शन पाने या बनाए रखने में कितनी बार परेशानी होती है?",
        options: [{
            text: "Everytime", hi: "हर बार",
            score: 10
        }, {
            text: "Sometimes", hi: "कभी-कभी",
            score: 6
        }, {
            text: "Rarely", hi: "कभी-कभार",
            score: 10
        }]
    }, {
        question: "How long can you keep up with your erection?",
        hi: "आप अपना इरेक्शन कितनी देर तक बनाए रख सकते हैं?",
        options: [{
            text: "Less than 1 minute", hi: "1 मिनट से कम",
            score: 10
        }, {
            text: "1-5 minutes", hi: "1-5 मिनट",
            score: 8
        }, {
            text: "5-10 minutes", hi: "5-10 मिनट",
            score: 5
        }, {
            text: "More than 10 minutes", hi: "10 मिनट से अधिक",
            score: 3
        }]
    }, {
        question: "Tell us about your performance anxiety levels",
        hi: "अपने प्रदर्शन संबंधी चिंता के स्तर के बारे में बताएं",
        options: [{
            text: "High", hi: "अधिक",
            score: 10
        }, {
            text: "Moderate", hi: "मध्यम",
            score: 8
        }, {
            text: "Low", hi: "कम",
            score: 5
        }, {
            text: "Never", hi: "कभी नहीं",
            score: 3
        }]
    }, {
        question: "How often do you have early ejaculation?",
        hi: "आपको कितनी बार जल्दी स्खलन होता है?",
        options: [{
            text: "Always", hi: "हमेशा",
            score: 0
        }, {
            text: "Sometimes", hi: "कभी-कभी",
            score: 0
        }, {
            text: "Rarely", hi: "कभी-कभार",
            score: 0
        }]
    }, {
        question: "What according to you is causing you to finish quickly?",
        hi: "आपके अनुसार जल्दी स्खलन का कारण क्या है?",
        options: [{
            text: "High Sensitivity", hi: "अधिक संवेदनशीलता",
            score: 0
        }, {
            text: "Anxiety", hi: "चिंता",
            score: 1
        }, {
            text: "Both", hi: "दोनों",
            score: 2
        }, {
            text: "I do not know", hi: "मुझे नहीं पता",
            score: 4
        }]
    }, {
        question: "What is your ejaculation timing while performing the intercourse?",
        hi: "संभोग के दौरान आपका स्खलन समय क्या होता है?",
        options: [{
            text: "Less than 1 minute", hi: "1 मिनट से कम",
            score: 10
        }, {
            text: "1-5 minutes", hi: "1-5 मिनट",
            score: 8
        }, {
            text: "5-10 minutes", hi: "5-10 मिनट",
            score: 5
        }, {
            text: "More than 10 minutes", hi: "10 मिनट से अधिक",
            score: 3
        }]
    }, {
        question: "For how long have you has this condition?",
        hi: "आपको यह समस्या कब से है?",
        options: [{
            text: "Less than a month", hi: "एक महीने से कम",
            score: 2
        }, {
            text: "Less than 6 months", hi: "6 महीने से कम",
            score: 3
        }, {
            text: "6 months - 1 year", hi: "6 महीने - 1 साल",
            score: 4
        }, {
            text: "1 year+", hi: "1 साल से अधिक",
            score: 5
        }]
    },],
};
const lifestyleQuestions = [{
    question: "How frequently do you consume cigarettes, alcohol, or similar substances on a daily basis?",
    hi: "आप रोज़ाना कितनी बार सिगरेट, शराब या इसी तरह के पदार्थों का सेवन करते हैं?",
    options: [{
        text: "Very Frequently", hi: "बहुत बार",
        score: 10
    }, {
        text: "Frequently", hi: "अक्सर",
        score: 8
    }, {
        text: "Sometimes", hi: "कभी-कभी",
        score: 5
    }, {
        text: "Rarely", hi: "कभी-कभार",
        score: 3
    }, {
        text: "Never", hi: "कभी नहीं",
        score: 0
    },],
}, {
    question: "Do you have any of the following health issues? If yes, tick those apply.",
    hi: "क्या आपको निम्नलिखित में से कोई स्वास्थ्य समस्या है? यदि हाँ, तो लागू विकल्प चुनें।",
    multiple: true,
    options: [{
        text: "Heart Problem", hi: "हृदय रोग",
        score: 2
    }, {
        text: "Blood Pressure", hi: "रक्तचाप",
        score: 2
    }, {
        text: "Diabetes", hi: "मधुमेह",
        score: 2
    }, {
        text: "High Cholesterol", hi: "उच्च कोलेस्ट्रॉल",
        score: 2
    }, {
        text: "Thyroid Issues", hi: "थायरॉइड समस्या",
        score: 2
    }, {
        text: "None", hi: "कोई नहीं",
        score: 0
    },],
},];
const timelineData = {
    ed: [{
        month: "Month 1", hi: "महीना 1",
        timelineDesc: "Improved erection, better mood, reduced fatigue",
        hiDesc: "बेहतर इरेक्शन, बेहतर मनोदशा, कम थकान"
    }, {
        month: "Month 3", hi: "महीना 3",
        timelineDesc: "Restored sexual normalcy, better confidence levels",
        hiDesc: "यौन सामान्यता बहाल, बेहतर आत्मविश्वास"
    }, {
        month: "Month 6", hi: "महीना 6",
        timelineDesc: "Confident sexual function, better energy levels",
        hiDesc: "आत्मविश्वासपूर्ण यौन क्रिया, बेहतर ऊर्जा स्तर"
    },],
    pe: [{
        month: "Month 1", hi: "महीना 1",
        timelineDesc: "Improved ejaculation control, reduced anxiety",
        hiDesc: "बेहतर स्खलन नियंत्रण, कम चिंता"
    }, {
        month: "Month 3", hi: "महीना 3",
        timelineDesc: "Consistent control, higher sexual satisfaction",
        hiDesc: "निरंतर नियंत्रण, अधिक यौन संतुष्टि"
    }, {
        month: "Month 6", hi: "महीना 6",
        timelineDesc: "Stable ejaculation control without anxiety",
        hiDesc: "बिना चिंता के स्थिर स्खलन नियंत्रण"
    },],
    both: [{
        month: "Month 1", hi: "महीना 1",
        timelineDesc: "Improved erection quality and ejaculation control, reduced anxiety",
        hiDesc: "बेहतर इरेक्शन गुणवत्ता और स्खलन नियंत्रण, कम चिंता"
    }, {
        month: "Month 3", hi: "महीना 3",
        timelineDesc: "Restored normal sexual performance, enhanced emotional intimacy",
        hiDesc: "सामान्य यौन प्रदर्शन बहाल, बेहतर भावनात्मक नज़दीकी"
    }, {
        month: "Month 6", hi: "महीना 6",
        timelineDesc: "Complete control, minimal dependence on meds, high confidence",
        hiDesc: "पूर्ण नियंत्रण, दवाओं पर कम निर्भरता, उच्च आत्मविश्वास"
    },],
};
const lifestyleTips = {
    "GENERAL": ["Eat foods that boost energy and hormones like almonds, pumpkin seeds, dates, and dark chocolate ", "Sleep 7–8 hours regularly and avoid stress, as it affects performance", "Stay active—30 minutes of walking or light exercise can help improve stamina", "Avoid smoking, alcohol, and junk food—they affect blood flow and energy", "Include zinc and magnesium-rich foods like seeds, leafy greens, and dry fruits", "Maintain daily physical activity",],
    "Heart Problem": ["Eat home-cooked meals with less oil, salt, and sugar", "Add heart-healthy foods like walnuts, oats, garlic, and fruits", "Avoid fried and packaged items", "Walk daily for 30 minutes and avoid sitting for long hours",],
    "Blood Pressure": ["Limit salt—avoid salty snacks, papads, and pickles", "Eat potassium-rich foods like bananas, tomatoes, and spinach", "Reduce tea/coffee to 1–2 cups a day", "Manage stress through deep breathing, meditation, or evening walks", "Drink enough water",],
    "Diabetes": ["Avoid sugar, sweets, and white rice or maida", "Eat small, regular meals with plenty of vegetables, dal, and whole grains like jowar or brown rice", "Avoid fruit juices—eat whole fruits instead", "Walk after meals and monitor blood sugar regularly",],
    "High Cholesterol": ["Cut down on fried and buttery foods.Prefer baked, grilled, or steamed items", "Use healthy oils like mustard, rice bran, or olive oil", "Eat more fiber—like fruits with skin, dalia, and vegetables", "Avoid overeating and aim for 20–30 minutes of activity daily",],
    "Thyroid Issues": ["Eat on time every day and avoid skipping meals", "Use iodized salt, and include foods like eggs, milk, nuts, and whole grains", "Avoid excess soy products and junk food", "Sleep at a fixed time and stay active to support hormone balance",],
};
const causeMapping = {
    "How often do you struggle to stay hard?": {
        "Less than 1 minute": "Severe erectile dysfunction, likely vascular or neurological",
        "1-5 minutes": "Less severe erectile dysfunction, likely vascular or psychological",
        "5-10 minutes": "Mild erectile dysfunction, likely psychological",
        "More than 10 minutes": "Likely psychological",
    },
    "How often do you feel nervous about performance?": {
        "High": "Performance anxiety and stress contributes to poor performance",
        "Moderate": "Performance anxiety",
        "Low": "Sometimes stress can be a contributing factor",
    },
    "How often do you feel like you climax too quickly?": {
        "Always": "Rushing sex, performance anxiety, stress & depression, guilt & shame",
        "Sometimes": "Performance anxiety, stress & depression",
        "Rarely": "Performance anxiety",
    },
    "What do you believe is causing you to finish early?": {
        "High Sensitivity": "Over sensitive penis, hormonal imbalance, infection, genetic predisposition",
        "Anxiety": "Performance anxiety",
        "Both": "Over sensitive penis, hormonal imbalance, infection, genetic predisposition",
        "I do not know": "Performance anxiety, stress & depression",
    },
    "How quickly do you typically finish during intercourse?": {
        "Less than 1 minute": "Rushing sex, performance anxiety, stress & depression, guilt & shame",
        "1-5 minutes": "Performance anxiety, stress & depression",
        "5-10 minutes": "Performance anxiety",
    },
    "How long can you keep up with your erection?": {
        "Less than 1 minute": "Severe erectile dysfunction, likely vascular or neurological",
        "1-5 minutes": "Less severe erectile dysfunction, likely vascular or psychological",
        "5-10 minutes": "Mild erectile dysfunction, likely psychological",
        "More than 10 minutes": "Likely psychological"
    },
    "Tell us about your performance anxiety levels": {
        "High": "Performance anxiety",
        "Moderate": "Stress factors"
    },
    "What according to you is causing you to finish quickly?": {
        "High Sensitivity": "Over sensitive penis, hormonal imbalance, infection, genetic predisposition",
        "Anxiety": "Performance anxiety, stress & depression",
        "Both": "Performance anxiety, stress & depression, hormonal imbalance",
        "I don't know": "Performance anxiety, stress & depression"
    },
    "What is your ejaculation timing while performing the intercourse?": {
        "Less than 1 minute": "Rushed sex, infrequent sex, hormonal disturbance, chronic metabolic condition",
        "1-5 minutes": "Rushed sex, infrequent sex, hormonal disturbance, stress",
        "5-10 minutes": "Psychological triggers"
    },
    "For how long have you has this condition?": {
        "Less than a month": "Psychological triggers, lifestyle factors, hormonal fluctuation, relationship dynamics",
        "Less than 6 months": "Psychological triggers, poor sleep, substance use, hormonal imbalances, relationship issues",
        "6 months - 1 year": "Stress & depression, chronic medical or neurological conditions, erectile dysfunction",
        "1 year +": "Stress & depression, chronic medical or neurological conditions, erectile dysfunction, infrequent sex, substance use"
    },
    "How frequently do you consume cigarettes, alcohol, or similar substances on a daily basis?": {
        "Very Frequently": "Substance abuse is a contributing factor",
        "Frequently": "Substance abuse is a contributing factor",
        "Sometimes": "Chronic substance use may worsen the existing condition"
    },
    "Do you have any of the following health issues?": {
        "Heart Problem": "Vascular issues due to heart problems",
        "Blood Pressure": "Vascular issues due to blood pressure problems",
        "Diabetes": "Nerve damage or poor blood flow from diabetes",
        "High cholesterol": "Vascular or neurological distress due to high cholesterol",
        "Thyroid issues": "Hormonal imbalance due to thyroid issues"
    }
};
// Future risks as { en, hi } so the result page can localise them.
const detailedFutureRisks = {
    ed: [
        { en: 'Loss of libido', hi: 'कामेच्छा में कमी' },
        { en: 'Relationship strain', hi: 'रिश्तों में तनाव' },
        { en: 'Impotency (untreated ED)', hi: 'नपुंसकता (अनुपचारित ED)' },
        { en: 'Risk of irreversible vascular and neurological damage', hi: 'अपरिवर्तनीय संवहनी और तंत्रिका क्षति का खतरा' },
        { en: 'Chronic depression', hi: 'दीर्घकालिक अवसाद' },
    ],
    pe: [
        { en: 'Escalation to secondary erectile dysfunction due to psychological stress', hi: 'मनोवैज्ञानिक तनाव के कारण द्वितीयक इरेक्टाइल डिसफंक्शन की ओर बढ़ना' },
        { en: 'Relationship strain and partner frustration', hi: 'रिश्तों में तनाव और साथी की निराशा' },
        { en: 'Avoidance of intimacy', hi: 'नज़दीकी से बचाव' },
        { en: 'Lower self-esteem and increased performance anxiety over time', hi: 'समय के साथ आत्म-सम्मान में कमी और प्रदर्शन चिंता में वृद्धि' },
    ],
    both: [
        { en: 'Escalation to complete sexual dysfunction', hi: 'पूर्ण यौन दुष्क्रिया की ओर बढ़ना' },
        { en: 'Long-term hormonal dysregulation', hi: 'दीर्घकालिक हार्मोनल असंतुलन' },
        { en: 'Risk of psychosomatic disorders (chronic fatigue, insomnia, substance abuse)', hi: 'मनोदैहिक विकारों का खतरा (दीर्घकालिक थकान, अनिद्रा, नशे की लत)' },
        { en: 'Isolation, social withdrawal, and reduced quality of life', hi: 'अलगाव, सामाजिक दूरी और जीवन की गुणवत्ता में कमी' },
        { en: 'Chronic depression', hi: 'दीर्घकालिक अवसाद' },
        { en: 'Relationship conflicts', hi: 'रिश्तों में टकराव' },
    ],
};

// ─── Full UI string table (en / hi) ─────────────────────────────────────────
const uiTranslations = {
    en: {
        'main-title': "Men's Sexual Wellness Score",
        'welcome-title': "Welcome to the Men's Sexual Health Quiz!",
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
        'step-3-title': "Select the challenge you’re facing - we’re here to help",
        'btn-ed': "Erectile Dysfunction (ED)",
        'btn-pe': "Premature Ejaculation (PE)",
        'btn-both': "Both",
        'btn-back-to-quiz': "Back to Questionnaire",
        'report-title': "Assessment Report",
        'label-report-date': "Date:",
        'label-patient-name': "Name",
        'label-age': "Age",
        'label-category': "Category",
        'label-report-date-row': "Report Date",
        'report-category': "Men's Sexual Wellness",
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
        'concern': "Challenge",
        'sexual_health': "Questions",
        'lifestyle': "Lifestyle Questions",
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
        'main-title': "पुरुष यौन स्वास्थ्य स्कोर",
        'welcome-title': "पुरुष यौन स्वास्थ्य प्रश्नोत्तरी में आपका स्वागत है!",
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
        'step-3-title': "उस चुनौती को चुनें जिसका आप सामना कर रहे हैं - हम यहाँ मदद के लिए हैं",
        'btn-ed': "इरेक्टाइल डिसफंक्शन (ED)",
        'btn-pe': "शीघ्रपतन (PE)",
        'btn-both': "दोनों",
        'btn-back-to-quiz': "प्रश्नावली पर वापस जाएँ",
        'report-title': "आकलन रिपोर्ट",
        'label-report-date': "दिनांक:",
        'label-patient-name': "नाम",
        'label-age': "आयु",
        'label-category': "श्रेणी",
        'label-report-date-row': "रिपोर्ट दिनांक",
        'report-category': "पुरुष यौन स्वास्थ्य",
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
        'concern': "चुनौती",
        'sexual_health': "प्रश्न",
        'lifestyle': "जीवनशैली प्रश्न",
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
    id: 'mens-wellness',
    staticSteps: 2,
    uiTranslations: uiTranslations,
    progressSteps: [{
        key: 'about-you',
        label: 'About You',
        step: 2
    },],
    questionGroups: [{
        step: 3,
        key: 'concern',
        label: 'Challenge',
        questions: [{
            question: "Select the challenge you’re facing - we’re here to help",
            hi: "उस चुनौती को चुनें जिसका आप सामना कर रहे हैं - हम यहाँ मदद के लिए हैं",
            options: [{
                text: "Erectile Dysfunction (ED)", hi: "इरेक्टाइल डिसफंक्शन (ED)",
                score: 0,
                key: 'ed'
            }, {
                text: "Premature Ejaculation (PE)", hi: "शीघ्रपतन (PE)",
                score: 0,
                key: 'pe'
            }, {
                text: "Both", hi: "दोनों",
                score: 0,
                key: 'both'
            },]
        }],
        onAnswer: (engineInstance, answer) => {
            const concernKey = answer.option.key;
            engineInstance.handleConcernSelection(concernKey, false);
        }
    }, {
        step: 4,
        key: 'sexual_health',
        label: 'Questions',
        questions: [],
        isDynamic: true,
    }, {
        step: 5,
        key: 'lifestyle',
        label: 'Lifestyle Questions',
        questions: lifestyleQuestions,
    },],
    questionBank: questionBank,
    productDatabase: window.productDatabase,
    lifestyleTips: lifestyleTips,
    causeMapping: causeMapping,
    getRiskType: (healthScore) => {
        if (healthScore <= 30) return "Critical Risk";
        if (healthScore > 30 && healthScore <= 60) return "High Risk";
        if (healthScore > 60 && healthScore <= 84) return "Moderate Risk";
        return "Low Risk";
    },
    calculateScore: (allAnswers, userInfo, config) => {
        let totalRisk = 0;
        (allAnswers.sexual_health || []).forEach(a => {
            totalRisk += a.score || 0;
        });
        (allAnswers.lifestyle || []).forEach(a => {
            totalRisk += a.score || 0;
        });
        const MAX_POSSIBLE_RISK = 80;
        const healthScore = 100 * (1 - (totalRisk / MAX_POSSIBLE_RISK));
        return Math.max(0, Math.min(100, Math.round(healthScore)));
    },
    productRules: (score, allAnswers, productDatabase, userInfo, config) => {
        const concernText = allAnswers.concern?.[0]?.text?.toLowerCase() || 'ed';

        // Use the Stable Internal IDs from PRODUCT_REGISTRY
        let baseProductKeys = ['ASHWAGANDHA', 'SHILAJIT'];

        if (concernText.includes('ed') || concernText.includes('both')) {
            baseProductKeys.push('TADALAFIL');
        }

        if (concernText.includes('pe') || concernText.includes('both')) {
            baseProductKeys.push('DAPOX');
        }

        const allKeys = [...new Set(baseProductKeys)];

        return allKeys.map((key) => {
            const product = productDatabase[key];
            if (product && product.active === true) {
                return product;
            }
            return null;
        }).filter(Boolean);
    },
    resultRules: (score, allAnswers, config, userInfo) => {
        const concernKey = allAnswers.concern?.[0]?.text?.toLowerCase() || 'ed';
        let issueTitle = '';
        let issueTitleHi = '';
        let baseText = '';
        let baseTextHi = '';
        if (concernKey === 'both') {
            issueTitle = "Erectile Dysfunction + Premature Ejaculation";
            issueTitleHi = "इरेक्टाइल डिसफंक्शन + शीघ्रपतन";
            baseText = "You’ve indicated concerns about both ED and PE. A comprehensive plan can help improve overall performance";
            baseTextHi = "आपने ED और PE दोनों से संबंधित चिंताएँ बताई हैं। एक व्यापक योजना समग्र प्रदर्शन सुधारने में मदद कर सकती है";
        } else if (concernKey === 'pe') {
            issueTitle = "Premature Ejaculation";
            issueTitleHi = "शीघ्रपतन";
            baseText = "Premature Ejaculation may be managed through specialized exercises, counseling, or medications";
            baseTextHi = "शीघ्रपतन को विशेष व्यायाम, परामर्श या दवाओं के माध्यम से प्रबंधित किया जा सकता है";
        } else {
            issueTitle = "Erectile Dysfunction";
            issueTitleHi = "इरेक्टाइल डिसफंक्शन";
            baseText = "Erectile Dysfunction can often be improved with medication, lifestyle changes, and therapy";
            baseTextHi = "इरेक्टाइल डिसफंक्शन को अक्सर दवा, जीवनशैली में बदलाव और थेरेपी से बेहतर किया जा सकता है";
        }
        const generalTimeline = timelineData[concernKey] || timelineData.ed;
        return {
            issueTitle: issueTitle,
            issueTitleHi: issueTitleHi,
            conditionTextHTML: `<p>${baseText}</p>`,
            conditionTextHTMLHi: `<p>${baseTextHi}</p>`,
            futureRisks: detailedFutureRisks[concernKey] || detailedFutureRisks.ed,
            possibleCauses: ['Psychological triggers', 'Vascular deficiency', 'Hormonal imbalance'],
            timelineData: {
                general: generalTimeline,
                extras: []
            },
            lifestyleConditions: [],
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
        const allTips = config.lifestyleTips || {};
        const conditions = results.lifestyleConditions || [];
        let tipsToSend = [...(allTips.GENERAL || [])];
        conditions.forEach((conditionKey) => {
            const key = String(conditionKey).toLowerCase();
            if (allTips[key]) {
                tipsToSend = [...tipsToSend, ...allTips[key]];
            }
        });
        const uniqueTips = [...new Set(tipsToSend)];
        const lifestyleTipsArray = uniqueTips.map((tip) => ({
            text: tip
        }));
        const possibleCauses = (results.possibleCauses || []).map((cause) => ({
            text: cause
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
                    text
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
            issueTitle: results.issueTitle,
            issueTitleHi: results.issueTitleHi || '',
            riskType: initialRiskType,
            concern: allAnswers.concern?.[0]?.text,
            reportCategory: "Mens Sexual Wellness",
            sexualHealthAnswers: allAnswers.sexual_health || [],
            lifestyleComorbiditiesAnswers: allAnswers.lifestyle || [],
            possibleCauses: possibleCauses,
            lifestyleChanges: lifestyleTipsArray,
            timeline: combinedTimeline,
            answers: answers,
            questionnaireId: config.id,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            futureRisks: futureRisks,
            recommendedProducts: finalRecommendedProducts,
            rawState: {
                allAnswers: allAnswers,
                results: results
            },
        };

        try {
            const docRef = await db.collection('questionnaire_submissions').add(data);
            console.log('Document written with ID: ', docRef.id);
            return docRef.id;
        } catch (e) {
            console.error('Error saving to Firebase:', e);
            throw e;
        }
    },
};
