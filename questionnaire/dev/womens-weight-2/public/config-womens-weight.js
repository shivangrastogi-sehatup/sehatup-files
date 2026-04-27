// assets/config-womens-weight.js
const questionnaireConfig = {
    id: 'womens-weight',
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
                        { text: "Sedentary (little or no exercise)", score: 10 },
                        { text: "Lightly active (1-3 days/week exercise)", score: 6 },
                        { text: "Moderately active (4-5 days/week exercise)", score: 3 },
                        { text: "Very active (daily exercise or physical job)", score: 0 },
                    ],
                },
                {
                    question:
                        "During the past 6 months my weight has increased by.",
                    options: [
                        { text: "1-3Kg", score: 0 },
                        { text: "3-6Kg", score: 3 },
                        { text: "6-10Kg", score: 6 },
                        { text: "More than 10kg", score: 10 },
                    ],
                },
                {
                    question:
                        "Which body type do you identify with?",
                    options: [
                        { text: "Normal weight", score: 1 },
                        { text: "Over weight", score: 3 },
                        { text: "Obese class 1", score: 6 },
                        { text: "Obese class 2", score: 8 },
                        { text: "Obese class 3", score: 15 },
                    ],
                },
                {
                    question:
                        "How many hours do you sleep daily?",
                    options: [
                        { text: "Less than 5 hours", score: 6 },
                        { text: "5-6 hours", score: 3 },
                        { text: "7-8 hours", score: 1 },
                        { text: "More than 8 hours", score: 10 },
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
                        { text: "PCOS/PCOD", score: 2 },
                        { text: "Irregular periods", score: 2 },
                        { text: "Hypertension", score: 2 },
                        { text: "Diabetes ", score: 2 },
                        { text: "Family history of obesity or metabolic disorders ", score: 2 },
                        { text: "Digestive issues (IBS, Acidity, Constipation)", score: 2 },
                        { text: "Thyroid disorder", score: 2 },
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
                        "Are you currently on birth control or hormone therapy?",
                    options: [
                        { text: "No", score: 1 },
                        { text: "Yes ", score: 5 },
                    ],
                },
                {
                    question:
                        "Have you recently been pregnant or breastfeeding?",
                    options: [
                        { text: "No", score: 1 },
                        { text: "Yes ", score: 5 },
                    ],
                },
                {
                    question:
                        "Do you have any history of pregnancy complications or significant weight gain during pregnancy?",
                    options: [
                        { text: "No", score: 5 },
                        { text: "Yes ", score: 1 },
                    ],
                },
                {
                    question:
                        "Do you experience emotional eating ?",
                    options: [
                        { text: "Never", score: 1 },
                        { text: "Rarely", score: 3 },
                        { text: "Sometimes", score: 5 },
                        { text: "Often", score: 10 },
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
            "Sedentary (little or no exercise)": "Sedentary lifestyle & lack of movement reduces calorie expenditure and leads to fat accumulation.",
            "Lightly active (1-3 days/week exercise)": "Light active exercises can help with minimal calorie burn. Not much enough to counter daily intake",
            "Moderately active (4-5 days/week exercise)": "Moderately active lifestyle is better than average, but may need more intensity or consistency to loose weight.",
            "Very active (daily exercise or physical job)": "Active lifestyle can have positive influence on metabolism and weight management",
        },
        "How often do you consume processed/junk food?": {
            "Rarely": "Minimal intake of processed food so not a significant factor in weight gain.",
            "Occasionally (1-2 times a week)": "Occasional indulgence may lead to minor calorie surpluses and cravings.",
            "Frequently (3-5 times a week)": "High intake of processed food increases calorie load and inflammatory response.",
            "Daily": "Daily consumption disrupts metabolism and promotes fat storage.",
        },
        "Do you experience any of the following? (Select all that apply)": {
            "PCOS/PCOD": "PCOS causes hormonal imbalance that affects insulin and fat storage.",
            "Irregular periods": "Underactive thyroid slows metabolism, making weight loss difficult.",
            "Hypertension": "Often associated with poor diet, stress, and visceral fat around organs.",
            "Diabetes": "Impaired glucose metabolism causes fat accumulation, especially around the belly.",
            "Family history of obesity or metabolic disorders ": "Genetic predisposition may affect metabolism and fat distribution.",
            "Digestive issues (IBS, Acidity, Constipation)": "Poor digestion may impact nutrient absorption and increase bloating and weight retention.",
            "Thyroid disorder": "Hormonal imbalance due to thyroid issues",
            "None ": "No known medical conditions reported.",
        },
        "How often do you feel stressed?": {
            "Rarely": "Healthy emotional regulation.",
            "Sometimes ": "Intermittent stress may affect food choices and sleep quality.",
            "Often ": "Chronic stress triggers cortisol, which increases fat accumulation, especially in the abdomen.",
            "Always": "Chronic stress triggers cortisol, which increases fat accumulation, especially in the abdomen.",
        },
        "Are you currently on birth control or hormone therapy?": {
            "No": "Hormonal weight fluctuations are less likely;",
            "Yes ": "Hormonal therapies can influence fat distribution, water retention, and appetite regulation.",
        },
        "Do you experience emotional eating ?": {
            "Never": "Indicates good emotional regulation and healthy relationship with food",
            "Rarely": "Occasional stress-related eating may not significantly impact weight",
            "Sometimes": "Emotional eating may be a response to stress, boredom, or anxiety, leading to irregular calorie intake",
            "Often": "Strong link between emotions and food choices, often leading to bingeing on high-calorie items",
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
            "Rarely": "Low risk from this behavior; continue maintaining healthy food habits.",
            "Occasionally (1-2 times a week)": "If not balanced with activity, can contribute to slow weight gain over time.",
            "Frequently (3-5 times a week)": "Leads to fat accumulation, insulin resistance, and digestive issues",
            "Daily": "High risk of obesity, metabolic syndrome, fatty liver, and hormonal imbalance.",
        },
        "Do you experience any of the following? (Select all that apply)": {
            "PCOS/PCOD": "Increased risk of infertility, type 2 diabetes, and chronic weight retention.",
            "Irregular periods": "Can lead to obesity, mood changes, menstrual issues, and high cholesterol.",
            "Hypertension": "Elevated risk of heart disease, stroke, and kidney disorders.",
            "Diabetes": "High risk of cardiovascular disease, nerve damage, and complications in organs.",
            "Family history of obesity or metabolic disorders ": "Increased lifetime risk of obesity, diabetes, and hormonal disorders.",
            "Digestive issues (IBS, Acidity, Constipation)": "Long-term gut inflammation, fatigue, and difficulty managing weight.",
            "Thyroid disorder": "Chronic fatigue, infertility, severe weight gain, depression",
            "None ": "Encouraging sign, focus on lifestyle, emotional, and nutritional factors.",
        },
        "How often do you feel stressed?": {
            "Rarely": "Minimal risk if overall lifestyle is balanced.",
            "Sometimes ": "Can progress into chronic stress or binge-eating patterns if unmanaged.",
            "Often ": "Long-term stress may cause emotional eating, hormonal imbalance, and fat gain.",
            "Always": "Long-term stress may cause emotional eating, hormonal imbalance, and fat gain.",
        },
        "Are you currently on birth control or hormone therapy?": {
            "No": " current weight patterns may be due to lifestyle or metabolism.",
            "Yes ": "May lead to weight gain, mood swings, and metabolic slowdown if not monitored.",
        },
        "Do you experience emotional eating ?": {
            "Never": "Low risk from emotional triggers; weight changes likely due to other factors.",
            "Rarely": "If unchecked, can evolve into a habit during high-stress periods.",
            "Sometimes": "Can promote fat gain, digestive distress, and disordered eating over time.",
            "Often": "Increased risk of obesity, poor self-esteem, metabolic syndrome, and depression.",
        },
    },
    healthTimelineData: {
        "<25": {
            "pcos/pcod": [
                { month: "Month 1", timelineDesc: "Bloating, mood improvement" },
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
                { month: "Month 6", timelineDesc: "Improved tone, weight, control over eating and energy; enhanced daily functioning." }
            ]
        },
        "25-60": {
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
                { month: "Month 1", timelineDesc: "Appetite settles, reduced snacking, better digestion and sleep" },
                { month: "Month 3", timelineDesc: "Fat loss becomes visible, stamina rises, sleep deepens" },
                { month: "Month 6", timelineDesc: "Noticeable inch loss, better metabolism, alertness, and physical ease" }
            ]
        },
        "61-80": {
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
                { month: "Month 1", timelineDesc: "Light digestion, fewer cravings, mild sleep and energy improvement" },
                { month: "Month 3", timelineDesc: "Energy improves, movement feels easier, eating becomes structured" },
                { month: "Month 6", timelineDesc: "Better body tone, control over habits, lighter feeling" },
            ]
        },
        "81+": {
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
    // productWhyPoints: {
    //     // Note: Product names must match product-database-common.js
    //     "Ignite Fat Burner": [ // Match 'Ignite'
    //         "Burns stubborn fat (especially belly)",
    //         "Controls appetite and cravings",
    //         "Boosts metabolism and energy",
    //         "Helps in sugar and insulin balance",
    //     ],
    //     "Valora": [
    //         "Support energy, digestion, and fat metabolism.",
    //         "Fight tiredness so you stay active.",
    //         "Help with sugar control and reduce cravings.",
    //         "Balance female hormones (great for PCOS, menopause).",
    //         "Boosts energy and metabolism naturally.",
    //         "Supports cell health and reduces inflammation.",
    //     ],
    //     "Leanor 60 mg": [
    //         "Helps you lose weight by blocking fat absorption from the food you eat."
    //     ],
    //     "Slimtox Tea": [
    //         "Boost fat burning and reduce appetite.",
    //         "Control sugar cravings and improve digestion.",
    //         "Gently cleanse the body and reduce bloating.",
    //         "Help you relax and reduce stress eating.",
    //         "Support heart health and reduce inflammation.",
    //         "Support metabolism and hormonal balance.",
    //     ],
    //     "Metabolic Multivitamin": [ // Match 'Multivitamin'
    //         "Speed up metabolism and help burn more calories.",
    //         "Cut bloating and improve digestion.",
    //         "Reduce sugar cravings and support fat breakdown.",
    //         "Keep your gut healthy, which helps with weight control.",
    //         "Keep your energy high while dieting."
    //     ],
    //     "Slimtox Energy Tea": [
    //         "Boost fat burning and metabolism.",
    //         "Cut bloating and sugar cravings.",
    //         "Help control blood sugar and reduce sweet cravings.",
    //         "Lower stress, which helps stop emotional eating.",
    //         "Improve digestion and reduce inflammation.",
    //     ],
    //     "Garcinia Cambogia": [
    //         "Natural fruit extract that helps you eat less, burn fat, and stop cravings.",
    //     ],
    //     "Her Menses": [ // Re-added existing product mappings for reference
    //         "Helps fix irregular or missed periods.",
    //         "Soothes pain, irritability, and emotional ups and downs.",
    //         "Useful in PCOS, delayed or painful periods.",
    //     ],
    //     "Thyroidinum 3X": [
    //         "Optimizes thyroid function which often causes unexplained weight gain.",
    //         "Boosts metabolic rate to help the body burn more calories.",
    //         "Reduces fatigue and lethargy, enabling higher activity levels.",
    //     ],
    //     "Zencal D3K2": [
    //         "Boosts metabolism and supports fat breakdown.",
    //         "Helps D3 work better and keeps calcium in bones, not in fat cells.",
    //         "Helps reduce fatigue and balance mood, making it easier to stay active and eat right",
    //     ],
    // },
    lifestyleTips: {
        "GENERAL": [
            "Prioritize protein in the first meal — skipping breakfast worsens insulin resistance and hormonal imbalance.",
            "Avoid calorie-dense drinks — replace juices, smoothies, and milkshakes with plain or lemon water.",
            "Always pair carbs with protein or fiber — e.g., roti + dal, poha + peanuts to avoid blood sugar spikes.",
            "Start lunch/dinner with raw salad or soaked nuts to reduce post-meal insulin load.",
            "Avoid eating after 8:30 PM — night eating worsens fat storage and affects reproductive hormones.",
            "Include 25–30 minutes of movement daily (walks, yoga, or strength training) — even light movement helps regulate estrogen.",
        ],
        "PCOS/PCOD": [
            "Follow fixed meal timings with low-GI grains.",
            "Limit dairy, sugar, and refined foods.",
            "Include flaxseeds, leafy greens, and soaked nuts.",
            "Manage stress with yoga, deep breathing.",
        ],
        "THYROID DISORDER": [
            "Use iodized salt and eat whole grains, eggs, and dairy.",
            "Avoid excess soy, processed foods, and erratic meal times.",
            "Eat at regular intervals every 3–4 hours.",
            "Sleep and wake at fixed times to support hormonal rhythm.",
        ],
        "HYPERTENSION": [
            "Limit salt; avoid pickles, papads, and processed snacks.",
            "Include potassium-rich foods: banana, spinach, tomatoes.",
            "Restrict tea/coffee to 1–2 cups per day.",
            "Walk daily and practice deep breathing exercises.",
        ],
        "DIABETES": [
            "Eat small, frequent meals with whole grains and vegetables.",
            "Avoid sweets, fruit juices, white rice, and refined flour.",
            "Walk 10–15 minutes after meals.",
            "Monitor blood sugar if advised.",
        ],
        "FAMILY HISTORY OF OBESITY / METABOLIC SYNDROME": [
            "Avoid long gaps between meals and late dinners.",
            "Focus on homemade, low-oil meals with balanced portions.",
            "Stay active throughout the day, not just during workouts.",
            "Limit sugar, refined carbs, and processed snacks.",
        ],
        "Digestive issues (IBS, Acidity, Constipation)": [
            "Eat slowly and chew food thoroughly.",
            "Avoid spicy, oily, and very cold or hot foods.",
            "Use soaked raisins, jeera/ajwain water for gut support.",
            "Walk after meals to ease digestion and reduce bloating.",
        ],
        "Irregular periods": [
            "Eat balanced meals; avoid fasting or skipping.",
            "Reduce sugar and packaged foods.",
            "Maintain regular sleep and daily movement.",
            "Add seeds and healthy fats like ghee or nuts.",
        ],
    },

    calculateScore: (allAnswers, userInfo, config) => {

        let totalQuestionScore = 0;
        for (const groupKey in allAnswers) {
            allAnswers[groupKey].forEach((answer) => {
                if (typeof answer.score === 'number' && !Array.isArray(answer.text)) {
                    totalQuestionScore += answer.score;
                }
                else if (Array.isArray(answer.text)) {
                    totalQuestionScore += answer.score || 0;
                }
            });
        }

        const bmi = userInfo?.bmi || 22;
        const age = userInfo?.age || 25;
        let bmiDeduction = 0;

        if (bmi >= 25) {
            if (age <= 18) {
                if (bmi >= 40) { bmiDeduction = 14; }
                else if (bmi >= 35) { bmiDeduction = 12; }
                else if (bmi >= 30) { bmiDeduction = 10; }
                else { bmiDeduction = 8; }
            }
            else if (age <= 45) {
                if (bmi >= 40) { bmiDeduction = 16; }
                else if (bmi >= 35) { bmiDeduction = 14; }
                else if (bmi >= 30) { bmiDeduction = 12; }
                else { bmiDeduction = 10; }
            }
            else if (age <= 65) {
                if (bmi >= 40) { bmiDeduction = 16; }
                else if (bmi >= 35) { bmiDeduction = 14; }
                else if (bmi >= 30) { bmiDeduction = 12; }
                else { bmiDeduction = 10; }
            }
            else {
                if (bmi >= 40) { bmiDeduction = 18; }
                else if (bmi >= 35) { bmiDeduction = 16; }
                else if (bmi >= 30) { bmiDeduction = 14; }
                else { bmiDeduction = 12; }
            }
        }

        const OVERALL_MAX_RISK = 130;
        const totalRiskScore = totalQuestionScore + bmiDeduction;
        const healthScore = 100 * (1 - (totalRiskScore / OVERALL_MAX_RISK));
        return Math.max(0, Math.min(100, Math.round(healthScore)));
    },

    productRules: (score, allAnswers, productDatabase, userInfo, config) => {
        const answers = allAnswers;
        const checkAnswerArrayIncludes = (groupKey, questionIndex, searchText) => {
            const answer = (answers[groupKey] || [])[questionIndex];
            if (!answer || !Array.isArray(answer.text)) return false;
            return answer.text.some(t => String(t).toLowerCase().includes(searchText.toLowerCase()));
        };
        const checkSpecificText = (groupKey, questionText, optionText) => {
            return answers[groupKey]?.some(
                (a) => a.question.includes(questionText) && String(a.text).toLowerCase().includes(optionText.toLowerCase())
            ) || false;
        }

        const hasThyroid = checkAnswerArrayIncludes('medical', 0, 'Thyroid disorder');
        const hasPCOS = checkAnswerArrayIncludes('medical', 0, 'PCOS/PCOD'); // Kept for the score < 25 rule

        // Cravings check is based on the "Barriers" question in the 'medical' group (index 6)
        const hasCravingsAsBarrier = checkAnswerArrayIncludes('medical', 6, 'Cravings');

        const bmi = userInfo?.bmi || 22;
        const isObeseClassIIMorbid = bmi >= 35; // Check for Leanor in optional tiers

        // Using stress/emotional eating as proxy for 'low energy' for optional Ignite/Tea
        const hasStress = checkSpecificText('medical', 'How often do you feel stressed?', 'Often') || checkSpecificText('medical', 'How often do you feel stressed?', 'Always');
        const hasEmotionalEating = checkSpecificText('medical', 'Do you experience emotional eating ?', 'Sometimes') || checkSpecificText('medical', 'Do you experience emotional eating ?', 'Often');


        let baseProductNames = [];

        // --- 1. Score-based Recommendations (Base) ---

        if (score < 25) {
            // 1. Leanor 60 (Orlistat), 2. Ignite, 3. Multivitamin, 4. Slimtox Tea
            baseProductNames = [
                'Leanor 60 mg',
                'Ignite Fat Burner',
                'Metabolic Multivitamin',
                'Slimtox Tea'
            ];
            // 5. Garcinia Cambogia (if female, PCOS)
            if (hasPCOS) {
                baseProductNames.push('Garcinia Cambogia');
            }

        } else if (score >= 25 && score <= 60) {
            // 1. Ignite, 2. Garcinia Cambogia, 3. Slimtox Tea, 5. Multivitamin, 6. Leanor 60 mg
            baseProductNames = [
                'Ignite Fat Burner',
                'Garcinia Cambogia',
                'Slimtox Tea',
                'Metabolic Multivitamin'
            ];
            // Leanor 60 mg is conditionally added for higher BMI in this tier
            if (bmi >= 30) {
                baseProductNames.push('Leanor 60 mg');
            }

        } else if (score >= 61 && score <= 80) {
            // 1. Garcinia Cambogia, 2. Slimtox Energy Tea, 3. Multivitamin
            baseProductNames = [
                'Garcinia Cambogia',
                'Slimtox Energy Tea',
                'Metabolic Multivitamin'
            ];
            // Optional: Ignite (if belly fat, low energy)
            if (hasStress || hasEmotionalEating) {
                baseProductNames.push('Ignite Fat Burner');
            }
            // Optional: Leanor 60 mg
            if (isObeseClassIIMorbid) {
                baseProductNames.push('Leanor 60 mg');
            }

        } else if (score > 80) {
            // 1. Slimtox Tea
            baseProductNames = [
                'Slimtox Tea'
            ];
            // 2. Multivitamin (optional) - Triggered by any stress/emotional eating flag
            if (hasStress || hasEmotionalEating) {
                baseProductNames.push('Metabolic Multivitamin');
            }
        }

        // --- 2. Conditional Add-ons (Overrides/Comorbidities/Cravings) ---

        // Comorbidities -> add Thyroidinum
        if (hasThyroid) {
            baseProductNames.push('Thyroidinum 3X');
        }

        // Cravings -> add Garcinia Cambogia
        if (hasCravingsAsBarrier && !baseProductNames.includes('Garcinia Cambogia')) {
            baseProductNames.push('Garcinia Cambogia');
        }

        // Keep Slimtox Energy Tea for general high stress/emotional eating when not covered by base rule (e.g., score < 25)
        if ((hasStress || hasEmotionalEating) && !baseProductNames.includes('Slimtox Energy Tea') && !baseProductNames.includes('Slimtox Tea')) {
            baseProductNames.push('Slimtox Energy Tea');
        }
        const allNames = [...new Set(baseProductNames)];
        return allNames.map((name) => {
            const product = productDatabase[name];
            if (product && product.active === true) {
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

        if (bmi >= 18.5 && bmi <= 24.9) baseIssue = 'Normal';
        else if (bmi >= 25 && bmi <= 29.9) baseIssue = 'Overweight';
        else if (bmi >= 30 && bmi <= 34.9) baseIssue = 'Obesity Class I';
        else if (bmi >= 35 && bmi <= 39.9) baseIssue = 'Obesity Class II';
        else if (bmi >= 40) baseIssue = 'Obesity Class III (Morbid)';

        let baseText = '';
        if (bmi >= 18.5 && bmi <= 24.9) baseText = 'Good BMI but lifestyle changes for maintenance Required';
        else if (bmi >= 25 && bmi <= 29.9) baseText = 'Overweight – Early signs of fat accumulation; risk of metabolic stress.';
        else if (bmi >= 30 && bmi <= 34.9) baseText = 'Obesity – Weight impacting metabolic and hormonal balance.';
        else if (bmi >= 35 && bmi <= 39.9) baseText = 'Severe Obesity – Increased risk of diabetes, BP, hormonal disorders.';
        else if (bmi >= 40) baseText = 'Morbid Obesity – Requires urgent lifestyle & medical intervention.';

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
        const medicalAnswers = getAnswerArray('medical', 0);
        const extraIssues = [];
        let comorbidityCount = 0;
        // 1. Diabetes / High Sugar -> Metabolic Dysfunction
        if (medicalAnswers.includes('Diabetes')) {
            extraIssues.push('Metabolic Dysfunction');
            comorbidityCount++;
            lifestyleConditions.push('DIABETES'); // For lifestyle tips
        }
        // 2. High BP -> Cardiovascular Risk
        if (medicalAnswers.includes('Hypertension')) {
            extraIssues.push('Cardiovascular Risk');
            comorbidityCount++;
            lifestyleConditions.push('HYPERTENSION'); // For lifestyle tips
        }
        // 3. PCOS / Irregular Periods -> Hormonal Imbalance
        const hasPCOS = medicalAnswers.includes('PCOS/PCOD');
        const hasIrregularPeriods = medicalAnswers.includes('Irregular periods');
        if (hasPCOS || hasIrregularPeriods) {
            extraIssues.push('Hormonal Imbalance');
            if (hasPCOS) comorbidityCount++;
            if (hasIrregularPeriods) comorbidityCount++;

            if (hasPCOS) lifestyleConditions.push('PCOS/PCOD'); // For timeline/tips
            if (hasIrregularPeriods) lifestyleConditions.push('Irregular periods'); // For tips
        }
        // 4. Thyroid Disorder -> Thyroid Dysfunction
        if (medicalAnswers.includes('Thyroid disorder')) {
            extraIssues.push('Thyroid Dysfunction');
            comorbidityCount++;
            lifestyleConditions.push('THYROID DISORDER'); // For timeline/tips
        }
        // 5. IBS / Acidity / Constipation -> Gastrointestinal Disturbance
        if (medicalAnswers.includes('Digestive issues (IBS, Acidity, Constipation)')) {
            extraIssues.push('Gastrointestinal Disturbance');
            comorbidityCount++;
            lifestyleConditions.push('Digestive issues (IBS, Acidity, Constipation)'); // For tips
        }
        // 7. ≥ 3 Conditions Ticked -> Multiple Morbid Conditions Present
        if (comorbidityCount >= 3) {
            extraIssues.push('Multiple Morbid Conditions Present');
        }
        const uniqueExtraIssues = [...new Set(extraIssues)];

        let issueTitle = baseIssue;
        if (uniqueExtraIssues.length > 0) {
            issueTitle = uniqueExtraIssues.join(', ') + (baseIssue ? ', ' + baseIssue : '');
        }

        if (medicalAnswers.includes('Family history of obesity or metabolic disorders ')) lifestyleConditions.push('FAMILY HISTORY OF OBESITY / METABOLIC SYNDROME');

        const generalTimelineKey = 'obesity';
        const general = config.healthTimelineData[bracket]?.[generalTimelineKey] || [];
        const extras = [];

        if (lifestyleConditions.includes('PCOS/PCOD')) {
            extras.push({
                sectionTitle: 'PCOS/PCOD Improvement',
                timeline: config.healthTimelineData[bracket]['pcos/pcod'] || []
            });
        }
        if (lifestyleConditions.includes('THYROID DISORDER')) {
            extras.push({
                sectionTitle: 'Thyroid Support & Energy',
                timeline: config.healthTimelineData[bracket]['thyroid disorder'] || []
            });
        }
        if (lifestyleConditions.includes('HYPERTENSION')) {
            extras.push({
                sectionTitle: 'Hypertension (BP) Management',
                timeline: config.healthTimelineData[bracket]['hypertension'] || []
            });
        }
        if (lifestyleConditions.includes('DIABETES')) {
            extras.push({
                sectionTitle: 'Diabetes & Sugar Control',
                timeline: config.healthTimelineData[bracket]['diabetes'] || []
            });
        }
        if (lifestyleConditions.includes('FAMILY HISTORY OF OBESITY / METABOLIC SYNDROME')) {
            extras.push({
                sectionTitle: 'Metabolic Disorder Risk Reduction',
                timeline: config.healthTimelineData[bracket]['family history of obesity or metabolic disorders'] || []
            });
        }
        return {
            issueTitle: issueTitle,
            conditionTextHTML,
            futureRisks: [...new Set(futureRisks)],
            possibleCauses: [...new Set(possibleCauses)],
            timelineData: { general, extras },
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
            const key = String(conditionKey).toUpperCase();
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
            concern: 'Womens Weight Loss',
            answers: answers,
            reportCategory: "Womens Weight Loss",

            // Save answers segmented by question group key (medical, lifestyle, etc.)
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