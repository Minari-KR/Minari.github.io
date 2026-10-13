// Public identity and sharing copy for generated pages.
export const siteUrl = 'https://minari-kr.github.io/';
export const shareImage = 'assets/images/minari-share.png';
export const homeTitle = 'Minari 박종찬 | 게임 디자이너 포트폴리오';
export const homeDescription = '아이디어를 프로토타입으로 만들고, 플레이하며 재미를 검증합니다. Reflectory와 Barrel Good Barrel의 수상 기록, 플레이 영상과 링크를 확인할 수 있습니다.';
// Project detail pages: one template per slug in src/templates/projects/.
export const projects = [
  { slug: 'reflectory', title: 'Reflectory', description: '2026 대전 inD 게임잼 국가수리과학연구장상. 4인 팀에서 기획과 팀장을 맡은 퍼즐 게임입니다.' },
  { slug: 'barrel-good-barrel', title: 'Barrel Good Barrel', description: '2025 대전 게임 브릿지 대상. 대전 인디(inD) 게임어스 3인 팀에서 기획과 팀장을 맡은 탑다운 슈팅 게임입니다.' },
];
export const shareImageAlt = 'Minari 박종찬 · 게임 시스템 기획 포트폴리오. 아이디어를 프로토타입으로 만들고, 플레이하며 재미를 검증합니다.';

// "출시 앱" section on the home page (shown between the intro and the awards).
// Keep null until the real information is ready; null means the section is not generated at all.
// Example shape (all text is escaped; links must be https; image must exist in public/assets/images/):
// export const release = {
//   title: '게임 이름',
//   status: '2026년 11월 출시 예정',
//   image: 'assets/images/cards/game-title.webp', imageWidth: 960, imageHeight: 540, // imageStyle: 'icon' for a square app icon
//   meta: ['Google Play', '기획', '1인 개발'],
//   links: [{ label: 'Google Play에서 보기', url: 'https://play.google.com/store/apps/details?id=...' }],
// };
// Source: C:\Unity Project\zzukzzuk-nyang (README 출시 현황, 스토어/스토어_등록정보.md, 스토어/store-icon-512.png).
// Google Play closed test started 2026-10-03; add the store link here once the public listing is live.
export const release = {
  title: '쭉쭉냥 : 고양이 퍼즐',
  status: 'Google Play 정식 출시 예정',
  image: 'assets/images/cards/zzukzzuk-nyang-icon.png',
  imageWidth: 256,
  imageHeight: 256,
  imageStyle: 'icon',
  meta: ['Android', '퍼즐'],
  links: [],
};
