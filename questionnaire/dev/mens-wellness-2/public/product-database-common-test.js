// product-database-common.js

/**
 * PRODUCT_REGISTRY: The single source of truth for Shopify Handles.
 * Keys here are "Stable Internal IDs" that never change.
 * Handles are the URL parts from Shopify.
 */
const PRODUCT_REGISTRY = {
    HER_MENSES: { handle: 'harmen' },
    ESTROGEN_BALANCE: { handle: 'estrogen-balance' },
    D3K2: { handle: 'vitamin-d3k2' },
    INTIMATE_WASH: { handle: 'aloezy-intimate-foam-wash' },
    HORMONIHERB_TEA: { handle: 'tea-for-period-cramps' },
    THYROIDINUM: { handle: 'thyroidinum-3x' },
    IGNITE: { handle: 'ignite-fat-burner' },
    ORLISTAT: { handle: 'orlistat-60-mg' },
    VALORA: { handle: 'valora' },
    SLIMTOX_RELAX_TEA: { handle: 'leanroutine' },
    SLIMTOX_ENERGY_TEA: { handle: 'slimtox-energy-tea' },
    METABOLIC_MULTI: { handle: 'metabolic-multivitamin' },
    GARCINIA: { handle: 'garcenia-cambogia-drops' },
    TADALAFIL: { handle: 'tadalafil-5-mg' },
    ASHWAGANDHA: { handle: 'ashwagandha-tablets' },
    SHILAJIT: { handle: 'pure-himalayan-shilajit-resin-20g' },
    DAPOX: { handle: 'dapoxetine-hyderochloride-tablets-ip-30-mg-pack-of-2' },
};

const productDatabaseCommon = {

    [PRODUCT_REGISTRY.HER_MENSES.handle]: {
        description: 'Her Menses is a carefully made homeopathic solution that works to restore balance to your menstrual health...',
        whyPoints: [
            'Helps fix irregular or missed periods.',
            'Soothes pain, irritability, and emotional ups and downs.',
            'Useful in PCOS, delayed or painful periods.',
        ],
    },

    [PRODUCT_REGISTRY.ESTROGEN_BALANCE.handle]: {
        description: "EstroEssentia is a scientifically formulated supplement designed to support estrogen balance...",
        whyPoints: [
            'Helps the body get rid of hormone buildup.',
            'Reduces symptoms like bloating, breast tenderness, and irritability.',
            'Helps regulate cycles and reduce heavy or painful periods.',
        ],
    },

    [PRODUCT_REGISTRY.D3K2.handle]: {
        description: "Zencal D3K2 is a daily wellness essential made to support bone strength...",
        whyPoints: [
            'Boosts metabolism and supports fat breakdown.',
            'Helps D3 work better and keeps calcium in bones, not in fat cells.',
            'Helps reduce fatigue and balance mood.',
        ],
    },

    [PRODUCT_REGISTRY.INTIMATE_WASH.handle]: {
        description: "SehatUP’s Intimate Foam Wash is a soothing, pH-balanced cleanser for daily hygiene...",
        whyPoints: [
            'Soothe and calm the skin.',
            'Maintain healthy pH balance.',
            'Gentle and safe for daily use.',
        ],
    },

    [PRODUCT_REGISTRY.HORMONIHERB_TEA.handle]: {
        description: "HormoniHerb Tea is a carefully mixed herbal infusion designed to support hormonal health...",
        whyPoints: [
            'Relax muscles and reduce cramping.',
            'Reduce bloating and water retention.',
            'Support hormonal balance.',
        ],
    },

    [PRODUCT_REGISTRY.THYROIDINUM.handle]: {
        description: "A homeopathic remedy designed to support thyroid function naturally.",
        whyPoints: [
            "Optimizes thyroid function.",
            "Boosts metabolic rate.",
            "Reduces fatigue and lethargy.",
        ],
    },

    [PRODUCT_REGISTRY.IGNITE.handle]: {
        description: "A smart fat-burning formula designed to support healthy weight loss.",
        whyPoints: [
            "Burns stubborn fat.",
            "Controls appetite and cravings.",
            "Boosts metabolism and energy.",
        ],
    },

    [PRODUCT_REGISTRY.ORLISTAT.handle]: {
        description: "Orlistat 60 mg supports fat loss by reducing dietary fat absorption.",
        whyPoints: [
            "Helps lose weight by blocking fat absorption.",
        ],
    },

    [PRODUCT_REGISTRY.VALORA.handle]: {
        description: 'A comprehensive multivitamin designed to support hormonal balance & vitality.',
        whyPoints: [
            "Supports energy and digestion.",
            "Balances female hormones.",
            "Boosts metabolism naturally.",
        ],
    },

    [PRODUCT_REGISTRY.SLIMTOX_RELAX_TEA.handle]: {
        description: "A calming metabolism-boosting herbal tea for weight management.",
        whyPoints: [
            "Boost fat burning.",
            "Reduce bloating.",
            "Help reduce stress eating.",
        ],
    },

    [PRODUCT_REGISTRY.SLIMTOX_ENERGY_TEA.handle]: {
        description: "An energizing herbal tea that boosts metabolism and reduces cravings.",
        whyPoints: [
            "Boost fat burning.",
            "Improve digestion.",
            "Control sugar cravings.",
        ],
    },

    [PRODUCT_REGISTRY.METABOLIC_MULTI.handle]: {
        description: "A multivitamin designed to support metabolism and daily vitality.",
        whyPoints: [
            "Speeds up metabolism.",
            "Improves digestion.",
            "Keeps energy high.",
        ],
    },

    [PRODUCT_REGISTRY.GARCINIA.handle]: {
        description: "A natural supplement that supports fat metabolism and reduces emotional eating.",
        whyPoints: [
            "Reduces appetite.",
            "Blocks fat production.",
        ],
    },

    [PRODUCT_REGISTRY.TADALAFIL.handle]: {
        description: "Low-dose medicine to support erectile function and performance.",
        whyPoints: [
            "Increases sexual confidence.",
            "Helps prolong performance.",
        ],
    },

    [PRODUCT_REGISTRY.ASHWAGANDHA.handle]: {
        description: "The King of Herbs in Ayurveda for stamina, libido, and stress tolerance.",
        whyPoints: [
            "Improves libido.",
            "Enhances stamina.",
            "Supports stronger erections.",
        ],
    },

    [PRODUCT_REGISTRY.SHILAJIT.handle]: {
        description: "Pure Himalayan Shilajit with 85+ minerals and high fulvic acid.",
        whyPoints: [
            "Enhances testosterone levels.",
            "Improves blood flow.",
            "Supports sexual health.",
        ],
    },

    [PRODUCT_REGISTRY.DAPOX.handle]: {
        description: "On-demand medicine to delay ejaculation and improve control.",
        whyPoints: [
            "Delays ejaculation.",
            "Improves satisfaction.",
            "Builds confidence.",
        ],
    },

};

