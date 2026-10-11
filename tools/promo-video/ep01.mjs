// 시리즈 1편 조립: 앞(주행+카메라 낙하) → 뒤(💢 반응) → 질문 카드 → SOS 카드 → 끝 카드(도메인)
// 사용: node ep01.mjs "<앞.mp4>" "<뒤.mp4>" "<sos card .mp4>"  → out/ep01-vn.mp4
import puppeteer from 'puppeteer-core';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const [A, B, SOS] = process.argv.slice(2);
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
fs.mkdirSync('out/ep01', { recursive:true });

const T = { // 자막 (베트남어 초안)
  hook: 'Camera rơi giữa đường…',
  react: 'Chỉ là camera thôi mà đã bực…',
  ask: 'Còn nếu là <em>BẠN</em> ngã thì sao?',
  domain: 'ridemate.iconbox.com',
  sub: 'Gõ vào trình duyệt · Link ở bio',
};
const css = `*{margin:0;box-sizing:border-box}html,body{width:1080px;height:1920px;overflow:hidden;font-family:-apple-system,'Helvetica Neue',sans-serif;color:#fff}
.t{position:absolute;left:70px;right:70px;top:200px;font-size:76px;line-height:1.2;font-weight:800;text-shadow:0 4px 18px rgba(0,0,0,.85),0 0 4px rgba(0,0,0,.9);-webkit-text-stroke:2px rgba(0,0,0,.55);paint-order:stroke fill}
em{font-style:normal;color:#eca710}`;
const pages = {
  hook: `<style>${css}</style><div class=t>${T.hook}</div>`,
  react: `<style>${css}</style><div class=t>${T.react}</div>`,
  ask: `<style>${css}body{background:#0c0c0d}.t{top:760px;text-align:center;font-size:92px;-webkit-text-stroke:0;text-shadow:none}</style><div class=t>${T.ask}</div>`,
  end: `<style>${css}body{background:#0c0c0d}.l{position:absolute;left:0;right:0;top:640px;text-align:center;font-size:56px;font-weight:800;letter-spacing:14px;color:#eca710}
  .d{position:absolute;left:0;right:0;top:800px;text-align:center;font-size:84px;font-weight:800;letter-spacing:-1px}
  .s{position:absolute;left:0;right:0;top:950px;text-align:center;font-size:44px;color:#a0a0a8}</style><div class=l>RIDEMATE</div><div class=d>${T.domain}</div><div class=s>${T.sub}</div>`,
};
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new' });
const p = await b.newPage(); await p.setViewport({ width:1080, height:1920, deviceScaleFactor:1 });
for (const [k, h] of Object.entries(pages)) {
  fs.writeFileSync(`out/ep01/${k}.html`, `<!doctype html><meta charset=utf-8>${h}`);
  await p.goto('file://' + path.resolve(`out/ep01/${k}.html`));
  await p.screenshot({ path:`out/ep01/${k}.png`, omitBackground: !['ask','end'].includes(k) });
}
await b.close();

// 구간 길이
const A_SS = 0.3, A_T = 9.7, B_T = 3.2, ASK_T = 2.0, SOS_SS = 0.4, SOS_T = 6.0, END_T = 3.2;
const up = 'scale=1080:1920:flags=lanczos,unsharp=5:5:0.6,setsar=1,fps=30,format=yuv420p';
const inputs = ['-ss', A_SS, '-t', A_T, '-i', A, '-ss', 0, '-t', B_T, '-i', B, '-ss', SOS_SS, '-t', SOS_T, '-i', SOS,
  '-loop','1','-framerate','30','-t',ASK_T,'-i','out/ep01/ask.png','-loop','1','-framerate','30','-t',END_T,'-i','out/ep01/end.png',
  '-loop','1','-framerate','30','-t',A_T,'-i','out/ep01/hook.png','-loop','1','-framerate','30','-t',B_T,'-i','out/ep01/react.png'];
const fc = [
  `[0:v]${up}[a0];[5:v]format=rgba[hk];[a0][hk]overlay=0:0:enable='between(t,0.2,3.6)'[v0]`,
  `[1:v]${up}[b00];[b00]split[bs1][bs2];[bs2]crop=520:340:520:1480,gblur=sigma=28[bl];color=c=black:s=520x340:r=30:d=${B_T + 1},drawbox=x=40:y=40:w=440:h=260:color=white:t=fill,gblur=sigma=22,format=gray[mk];[bl][mk]alphamerge[bla];[bs1][bla]overlay=520:1480:shortest=1[b0];[6:v]format=rgba[rc];[b0][rc]overlay=0:0:enable='between(t,0.1,3.1)'[v1]`, // 계기판(속도) 가림: 뒤 영상 x560 y1520 440x260 구간을 가장자리 부드러운 블러로 // 계기판(속도) 가림: 뒤 영상의 x560 y1520 440x260 구간 블러
  `[3:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p[v3]`,
  `[2:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p[v2]`,
  `[4:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p[v4]`,
  `[0:a]afade=t=out:st=${A_T-0.15}:d=0.15,aresample=48000[a_0]`,
  `[1:a]afade=t=in:st=0:d=0.1,afade=t=out:st=${B_T-0.2}:d=0.2,aresample=48000[a_1]`,
  `anullsrc=r=48000:cl=stereo,atrim=0:${ASK_T}[a_ask]`,
  `anullsrc=r=48000:cl=stereo,atrim=0:${SOS_T}[a_sos]`,
  `anullsrc=r=48000:cl=stereo,atrim=0:${END_T}[a_end]`,
  `[v0][a_0][v1][a_1][v3][a_ask][v2][a_sos][v4][a_end]concat=n=5:v=1:a=1[v][a]`,
].join(';');
execFileSync(FFMPEG, ['-y','-loglevel','error', ...inputs.map(String), '-filter_complex', fc, '-map','[v]','-map','[a]',
  '-c:v','libx264','-crf','17','-preset','medium','-c:a','aac','-b:a','160k','-movflags','+faststart','out/ep01-vn.mp4']);
console.log('done: out/ep01-vn.mp4  (', (A_T + B_T + ASK_T + SOS_T + END_T).toFixed(1), 's )');
