// product-database-common.js

const productDatabaseCommon = {

    'Her Menses': {
        description: 'Her Menses is a carefully made homeopathic solution that works to restore balance to your menstrual health...',
        whyPoints: [
            'Helps fix irregular or missed periods.',
            'Soothes pain, irritability, and emotional ups and downs.',
            'Useful in PCOS, delayed or painful periods.',
        ],
    },

    'Estrogen Balance': {
        description: "EstroEssentia is a scientifically formulated supplement designed to support estrogen balance...",
        whyPoints: [
            'Helps the body get rid of hormone buildup.',
            'Reduces symptoms like bloating, breast tenderness, and irritability.',
            'Helps regulate cycles and reduce heavy or painful periods.',
        ],
    },

    'Zencal D3K2': {
        description: "Zencal D3K2 is a daily wellness essential made to support bone strength...",
        whyPoints: [
            'Boosts metabolism and supports fat breakdown.',
            'Helps D3 work better and keeps calcium in bones, not in fat cells.',
            'Helps reduce fatigue and balance mood.',
        ],
    },

    'Intimate Wash': {
        description: "SehatUP’s Intimate Foam Wash is a soothing, pH-balanced cleanser for daily hygiene...",
        whyPoints: [
            'Soothe and calm the skin.',
            'Maintain healthy pH balance.',
            'Gentle and safe for daily use.',
        ],
    },

    'HormoniHerb Tea': {
        description: "HormoniHerb Tea is a carefully mixed herbal infusion designed to support hormonal health...",
        whyPoints: [
            'Relax muscles and reduce cramping.',
            'Reduce bloating and water retention.',
            'Support hormonal balance.',
        ],
    },

    'Thyroidinum 3x': {
        description: "A homeopathic remedy designed to support thyroid function naturally.",
        whyPoints: [
            "Optimizes thyroid function.",
            "Boosts metabolic rate.",
            "Reduces fatigue and lethargy.",
        ],
    },

    'Ignite Fat Burner': {
        description: "A smart fat-burning formula designed to support healthy weight loss.",
        whyPoints: [
            "Burns stubborn fat.",
            "Controls appetite and cravings.",
            "Boosts metabolism and energy.",
        ],
    },

    'Orlistat 60 mg': {
        description: "Orlistat 60 mg supports fat loss by reducing dietary fat absorption.",
        whyPoints: [
            "Helps lose weight by blocking fat absorption.",
        ],
    },

    'Valora': {
        description: 'A comprehensive multivitamin designed to support hormonal balance & vitality.',
        whyPoints: [
            "Supports energy and digestion.",
            "Balances female hormones.",
            "Boosts metabolism naturally.",
        ],
    },

    'Slimtox Tea': {
        description: "A calming metabolism-boosting herbal tea for weight management.",
        whyPoints: [
            "Boost fat burning.",
            "Reduce bloating.",
            "Help reduce stress eating.",
        ],
    },

    'Slimtox Energy Tea': {
        description: "An energizing herbal tea that boosts metabolism and reduces cravings.",
        whyPoints: [
            "Boost fat burning.",
            "Improve digestion.",
            "Control sugar cravings.",
        ],
    },

    'Metabolic Multivitamin': {
        description: "A multivitamin designed to support metabolism and daily vitality.",
        whyPoints: [
            "Speeds up metabolism.",
            "Improves digestion.",
            "Keeps energy high.",
        ],
    },

    'Garcinia Cambogia': {
        description: "A natural supplement that supports fat metabolism and reduces emotional eating.",
        whyPoints: [
            "Reduces appetite.",
            "Blocks fat production.",
        ],
    },

    'Tadalafil': {
        description: "Low-dose medicine to support erectile function and performance.",
        whyPoints: [
            "Increases sexual confidence.",
            "Helps prolong performance.",
        ],
    },

    'Ashwagandha': {
        description: "The King of Herbs in Ayurveda for stamina, libido, and stress tolerance.",
        whyPoints: [
            "Improves libido.",
            "Enhances stamina.",
            "Supports stronger erections.",
        ],
    },

    'Shilajit': {
        description: "Pure Himalayan Shilajit with 85+ minerals and high fulvic acid.",
        whyPoints: [
            "Enhances testosterone levels.",
            "Improves blood flow.",
            "Supports sexual health.",
        ],
    },

    'Dapox': {
        description: "On-demand medicine to delay ejaculation and improve control.",
        whyPoints: [
            "Delays ejaculation.",
            "Improves satisfaction.",
            "Builds confidence.",
        ],
    },

};


function hydrateProductDatabase() {
    const staticDB = productDatabaseCommon;
    const liveDB = window.shopifyLiveProducts || {};

    Object.keys(staticDB).forEach(key => {
        const item = staticDB[key];

        // Find Shopify product by title match
        const liveProduct = Object.values(liveDB).find(p =>
            p.title.toLowerCase().includes(key.toLowerCase())
        );

        if (!liveProduct) {
            item.active = false;   // Mark inactive
            return;
        }

        const variants = Object.values(liveProduct.variants);
        const liveVariant = variants.find(v => v.available) || variants[0];

        item.name = liveProduct.title;
        item.image = liveProduct.featuredImage;
        item.variantId = Object.keys(liveProduct.variants)
            .find(id => liveProduct.variants[id] === liveVariant);

        item.regularPrice = (liveVariant.compareAtPrice || liveVariant.price) / 100;
        item.salePrice = liveVariant.price / 100;
        item.active = liveVariant.available;
    });

    return staticDB;
}

window.productDatabase = hydrateProductDatabase();