/**
 * Hydrates the product database with live data from Shopify.
 * Now uses Handles (from PRODUCT_REGISTRY) to match products.
 */
function hydrateProductDatabase() {
    const staticDB = productDatabaseCommon;
    const liveDB = window.shopifyLiveProducts || {};
    const finalDB = {};

    // Use Registry to build the final database keyed by Internal ID
    Object.keys(PRODUCT_REGISTRY).forEach(idKey => {
        const productInfo = PRODUCT_REGISTRY[idKey];
        const handle = productInfo.handle;

        // 1. Get static data (using handle as key in staticDB)
        const staticData = staticDB[handle] || {
            description: "Product details coming soon.",
            whyPoints: ["High quality ingredients", "Scientifically formulated"]
        };

        // 2. Get live Shopify data
        const liveProduct = liveDB[handle];

        if (!liveProduct) {
            // Fallback if product not found in the current Shopify collection
            finalDB[idKey] = {
                ...staticData,
                name: idKey.replace(/_/g, ' '),
                active: false
            };
            return;
        }

        // 3. Select best variant
        const variants = Object.values(liveProduct.variants);
        const liveVariant = variants.find(v => v.available) || variants[0];

        // 4. Merge everything into the Stable ID key
        finalDB[idKey] = {
            ...staticData,
            name: liveProduct.title,
            image: liveProduct.featuredImage,
            variantId: Object.keys(liveProduct.variants).find(id => liveProduct.variants[id] === liveVariant),
            regularPrice: (liveVariant.compareAtPrice || liveVariant.price) / 100,
            salePrice: liveVariant.price / 100,
            active: liveVariant.available && liveVariant.price > 0,
            handle: handle // Store handle for reference
        };
    });

    return finalDB;
}

// Expose safely to window
window.PRODUCT_REGISTRY = PRODUCT_REGISTRY;
window.productDatabase = hydrateProductDatabase();
