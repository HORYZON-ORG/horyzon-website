// Prints the SQL that seeds hub.radar_advice with the default texts of src/lib/radar/advice.ts.
// Existing rows are kept: the Hub copy wins once someone has edited it.
import { DEFAULT_RADAR_ADVICE } from '../src/lib/radar/advice.ts';
const q = (text) => `'${String(text).replaceAll("'", "''")}'`;
const rows = DEFAULT_RADAR_ADVICE.map((a, i) => `  (${q(a.kind)}, ${q(a.subject)}, ${q(a.band)}, ${i}, ${q(a.title)}, ${q(a.body)}, ${q(a.action)})`);
console.log(`insert into hub.radar_advice (kind, subject, band, position, title, body, action) values\n${rows.join(',\n')}\non conflict (kind, subject, band) do nothing;`);
