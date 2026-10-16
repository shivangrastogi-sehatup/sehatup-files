const fs = require('fs'), path = require('path');
const OUT = 'D:/firebase/sehatupfirebase-main/dump/icon-prompts';

const STYLE = `STYLE (keep exactly the same for every icon in the set):
- One single icon, centred on a square 512 x 512 px canvas, TRANSPARENT background (no white, no circle, no tile behind it).
- Thick outline (line) icon. Stroke width 40 px on the 512 px canvas (about 8% of the width), the same thickness everywhere. This icon is shown very small on the website (about 32 px), so thin lines disappear: keep the lines THICK.
- Round line ends and round corners. No fill, no shading, no gradient, no 3D, no shadow.
- One colour only: #d81f48 (brand red).
- Very simple: 2 to 3 shapes at most, no small details, no tiny dots, no text, no letters, no numbers.
- Leave at least 50 px empty space on every side, and keep gaps between lines at least as wide as the line itself, so it stays clear when shrunk.
- Modern, friendly, medical-but-calm, same look as Lucide or Feather icons but with heavier lines.`;

const icons = {
  men: [
    ['01-why-root-cause', 'Why do thousands trust sehatUP', 'Treat Root Cause, Not Just Symptoms', 'two cupped open hands holding a small leaf, with a capsule and a water drop floating just above (three systems of care: Ayurveda, Allopathy, Homeopathy)'],
    ['02-why-improved-performance', 'Why do thousands trust sehatUP', '85% Improved Performance', 'a simple rising bar chart with three bars and an upward arrow'],
    ['03-why-improved-relationships', 'Why do thousands trust sehatUP', '92% Improved Relationships', 'two overlapping hearts'],
    ['04-why-doctor-therapist', 'Why do thousands trust sehatUP', 'Doctor + Therapist Follow-up Included', 'a doctor (head and shoulders with a stethoscope) next to a small speech bubble'],
    ['05-why-certified', 'Why do thousands trust sehatUP', 'We are certified', 'a shield with a check mark inside'],
  ],
  women: [
    ['01-why-root-cause', 'Why do thousands trust sehatUP', 'Treat Root Cause, Not Just Symptoms', 'two cupped open hands holding a small leaf, with a capsule and a water drop floating just above (three systems of care: Ayurveda, Allopathy, Homeopathy)'],
    ['02-why-irregular-periods', 'Why do thousands trust sehatUP', 'Irregular Periods', 'a circular cycle arrow with a single drop in its centre'],
    ['03-why-hormonal-support', 'Why do thousands trust sehatUP', 'Hormonal Health Support', 'a heart with a pulse line running through it'],
    ['04-why-doctor-led', 'Why do thousands trust sehatUP', 'Doctor-Led Guidance', 'a stethoscope'],
    ['05-why-certified', 'Why do thousands trust sehatUP', 'We are certified', 'a shield with a check mark inside'],
  ],
};

for (const [who, list] of Object.entries(icons)) {
  const dir = path.join(OUT, who);
  fs.mkdirSync(dir, { recursive: true });
  for (const [file, where, title, idea] of list) {
    const body = `ICON: ${title}
PAGE: ${who === 'men' ? "Men's landing page (/pages/mens-check)" : 'PCOD landing page (/pages/pcod-check)'}
SECTION: ${where}
SAVE AS: ${file}.png

PROMPT (paste everything below into ChatGPT):
----------------------------------------------------------------
Create a single app-style icon for a health website.
What it shows: ${idea}.
Meaning: "${title}".

${STYLE}

Output: 512 x 512 px PNG with a transparent background.
----------------------------------------------------------------

IF IT COMES OUT WRONG, reply with one of these:
- "Make the lines thicker, 40 px, and remove the small details."
- "Use only the colour #d81f48 and a transparent background, nothing behind the icon."
- "Simpler: fewer shapes, bigger gaps between the lines."
`;
    fs.writeFileSync(path.join(dir, file + '.txt'), body);
  }
}

const readme = `ICON PROMPTS: "Why do thousands trust sehatUP?" SECTION
=====================================================

men/    5 prompts for the men's landing page  (/pages/mens-check)
women/  5 prompts for the PCOD landing page   (/pages/pcod-check)

One file = one icon. Open a file, copy the prompt part into ChatGPT,
download the PNG and save it with the name shown in "SAVE AS".

WHY THE LINES MUST BE THICK
In this section each icon shows at only about 32 px, inside a 56 px
pink circle. A 512 px image shrunk to 32 px keeps only 1/16 of its line
width, so a line must be about 40 px thick on the 512 px canvas to look
like the 2-2.5 px lines of the icons already there.

TIPS FOR A MATCHING SET
- Make all 5 icons of one page in the same ChatGPT chat, and after the
  first good one say: "Use exactly the same style, line thickness and
  colour as the previous icon" for every next one.
- If one looks too detailed, ask: "Simpler, fewer shapes, thicker lines."
- Check each icon shrunk down (zoom out until it is about the size of a
  fingernail on screen). If you can still tell what it is, it is good.

WHERE TO UPLOAD
Theme editor > the landing page > "Why do thousands trust sehatUP?" >
click a point > "Icon image (replaces the icon above)" > Save.

Colour: #d81f48 (brand red). Background: transparent.
`;
fs.writeFileSync(path.join(OUT, 'README.txt'), readme);
console.log('written:', fs.readdirSync(path.join(OUT, 'men')).length, 'men,', fs.readdirSync(path.join(OUT, 'women')).length, 'women');
