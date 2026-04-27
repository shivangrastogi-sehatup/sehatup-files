/**
 * Internal Helper Functions
 * These are helper utilities for the main logic functions.
 */

// Calculates age from a 'YYYY-MM-DD' date string
const _calculateAge = (dobString) => {
    if (!dobString) return 0;
    const dob = new Date(dobString);
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
};

// Calculates BMI
const _calculateBmi = (height, weight) => {
    if (!height || !weight || height === 0 || weight === 0) return 0;
    const heightInMeters = parseFloat(height) / 100;
    return parseFloat(weight) / (heightInMeters * heightInMeters);
};

// Gets BMI classification string
const _getBmiClass = (bmi) => {
    if (bmi < 18.5) return "Underweight";
    if (bmi <= 24.9) return "Normal weight";
    if (bmi <= 29.9) return "Overweight";
    if (bmi <= 34.9) return "Obese Class I";
    if (bmi <= 34.9) return "Obese Class I";
    if (bmi <= 39.9) return "Obese Class II";
    return "Obese Class III";
};

// Helper to check for answers (single and multi-select)
const _hasAnswer = (allAnswers, groupKey, answerText) => {
    const group = allAnswers[groupKey];
    if (!group) return false;
    const lowerAnswerText = answerText.toLowerCase();

    return group.some(answer => {
        if (Array.isArray(answer.text)) {
            // Multi-select
            return answer.text.some(text => String(text).toLowerCase().includes(lowerAnswerText));
        } else {
            // Single-select
            return String(answer.text).toLowerCase().includes(lowerAnswerText);
        }
    });
};

/**
 * Main Questionnaire Configuration Object
 */
