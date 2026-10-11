import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const lang = process.argv[2] || 'vn';
const out = process.argv[3] || 'out'; // 예: ../../store-assets/screenshots/v2
const SET = {
  vn: [['home','Nhắc bảo dưỡng|trước khi tới hạn'],['consumables','Dầu nhớt, lọc gió,|má phanh… theo dõi đủ'],['history','Lịch sử bảo dưỡng|xuất PDF khi bán xe'],['sosauto','Va chạm? SOS tự gửi|vị trí cho người thân'],['news','Tin triệu hồi &|tin xe máy mới nhất']],
  en: [['home','Service reminders|before they’re due'],['consumables','Oil, filters, brake pads|— all tracked'],['history','Service history|PDF when you sell'],['sosauto','Crash? SOS texts|your location'],['news','Recall alerts &|the latest bike news']],
  ko: [['home','교체 시기 전에|미리 알려드려요'],['consumables','소모품 상태를|한눈에 확인'],['history','정비 이력 PDF|중고 판매 때 증빙'],['sosauto','낙차 감지 시|자동 SOS 문자 발송'],['news','리콜·신차 소식을|한곳에서']],
}[lang];
const pre = { vn:'vi', en:'en', ko:'ko' }[lang];
fs.mkdirSync(out, { recursive:true });
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new' });
const p = await b.newPage();
await p.setViewport({ width:1080, height:2100, deviceScaleFactor:1 });
let i = 0;
for (const [name, cap] of SET) {
  i++;
  const img = 'file://' + process.cwd() + `/raw/${lang}_${name}.png`;
  const html = `<!doctype html><meta charset=utf-8><style>
    *{box-sizing:border-box;margin:0}
    body{width:1080px;height:2100px;background:radial-gradient(120% 60% at 50% 0%,#1d1608 0%,#0c0c0d 55%);font-family:-apple-system,'Helvetica Neue','Apple SD Gothic Neo',sans-serif;color:#fff;position:relative;overflow:hidden}
    .bar{position:absolute;left:140px;top:84px;width:72px;height:8px;background:#eca710;border-radius:4px}
    h1{position:absolute;left:140px;right:140px;top:120px;font-size:68px;line-height:1.16;font-weight:800;letter-spacing:-.5px}
    .ph{position:absolute;left:140px;top:340px;width:800px;height:1731px;border-radius:44px;overflow:hidden;border:2px solid #2a2a2e;box-shadow:0 30px 80px rgba(0,0,0,.6)}
    .ph img{width:100%;height:100%;display:block}
  </style><div class=bar></div><h1>${cap.replace(/&/g,'&amp;').replace('|','<br>')}</h1><div class=ph><img src="${img}"></div>`;
  fs.writeFileSync('compose.html', html);
  await p.goto('file://' + process.cwd() + '/compose.html', { waitUntil:'load' });
  await p.screenshot({ path:`${out}/${pre}_0${i}_${name}.png` });
}
await b.close();
