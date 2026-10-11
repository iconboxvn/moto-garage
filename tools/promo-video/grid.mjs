import puppeteer from 'puppeteer-core'; import fs from 'fs'; import path from 'path';
const [out, per, ...files] = process.argv.slice(2); const n = +per;
const rows = []; for (let i = 0; i < files.length; i += n) rows.push(files.slice(i, i + n));
const cell = f => `<div style="display:inline-block;margin:3px;text-align:center;color:#fff;font:12px sans-serif"><img src="file://${path.resolve(f)}" style="height:300px;display:block">${path.basename(f, '.png').replace(/^[a-z]+/,'')}s</div>`;
fs.writeFileSync('/tmp/_grid.html', '<body style="margin:0;background:#333">' + rows.map(r => `<div style="white-space:nowrap">${r.map(cell).join('')}</div>`).join('') + '</body>');
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new' });
const p = await b.newPage(); await p.setViewport({ width: n*224+20, height: rows.length*325+10 });
await p.goto('file:///tmp/_grid.html'); await new Promise(r => setTimeout(r, 500)); await p.screenshot({ path: out }); await b.close();
