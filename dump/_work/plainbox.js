// Packaging copy: the box has a shipping label (address + product names cut
// to their first few letters), so it is not a blank box.
const fs = require('fs'), tp = 'D:/firebase/sehatupfirebase-main/shopify-theme/live/templates/page.healthscore 360.json';
let t = fs.readFileSync(tp, 'utf8');
const rep = (a, b) => { const c = t.split(a).length - 1; if (c !== 1) throw new Error('anchor x' + c + ': ' + a.slice(0, 70)); t = t.replace(a, b); };
rep(`"text_3": "In a plain box. Nobody knows what is inside. Confirm with just ₹50 and pay the rest on delivery, or pay in full online."`,
    `"text_3": "Packed discreetly. The label has your address, and product names show only their first few letters. Confirm with just ₹50 and pay the rest on delivery, or pay in full online."`);
rep(`"trust_3_text": "A plain box, nothing printed on it"`,
    `"trust_3_text": "Product names cut short on the label"`);
rep(`"answer": "<p>No. Your kit comes in a plain box with nothing printed on it about what is inside, and only your doctor sees your answers.</p>"`,
    `"answer": "<p>Your kit is packed discreetly. The shipping label has your address, and product names are cut to their first few letters, so the full names are not shown. Only your doctor sees your answers.</p>"`);
JSON.parse(t.slice(t.indexOf('{')));
fs.writeFileSync(tp, t);
console.log('ok');
