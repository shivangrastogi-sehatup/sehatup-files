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
        options: [{
            text: "High Sensitivity",
            score: 10
        }, {
            text: "Anxiety",
            score: 8
        }, {
            text: "Both",
            score: 5
        }, {
            text: "I do not know",
            score: 3
        }]
    }, {
        question: "How quickly do you typically finish during intercourse?",
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
        question: "Currently taking any med. for current problem or lifestyle modification",
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
    both: [{
        question: "How often do you have trouble getting an erection or keeping an erection during sex?",
        options: [{
            text: "Everytime",
            score: 10
        }, {
            text: "Sometimes",
            score: 6
        }, {
            text: "Rarely",
            score: 10
        }]
    }, {
        question: "How long can you keep up with your erection?",
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
        question: "Tell us about your performance anxiety levels",
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
            text: "Never",
            score: 3
        }]
    }, {
        question: "How often do you have early ejaculation?",
        options: [{
            text: "Always",
            score: 0
        }, {
            text: "Sometimes",
            score: 0
        }, {
            text: "Rarely",
            score: 0
        }]
    }, {
        question: "What according to you is causing you to finish quickly?",
        options: [{
            text: "High Sensitivity",
            score: 0
        }, {
            text: "Anxiety",
            score: 1
        }, {
            text: "Both",
            score: 2
        }, {
            text: "I do not know",
            score: 4
        }]
    }, {
        question: "What is your ejaculation timing while performing the intercourse?",
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
        question: "For how long have you has this condition?",
        options: [{
            text: "Less than a month",
            score: 2
        }, {
            text: "Less than 6 months",
            score: 3
        }, {
            text: "6 months - 1 year",
            score: 4
        }, {
            text: "1 year+",
            score: 5
        }]
    },],
};
const lifestyleQuestions = [{
    question: "How frequently do you consume cigarettes, alcohol, or similar substances on a daily basis?",
    options: [{
        text: "Very Frequently",
        score: 10
    }, {
        text: "Frequently",
        score: 8
    }, {
        text: "Sometimes",
        score: 5
    }, {
        text: "Rarely",
        score: 3
    }, {
        text: "Never",
        score: 0
    },],
}, {
    question: "Do you have any of the following health issues? If yes, tick those apply.",
    multiple: true,
    options: [{
        text: "Heart Problem",
        score: 2
    }, {
        text: "Blood Pressure",
        score: 2
    }, {
        text: "Diabetes",
        score: 2
    }, {
        text: "High Cholesterol",
        score: 2
    }, {
        text: "Thyroid Issues",
        score: 2
    }, {
        text: "None",
        score: 0
    },],
},];
const timelineData = {
    ed: [{
        month: "Month 1",
        timelineDesc: "Improved erection, better mood, reduced fatigue"
    }, {
        month: "Month 3",
        timelineDesc: "Restored sexual normalcy, better confidence levels"
    }, {
        month: "Month 6",
        timelineDesc: "Confident sexual function, better energy levels"
    },],
    pe: [{
        month: "Month 1",
        timelineDesc: "Improved ejaculation control, reduced anxiety"
    }, {
        month: "Month 3",
        timelineDesc: "Consistent control, higher sexual satisfaction"
    }, {
        month: "Month 6",
        timelineDesc: "Stable ejaculation control without anxiety"
    },],
    both: [{
        month: "Month 1",
        timelineDesc: "Improved erection quality and ejaculation control, reduced anxiety"
    }, {
        month: "Month 3",
        timelineDesc: "Restored normal sexual performance, enhanced emotional intimacy"
    }, {
        month: "Month 6",
        timelineDesc: "Complete control, minimal dependence on meds, high confidence"
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
    ed: ['Loss of libido', 'Relationship strain', 'Impotency (untreated ED)', 'Risk of irreversible vascular and neurological damage', 'Chronic depression'],
    pe: ['Escalation to secondary erectile dysfunction due to psychological stress', 'Relationship strain and partner frustration', 'Avoidance of intimacy', 'Lower self-esteem and increased performance anxiety over time'],
    both: ['Escalation to complete sexual dysfunction', 'Long-term hormonal dysregulation', 'Risk of psychosomatic disorders (chronic fatigue, insomnia, substance abuse)', 'Isolation, social withdrawal, and reduced quality of life', 'Chronic depression', 'Relationship conflicts']
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
            options: [{
                text: "Erectile Dysfunction (ED)",
                score: 0,
                key: 'ed'
            }, {
                text: "Premature Ejaculation (PE)",
                score: 0,
                key: 'pe'
            }, {
                text: "Both",
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
        let baseText = '';
        if (concernKey === 'both') {
            issueTitle = "Erectile Dysfunction + Premature Ejaculation";
            baseText = "You’ve indicated concerns about both ED and PE. A comprehensive plan can help improve overall performance";
        } else if (concernKey === 'pe') {
            issueTitle = "Premature Ejaculation";
            baseText = "Premature Ejaculation may be managed through specialized exercises, counseling, or medications";
        } else {
            issueTitle = "Erectile Dysfunction";
            baseText = "Erectile Dysfunction can often be improved with medication, lifestyle changes, and therapy";
        }
        const generalTimeline = timelineData[concernKey] || timelineData.ed;
        return {
            issueTitle: issueTitle,
            conditionTextHTML: `<p>${baseText}</p>`,
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
                salePrice: p.salePrice,
                image: p.image,
                whyPoints: (p.whyPoints || []).map((text) => ({
                    text
                })),
            };
        });
        const initialRiskType = config.getRiskType(computedHealthScore);
        const data = {
            reportDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
            userName: userInfo.name,
            dob: userInfo.dob,
            phone: userInfo.phone,
            healthScore: computedHealthScore,
            issueTitle: results.issueTitle,
            riskType: initialRiskType,
            concern: allAnswers.concern?.[0]?.text,
            reportCategory: "Mens Sexual Wellness",
            lifestyleConditions: results.lifestyleConditions || [],
            possibleCauses: possibleCauses,
            lifestyleChanges: lifestyleTipsArray,
            timeline: combinedTimeline,
            answers: answers,
            questionnaireId: config.id,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            isWhatsAppSent: false,
            futureRisks: (results.futureRisks || []).map((text) => ({
                text
            })),
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