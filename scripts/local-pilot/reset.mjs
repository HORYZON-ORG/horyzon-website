// Destructive ONLY to the explicitly named, disposable native fixture database.
import {foundationDatabase} from '../lib/patrimonial-foundation-db.mjs';
if(!process.argv.includes('--synthetic-local-only')||process.env.VERCEL)throw Error('Explicit local fixture reset required');
const db=await foundationDatabase();
await db.query("NOTIFY pgrst,'reload schema'");
await db.close();
console.log('Fresh synthetic radar_5a_test database ready. No provider Auth schema modified.');
