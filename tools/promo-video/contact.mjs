import puppeteer from 'puppeteer-core'; import path from 'path'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const files = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new' });
const p = await b.newPage(); await p.setViewport({ width: files.length*250, height:460 });
import fs from 'fs'; fs.writeFileSync('/tmp/_contact.html', '<body style="margin:0;background:#444;display:flex;gap:10px;padding:10px">' + files.map(f => `<img src="file://${path.resolve(f)}" style="height:440px">`).join('') + '</body>');
await p.goto('file:///tmp/_contact.html');
await new Promise(r => setTimeout(r, 500));
await p.screenshot({ path: path.join(HERE, 'contact.png') }); await b.close();
