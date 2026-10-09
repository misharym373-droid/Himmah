// فحص الترجمة: يجد كل tr('...') و trf('...') في الكود ويتأكد أن لها ترجمة إنجليزية
// الاستخدام: node scripts/i18n-check.mjs [ملفات...]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dictDir = 'src/i18n/en';
const EN = {};
for (const f of readdirSync(dictDir)) Object.assign(EN, (await import('../' + join(dictDir, f))).default);

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = process.argv.slice(2).length ? process.argv.slice(2) : walk('src').filter((f) => /\.(jsx?|mjs)$/.test(f) && !f.startsWith('src/i18n'));
const re = /\btrf?\(\s*(['"`])((?:\\.|(?!\1).)*?)\1/gs;
let missing = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(re)) {
    if (m[1] === '`' && m[2].includes('${')) {
      console.log(`${f}: template literal with \${} inside tr() — use trf with {vars}: ${m[2].slice(0, 60)}`);
      missing++;
      continue;
    }
    const key = m[2].replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n');
    if (!(key in EN)) {
      console.log(`${f}: missing: ${key}`);
      missing++;
    }
  }
}
console.log(missing ? `\n${missing} issue(s)` : 'OK — every tr()/trf() string has an English translation');
process.exit(missing ? 1 : 0);
