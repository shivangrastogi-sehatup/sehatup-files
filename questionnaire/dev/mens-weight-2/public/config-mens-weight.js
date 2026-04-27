// assets/config-womens-weight.js (CORRECTED)
const questionnaireConfig = {
    id: 'mens-weight',
    staticSteps: 2,

    questionGroups: [
        {
            step: 3,
            key: 'Health',
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
                        { text: "Lose 1-5 kg", score: 0 },
                        { text: "Lose 5-10 kg", score: 0 },
                        { text: "Lose more than 10 kg", score: 0 },
                    ],
                },
                {
                    question: "Why do you want to lose weight?",
                    options: [
                        { text: "health reasons", score: 0 },
                        { text: "improved looks", score: 0 },
                        { text: "more energy", score: 0 },
                        { text: "doctor advice", score: 0 },
                        { text: "others, please specify", score: 0 },
                    ],
                },
            ],
        },
        {
            step: 4,
            key: 'lifestyle',
            questions: [
                {
                    question:
                        "How active are you daily?",
                    options: [
                        { text: "Sedentary (little or no exercise)", score: 20 },
                        { text: "Lightly active (1-3 days/week exercise)", score: 15 },
                        { text: "Moderately active (4-5 days/week exercise)", score: 10 },
                        { text: "Very active (daily exercise or physical job)", score: 5 },
                    ],
                },
                {
                    question:
                        "During the past 6 months my weight has increased by.",
                    options: [
                        { text: "1-3Kg", score: 1 },
                        { text: "3-6Kg", score: 3 },
                        { text: "6-10Kg", score: 5 },
                        { text: "More than 10kg", score: 10 },
                    ],
                },
                {
                    question:
                        "Which body type do you identify with?",
                    options: [
                        { text: "Normal weight", score: 1 },
                        { text: "Over weight", score: 5 },
                        { text: "Obese class 1", score: 10 },
                        { text: "Obese class 2", score: 15 },
                        { text: "Obese class 3", score: 20 },
                    ],
                },
                {
                    question:
                        "How many hours do you sleep daily?",
                    options: [
                        { text: "Less than 5 hours", score: 1 },
                        { text: "5-6 hours", score: 10 },
                        { text: "7-8 hours", score: 6 },
                        { text: "More than 8 hours", score: 3 },
                    ],
                },
                {
                    question:
                        "How often do you consume processed/junk food?",
                    options: [
                        { text: "Rarely", score: 1 },
                        { text: "Occasionally (1-2 times a week)", score: 3 },
                        { text: "Frequently (3-5 times a week)", score: 6 },
                        { text: "Daily", score: 10 },
                    ],
                },
                {
                    question:
                        "How often do you smoke or consume alcohol?",
                    options: [
                        { text: "Never", score: 1 },
                        { text: "rarely", score: 5 },
                        { text: "Occasionally ", score: 6 },
                        { text: "Frequently ", score: 10 },
                    ],
                },
            ],
        },
        {
            step: 5,
            key: 'medical',
            questions: [
                {
                    question:
                        "Do you experience any of the following? (Select all that apply)",
                    multiple: true,
                    options: [
                        { text: "Erectile Dysfunction", score: 2 },
                        { text: "Thyroid Disorder", score: 2 },
                        { text: "Hypertension", score: 2 },
                        { text: "Diabetes ", score: 2 },
                        { text: "Family history of obesity or metabolic disorders", score: 2 },
                        { text: "Digestive Issues (IBS, Acidity, Constipation)", score: 2 },
                        { text: "High Cholesterol", score: 2 },
                        { text: "None ", score: 0 },
                    ],
                },
                {
                    question:
                        "How often do you feel stressed?",
                    options: [
                        { text: "Rarely", score: 1 },
                        { text: "Sometimes ", score: 3 },
                        { text: "Often ", score: 6 },
                        { text: "Always", score: 10 },
                    ],
                },
                {
                    question:
                        "Do you experience emotional eating ?",
                    options: [
                        { text: "Never", score: 1 },
                        { text: "Rarely", score: 3 },
                        { text: "Sometimes", score: 10 },
                        { text: "Often", score: 20 },
                    ],
                },
                {
                    question:
                        "What do you consider some of your barriers when it comes to managing your weight? (check all that apply)?",
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
            ],
        },
        {
            step: 6,
            key: 'Weight Loss',
            questions: [
                {
                    question:
                        "Have you tried weight loss before?",
                    options: [
                        { text: "No", score: 0 },
                        { text: "Yes, but unsuccessful", score: 0 },
                        { text: "Yes, but regained weight", score: 0 },
                    ],
                },
                {
                    question:
                        "Which weight loss method have you tried? (Select all that apply)",
                    multiple: true,
                    options: [
                        { text: "Dieting", score: 0 },
                        { text: "Exercise ", score: 0 },
                        { text: "Supplements", score: 0 },
                        { text: "Ayurvedic/Homeopathic treatment", score: 0 },
                        { text: "Allopathic medication", score: 0 },
                        { text: "None", score: 0 },
                    ],
                },
                {
                    question:
                        "Are you currently on any weight loss medication or supplement? (Select all that apply)",
                    multiple: true,
                    options: [
                        { text: "No", score: 0 },
                        { text: "Yes, allopathic", score: 0 },
                        { text: "Yes, ayurvedic", score: 0 },
                        { text: "Yes, homeopathic", score: 0 },
                    ],
                },
            ],
        },
    ],

    productDatabase: window.productDatabase,
    causeMapping: {
        "How active are you daily?": {
            "Sedentary (little or no exercise)":
                "Sedentary lifestyle & lack of movement reduces calorie expenditure and leads to fat accumulation.",
            "Lightly active (1-3 days/week exercise)":
                "Light active exercises can help with minimal calorie burn. Not much enough to counter daily intake",
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
    futureRisksMapping: {
        "How active are you daily?": {
            "Sedentary (little or no exercise)":
                "Increased risk of obesity, diabetes, cardiovascular diseases",
            "Lightly active (1-3 days/week exercise)":
                "Risk of gradual weight gain and lowered metabolism",
            "Moderately active (4-5 days/week exercise)": "Moderate risk if diet isn’t managed well",
            "Very active (daily exercise or physical job)": "Low risk; helps in maintaining ideal weight",
        },
        "Which body type do you identify with?": {
            "Normal weight": "No future risk from body type alone",
            "Over weight": "Progression to obesity, increased risk of hypertension and diabetes",
            "Obese class 1": "Cardiovascular issues, sleep apnea, joint stress, metabolic syndrome",
            "Obese class 2": "High risk of diabetes, PCOS, fatty liver, infertility",
            "Obese class 3": "Critical risk of heart disease, stroke, osteoarthritis, mobility limitations",
        },
        "How often do you consume processed/junk food?": {
            "Rarely": "Low risk from this behavior; continue maintaining healthy food habits",
            "Occasionally (1-2 times a week)": "If not balanced with activity, can contribute to slow weight gain over time",
            "Frequently (3-5 times a week)": "Leads to fat accumulation, insulin resistance, and digestive issues",
            "Daily": "High risk of obesity, metabolic syndrome, fatty liver, and hormonal imbalance",
        },
        "Do you experience any of the following? (Select all that apply)": {
            "Erectile dysfunction": "Indicates systemic dysfunction, affects quality of life, emotional health",
            "thyroid disorder": "Chronic fatigue, infertility, severe weight gain, depression",
            "Hypertension": "Heart disease, kidney failure, stroke",
            "Diabetes": "Neuropathy, kidney damage, vision loss, obesity complications",
            "Family history of obesity or metabolic disorders": "Earlier onset of lifestyle diseases, weight gain despite effort",
            "Digestive issues (IBS, Acidity, Constipation)": "Nutritional deficiencies, chronic inflammation, fatigue",
            "high cholesterol": "Atherosclerosis, heart attacks, non-alcoholic fatty liver",
            "None": "Risk depends on habits; early prevention is key",
        },
        "How often do you feel stressed?": {
            "Rarely": "Minimal risk if overall lifestyle is balanced",
            "Sometimes": "Can progress into chronic stress or binge-eating patterns if unmanaged",
            "Often": "Long-term stress may cause emotional eating, hormonal imbalance, and fat gain",
            "Always ": "Long-term stress may cause emotional eating, hormonal imbalance, and fat gain",
        },
        "Do you experience emotional eating ?": {
            "Never": "No risk from emotional eating, though other causes may exist",
            "Rarely": "Possible future coping dependency, mild weight fluctuations",
            "Sometimes": "High risk of binge cycles, poor weight control, mood instability",
            "Often": "Chronic weight gain, eating disorders, anxiety, metabolic diseases",
        },
    },
    healthTimelineData: {
        "<25": {
            "erectile dysfunction": [
                { month: "Month 1", timelineDesc: "May feel lighter, mild boost in stamina" },
                { month: "Month 3", timelineDesc: "Better sleep, reduced anxiety around intimacy" },
                { month: "Month 6", timelineDesc: "Increased stamina, better self-esteem" }
            ],
            "thyroid disorder": [
                { month: "Month 1", timelineDesc: "Slight increase in energy, early relief in fatigue" },
                { month: "Month 3", timelineDesc: "Confidence may improve, mood becomes more stable" },
                { month: "Month 6", timelineDesc: "TSH may improve; better energy, mood and control" }
            ],
            "hypertension": [
                { month: "Month 1", timelineDesc: "May feel calmer, less heaviness, better sleep" },
                { month: "Month 3", timelineDesc: "BP may start to settle, better daily rhythm" },
                { month: "Month 6", timelineDesc: "Noticeable BP control, better response to activity" }
            ],
            "diabetes": [
                { month: "Month 1", timelineDesc: "Sugar cravings may ease, energy steadier" },
                { month: "Month 3", timelineDesc: "Early improvements in glucose levels and weight" },
                { month: "Month 6", timelineDesc: "Insulin sensitivity improves, fatigue decreases" }
            ],
            "metabolic disorders": [
                { month: "Month 1", timelineDesc: "Reduced bloating and food sensitivity" },
                { month: "Month 3", timelineDesc: "Digestion and fat metabolism begin to stabilize" },
                { month: "Month 6", timelineDesc: "Weight and sugar balance feel more manageable" }
            ],
            "obesity": [
                { month: "Month 1", timelineDesc: "Reduced bloating and cravings" },
                { month: "Month 3", timelineDesc: "Weight loss becomes visible, better control" },
                { month: "Month 6", timelineDesc: "Significant fat loss, hormone balance, stamina boost" }
            ]
        },

        "25-60": {
            "erectile dysfunction": [
                { month: "Month 1", timelineDesc: "Less dependency on stimulants, mood uplift" },
                { month: "Month 3", timelineDesc: "More stamina, less anxiety around intimacy" },
                { month: "Month 6", timelineDesc: "Noticeable control and performance gains" }
            ],
            "thyroid disorder": [
                { month: "Month 1", timelineDesc: "Improved energy, lesser brain fog and lethargy" },
                { month: "Month 3", timelineDesc: "Mood stabilizes, mild hormonal balance begins" },
                { month: "Month 6", timelineDesc: "Sexual wellness and energy improve consistently" }
            ],
            "hypertension": [
                { month: "Month 1", timelineDesc: "Slight dip in pressure sensation or headaches" },
                { month: "Month 3", timelineDesc: "Better stress tolerance, early BP stability" },
                { month: "Month 6", timelineDesc: "BP patterns more stable, less effort fatigue" }
            ],
            "diabetes": [
                { month: "Month 1", timelineDesc: "Calmer digestion, slightly more energy" },
                { month: "Month 3", timelineDesc: "Weight and sugar readings may begin to shift" },
                { month: "Month 6", timelineDesc: "Fewer post-meal crashes, lighter and more energetic" }
            ],
            "metabolic disorders": [
                { month: "Month 1", timelineDesc: "Appetite and cravings begin to regulate" },
                { month: "Month 3", timelineDesc: "Cholesterol/sugar levels show positive trends" },
                { month: "Month 6", timelineDesc: "Digestion, weight, and inflammation improve" }
            ],
            "obesity": [
                { month: "Month 1", timelineDesc: "Appetite and mood begin to stabilize" },
                { month: "Month 3", timelineDesc: "Visible changes in weight and waistline" },
                { month: "Month 6", timelineDesc: "Fat loss more sustainable, better energy and control" }
            ]
        },

        "61-80": {
            "erectile dysfunction": [
                { month: "Month 1", timelineDesc: "More energetic mornings, better focus" },
                { month: "Month 3", timelineDesc: "Better control, increased morning stamina" },
                { month: "Month 6", timelineDesc: "Higher stamina and emotional control" }
            ],
            "thyroid disorder": [
                { month: "Month 1", timelineDesc: "Slight hormonal clarity, reduced sluggishness" },
                { month: "Month 3", timelineDesc: "TSH and thyroid functions begin to show balance" },
                { month: "Month 6", timelineDesc: "Hair, skin, and emotional health may improve" }
            ],
            "hypertension": [
                { month: "Month 1", timelineDesc: "BP may remain high but energy begins improving" },
                { month: "Month 3", timelineDesc: "BP stabilizes slowly, less dizziness/fatigue" },
                { month: "Month 6", timelineDesc: "Cardiovascular endurance builds up, better flow" }
            ],
            "diabetes": [
                { month: "Month 1", timelineDesc: "Less bloating, sugar crashes reduce" },
                { month: "Month 3", timelineDesc: "Glucose control better with consistent lifestyle" },
                { month: "Month 6", timelineDesc: "Long-term glucose stability and lower cravings" }
            ],
            "metabolic disorders": [
                { month: "Month 1", timelineDesc: "Improved digestion, easier hunger control" },
                { month: "Month 3", timelineDesc: "Weight loss trends begin showing steadily" },
                { month: "Month 6", timelineDesc: "Metabolism better tuned; cholesterol, sugar improve" }
            ],
            "obesity": [
                { month: "Month 1", timelineDesc: "Minor weight reduction, better digestion, controlled eating" },
                { month: "Month 3", timelineDesc: "Sustained energy and motivation to exercise may improve" },
                { month: "Month 6", timelineDesc: "Non-rebound fat loss and improved metabolic confidence" }
            ]
        },

        "81+": {
            "erectile dysfunction": [
                { month: "Month 1", timelineDesc: "Feeling in control, consistent energy" },
                { month: "Month 3", timelineDesc: "Healthier libido and natural confidence" },
                { month: "Month 6", timelineDesc: "Consistent energy, long-term wellness" }
            ],
            "thyroid disorder": [
                { month: "Month 1", timelineDesc: "Energy and mood stay balanced" },
                { month: "Month 3", timelineDesc: "Wellness and hormonal balance continue improving" },
                { month: "Month 6", timelineDesc: "Hormones well-managed, better skin/hair/weight" }
            ],
            "hypertension": [
                { month: "Month 1", timelineDesc: "Stable BP patterns, better alertness" },
                { month: "Month 3", timelineDesc: "Calmness in body, better focus and blood flow" },
                { month: "Month 6", timelineDesc: "Long-term BP control, endurance improves" }
            ],
            "diabetes": [
                { month: "Month 1", timelineDesc: "Reduced food swings, stable energy" },
                { month: "Month 3", timelineDesc: "Sugar balance maintained, more flexibility" },
                { month: "Month 6", timelineDesc: "Blood sugar levels under control, fatigue minimal" }
            ],
            "metabolic disorders": [
                { month: "Month 1", timelineDesc: "Digestion and metabolism feel consistent" },
                { month: "Month 3", timelineDesc: "Healthy weight and cholesterol become sustainable" },
                { month: "Month 6", timelineDesc: "Long-term stability in sugar, lipids, and digestion" }
            ],
            "obesity": [
                { month: "Month 1", timelineDesc: "Continued balance in weight and energy" },
                { month: "Month 3", timelineDesc: "Lifestyle habits tend to solidify; metabolism and mood remain stable" },
                { month: "Month 6", timelineDesc: "Maintenance of weight goals and prevention of imbalances" }
            ]
        }
    },
    // productWhyPoints: {
    //     "Leanor 60 mg": [
    //         "Helps you lose weight by blocking fat absorption from the food you eat."
    //     ],
    //     "Ignite Fat Burner": [
    //         "Burns stubborn fat (especially belly)",
    //         "Controls appetite and cravings",
    //         "Boosts metabolism and energy",
    //         "Helps in sugar and insulin balance",
    //     ],
    //     "Metabolic Multivitamin": [
    //         "Speed up metabolism and help burn more calories.",
    //         "Cut bloating and improve digestion.",
    //         "Reduce sugar cravings and support fat breakdown.",
    //         "Keep your gut healthy, which helps with weight control.",
    //         "Keep your energy high while dieting."
    //     ],
    //     "Slimtox Tea": [
    //         "Boost fat burning and reduce appetite.",
    //         "Control sugar cravings and improve digestion.",
    //         "Gently cleanse the body and reduce bloating.",
    //         "Help you relax and reduce stress eating.",
    //         "Support heart health and reduce inflammation.",
    //         "Support metabolism and hormonal balance.",
    //     ],
    //     "Garcinia Cambogia": [
    //         "Natural fruit extract that helps you eat less, burn fat, and stop cravings.",
    //     ],
    //     "Valora": [
    //         "Support energy, digestion, and fat metabolism.",
    //         "Fight tiredness so you stay active.",
    //         "Help with sugar control and reduce cravings.",
    //         "Balance female hormones (great for PCOS, menopause).",
    //         "Boosts energy and metabolism naturally.",
    //         "Supports cell health and reduces inflammation.",
    //     ],

    //     "Slimtox Energy Tea": [
    //         "Boost fat burning and metabolism.",
    //         "Cut bloating and sugar cravings.",
    //         "Help control blood sugar and reduce sweet cravings.",
    //         "Lower stress, which helps stop emotional eating.",
    //         "Improve digestion and reduce inflammation.",
    //     ],
    //     "Thyroidinum 3X": [
    //         "Optimizes thyroid function which often causes unexplained weight gain.",
    //         "Boosts metabolic rate to help the body burn more calories.",
    //         "Reduces fatigue and lethargy, enabling higher activity levels.",
    //     ],
    // },

    lifestyleTips: {
        "GENERAL": [
            "Never skip your first meal—delayed or skipped breakfast can lead to belly fat and insulin resistance.",
            "Avoid calorie drinks—replace juices, energy drinks, and even smoothies with plain or lemon water.",
            "Combine carbs with protein—never eat carbs alone to avoid fat storage (e.g., roti with dal or paneer).",
            "Start meals with fiber—have raw salads or soaked nuts before meals to prevent sugar spikes.",
            "Maintain a 'metabolic window'—finish dinner at least 3 hours before bedtime for better fat metabolism.",
            "Stand up every 45 minutes—long sitting reduces testosterone and lymphatic flow. Take micro-breaks.",
        ],

        "erectile dysfunction": [
            "Avoid alcohol, smoking, and fried food.",
            "Include zinc-rich foods: seeds, nuts, eggs, and greens.",
            "Walk daily to improve circulation and stamina.",
            "Ensure 7–8 hours of uninterrupted sleep.",
        ],

        "thyroid disorder": [
            "Use iodized salt and eat whole grains, eggs, and dairy.",
            "Avoid excess soy, processed foods, and erratic meal times.",
            "Eat at regular intervals every 3–4 hours.",
            "Sleep and wake at fixed times to support hormonal rhythm.",
        ],

        "hypertension": [
            "Limit salt; avoid pickles, papads, and processed snacks.",
            "Include potassium-rich foods: banana, spinach, tomatoes.",
            "Restrict tea/coffee to 1–2 cups per day.",
            "Walk daily and practice deep breathing exercises.",
        ],

        "diabetes": [
            "Eat small, frequent meals with whole grains and vegetables.",
            "Avoid sweets, fruit juices, white rice, and refined flour.",
            "Walk 10–15 minutes after meals.",
            "Monitor blood sugar if advised.",
        ],

        "family history of obesity or metabolic disorders": [
            "Avoid long gaps between meals and late dinners.",
            "Focus on homemade, low-oil meals with balanced portions.",
            "Stay active throughout the day, not just during workouts.",
            "Limit sugar, refined carbs, and processed snacks.",
        ],
        "digestive issues (ibs, acidity, constipation)": [
            "Eat slowly and chew food thoroughly.",
            "Avoid spicy, oily, and very cold or hot foods.",
            "Use soaked raisins, jeera/ajwain water for gut support.",
            "Walk after meals to ease digestion and reduce bloating.",
        ],
    },

    /**
     * ALL LOGIC & RULES - COMBINED QUESTION SCORE + BMI DEDUCTION
     */
    calculateScore: (allAnswers, userInfo, config) => {
        let totalQuestionScore = 0;
        let maxPossibleQuestionScore = 0;

        // 1. Calculate Total Score from Questions
        for (const groupKey in allAnswers) {
            allAnswers[groupKey].forEach(answer => {
                const questionConfig = config.questionGroups
                    .find(g => g.key === groupKey)?.questions
                    .find(q => q.question === answer.question);

                if (questionConfig) {
                    let maxQuestionScore = 0;

                    if (questionConfig.multiple) {
                        // Max score for multi-select is the sum of all POSSIBLE non-zero option scores
                        maxQuestionScore = questionConfig.options.filter(opt => opt.score > 0).reduce((sum, opt) => sum + opt.score, 0);

                        // Accumulate score for selected options
                        if (Array.isArray(answer.text)) {
                            answer.text.forEach(selectedText => {
                                const selectedOption = questionConfig.options.find(opt => opt.text === selectedText);
                                if (selectedOption) {
                                    totalQuestionScore += selectedOption.score;
                                }
                            });
                        }
                    } else {
                        // Max score for single-select is just the highest score of any option
                        maxQuestionScore = questionConfig.options.reduce((max, option) => Math.max(max, option.score), 0);

                        // Accumulate score for selected option
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

        // --- 2. Normalize Risk using only Question Score ---

        // Base max risk is now only maxPossibleQuestionScore (approx 109 based on current scores)
        const BASE_SCORE_MAX_RISK = maxPossibleQuestionScore > 0 ? maxPossibleQuestionScore : 110;

        const totalRiskScore = totalQuestionScore;

        // Health Score = 100 * (1 - (Actual Risk / Max Risk))
        const healthScore = 100 * (1 - (totalRiskScore / BASE_SCORE_MAX_RISK));

        return Math.max(0, Math.min(100, Math.round(healthScore)));
    },

    productRules: (score, allAnswers, productDatabase, userInfo, config) => {
        const answers = allAnswers;
        let productNames = new Set();
        const bmi = userInfo?.bmi || 22;

        // Helper function to check if an answer containing 'text' was selected in 'groupKey'
        const checkAnswer = (groupKey, text) => {
            return answers[groupKey]?.some(
                (a) => Array.isArray(a.text)
                    ? a.text.some(t => String(t).toLowerCase().includes(text.toLowerCase()))
                    : String(a.text).toLowerCase().includes(text.toLowerCase())
            ) || false;
        };

        // Helper function to get answers for a specific question (used for multi-select and flags)
        const getAnswerTexts = (groupKey, questionText) => {
            const answerObj = answers[groupKey]?.find(a => a.question.includes(questionText));
            if (!answerObj) return [];
            return Array.isArray(answerObj.text) ? answerObj.text : [answerObj.text];
        };

        // --- 1. Core Product Logic based on Score Tiers ---

        if (score < 25) {
            // score : <25
            productNames.add('Leanor 60 mg');
            productNames.add('Ignite Fat Burner');
            productNames.add('Metabolic Multivitamin');
            productNames.add('Slimtox Tea');
            // Garcinia Cambogia (if female, PCOS) is ignored for this men's questionnaire.
        } else if (score >= 25 && score <= 60) {
            // score : 25-60
            productNames.add('Ignite Fat Burner');
            productNames.add('Garcinia Cambogia');
            productNames.add('Slimtox Tea');
            productNames.add('Metabolic Multivitamin');
            productNames.add('Leanor 60 mg');
            // Thyroidinum 3X is handled in the conditional section below.
        } else if (score >= 61 && score <= 80) {
            // score: 61-80
            productNames.add('Garcinia Cambogia');
            productNames.add('Slimtox Energy Tea');
            productNames.add('Metabolic Multivitamin');

            // Optional: Ignite (if belly fat, low energy)
            const isObeseOrHighRisk = bmi >= 30 || checkAnswer('lifestyle', 'Obese class 2') || checkAnswer('lifestyle', 'Obese class 3');
            const hasFatigue = getAnswerTexts('medical', 'What do you consider some of your barriers').some(text => text.toLowerCase().includes('fatigue'));

            if (isObeseOrHighRisk || hasFatigue) {
                productNames.add('Ignite Fat Burner');
            }
            // Optional: Leanor 60 mg
            if (bmi >= 30) {
                productNames.add('Leanor 60 mg');
            }
        } else if (score > 80) {
            // score: 81+
            productNames.add('Slimtox Tea');
            // Metabolic Multivitamin (optional) - Adding it by default but easily removable later if needed
            productNames.add('Metabolic Multivitamin');
        }

        // --- 2. Overriding/Additive Conditional Logic (Flags) ---

        const medicalConditions = getAnswerTexts('medical', 'Do you experience any of the following?');
        const barrierAnswers = getAnswerTexts('medical', 'What do you consider some of your barriers');

        // if hasComorbities then thyrodinium 3X, 
        // NOTE: Assuming "if hasComorbidities" in your request refers to the Thyroid Flag from the score section.
        // We will check for Thyroid Disorder specifically.
        const hasThyroid = medicalConditions.some(text => text.toLowerCase().includes('thyroid disorder'));
        if (hasThyroid) {
            // Using Thyroidinum 3X as proxy for Thyrodinium 3X (which isn't in your keys)
            productNames.add('Thyroidinum 3X');
        }

        // if hasCravings then Garcinia
        const hasCravings = barrierAnswers.some(text => text.toLowerCase().includes('cravings'));
        if (hasCravings) {
            productNames.add('Garcinia Cambogia');
        }

        // --- 3. Final Product Consolidation and Formatting ---
        const finalProductNames = [...productNames];

        const recommendedAndAvailableProducts = finalProductNames
            .map((name) => {
                const product = productDatabase[name];
                if (product && product.active === true) {
                    const correctName = name === 'Leanor 60' ? 'Leanor 60 mg' : name;
                    return { ...product, name: correctName, active: true };
                }
                return null;
            })
            .filter(Boolean); 

        return recommendedAndAvailableProducts;

        return finalProductNames.map((name) => {
            const product = productDatabase[name];
            if (product) {
                // Adjusting 'Leanor 60' mentions to the correct key 'Leanor 60 mg' if needed.
                const correctName = name === 'Leanor 60' ? 'Leanor 60 mg' : name;
                return { ...product, name: correctName, active: true };
            }
            return null;
        }).filter(Boolean);
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

        if (score < 25) baseIssue = 'Critical Metabolic Dysfunction & Weight Risk';
        else if (score <= 60) baseIssue = 'High Weight Management Risk (Hormonal Factors)';
        else if (score <= 80) baseIssue = 'Moderate Lifestyle Risk (Diet & Activity)';
        else baseIssue = 'Good Metabolic Health';

        let baseText = '';
        if (score < 25) baseText = `Your BMI (${bmi.toFixed(1)}) indicates **${bmi >= 30 ? 'Obesity' : 'Overweight'}**, combined with severe metabolic and hormonal issues. Urgent intervention is needed to achieve your ${weightGoal.toFixed(1)} kg goal.`;
        else if (score <= 60) baseText = `Your BMI (${bmi.toFixed(1)}) suggests **Overweight** status. The weight gain is likely driven by underlying hormonal issues (PCOD/Thyroid) and stress.`;
        else if (score <= 80) baseText = `You have moderate risk for lifestyle-related weight gain (BMI ${bmi.toFixed(1)}). Focus is needed on exercise, sleep, and managing dietary indiscretions.`;
        else baseText = `Your metabolic health is good (BMI ${bmi.toFixed(1)}). Minor weight correction can be achieved through small lifestyle improvements.`;

        let conditionTextHTML = `<p>${baseText}</p>`;

        let futureRisks = [];
        let possibleCauses = [];
        let lifestyleConditions = [];

        for (const groupKey in allAnswers) {
            allAnswers[groupKey].forEach((answer) => {
                const qRisks = config.futureRisksMapping[answer.question];
                const qCauses = config.causeMapping[answer.question];
                const texts = Array.isArray(answer.text) ? answer.text : [answer.text];

                texts.forEach((text) => {
                    if (qRisks && qRisks[text]) futureRisks.push(qRisks[text]);
                    if (qCauses && qCauses[text]) possibleCauses.push(qCauses[text]);
                });
            });
        }

        // Identify lifestyle condition keys for tips (from medical group)
        const medicalAnswers = getAnswerArray('medical', 0);

        if (medicalAnswers.includes('Erectile Dysfunction')) lifestyleConditions.push('erectile dysfunction');
        if (medicalAnswers.includes('Thyroid Disorder')) lifestyleConditions.push('thyroid disorder');
        if (medicalAnswers.includes('Hypertension')) lifestyleConditions.push('hypertension');
        if (medicalAnswers.includes('Diabetes')) lifestyleConditions.push('diabetes');
        if (medicalAnswers.includes('Family history of obesity or metabolic disorders')) lifestyleConditions.push('family history of obesity or metabolic disorders');
        if (medicalAnswers.includes('Digestive Issues (IBS, Acidity, Constipation)')) lifestyleConditions.push('digestive issues (ibs, acidity, constipation)');
        if (medicalAnswers.includes('High Cholesterol')) lifestyleConditions.push('high cholesterol');

        // Prepare timeline data
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
        // NOTE: Other specific condition timelines would be added here (e.g., hypertension, diabetes)

        return {
            issueTitle: baseIssue,
            conditionTextHTML,
            futureRisks: [...new Set(futureRisks)],
            possibleCauses: [...new Set(possibleCauses)],
            timelineData: { general, extras }, // KEEPING ORIGINAL FORMAT FOR RENDERRESULTS
            lifestyleConditions: [...new Set(lifestyleConditions)],
        };
    },

    // 🔑 NEW FUNCTION: saveSubmission for Firebase 🔑
    saveSubmission: async (state, db, config) => {
        const userInfo = state.userInfo;
        const computedHealthScore = state.healthScore;
        const results = state.results;
        const allAnswers = state.allAnswers;
        const activeProducts = state.recommendedProducts.filter(p => p.active);

        // --- 1. TIMELINE MERGING LOGIC for Firestore format (Backend Only) ---
        // We use the timelineData structure from results: { general, extras }
        const { general, extras } = results.timelineData;
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
            timelineDesc: descList.join(', '), // Merge descriptions
        }));
        // --- END TIMELINE MERGING ---


        // --- 2. Extract Data for Firestore ---
        const possibleCauses = (results.possibleCauses || []).map((cause) => ({
            text: cause,
        }));

        const allTips = config.lifestyleTips || {};
        const conditions = results.lifestyleConditions || [];
        let tipsToSend = [...(allTips.GENERAL || [])];
        conditions.forEach((conditionKey) => {
            // Keys in lifestyleTips are lowercase with spaces (e.g., "thyroid disorder").
            // We need to convert the keys from resultRules (which are uppercase like "THYROID DISORDER")
            // back to the expected keys, but since the mens-weight uses specific mixed casing, 
            // we will primarily use the lowercase version for lookup.
            let key = String(conditionKey).toLowerCase();
            if (allTips[key]) {
                tipsToSend = [...tipsToSend, ...allTips[key]];
            }
        });
        const uniqueTips = [...new Set(tipsToSend)];
        const lifestyleTipsArray = uniqueTips.map((tip) => ({ text: tip }));

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
            // Look up the full product object directly from the database using its name (key)
            const sourceProduct = config.productDatabase[p.name];

            return {
                name: p.name,
                salePrice: p.salePrice,
                // Access the new 'whyPoints' array directly from the source product
                whyPoints: (sourceProduct?.whyPoints || []).map((text) => ({
                    text,
                })),
            };
        });

        // --- 3. BUILD THE FINAL DATA OBJECT ---
        const data = {
            reportDate: new Date()
                .toLocaleDateString('en-GB')
                .replace(/\//g, '-'),
            userName: userInfo.name,
            dob: userInfo.dob,
            phone: userInfo.phone,
            healthScore: computedHealthScore,
            issueTitle: results.issueTitle,

            // 🔑 SAVE WEIGHT/BMI METRICS HERE 🔑
            height: userInfo.height,
            currentWeight: userInfo.currentWeight,
            targetWeight: userInfo.targetWeight,
            bmi: userInfo.bmi,

            possibleCauses: possibleCauses,
            lifestyleChanges: lifestyleTipsArray,
            timeline: combinedTimeline, // Merged timeline for the backend
            concern: 'Mens Weight Loss',
            answers: answers,
            reportCategory: "Mens Weight Loss", // Changed to Mens

            // Save answers segmented by question group key
            medicalAnswers: allAnswers.medical || [],
            lifestyleAnswers: allAnswers.lifestyle || [],
            healthAnswers: allAnswers.Health || [],
            weightLossAnswers: allAnswers['Weight Loss'] || [],

            questionnaireId: config.id,

            timestamp: firebase.firestore.FieldValue.serverTimestamp(),

            futureRisks: (results.futureRisks || []).map((text) => ({
                text,
            })),
            recommendedProducts: finalRecommendedProducts,

            rawState: {
                allAnswers: allAnswers,
                results: results,
            },
        };

        // --- 4. FIREBASE SUBMISSION ---
        try {
            const docRef = await db
                .collection('questionnaire_submissions')
                .add(data);
            console.log('Document written with ID: ', docRef.id);
            return docRef.id;

        } catch (e) {
            console.error('Error saving to Firebase:', e);
            throw e;
        }
    },
};