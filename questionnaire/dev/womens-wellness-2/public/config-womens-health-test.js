// assets/config-womens-health.js
const questionnaireConfig = {
  id: 'womens-wellness',
  reportCategory: "Womens Sexual Wellness",
  staticSteps: 2, // 1. Welcome, 2. About You. Questions start at step 3.

  questionGroups: [
    {
      step: 3,
      key: 'health',
      questions: [
        {
          question: 'How regular is your menstrual cycle?',
          options: [
            { text: 'Very regular (28–30 days)', score: 3 },
            { text: 'Slightly irregular (varies by a few days)', score: 5 },
            { text: 'Irregular (varies significantly)', score: 8 },
            { text: 'Highly unpredictable or absent', score: 10 },
          ],
        },
        {
          question: 'How severe are your menstrual cramps?',
          options: [
            { text: 'I don’t experience cramps', score: 3 },
            { text: 'Mild discomfort, manageable without medication', score: 5 },
            { text: 'Moderate pain, occasionally need medication', score: 8 },
            { text: 'Severe pain, regularly need medication', score: 10 },
          ],
        },
        {
          question: 'How would you describe your period flow?',
          options: [
            { text: 'Light to moderate', score: 3 },
            { text: 'Heavy for 1–2 days, then manageable', score: 5 },
            { text: 'Heavy for most of the cycle', score: 8 },
            { text: 'Extremely heavy and difficult to manage', score: 10 },
          ],
        },
        {
          question: 'Have you been diagnosed with PCOD or PCOS?',
          options: [
            { text: 'No', score: 0 },
            { text: 'Yes, but it’s under control', score: 5 },
            { text: 'Yes, and I’m managing it', score: 8 },
            { text: 'Yes, and it’s not well-managed', score: 10 },
          ],
        },
        {
          question: 'Do you experience any symptoms given below during or just before your menstrual cycle? (Select all that apply)',
          multiple: true,
          options: [
            { text: 'Bloating', score: 0 },
            { text: 'Constipation', score: 0 },
            { text: 'Diarrhea', score: 0 },
            { text: 'Acne', score: 0 },
            { text: 'Mood swings', score: 0 },
            { text: 'Headache', score: 0 },
            { text: 'None', score: 0 },
          ],
        },
      ],
    },
    {
      step: 4,
      key: 'lifestyle', // Your old 'lifestyleQuestions'
      questions: [
        {
          question: 'How often do you consume a balanced diet with fruits, vegetables, and calcium or Vitamin D-rich foods?',
          options: [
            { text: 'Daily', score: 3 },
            { text: 'Most days', score: 5 },
            { text: 'Occasionally', score: 8 },
            { text: 'Rarely', score: 10 },
          ],
        },
        {
          question: 'How often do you consume caffeinated beverages (e.g., coffee, tea, energy drinks, soda)?',
          options: [
            { text: 'Rarely or never', score: 0 },
            { text: 'Occasionally, a few times a week', score: 5 },
            { text: 'Daily, 1–2 servings', score: 8 },
            { text: 'Daily, more than 3 servings', score: 10 },
          ],
        },
        {
          question: 'How often do you feel fatigued or low in energy during your period?',
          options: [
            { text: 'Rarely or never', score: 3 },
            { text: 'Occasionally', score: 5 },
            { text: 'Frequently', score: 8 },
            { text: 'Always', score: 10 },
          ],
        },
        {
          question: 'How often do you consume alcohol or cigarettes?',
          options: [
            { text: 'Rarely', score: 0 },
            { text: 'Occasionally', score: 0 },
            { text: '2–3 times a week', score: 0 },
            { text: 'Daily', score: 0 },
          ],
        },
        {
          question: 'Do you have any of the mentioned health problems? (Select all that apply)',
          multiple: true,
          options: [
            { text: 'Endometriosis / Fibroids', score: 0 },
            { text: 'Depression/Anxiety', score: 0 },
            { text: 'Thyroid disorder', score: 0 },
            { text: 'PCOD/PCOS', score: 0 },
            { text: 'Diabetes', score: 0 },
            { text: 'None', score: 0 },
          ],
        },
      ],
    },
    {
      step: 5,
      key: 'hygiene', // Your old 'hygieneQuestions'
      questions: [
        {
          question: 'Do you experience itching, irritation, or discomfort in the intimate area?',
          options: [
            { text: 'Rarely or never', score: 3 },
            { text: 'Occasionally', score: 5 },
            { text: 'Frequently', score: 8 },
            { text: 'Always', score: 10 },
          ],
        },
        {
          question: 'Do you experience any bad odor or discharge from your genitalia?',
          options: [
            { text: 'Rarely or never', score: 3 },
            { text: 'Occasionally', score: 5 },
            { text: 'Frequently', score: 8 },
            { text: 'Always', score: 10 },
          ],
        },
      ],
    },
    {
      step: 6,
      key: 'hormonal', // Your old 'hormonalQuestions'
      questions: [
        {
          question: 'Do you experience hormonal imbalance symptoms such as acne, mood swings, facial hair or weight changes?',
          options: [
            { text: 'Rarely or never', score: 3 },
            { text: 'Occasionally', score: 5 },
            { text: 'Frequently', score: 8 },
            { text: 'Always', score: 10 },
          ],
        },
        {
          question: 'Have you ever been diagnosed with estrogen dominance or related conditions?',
          options: [
            { text: 'No', score: 3 },
            { text: 'Yes, but it’s under control', score: 5 },
            { text: 'Yes, and I’m managing it', score: 8 },
            { text: 'Yes and it’s uncontrolled', score: 10 },
          ],
        },
      ],
    },
  ],

  /**
   * ALL DATA MAPPINGS (PRODUCTS, TIMELINES, CAUSES)
   */
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

  futureRisksMapping: {
    'How regular is your menstrual cycle?': {
      'Very regular (28–30 days)': 'Minimal risk. Keep maintaining healthy habits.',
      'Slightly irregular (varies by a few days)': 'May cause delayed ovulation or mild fertility issues if unchecked.',
      'Irregular (varies significantly)': 'Increased risk of infertility, hormonal disorders, and endometrial issues.',
      'Highly unpredictable or absent': 'High risk of infertility, endometrial hyperplasia, or metabolic disorders.',
    },
    'How severe are your menstrual cramps?': {
      'I don’t experience cramps': 'No risk. Maintain current health.',
      'Mild discomfort, manageable without medication': 'Low risk. Could worsen if lifestyle becomes unbalanced.',
      'Moderate pain, occasionally need medication': 'May progress to chronic pelvic pain or severe endometriosis.',
      'Severe pain, regularly need medication': 'Chronic pain, infertility, need for surgery if untreated.',
    },
    'Do you have any of the mentioned health problems? (Select all that apply)': {
      'Endometriosis / Fibroids': 'Infertility, chronic pain, heavy bleeding, need for surgery.',
      'Depression/Anxiety': 'Emotional burnout, sleep disorders, hormonal imbalance, weight gain.',
      'Thyroid disorder': 'Irregular cycles, fatigue, weight changes, fertility issues.',
      'PCOD/PCOS': 'Irregular periods, infertility, diabetes, heart disease risk.',
      'Diabetes': 'Hormonal disruption, menstrual irregularities, fertility issues, chronic complications.',
    },
    'Do you experience itching, irritation, or discomfort in the intimate area?': {
      'Rarely or never': 'No immediate risks. Continue good hygiene practices.',
      'Occasionally': 'May lead to recurrent infections or inflammation if ignored.',
      'Frequently': 'Risk of chronic infections, discomfort, or pelvic inflammation.',
      'Always': 'High risk of chronic inflammation, sexual health issues, or reproductive tract damage.',
    },
    'Do you experience hormonal imbalance symptoms such as acne, mood swings, facial hair or weight changes?': {
      'Rarely or never': 'No major risks. Maintain current routine.',
      'Occasionally': 'Risk of worsening imbalance if lifestyle isn’t improved.',
      'Frequently': 'May cause cycle irregularity, skin issues, weight gain, emotional distress.',
      'Always': 'Risk of infertility, diabetes, obesity, and mood disorders if left untreated.',
    },
  },

  femaleGeneralTimeline: {
    '<25': [
      { month: 'Month 1', timelineDesc: 'Cycle begins to respond' },
      { month: 'Month 2', timelineDesc: 'Periods become more predictable' },
      { month: 'Month 3', timelineDesc: 'Regular cycles (within 3–5 days)' },
      { month: 'Month 6', timelineDesc: 'Smooth and timely cycles' },
    ],
    '25-60': [
      { month: 'Month 1', timelineDesc: 'Mild improvement in cycle timing' },
      { month: 'Month 2', timelineDesc: 'Cycles more predictable' },
      { month: 'Month 3', timelineDesc: 'Periods regular and lighter' },
      { month: 'Month 6', timelineDesc: 'Healthy cycle pattern maintained' },
    ],
    '61-80': [
      { month: 'Month 1', timelineDesc: 'Slight improvement in timing' },
      { month: 'Month 2', timelineDesc: 'Regular and balanced cycles' },
      { month: 'Month 3', timelineDesc: 'Fully predictable periods' },
      { month: 'Month 6', timelineDesc: 'Cycles easy and on time' },
    ],
    '81+': [
      { month: 'Month 1', timelineDesc: 'Cycles stay smooth and regular' },
      { month: 'Month 2', timelineDesc: 'Healthy rhythm continues' },
      { month: 'Month 3', timelineDesc: 'Consistent and healthy periods' },
      { month: 'Month 6', timelineDesc: 'Long-term menstrual wellness' },
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
    // *** FIXED KEYS to match product names from database ***
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
    'Aloezy Wash': [ // Fixed key from 'Aloezy'
      'Soothe and calm the skin.',
      'Give a fresh, cooling feel.',
      'Maintains healthy pH balance.',
      'Protects against germs.',
      'Gentle and safe for daily use.',
    ],
    'Thyrostatin 3X': [ // Fixed key from 'Thyroidinum 3x'
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
    if (score < 25) baseIssue = 'Critical Hormonal Disturbance';
    else if (score <= 60) baseIssue = 'High Hormonal Disturbance';
    else if (score <= 80) baseIssue = 'Mild Hormonal Disturbance';
    else baseIssue = 'Good Hormonal Health';

    // Get answers from Lifestyle, Q5 ('Do you have any of the mentioned health problems?')
    let lifestyleConditions = getAnswerArray('lifestyle', 4);
    // Get answers from Hygiene, Q2 ('Do you experience any bad odor...')
    const hygieneAnswer = getAnswerText('hygiene', 1);

    let extraIssues = [];
    if (lifestyleConditions.includes('Diabetes')) extraIssues.push('Metabolic Dysfunction');
    if (lifestyleConditions.includes('Thyroid disorder')) extraIssues.push('Thyroid Dysfunction');
    if (lifestyleConditions.includes('Depression/Anxiety')) extraIssues.push('PMS-linked Mood Disorder');
    if (lifestyleConditions.includes('Endometriosis / Fibroids')) extraIssues.push('Fibroids / Endometriosis');
    if (
      hygieneAnswer.includes('Occasionally') ||
      hygieneAnswer.includes('Frequently') ||
      hygieneAnswer.includes('Always')
    ) {
      extraIssues.push('Vaginal pH Imbalance');
    }

    let issueTitle = baseIssue;
    if (extraIssues.length > 0) {
      issueTitle += ', ' + extraIssues.join(', ');
    }

    let baseText = '';
    if (score < 25) baseText = 'Severe hormonal imbalance with disrupted menstrual health';
    else if (score <= 60) baseText = 'Moderate Hormonal imbalance (if untreated, may disrupt fertility)';
    else if (score <= 80) baseText = 'Slight hormonal irregularities triggered by lifestyle, stress or nutritional deficiency';
    else baseText = 'No major hormonal or PMS issue detected. Continue maintaining hormonal and menstrual wellness.';

    let conditionTextHTML = `<p>${baseText}</p>`;

    let futureRisks = [];
    let possibleCauses = []; // Added for full report

    for (const groupKey in allAnswers) {
      allAnswers[groupKey].forEach((answer) => {
        const qRisks = config.futureRisksMapping[answer.question];
        const qCauses = config.causeMapping[answer.question];
        const texts = Array.isArray(answer.text) ? answer.text : [answer.text];

        texts.forEach((text) => {
          if (qRisks && qRisks[text]) {
            const risk = qRisks[text];
            if (risk && !futureRisks.includes(risk)) {
              futureRisks.push(risk);
            }
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

    return {
      issueTitle,
      conditionTextHTML,
      futureRisks,
      possibleCauses,
      timelineData: { general, extras },
      lifestyleConditions: [...new Set(finalLifestyleKeys)], // Pass the mapped keys
    };
  },

  async saveSubmission(state, db, config) {
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
      reportCategory: "Women's Probiotic & PMS Wellness",
      bmi: Number(healthMetrics.bmi) || 0,
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
