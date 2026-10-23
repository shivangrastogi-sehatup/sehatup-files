// Builds templates/page.landing-weight.json from the live PCOD landing template.
const fs = require('fs');
const src = 'D:/firebase/sehatupfirebase-main/dump/_work/livelp/templates/page.landing-pcod.json';
const out = 'D:/firebase/sehatupfirebase-main/dump/_work/livelp/templates/page.landing-weight.json';
const raw = fs.readFileSync(src, 'utf8');
const j = JSON.parse(raw.slice(raw.indexOf('{')));
const S = j.sections;
const WEIGHT = ['calm-curve-control', 'macho-metabolism', 'leanroutine', 'slimtox-energy-tea'];

// Header: Home / About / Contact Us on the left, "Trusted by 15,000+" on the right.
Object.assign(S.header.settings, { trust_before: 'Trusted by', trust_number: '15,000+' });

// Hero: heading on top, photo + card below.
Object.assign(S.hero.settings, {
  layout: 'card', glow: true, glow_color: '#fbdcd3', image_side: 'left',
  image: '', // upload: a couple struggling with their weight
  ticks: 'Diet\nExercise\nWeight Loss Pills', tick_color: '#2e9e5b',
  heading: 'Still Struggling to', highlight: 'Lose Weight?', heading_end: '',
  subheading: 'Then work on the root cause, not just the symptoms.', sub_red: 'root cause',
  card_heading: 'Talk to a doctor, free and private',
  card_text: 'Find out what is really holding your weight back, and what to do next.',
  button_1: 'Book an Appointment', button_1_note: '', button_1_link: '#book',
  button_2: 'Take 360 Self-Assessment', button_2_note: '', button_2_link: '/pages/health-score-360',
  privacy: 'Don’t worry, we keep your information private.',
  trust_text: 'Trusted by 15,000+ people', rating: '4.5', trust_initials: 'R, P, S',
  avatar_1: 'shopify://shop_images/Joyful_South_Asian_Man_Portrait.webp',
  avatar_2: 'shopify://shop_images/Warm_Portrait_with_Red_Dupatta.webp',
  avatar_3: 'shopify://shop_images/Warm_Professional_Headshot.webp',
  review_products: WEIGHT,
  chip_1: '', chip_2: '', gap: 56, img_width: 54, img_zoom: 100, img_focus: 30, img_height_mobile: 300,
});

// Symptoms.
const sym = [
  ['scale', 'Weight Gain', 'Kilos that keep adding up, month after month.'],
  ['down', 'Belly Fat', 'Fat around the middle that will not shift.'],
  ['timer', 'Stubborn Weight', 'The scale will not move, even when you try.'],
  ['heart', 'Food Cravings', 'Hunger and cravings that are hard to control.'],
  ['calendar', 'PCOS/PCOD-Related Weight Concerns', 'Weight that comes with irregular periods or hormones.'],
  ['question', 'Other Weight Management Concerns', 'Something else about your weight on your mind.'],
];
S.symptoms.block_order.forEach((id, i) => {
  const [icon, title, text] = sym[i];
  S.symptoms.blocks[id].settings = { icon, icon_image: '', title, text, form_value: title };
});

// Success stories: same layout, weight-loss reviews.
Object.assign(S.stories.settings, { review_products: WEIGHT });

// Why trust: root cause + weight points + certifications (kept).
const why = S.trust.block_order.map(id => S.trust.blocks[id]);
why[1].settings = { ...why[1].settings, icon: 'chart', icon_image: '', title: 'Personalised Weight Plan', text: 'A plan built around your body, habits and health history.' };
why[2].settings = { ...why[2].settings, icon: 'pulse', title: 'Metabolism and Hormone Support', text: 'Care that looks at thyroid, hormones and metabolism, not just calories.' };
why[3].settings = { ...why[3].settings, title: 'Doctor-Led Guidance', text: 'Get professional guidance tailored to your weight and health needs.' };

// Start your journey.
Object.assign(S.ready.settings, { heading: 'Start your', highlight: 'Weight Loss Journey' });
const rd = S.ready.block_order.map(id => S.ready.blocks[id]);
rd[0].settings = { ...rd[0].settings, title: 'Private Consultation', text: 'Talk to a doctor about your weight, privately and for free.', button: 'Book free consultation', link: '#book' };
rd[1].settings = { ...rd[1].settings, title: 'Private Self-Assessment', text: 'A 2-minute check that looks at what is behind your weight.', button: 'Take Free Assessment', link: '/pages/health-score-360' };
rd[2].settings = { ...rd[2].settings, link: 'https://wa.me/919355539355?text=Hi%2C%20I%20have%20a%20question%20about%20weight%20loss' };

// Booking form: own source, both genders, own sheet (URL added after the script is deployed).
Object.assign(S.book.settings, {
  subheading: 'Book your slot and get expert guidance for weight loss.',
  concerns: sym.map(x => x[1]).join('\n') + '\nSomething else',
  source: 'landing_weight', gender: 'none', sheet_url: '',
});

// Not sure.
Object.assign(S.unsure.settings, {
  heading: 'Not sure why you’re not able to', highlight: 'lose weight?',
  subheading: 'Take our self-assessment to get personalised recommendations based on your symptoms & concerns.',
  button: 'Take HS 360 assessment', link: '/pages/health-score-360',
});

const body = JSON.stringify(j, null, 2);
JSON.parse(body);
fs.writeFileSync(out, raw.slice(0, raw.indexOf('{')) + body + '\n');
console.log('written', out.split('/').pop(), '| sections:', j.order.join(', '));
