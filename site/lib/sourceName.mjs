/**
 * brand_news.sourceName 정리.
 *
 * Firestore에는 개발자 편의로 한국어 설명이 섞인 값이 들어있다
 * (예: "NHTSA (미국 도로교통안전국)", "아세안데일리"). 공개 사이트,
 * 특히 EN/VN 페이지에 한국어가 노출되지 않도록 빌드 시 정리한다.
 */

// 완전 대체 (언어별)
const RENAME = {
  '아세안데일리': { ko: '아세안데일리', en: 'ASEAN Daily', vn: 'ASEAN Daily' },
  'NHTSA (미국 도로교통안전국)': { ko: 'NHTSA (미국 도로교통안전국)', en: 'NHTSA (USA)', vn: 'NHTSA (Hoa Kỳ)' },
  'Cục Đăng kiểm Việt Nam (베트남 등록청)': {
    ko: 'Cục Đăng kiểm Việt Nam (베트남 등록청)',
    en: 'Cục Đăng kiểm Việt Nam (Vietnam Register)',
    vn: 'Cục Đăng kiểm Việt Nam',
  },
};

const HANGUL = /[가-힣]/;

export function displaySourceName(name, lang) {
  if (!name) return '';
  if (RENAME[name]) return RENAME[name][lang] || RENAME[name].en;
  // 한국어가 아닌 언어인데 이름에 한글이 남아있으면, 괄호 안 한글 설명을 떼어낸다
  if (lang !== 'ko' && HANGUL.test(name)) {
    const stripped = name.replace(/\s*\([^)]*[가-힣][^)]*\)\s*/g, ' ').trim();
    return HANGUL.test(stripped) ? stripped.replace(HANGUL, '').trim() || name : stripped;
  }
  return name;
}
