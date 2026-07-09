// Print a slice of flagged.json with full turns; flagged model turns marked with <<idx>>.
// usage: node show-batch.mjs <flagged.json> <start> <count>
import { readFileSync } from 'node:fs';
const [file, start = '0', count = '15'] = process.argv.slice(2);
const all = JSON.parse(readFileSync(file, 'utf8'));
const slice = all.slice(Number(start), Number(start) + Number(count));
for (const ex of slice) {
  console.log(`\n##### ${ex.file} #${ex.idx}   (flagged turns: ${ex.flagged.join(',')}) #####`);
  ex.turns.forEach((t, i) => {
    const mark = ex.flagged.includes(i) ? ` <<FLAG t${i}>>` : '';
    console.log(`t${i} ${t.role.toUpperCase()}${mark}: ${t.text.replace(/\n/g, ' ⏎ ')}`);
  });
}
console.log(`\n--- showing ${Number(start)}..${Number(start)+slice.length-1} of ${all.length} ---`);
process.exit(0);
