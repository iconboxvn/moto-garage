import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { languageRoutingScript } from '../lib/languageRouting.mjs';
import { layout, setBuiltLangs } from '../lib/render.mjs';
import STRINGS from '../content/strings.mjs';

function visit({ href = 'https://ridemate.iconbox.com/', languages = ['en-US'],
  stored, blocked = false, built = ['ko', 'en', 'vn'] } = {}) {
  const url = new URL(href);
  let redirected;
  let click;
  const context = {
    URL,
    location: { href, pathname: url.pathname, replace(target) { redirected = target; } },
    navigator: { languages, language: languages[0] },
    localStorage: {
      getItem() { if (blocked) throw new Error('Storage disabled'); return stored; },
      setItem(key, value) { if (blocked) throw new Error('Storage disabled'); stored = value; },
    },
    document: { addEventListener(event, handler) { if (event === 'click') click = handler; } },
  };
  const script = languageRoutingScript(built).replace(/^<script>|<\/script>$/g, '');
  vm.runInNewContext(script, context);
  return { redirected, select(language) {
    click({ target: { closest() { return { getAttribute() { return language; } }; } } });
    return stored;
  } };
}

test('regional Korean, English and Vietnamese language codes choose existing homes', () => {
  assert.equal(visit({ languages: ['ko-KR'] }).redirected, undefined);
  assert.equal(visit({ languages: ['en-GB'] }).redirected, 'https://ridemate.iconbox.com/en/');
  assert.equal(visit({ languages: ['vi-VN'] }).redirected, 'https://ridemate.iconbox.com/vn/');
});

test('uses ordered browser preferences and falls back to English', () => {
  assert.equal(visit({ languages: ['ja-JP', 'vi'] }).redirected, 'https://ridemate.iconbox.com/vn/');
  assert.equal(visit({ languages: ['ja-JP'] }).redirected, 'https://ridemate.iconbox.com/en/');
  assert.equal(visit({ languages: [] }).redirected, 'https://ridemate.iconbox.com/en/');
});

test('saved manual preference overrides browser language; invalid preferences are ignored', () => {
  assert.equal(visit({ stored: 'ko' }).redirected, undefined);
  assert.equal(visit({ stored: 'vn', languages: ['ko'] }).redirected, 'https://ridemate.iconbox.com/vn/');
  assert.equal(visit({ stored: 'unavailable' }).redirected, 'https://ridemate.iconbox.com/en/');
});

test('manual Korean choice works even when storage is blocked', () => {
  assert.equal(visit({ href: 'https://ridemate.iconbox.com/?lang=ko', blocked: true }).redirected, undefined);
  assert.equal(visit({ blocked: true, languages: ['vi'] }).redirected, 'https://ridemate.iconbox.com/vn/');
});

test('redirect preserves campaign parameters and fragment', () => {
  assert.equal(visit({ href: 'https://ridemate.iconbox.com/?utm_source=qr#features' }).redirected,
    'https://ridemate.iconbox.com/en/?utm_source=qr#features');
});

test('direct language, news and policy URLs are never automatically redirected', () => {
  for (const path of ['/en/', '/vn/', '/news/', '/news/story/', '/privacy_policy/']) {
    assert.equal(visit({ href: `https://ridemate.iconbox.com${path}`, stored: 'vn', languages: ['ko'] }).redirected, undefined);
  }
});

test('language buttons remember explicit selection on all pages', () => {
  const page = visit({ href: 'https://ridemate.iconbox.com/en/' });
  assert.equal(page.select('ko'), 'ko');
  assert.equal(page.select('unsupported'), 'ko');
});

test('limited builds never redirect to languages that were not generated', () => {
  assert.equal(visit({ built: ['ko'], languages: ['en'] }).redirected, undefined);
  assert.equal(visit({ built: ['vn'], languages: ['ko'] }).redirected, 'https://ridemate.iconbox.com/vn/');
});

test('rendered home loads routing early and includes an explicit Korean language link', () => {
  setBuiltLangs(['ko', 'en', 'vn']);
  const html = layout({ lang: 'en', path: '/', title: 'Ridemate', description: 'Home', body: '', t: STRINGS.en });
  assert.ok(html.indexOf('ridemate-site-language') < html.indexOf('<link rel="stylesheet"'));
  assert.match(html, /href="\/\?lang=ko"[^>]*data-site-language="ko"/);
  assert.match(html, /href="\/vn\/"[^>]*data-site-language="vn"/);
});
