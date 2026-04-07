/** 메인(피치 계열 액센트) / 서브(틸 계열 액센트) — 테마 프리셋 */
export const APP_THEME_PRESETS = [
  { id: 'peach-teal', label: '피치+틸', main: '#FB923C', sub: '#2DD4BF' },
  { id: 'cyan-orange', label: '시안+주황', main: '#22D3EE', sub: '#F97316' },
  { id: 'mint-coral', label: '민트+코랄', main: '#00C9A7', sub: '#FF6B6B' },
  /** 어두운 배경용: 메인은 한 톤 밝은 인디고/로즈, 서브는 대비 유지 */
  { id: 'indigo-gold', label: '인디고+골드', main: '#A5B4FC', sub: '#FCD34D' },
  { id: 'rose-sky', label: '로즈+스카이', main: '#FDA4AF', sub: '#7DD3FC' },
  { id: 'lime-blue', label: '라임+블루', main: '#A3E635', sub: '#3B82F6' },
]

export const DEFAULT_THEME_INDEX = 0

/** @param {string} hex #RGB or #RRGGBB */
export function hexToRgbComma(hex) {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  if (Number.isNaN(n)) return '251, 146, 60'
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `${r}, ${g}, ${b}`
}

/** @param {number} index */
export function applyThemeToDocument(index) {
  const preset = APP_THEME_PRESETS[index] ?? APP_THEME_PRESETS[0]
  const root = document.documentElement
  root.style.setProperty('--ww-main', preset.main)
  root.style.setProperty('--ww-sub', preset.sub)
  root.style.setProperty('--ww-main-rgb', hexToRgbComma(preset.main))
  root.style.setProperty('--ww-sub-rgb', hexToRgbComma(preset.sub))
}
