// config-mens-health.js
const questionBank = {
    ed: [{
        question: "Is getting or staying hard ever a challenge? How often?",
        options: [{
            text: "Everytime",
            score: 10
        }, {
            text: "Sometimes",
            score: 6
        }, {
            text: "Rarely",
            score: 3
        }]
    }, {
        question: "How often do you struggle to stay hard?",
        options: [{
            text: "Less than 1 minute",
            score: 10
        }, {
            text: "1-5 minutes",
            score: 8
        }, {
            text: "5-10 minutes",
            score: 5
        }, {
            text: "More than 10 minutes",
            score: 3
        }]
    }, {
        question: "How often do you feel nervous about performance?",
        options: [{
            text: "High",
            score: 10
        }, {
            text: "Moderate",
            score: 8
        }, {
            text: "Low",
            score: 5
        }, {
            text: "Very low",
            score: 3
        }]
    }, {
        question: "Currently taking any medicine for current problem or lifestyle modification",
        options: [{
            text: "Medicine",
            score: 0
        }, {
            text: "Gel",
            score: 0
        }, {
            text: "Spray",
            score: 0
        }, {
            text: "None",
            score: 0
        }]
    }, {
        question: "For how long have you has this condition?",
        options: [{
            text: "Less than a month",
            score: 1
        }, {
            text: "Less than 6 months",
            score: 2
        }, {
            text: "6 months - 1 year",
            score: 4
        }, {
            text: "1 year+",
            score: 5
        }]
    },],
    pe: [{
        question: "How often do you feel like you climax too quickly?",
        options: [{
            text: "Always",
            score: 10
        }, {
            text: "Sometimes",
            score: 6
        }, {
            text: "Rarely",
            score: 10
        }]
    }, {
        question: "What do you believe is causing you to finish early?",
        hi: "आपको क्या लगता है कि आपके जल्दी स्खलन होने का क्या कारण है?",
        options: [{
            text: "High Sensitivity",
            hi: "अत्यधिक संवेदनशीलता",
            score: 10
        }, {
            text: "Anxiety",
            hi: "चिंता/घबराहट",
            score: 8
        }, {
            text: "Both",
            hi: "दोनों",
            score: 5
        }, {
            text: "I do not know",
            hi: "मुझे नहीं पता",
            score: 3
        }]
    }, {
        question: "How quickly do you typically finish during intercourse?",
        hi: "संबंध बनाने के दौरान आप आम तौर पर कितनी जल्दी स्खलन कर देते हैं?",
        options: [{
            text: "Less than 1 minute",
            hi: "1 मिनट से कम",
            score: 10
        }, {
            text: "1-5 minutes",
            hi: "1-5 मिनट",
            score: 8
        }, {
            text: "5-10 minutes",
            hi: "5-10 मिनट",
            score: 5
        }, {
            text: "More than 10 minutes",
            hi: "10 मिनट से अधिक",
            score: 3
        }]
    }, {
        question: "Currently taking any med. for current problem or lifestyle modification",
        hi: "वर्तमान समस्या या जीवनशैली में बदलाव के लिए वर्तमान में कोई दवा ले रहे हैं?",
        options: [{
            text: "Medicine",
            hi: "दवा",
            score: 0
        }, {
            text: "Gel",
            hi: "जैल",
            score: 0
        }, {
            text: "Spray",
            hi: "स्प्रे",
            score: 0
        }, {
            text: "None",
            hi: "कोई नहीं",
            score: 0
        }]
    },
    {
        question: "For how long have you has this condition?",
        options: [{
            text: "Less than a month",
            score: 1
        }, {
            text: "Less than 6 months",
            score: 2
        }, {
            text: "6 months - 1 year",
            score: 4
        }, {
            text: "1 year+",
            score: 5
        }]
    },],
    both: [{
        question: "How often do you have trouble getting an erection or keeping an erection during sex?",
        hi: "संबंध बनाने के दौरान आपको कितनी बार इरेक्शन (तनाव) पाने या उसे बनाए रखने में परेशानी होती है?",
        options: [{
            text: "Everytime",
            hi: "हर बार",
            score: 10
        }, {
            text: "Sometimes",
            hi: "कभी-कभी",
            score: 6
        }, {
            text: "Rarely",
            hi: "शायद ही कभी",
            score: 10
        }]
    }, {
        question: "How long can you keep up with your erection?",
        hi: "आप अपने इरेक्शन को कितनी देर तक बनाए रख सकते हैं?",
        options: [{
            text: "Less than 1 minute",
            hi: "1 मिनट से कम",
            score: 10
        }, {
            text: "1-5 minutes",
            hi: "1-5 मिनट",
            score: 8
        }, {
            text: "5-10 minutes",
            hi: "5-10 मिनट",
            score: 5
        }, {
            text: "More than 10 minutes",
            hi: "10 मिनट से अधिक",
            score: 3
        }]
    }, {
        question: "Tell us about your performance anxiety levels",
        hi: "हमें अपने परफॉरमेंस की घबराहट के स्तर के बारे में बताएं",
        options: [{
            text: "High",
            hi: "ज़्यादा",
            score: 10
        }, {
            text: "Moderate",
            hi: "मध्यम",
            score: 8
        }, {
            text: "Low",
            hi: "कम",
            score: 5
        }, {
            text: "Never",
            hi: "कभी नहीं",
            score: 3
        }]
    }, {
        question: "How often do you have early ejaculation?",
        hi: "आपको कितनी बार जल्दी स्खलन की समस्या होती है?",
        options: [{
            text: "Always",
            hi: "हमेशा",
            score: 0
        }, {
            text: "Sometimes",
            hi: "कभी-कभी",
            score: 0
        }, {
            text: "Rarely",
            hi: "शायद ही कभी",
            score: 0
        }]
    }, {
        question: "What according to you is causing you to finish quickly?",
        hi: "आपके अनुसार आपके जल्दी चरम सीमा पर पहुँचने का क्या कारण है?",
        options: [{
            text: "High Sensitivity",
            hi: "अत्यधिक संवेदनशीलता",
            score: 0
        }, {
            text: "Anxiety",
            hi: "चिंता/घबराहट",
            score: 1
        }, {
            text: "Both",
            hi: "दोनों",
            score: 2
        }, {
            text: "I do not know",
            hi: "मुझे नहीं पता",
            score: 4
        }]
    }, {
        question: "What is your ejaculation timing while performing the intercourse?",
        hi: "संबंध बनाने के दौरान आपके स्खलन का समय क्या है?",
        options: [{
            text: "Less than 1 minute",
            hi: "1 मिनट से कम",
            score: 10
        }, {
            text: "1-5 minutes",
            hi: "1-5 मिनट",
            score: 8
        }, {
            text: "5-10 minutes",
            hi: "5-10 मिनट",
            score: 5
        }, {
            text: "More than 10 minutes",
            hi: "10 मिनट से अधिक",
            score: 3
        }]
    }, {
        question: "For how long have you has this condition?",
        hi: "आपको यह समस्या कितने समय से है?",
        options: [{
            text: "Less than a month",
            hi: "एक महीने से कम",
            score: 2
        }, {
            text: "Less than 6 months",
            hi: "6 महीने से कम",
            score: 3
        }, {
            text: "6 months - 1 year",
            hi: "6 महीने - 1 साल",
            score: 4
        }, {
            text: "1 year+",
            hi: "1 साल से अधिक",
            score: 5
        }]
    },],
};
const lifestyleQuestions = [{
    question: "How frequently do you consume cigarettes, alcohol, or similar substances on a daily basis?",
    hi: "आप दैनिक आधार पर सिगरेट, शराब या इसी तरह के पदार्थों का कितनी बार सेवन करते हैं?",
    options: [{
        text: "Very Frequently",
        hi: "बहुत बार",
        score: 10
    }, {
        text: "Frequently",
        hi: "अक्सर",
        score: 8
    }, {
        text: "Sometimes",
        hi: "कभी-कभी",
        score: 5
    }, {
        text: "Rarely",
        hi: "शायद ही कभी",
        score: 3
    }, {
        text: "Never",
        hi: "कभी नहीं",
        score: 0
    },],
}, {
    question: "Do you have any of the following health issues? If yes, tick those apply.",
    hi: "क्या आपको निम्नलिखित में से कोई स्वास्थ्य समस्या है? यदि हाँ, तो उन पर टिक करें जो आप पर लागू होती हैं।",
    multiple: true,
    options: [{
        text: "Heart Problem",
        hi: "दिल की समस्या",
        score: 2
    }, {
        text: "Blood Pressure",
        hi: "रक्तचाप (BP)",
        score: 2
    }, {
        text: "Diabetes",
        hi: "मधुमेह (शुगर)",
        score: 2
    }, {
        text: "High Cholesterol",
        hi: "हाई कोलेस्ट्रॉल",
        score: 2
    }, {
        text: "Thyroid Issues",
        hi: "थायराइड की समस्या",
        score: 2
    }, {
        text: "None",
        hi: "कोई नहीं",
        score: 0
    },],
},];
const timelineData = {
    ed: [{
        month: "Month 1",
        hi: "महीना 1",
        timelineDesc: "Improved erection, better mood, reduced fatigue",
        hiDesc: "इरेक्शन में सुधार, बेहतर मूड, थकान में कमी"
    }, {
        month: "Month 3",
        hi: "महीना 3",
        timelineDesc: "Restored sexual normalcy, better confidence levels",
        hiDesc: "यौन सामान्यता बहाल, आत्मविश्वास के स्तर में सुधार"
    }, {
        month: "Month 6",
        hi: "महीना 6",
        timelineDesc: "Confident sexual function, better energy levels",
        hiDesc: "आत्मविश्वासपूर्ण यौन कार्य, बेहतर ऊर्जा स्तर"
    },],
    pe: [{
        month: "Month 1",
        hi: "महीना 1",
        timelineDesc: "Improved ejaculation control, reduced anxiety",
        hiDesc: "स्खलन नियंत्रण में सुधार, चिंता में कमी"
    }, {
        month: "Month 3",
        hi: "महीना 3",
        timelineDesc: "Consistent control, higher sexual satisfaction",
        hiDesc: "लगातार नियंत्रण, उच्च यौन संतुष्टि"
    }, {
        month: "Month 6",
        hi: "महीना 6",
        timelineDesc: "Stable ejaculation control without anxiety",
        hiDesc: "बिना चिंता के स्थिर स्खलन नियंत्रण"
    },],
    both: [{
        month: "Month 1",
        hi: "महीना 1",
        timelineDesc: "Improved erection quality and ejaculation control, reduced anxiety",
        hiDesc: "इरेक्शन की गुणवत्ता और स्खलन नियंत्रण में सुधार, चिंता में कमी"
    }, {
        month: "Month 3",
        hi: "महीना 3",
        timelineDesc: "Restored normal sexual performance, enhanced emotional intimacy",
        hiDesc: "सामान्य यौन प्रदर्शन बहाल, बढ़ी हुई भावनात्मक आत्मीयता"
    }, {
        month: "Month 6",
        hi: "महीना 6",
        timelineDesc: "Complete control, minimal dependence on meds, high confidence",
        hiDesc: "पूर्ण नियंत्रण, दवाओं पर न्यूनतम निर्भरता, उच्च आत्मविश्वास"
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
    "For how long have you has this condition?": {
        "Less than a month": "Psychological triggers, lifestyle factors, hormonal fluctuation, relationship dynamics",
        "Less than 6 months": "Psychological triggers, poor sleep, substance use, hormonal imbalances, relationship issues",
        "6 months - 1 year": "Stress & depression, chronic medical or neurological conditions, erectile dysfunction",
        "1 year +": "Stress & depression, chronic medical or neurological conditions, erectile dysfunction, infrequent sex, substance use",
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
const detailedFutureRisks = {
    ed: [
        { en: 'Loss of libido', hi: 'कामेच्छा में कमी' },
        { en: 'Relationship strain', hi: 'रिश्तों में तनाव' },
        { en: 'Impotency (untreated ED)', hi: 'नपुंसकता (अनुपचारित ED)' },
        { en: 'Risk of irreversible vascular and neurological damage', hi: 'अपरिवर्तनीय संवहनी और न्यूरोलॉजिकल क्षति का जोखिम' },
        { en: 'Chronic depression', hi: 'पुरानी अवसाद (Depression)' }
    ],
    pe: [
        { en: 'Escalation to secondary erectile dysfunction due to psychological stress', hi: 'मनोवैज्ञानिक तनाव के कारण माध्यमिक इरेक्टाइल डिसफंक्शन में वृद्धि' },
        { en: 'Relationship strain and partner frustration', hi: 'रिश्ते में तनाव और साथी की हताशा' },
        { en: 'Avoidance of intimacy', hi: 'आत्मीयता से बचाव' },
        { en: 'Lower self-esteem and increased performance anxiety over time', hi: 'समय के साथ कम आत्मविश्वास और बढ़ी हुई परफॉरमेंस की चिंता' }
    ],
    both: [
        { en: 'Escalation to complete sexual dysfunction', hi: 'पूर्ण यौन रोग में वृद्धि' },
        { en: 'Long-term hormonal dysregulation', hi: 'दीर्घकालिक हार्मोनल अनियमितता' },
        { en: 'Risk of psychosomatic disorders (chronic fatigue, insomnia, substance abuse)', hi: 'साइकोसोमैटिक विकारों का जोखिम (पुरानी थकान, अनिद्रा, नशीली दवाओं का दुरुपयोग)' },
        { en: 'Isolation, social withdrawal, and reduced quality of life', hi: 'अलगाव, सामाजिक वापसी, और जीवन की गुणवत्ता में कमी' },
        { en: 'Chronic depression', hi: 'पुरानी अवसाद (Depression)' },
        { en: 'Relationship conflicts', hi: 'रिश्तों में टकराव' }
    ]
};
const questionnaireConfig = {
    id: 'mens-wellness',
    staticSteps: 2,
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
            hi: "वह समस्या चुनें जिसका आप सामना कर रहे हैं - हम आपकी मदद के लिए यहाँ हैं",
            options: [{
                text: "Erectile Dysfunction (ED)",
                hi: "इरेक्टाइल डिसफंक्शन (ED)",
                score: 0,
                key: 'ed'
            }, {
                text: "Premature Ejaculation (PE)",
                hi: "शीघ्रपतन (PE)",
                score: 0,
                key: 'pe'
            }, {
                text: "Both",
                hi: "दोनों",
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
        if (healthScore <= 30) return "critical-risk";
        if (healthScore > 30 && healthScore <= 60) return "high-risk";
        if (healthScore > 60 && healthScore <= 84) return "moderate-risk";
        return "low-risk";
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
        const rawConcern = allAnswers.concern?.[0]?.text || 'ed';
        const concernLower = rawConcern.toLowerCase();
        
        // Bilingual aware concern matching
        let concernKey = 'ed';
        if (concernLower.includes('both') || concernLower.includes('दोनों')) {
            concernKey = 'both';
        } else if (concernLower.includes('pe') || concernLower.includes('शीघ्रपतन')) {
            concernKey = 'pe';
        } else if (concernLower.includes('ed') || concernLower.includes('इरेक्टाइल')) {
            concernKey = 'ed';
        }

        let issueTitle = '';
        let issueTitleHi = '';
        let baseText = '';
        let baseTextHi = '';
        
        if (concernKey === 'both') {
            issueTitle = "Erectile Dysfunction + Premature Ejaculation";
            issueTitleHi = "इरेक्टाइल डिसफंक्शन + शीघ्रपतन";
            baseText = "You’ve indicated concerns about both ED and PE. A comprehensive plan can help improve overall performance";
            baseTextHi = "आपने ED और PE दोनों के बारे में चिंता जताई है। एक व्यापक योजना समग्र प्रदर्शन को बेहतर बनाने में मदद कर सकती है";
        } else if (concernKey === 'pe') {
            issueTitle = "Premature Ejaculation";
            issueTitleHi = "शीघ्रपतन (Premature Ejaculation)";
            baseText = "Premature Ejaculation may be managed through specialized exercises, counseling, or medications";
            baseTextHi = "शीघ्रपतन को विशेष व्यायाम, परामर्श या दवाओं के माध्यम से प्रबंधित किया जा सकता है";
        } else {
            issueTitle = "Erectile Dysfunction";
            issueTitleHi = "इरेक्टाइल डिसफंक्शन (ED)";
            baseText = "Erectile Dysfunction can often be improved with medication, lifestyle changes, and therapy";
            baseTextHi = "इरेक्टाइल डिसफंक्शन को अक्सर दवा, जीवनशैली में बदलाव और थेरेपी के साथ सुधारा जा सकता है";
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

        // Generate Shopify Cart URL
        const generateCartUrl = (products) => {
            if (!products || products.length === 0) return "";
            const baseUrl = "https://sehatup.com/cart/";
            const items = products.map(p => {
                const variantId = p.variantId || "";
                const qty = p.qty || 1;
                return variantId ? `${variantId}:${qty}` : "";
            }).filter(item => item !== "");
            
            if (items.length === 0) return "";
            return `${baseUrl}${items.join(",")}?storefront=true`;
        };

        const cartUrl = generateCartUrl(activeProducts);

        const data = {
            reportDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
            userName: userInfo.name,
            dob: userInfo.dob,
            phone: userInfo.phone,
            healthScore: computedHealthScore,
            reportCategory: "Mens Sexual Wellness",
            questionnaireId: config.id,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            cartUrl: cartUrl,
            recommendedProducts: activeProducts.map(p => ({
                name: p.name,
                handle: p.handle || '',
                variantId: p.variantId || '',
                salePrice: p.salePrice,
                image: p.image,
                qty: p.qty || 1,
                active: true
            })),
            // Critical Fields for Report Templates (rT.html)
            ...results,
            allAnswers: allAnswers
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