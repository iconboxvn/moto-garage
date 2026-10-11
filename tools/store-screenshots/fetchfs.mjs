import fs from 'fs';
import { fileURLToPath as _f } from 'url';
import { dirname as _d } from 'path';
process.chdir(_d(_f(import.meta.url)));
const base = 'https://firestore.googleapis.com/v1/projects/moto-garage-8da30/databases/(default)/documents:runQuery';
const conv = v => {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) { const t = new Date(v.timestampValue).getTime(); return { seconds: Math.floor(t/1000), nanoseconds: 0 }; }
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, conv(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(conv);
  return null;
};
async function q(col, field, limit) {
  const r = await fetch(base, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ structuredQuery:{ from:[{collectionId:col}], orderBy:[{field:{fieldPath:field},direction:'DESCENDING'}], limit } }) });
  const j = await r.json();
  if (!Array.isArray(j)) { console.log(col, JSON.stringify(j).slice(0,300)); return []; }
  return j.filter(x => x.document).map(x => ({ id: x.document.name.split('/').pop(), data: Object.fromEntries(Object.entries(x.document.fields).map(([k, v]) => [k, conv(v)])) }));
}
const news = await q('brand_news', 'publishedAt', 200);
const fuel = await q('fuel_prices', 'effectiveAt', 3);
fs.writeFileSync('fs_news.json', JSON.stringify(news)); fs.writeFileSync('fs_fuel.json', JSON.stringify(fuel));
console.log('news', news.length, 'fuel', fuel.length);
console.log(JSON.stringify(fuel[0]?.data).slice(0, 400));
console.log(JSON.stringify(news[0]?.data).slice(0, 500));
