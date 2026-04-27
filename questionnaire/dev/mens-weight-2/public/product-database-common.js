// assets/product-database-common.js (UPDATED)
const productDatabaseCommon = {
    // Existing Wellness Products (Renamed from original keys)
    'Ovinorm': {
        name: 'Her Menses',
        image: 'https://cdn.shopify.com/s/files/1/0924/5687/8383/files/Hermenses1.jpg?v=1751872961',
        regularPrice: 449,
        salePrice: 399,
        variantId: '50972820996399',
        description: 'Ovinorm is a carefully made homeopathic solution that works to restore balance to your menstrual health...',
        active: true,
        whyPoints: [
            'Helps fix irregular or missed periods.',
            'Soothes pain, irritability, and emotional ups and downs.',
            'Useful in PCOS, delayed or painful periods.',
        ],
    },
    'Estrogen Balance': {
        name: 'EstroEssentia',
        image: 'https://cdn.shopify.com/s/files/1/0924/5687/8383/files/Product_Coming_Soon.jpg?v=1752838005',
        regularPrice: 1799,
        salePrice: 1799,
        variantId: '51170203926831',
        description: "EstroEssentia is a scientifically formulated supplement designed to support estrogen balance...",
        active: false,
        whyPoints: [
            'Helps the body get rid of hormone buildup.',
            'Reduces symptoms like bloating, breast tenderness, and irritability.',
            'Helps regulate cycles and reduce heavy or painful periods.',
        ],
    },
    'Vitamin D3 600UI': {
        name: 'Zencal D3K2',
        image: 'https://cdn.shopify.com/s/files/1/0924/5687/8383/files/Product_Coming_Soon.jpg?v=1752838005',
        regularPrice: 799,
        salePrice: 499,
        variantId: '50972820996399',
        description: "Zencal D3K2 is a daily wellness essential made to support bone strength...",
        active: false,
        whyPoints: [
            'Boosts metabolism and supports fat breakdown.',
            'Helps D3 work better and keeps calcium in bones, not in fat cells.',
            'Helps reduce fatigue and balance mood, making it easier to stay active and eat right',
        ],
    },
    'Intimate Wash': {
        name: 'Aloezy Wash',
        image: 'https://cdn.shopify.com/s/files/1/0924/5687/8383/files/FoamWashCreativeContentHeroImage1.jpg?v=1762326407',
        regularPrice: 449,
        salePrice: 399,
        variantId: '50972820996399',
        description: "Your intimate area deserves the same care as the rest of your body. SehatUP’s Intimate Foam Wash is a soothing, pH-balanced cleanser...",
        active: true,
        whyPoints: [
            'Soothe and calm the skin.',
            'Give a fresh, cooling feel.',
            'Maintains healthy pH balance.',
            'Protects against germs.',
            'Gentle and safe for daily use.',
        ],
    },
    'HormoniHerb Tea': {
        name: 'HormoniHerb Tea',
        image: 'https://cdn.shopify.com/s/files/1/0924/5687/8383/files/HormoniHerb_Tea-1.webp?v=1764746066',
        regularPrice: 499,
        salePrice: 399,
        variantId: '52046359200047',
        description: "HormoniHerb Tea is a carefully mixed herbal infusion designed to support women’s hormonal health...",
        active: true,
        whyPoints: [
            'Relax muscles and reduce cramping.',
            'Reduce inflammation and ease pain.',
            'Reduce bloating and water retention.',
            'Support hormonal balance and menstrual flow.',
            'Boost iron and energy during periods.',
        ],
    },
    'Thyroidinum 3x': {
        name: 'Thyrostatin 3X',
        image: 'https://cdn.shopify.com/s/files/1/0924/5687/8383/files/Product_Coming_Soon.jpg?v=1752838005',
        regularPrice: 399,
        salePrice: 249,
        variantId: '50972820996399',
        description: "Thyrostatin 3X is a homeopathic remedy that is made to support thyroid function naturally. If you're struggling with low energy, weight gain, slow metabolism, or emotional breakdown, these signs commonly indicate hypothyroidism. This remedy offers a gentle yet effective way to help your system restore balance.",
        active: false,
        whyPoints: [
            "Optimizes thyroid function which often causes unexplained weight gain.",
            "Boosts metabolic rate to help the body burn more calories.",
            "Reduces fatigue and lethargy, enabling higher activity levels.",
        ],
    },
    'Ignite Fat Burner': {
        name: 'Ignite Fat Burner',
        image:
            "https://cdn.shopify.com/s/files/1/0924/5687/8383/files/Product_Coming_Soon.jpg?v=1752838005",
        regularPrice: 1799,
        salePrice: 1799,
        variantId: "51170203926831",
        description:
            "Ignifit is a smart fat-burning formula designed to support healthy weight loss without compromising your energy or mood. Researched by clinically studied ingredients like CLA, Green Coffee Bean & White Kidney Bean Extract, it helps reduce fat storage, curb appetite & boost metabolism.",
        active: false,
        whyPoints: [
            "Burns stubborn fat (especially belly)",
            "Controls appetite and cravings",
            "Boosts metabolism and energy",
            "Helps in sugar and insulin balance",
        ],
    },
    'Leanor 60 mg': {
        name: 'Leanor 60 mg',
        image:
            "https://cdn.shopify.com/s/files/1/0924/5687/8383/files/Orlistat1.jpg?v=1751872910",
        regularPrice: 799,
        salePrice: 599,
        variantId: "51169561575727",
        description:
            "Orlistat 60 mg is a clinically researched weight management formula made to support fat loss by reducing the absorption of dietary fat. Perfect for those who are on a calorie deficit diet & active lifestyle, it helps accelerate your fitness goals without extreme diets or boosters.",
        active: true,
        whyPoints: [
            "Helps you lose weight by blocking fat absorption from the food you eat",
        ],
    },
    'Valora': {
        name: 'Valora for Hormonal Weight',
        image: 'https://cdn.shopify.com/s/files/1/0924/5687/8383/files/Product_Coming_Soon.jpg?v=1752838005',
        regularPrice: 799,
        salePrice: 499,
        variantId: '51928490234125',
        description: 'Valora is a comprehensive multivitamin & mineral supplement designed to support women’s immunity, energy & overall vitality. Infused with essential nutrients like Vitamin D2, B12, Zinc & Iron, along with Ginseng, Lycopene & Soya Isoflavones, it fulfills nutritional gaps while promoting hormonal balance & daily wellness.',
        active: false,
        whyPoints: [
            "Support energy, digestion, and fat metabolism.",
            "Fight tiredness so you stay active.",
            "Help with sugar control and reduce cravings.",
            "Balance female hormones (great for PCOS, menopause).",
            "Boosts energy and metabolism naturally.",
            "Supports cell health and reduces inflammation.",
        ],
    },
    'Slimtox Tea': {
        name: 'Slimtox Tea',
        image:
            "https://cdn.shopify.com/s/files/1/0924/5687/8383/files/Product_Coming_Soon.jpg?v=1752838005",
        regularPrice: 449,
        salePrice: 399,
        variantId: "50972820996399",
        description:
            "LeanRoutine is a calming, metabolism-boosting herbal tea designed to support weight management while helping you relax. Made by ingredients like Green Tea, Garcinia Cambogia, Hibiscus & Valerian Root, this mix helps burn fat, reduce stress & support digestion, all in one soothing cup.",
        active: false,
        whyPoints: [
            "Boost fat burning and reduce appetite.",
            "Control sugar cravings and improve digestion.",
            "Gently cleanse the body and reduce bloating.",
            "Help you relax and reduce stress eating.",
            "Support heart health and reduce inflammation.",
            "Support metabolism and hormonal balance.",
        ],
    },
    'Slimtox Energy Tea': {
        name: 'Slimtox Energy Tea',
        image:
            "https://cdn.shopify.com/s/files/1/0924/5687/8383/files/Product_Coming_Soon.jpg?v=1752838005",
        regularPrice: 449,
        salePrice: 399,
        variantId: "51170203926831",
        description:
            "Leanixir is a metabolism-boosting, antioxidant-rich green tea mix made to support your weight management journey the natural way. With carefully selected herbs like Oolong, Moringa & Gymnema, this energizing tea helps curb cravings, fire up metabolism & sharpen mental focus without the anxiety of artificial boosters.",
        active: false,
        whyPoints: [
            "Boost fat burning and metabolism.",
            "Cut bloating and sugar cravings.",
            "Help control blood sugar and reduce sweet cravings.",
            "Lower stress, which helps stop emotional eating.",
            "Improve digestion and reduce inflammation.",
        ],
    },
    'Metabolic Multivitamin': {
        name: 'Metabolic Multivitamin',
        image:
            "https://cdn.shopify.com/s/files/1/0924/5687/8383/files/Product_Coming_Soon.jpg?v=1752838005",
        regularPrice: 799,
        salePrice: 499,
        variantId: "50972820996399",
        description:
            "PrimeVital is a comprehensive multivitamin & mineral supplement customized to support men’s daily performance, immunity & overall vitality. Enriched with essential nutrients like Zinc, Iron, Magnesium & powerful botanicals such as Panax Ginseng, Green Tea Extract & Grape Seed, it’s built to fuel both body & mind.",
        active: false,
        whyPoints: [
           "Speed up metabolism and help burn more calories.",
            "Cut bloating and improve digestion.",
            "Reduce sugar cravings and support fat breakdown.",
            "Keep your gut healthy, which helps with weight control.",
            "Keep your energy high while dieting." 
        ],
    },
    'Garcinia Cambogia': {
        name: 'Garcinia Cambogia',
        image:
            "https://cdn.shopify.com/s/files/1/0924/5687/8383/files/GaceniaCambogiaDropsArtboard1_1.jpg?v=1753944226",
        regularPrice: 799,
        salePrice: 399,
        variantId: "51170203926831",
        description:
            "Garcinia Cambogia is a natural weight management supplement that supports fat metabolism & helps reduce emotional eating. Made with hydroxycitric acid (HCA)  which can reduce appetite, block fat production & uplift mood, makes it easier to stay committed to your wellness goals.",
        active: true,
        whyPoints: [
            "Natural fruit extract that helps you eat less, burn fat, and stop cravings.",
        ],
    },
};

window.productDatabase = productDatabaseCommon;