const questionnaireConfig = {
    id: 'womens-weight',
    reportCategory: "Womens Weight Management",

    /**
     * QUESTION GROUPS
     * This section defines all questions for each step.
     */
    questionGroups: [
        {
            step: 3,
            key: 'health',
            questions: [
                {
                    question: "Tick that applies for you (For long-term weight control)",
                    options: [
                        { text: "I definitely will not be able to devote 30 minutes daily to weight control.", score: 0 },
                        { text: "I'm not sure if I can find 30 minutes daily for weight control.", score: 0 },
                        { text: "I think I can probably find 30 minutes daily for weight control", score: 0 },
                        { text: "I can definitely find 30 minutes daily for weight control", score: 0 },
                        { text: "I can devote more than 30 minutes daily to weight control", score: 0 },
                    ],
                },
                {
                    question: "What is your primary weight loss goal?",
                    options: [
                        { text: "fat loss", score: 0 },
                        { text: "toning", score: 0 },
                        { text: "increased energy", score: 0 },
                        { text: "improved hormonal balance", score: 0 },
                        { text: "others, please specify", score: 0 },
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
                    options: [
                        { text: "Sedentary (little or no exercise)", score: 10 },
                        { text: "Lightly active (1-3 days/week exercise)", score: 6 },
                        { text: "Moderately active (4-5 days/week exercise)", score: 3 },
                        { text: "Very active (daily exercise or physical job)", score: 0 },
                    ],
                },
                {
                    question: "During the past 6 months my weight has increased by.",
                    options: [
                        { text: "1-3Kg", score: 0 },
                        { text: "3-6Kg", score: 3 },
                        { text: "6-10Kg", score: 6 },
                        { text: "More than 10kg", score: 10 },
                    ],
                },
                {
                    question: "Which body type do you identify with?",
                    options: [
                        { text: "Normal weight", score: 1 },
                        { text: "Over weight", score: 3 },
                        { text: "Obese class 1", score: 6 },
                        { text: "Obese class 2", score: 8 },
                        { text: "Obese class 3", score: 15 },
                    ],
                },
                {
                    question: "How many hours do you sleep daily?",
                    options: [
                        { text: "Less than 5 hours", score: 6 },
                        { text: "5-6 hours", score: 3 },
                        { text: "7-8 hours", score: 1 },
                        { text: "More than 8 hours", score: 10 },
                    ],
                },
                {
                    question: "How often do you consume processed/junk food?",
                    options: [
                        { text: "Rarely", score: 1 },
                        { text: "Occasionally (1-2 times a week)", score: 3 },
                        { text: "Frequently (3-5 times a week)", score: 6 },
                        { text: "Daily", score: 10 },
                    ],
                },
                {
                    question: "How often do you smoke or consume alcohol?",
                    options: [
                        { text: "Never", score: 1 },
                        { text: "rarely", score: 5 },
                        { text: "Occasionally ", score: 6 },
                        { text: "Frequently ", score: 10 },
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
                    multiple: true,
                    options: [
                        { text: "PCOS/PCOD", score: 2 },
                        { text: "Irregular periods", score: 2 },
                        { text: "Hypertension", score: 2 },
                        { text: "Diabetes", score: 2 },
                        { text: "Family history of obesity or metabolic disorders", score: 2 },
                        { text: "Digestive issues (IBS, Acidity, Constipation)", score: 2 },
                        { text: "Thyroid disorder", score: 2 },
                        { text: "None", score: 0 },
                    ],
                },
                {
                    question: "How often do you feel stressed?",
                    options: [
                        { text: "Rarely", score: 1 },
                        { text: "Sometimes", score: 3 },
                        { text: "Often", score: 6 },
                        { text: "Always", score: 10 },
                    ],
                },
                {
                    question: "Are you currently on birth control or hormone therapy?",
                    options: [
                        { text: "No", score: 1 },
                        { text: "Yes", score: 5 },
                    ],
                },
                {
                    question: "Have you recently been pregnant or breastfeeding?",
                    options: [
                        { text: "No", score: 1 },
                        { text: "Yes", score: 5 },
                    ],
                },
                {
                    question: "Do you have any history of pregnancy complications or significant weight gain during pregnancy?",
                    options: [
                        { text: "No", score: 5 },
                        { text: "Yes", score: 1 },
                    ],
                },
                {
                    question: "Do you experience emotional eating ?",
                    options: [
                        { text: "Never", score: 1 },
                        { text: "Rarely", score: 3 },
                        { text: "Sometimes", score: 5 },
                        { text: "Often", score: 10 },
                    ],
                },
                {
                    question: "What do you consider some of your barriers when it comes to managing your weight? (check all that apply)?",
                    multiple: true,
                    options: [
                        { text: "Hunger", score: 0 },
                        { text: "Cravings", score: 0 },
                        { text: "Fatigue", score: 0 },
                        { text: "Finances", score: 0 },
                        { text: "Time", score: 0 },
                        { text: "Boredom", score: 0 },
                        { text: "Stress", score: 0 },
                        { text: "Insomnia", score: 0 },
                        { text: "Socializing", score: 0 },
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
                    options: [
                        { text: "No", score: 0 },
                        { text: "Yes, but unsuccessful", score: 0 },
                        { text: "Yes, but regained weight", score: 0 },
                    ],
                },
                {
                    question: "Which weight loss method have you tried? (Select all that apply)",
                    multiple: true,
                    options: [
                        { text: "Dieting", score: 0 },
                        { text: "Exercise", score: 0 },
                        { text: "Supplements", score: 0 },
                        { text: "Ayurvedic/Homeopathic treatment", score: 0 },
                        { text: "Allopathic medication", score: 0 },
                        { text: "None", score: 0 },
                    ],
                },
                {
                    question: "Are you currently on any weight loss medication or supplement? (Select all that apply)",
                    multiple: true,
                    options: [
                        { text: "No", score: 0 },
                        { text: "Yes, allopathic", score: 0 },
                        { text: "Yes, ayurvedic", score: 0 },
                        { text: "Yes, homeopathic", score: 0 },
                    ],
                },
            ]
        },
    ],

    /**
     * DATA MAPPINGS
     */
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

    futureRisksMapping: {
        "How active are you daily?": {
            "Sedentary (little or no exercise)": "Increased risk of obesity, diabetes, cardiovascular diseases",
            "Lightly active (1-3 days/week exercise)": "Risk of gradual weight gain and lowered metabolism",
            "Moderately active (4-5 days/week exercise)": "Moderate risk if diet isn’t managed well",
            "Very active (daily exercise or physical job)": "Low risk helps in maintaining ideal weight",
        },
        "How often do you consume processed/junk food?": {
            "Rarely": "Low risk; continue maintaining healthy food habits.",
            "Occasionally (1-2 times a week)": "Can contribute to slow weight gain over time.",
            "Frequently (3-5 times a week)": "Leads to fat accumulation and insulin resistance.",
            "Daily": "High risk of obesity, metabolic syndrome, and fatty liver.",
        },
        "Do you experience any of the following? (Select all that apply)": {
            "PCOS/PCOD": "Increased risk of infertility and chronic weight retention.",
            "Irregular periods": "Can lead to obesity, mood changes, and menstrual issues.",
            "Hypertension": "Elevated risk of heart disease and stroke.",
            "Diabetes": "High risk of cardiovascular disease and organ complications.",
            "Family history of obesity or metabolic disorders": "Increased lifetime risk of obesity and diabetes.",
            "Digestive issues (IBS, Acidity, Constipation)": "Long-term gut inflammation and fatigue.",
            "Thyroid disorder": "Chronic fatigue and severe weight gain.",
            "None": "Encouraging sign; focus on lifestyle and nutrition.",
        },
        "How often do you feel stressed?": {
            "Rarely": "Minimal risk if overall lifestyle is balanced.",
            "Sometimes": "Can progress into chronic stress if unmanaged.",
            "Often": "Long-term stress may cause hormonal imbalance and fat gain.",
            "Always": "Long-term stress may cause hormonal imbalance and fat gain.",
        },
        "Are you currently on birth control or hormone therapy?": {
            "No": "Current weight patterns likely due to lifestyle or metabolism.",
            "Yes": "May lead to weight gain and mood swings if not monitored.",
        },
        "Do you experience emotional eating ?": {
            "Never": "Low risk from emotional triggers.",
            "Rarely": "Can evolve into a habit during high-stress periods.",
            "Sometimes": "Can promote fat gain and digestive distress.",
            "Often": "Increased risk of obesity and metabolic syndrome.",
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
                { month: "Month 1", timelineDesc: "Bloating, mood improve" },
                { month: "Month 3", timelineDesc: "Cycles begin regulating" },
                { month: "Month 6", timelineDesc: "Ovulation regularises" }
            ],
            "thyroid disorder": [
                { month: "Month 1", timelineDesc: "Morning energy rises" },
                { month: "Month 3", timelineDesc: "Focus, fatigue improve" },
                { month: "Month 6", timelineDesc: "Stable energy and mood" }
            ],
            "hypertension": [
                { month: "Month 1", timelineDesc: "Heaviness reduces" },
                { month: "Month 3", timelineDesc: "BP shows improvement" },
                { month: "Month 6", timelineDesc: "BP easier to manage" }
            ],
            "diabetes": [
                { month: "Month 1", timelineDesc: "Cravings reduce" },
                { month: "Month 3", timelineDesc: "Sugar response improves" },
                { month: "Month 6", timelineDesc: "Sugar levels stabilise" }
            ],
            "family history of obesity or metabolic disorders": [
                { month: "Month 1", timelineDesc: "Digestion improves" },
                { month: "Month 3", timelineDesc: "Belly fat begins reducing" },
                { month: "Month 6", timelineDesc: "Liver health, energy improve" }
            ],
            "obesity": [
                { month: "Month 1", timelineDesc: "Initial reduction in bloating, better energy, appetite and digestion." },
                { month: "Month 3", timelineDesc: "Visible inch loss, better sleep, sustained stamina and improved metabolic rhythm." },
                { month: "Month 6", timelineDesc: "Improved tone, weight, control over eating and energy, enhanced daily functioning." }
            ]
        },
        '25-60': {
            "pcos/pcod": [
                { month: "Month 1", timelineDesc: "Period discomfort reduces" },
                { month: "Month 3", timelineDesc: "Cycles get regular" },
                { month: "Month 6", timelineDesc: "PMS and mood swings ease" }
            ],
            "thyroid disorder": [
                { month: "Month 1", timelineDesc: "Sleep, bowels improve" },
                { month: "Month 3", timelineDesc: "Hair, weight improve" },
                { month: "Month 6", timelineDesc: "Skin, hair healthier" }
            ],
            "hypertension": [
                { month: "Month 1", timelineDesc: "Puffiness lessens" },
                { month: "Month 3", timelineDesc: "BP starts stabilising" },
                { month: "Month 6", timelineDesc: "BP becomes manageable" }
            ],
            "diabetes": [
                { month: "Month 1", timelineDesc: "Less fatigue after meals" },
                { month: "Month 3", timelineDesc: "Sugar control improves" },
                { month: "Month 6", timelineDesc: "Rare sugar dips" }
            ],
            "family history of obesity or metabolic disorders": [
                { month: "Month 1", timelineDesc: "Cravings begin decreasing" },
                { month: "Month 3", timelineDesc: "Digestion, bloating reduce" },
                { month: "Month 6", timelineDesc: "Liver and cholesterol improve" }
            ],
            "obesity": [
                { month: "Month 1", timelineDesc: "Appetite settles, reduced snacking, better digestion and sleep." },
                { month: "Month 3", timelineDesc: "Fat loss becomes visible, stamina rises, sleep deepens." },
                { month: "Month 6", timelineDesc: "Noticeable inch loss, better metabolism, alertness, and physical ease." }
            ]
        },
        '61-80': {
            "pcos/pcod": [
                { month: "Month 1", timelineDesc: "Acne, bloating ease" },
                { month: "Month 3", timelineDesc: "Periods more predictable" },
                { month: "Month 6", timelineDesc: "PMS manageable" },
            ],
            "thyroid disorder": [
                { month: "Month 1", timelineDesc: "Mood improves" },
                { month: "Month 3", timelineDesc: "Hair, focus better" },
                { month: "Month 6", timelineDesc: "Hormonal rhythm stable" },
            ],
            "hypertension": [
                { month: "Month 1", timelineDesc: "Puffiness reduces" },
                { month: "Month 3", timelineDesc: "BP readings stabilise" },
                { month: "Month 6", timelineDesc: "BP stays steady" },
            ],
            "diabetes": [
                { month: "Month 1", timelineDesc: "Sugar crashes decline" },
                { month: "Month 3", timelineDesc: "Sugar levels even out" },
                { month: "Month 6", timelineDesc: "Appetite remains balanced" },
            ],
            "family history of obesity or metabolic disorders": [
                { month: "Month 1", timelineDesc: "Junk cravings reduce" },
                { month: "Month 3", timelineDesc: "Fat shifts, digestion improves" },
                { month: "Month 6", timelineDesc: "Body lighter, more resilient" },
            ],
            "obesity": [
                { month: "Month 1", timelineDesc: "Light digestion, fewer cravings, mild sleep and energy improvement." },
                { month: "Month 3", timelineDesc: "Energy improves, movement feels easier, eating becomes structured." },
                { month: "Month 6", timelineDesc: "Better body tone, control over habits, lighter feeling." },
            ]
        },
        '81+': {
            "pcos/pcod": [
                { month: "Month 1", timelineDesc: "Skin, mood stable" },
                { month: "Month 3", timelineDesc: "Cycles consistent" },
                { month: "Month 6", timelineDesc: "PMS under control" },
            ],
            "thyroid disorder": [
                { month: "Month 1", timelineDesc: "Less daytime fatigue" },
                { month: "Month 3", timelineDesc: "Focus, alertness stable" },
                { month: "Month 6", timelineDesc: "Thyroid function steady" },
            ],
            "hypertension": [
                { month: "Month 1", timelineDesc: "Mood, puffiness balanced" },
                { month: "Month 3", timelineDesc: "BP remains controlled" },
                { month: "Month 6", timelineDesc: "BP under long-term control" },
            ],
            "diabetes": [
                { month: "Month 1", timelineDesc: "Cravings under control" },
                { month: "Month 3", timelineDesc: "Sugar control sustained" },
                { month: "Month 6", timelineDesc: "Appetite, sugar balanced" },
            ],
            "family history of obesity or metabolic disorders": [
                { month: "Month 1", timelineDesc: "Digestion remains smooth" },
                { month: "Month 3", timelineDesc: "Lipids, liver stay normal" },
                { month: "Month 6", timelineDesc: "Long-term wellness sustained" },
            ],
            "obesity": [
                { month: "Month 1", timelineDesc: "Weight stable, digestion light, energy and food control consistent." },
                { month: "Month 3", timelineDesc: "Agility improves, immune recovery and tone maintained." },
                { month: "Month 6", timelineDesc: "Metabolism, body shape, and stamina stay balanced and sustained." },
            ]
        }
    },

    /**
     * LOGIC & RULES
     */
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
        const hasHealthConditions = (allAnswers.medical || []).some(ans => ans.score > 0 && ans.text !== 'None');

        let issueTitle = bmiClass;
        const medicalAnswersText = (allAnswers.medical || []).flatMap(ans =>
            Array.isArray(ans.text) ? ans.text.map(t => t.toLowerCase()) : [String(ans.text).toLowerCase()]
        );

        if (medicalAnswersText.includes("diabetes")) issueTitle += " + Metabolic Dysfunction";
        if (medicalAnswersText.includes("hypertension")) issueTitle += " + Hypertension";
        if (medicalAnswersText.includes("pcos/pcod")) issueTitle += " + Hormonal Imbalance";
        if (medicalAnswersText.includes("thyroid disorder")) issueTitle += " + Thyroid Dysfunction";

        let conditionTextHTML = "";
        if (score < 25) {
            conditionTextHTML = "<p>Your health metrics indicate a need for major lifestyle changes and a SEHAT UP doctor-guided program.</p>";
        } else if (score <= 60) {
            conditionTextHTML = "<p>You need focused lifestyle correction, balanced meals, and targeted support for your conditions.</p>";
        } else if (score <= 80) {
            conditionTextHTML = "<p>You’re doing better, but still need discipline in eating habits and regular physical activity.</p>";
        } else {
            conditionTextHTML = "<p>Great job! Just focus on sustaining your healthy routine and staying consistent.</p>";
        }

        let futureRisks = [];
        let possibleCauses = [];
        for (const groupKey in allAnswers) {
            allAnswers[groupKey].forEach(answer => {
                // Future Risks
                const qRisks = config.futureRisksMapping[answer.question];
                if (qRisks) {
                    const texts = Array.isArray(answer.text) ? answer.text : [answer.text];
                    texts.forEach(text => {
                        const risk = qRisks[text];
                        if (risk && !futureRisks.includes(risk)) futureRisks.push(risk);
                    });
                }
                // Possible Causes
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

        const baseTimeline = (timelineData[scoreBracket] && timelineData[scoreBracket]["obesity"]) || [];
        baseTimeline.forEach(item => { if (timelineDescMap[item.month] !== undefined) timelineDescMap[item.month] = item.timelineDesc; });

        medicalAnswersText.forEach(conditionKey => {
            const conditionTimeline = (timelineData[scoreBracket] && timelineData[scoreBracket][conditionKey.toLowerCase()]);
            if (conditionTimeline) {
                conditionTimeline.forEach(item => {
                    if (timelineDescMap[item.month] !== undefined) {
                        const existing = timelineDescMap[item.month];
                        timelineDescMap[item.month] = existing ? `${existing}, ${item.timelineDesc.toLowerCase()}` : item.timelineDesc;
                    }
                });
            }
        });

        const finalTimeline = Object.entries(timelineDescMap).map(([month, timelineDesc]) => ({ month, timelineDesc }));

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
            conditionTextHTML,
            futureRisks,
            possibleCauses,
            timelineData: { general: finalTimeline, extras: [] },
            lifestyleConditions: [...new Set(lifestyleConditions)]
        };
    },

    saveSubmission: async (state, db, config) => {
        const { userInfo, healthMetrics, allAnswers, results, recommendedProducts, healthScore } = state;
        const activeProducts = (recommendedProducts || []).filter(p => p.active);

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
            userName: userInfo.name || '',
            phone: userInfo.phone || '',
            dob: userInfo.dob || '',
            reportDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
            healthScore: healthScore,
            issueTitle: results.issueTitle || '',
            reportCategory: "Womens Weight Management",
            height: Number(healthMetrics.height) || 0,
            currentWeight: Number(healthMetrics.currentWeight) || 0,
            targetWeight: Number(healthMetrics.targetWeight) || 0,
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
            // Critical Fields for rT.html & Prescription Editor
            ...results,
            allAnswers: allAnswers
        };

        try {
            console.log("Saving final submission to 'questionnaire_submissions':", data);
            const docRef = await db.collection('questionnaire_submissions').add(data);
            console.log("✅ Submission saved with ID:", docRef.id);
            return docRef.id;
        } catch (e) {
            console.error('❌ Error saving to Firebase:', e);
            throw e;
        }
    }
};