// Runs in the page head so root visitors reach their language before rendering.
function routeLanguage(routes, fallback) {
  const storageKey = 'ridemate-site-language';
  const supported = (language) => Object.hasOwn(routes, language);
  const normalize = (language) => {
    const code = String(language || '').toLowerCase().split(/[-_]/)[0];
    return code === 'vi' ? 'vn' : code;
  };
  const remember = (language) => {
    try { localStorage.setItem(storageKey, language); } catch { /* Storage can be disabled. */ }
  };

  // An explicit choice takes precedence on future root visits.
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[data-site-language]');
    if (!link) return;
    const language = link.getAttribute('data-site-language');
    if (supported(language)) remember(language);
  });

  if (location.pathname !== '/') return;

  const url = new URL(location.href);
  let language = normalize(url.searchParams.get('lang'));
  if (supported(language)) {
    remember(language);
  } else {
    try { language = localStorage.getItem(storageKey); } catch { language = null; }
    if (!supported(language)) {
      const preferences = navigator.languages?.length ? navigator.languages : [navigator.language];
      language = preferences.map(normalize).find(supported) || fallback;
    }
  }

  const target = routes[language];
  if (target && target !== location.pathname) {
    url.pathname = target;
    location.replace(url.href);
  }
}

export function languageRoutingScript(languages) {
  const routes = Object.fromEntries(languages.map((language) => [
    language, language === 'ko' ? '/' : `/${language}/`,
  ]));
  const fallback = languages.includes('en') ? 'en' : languages[0];
  return `<script>(${routeLanguage.toString()})(${JSON.stringify(routes)},${JSON.stringify(fallback)});</script>`;
}
