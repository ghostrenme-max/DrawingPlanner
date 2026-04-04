/** 설정·목표 탭 공통 — 주차(dm_1d…15d = 1~4주차)·분기(dm_q*) goalTexts 키 + 연간(1y…) 키 */

export const GOAL_DAY_MONTH_ROWS = [
  { id: 'dm_1d', label: '1주차' },
  { id: 'dm_3d', label: '2주차' },
  { id: 'dm_7d', label: '3주차' },
  { id: 'dm_15d', label: '4주차' },
  { id: 'dm_q1', label: '1분기' },
  { id: 'dm_q2', label: '2분기' },
  { id: 'dm_q3', label: '3분기' },
  { id: 'dm_q4', label: '4분기' },
]

export const GOAL_YEAR_ROWS = [
  { id: '1y', label: '1년 목표 수정' },
  { id: '3y', label: '3년 목표 수정' },
  { id: '5y', label: '5년 목표 수정' },
  { id: '10y', label: '10년 목표 수정' },
]

/** @returns {Record<string, string>} */
export function createEmptyGoalTexts() {
  const o = /** @type {Record<string, string>} */ ({})
  for (const r of GOAL_DAY_MONTH_ROWS) o[r.id] = ''
  for (const r of GOAL_YEAR_ROWS) o[r.id] = ''
  return o
}

/** 목표 탭 일별 줌(키만 사용, 라벨은 로케일 dailyWeekLabels / dmZoom) */
export const GOAL_DM_ZOOM_DAYS = [
  { id: 'dm_1d', label: '1주차', segments: ['1'] },
  { id: 'dm_3d', label: '2주차', segments: ['1', '2', '3'] },
  { id: 'dm_7d', label: '3주차', segments: ['1', '2', '3', '4', '5', '6', '7'] },
  {
    id: 'dm_15d',
    label: '4주차',
    segments: Array.from({ length: 15 }, (_, i) => String(i + 1)),
  },
]

/** 목표 탭에서 선택 가능한 줌 = 일 단위만 */
export const GOAL_DM_ZOOM = [...GOAL_DM_ZOOM_DAYS]

/** 1·3·7·15일: 선택 구간과 관계없이 보기 단위 제목 (예: 3일 작업 내역) */
const DM_DETAIL_ZOOM_ONLY = new Set(['dm_1d', 'dm_3d', 'dm_7d', 'dm_15d'])

/**
 * @param {string} zoomId
 * @param {string} segmentLabel 막대 라벨
 * @param {string} zoomLabel 칩 라벨 (1주차 …)
 */
export function getGoalDmDetailTitle(zoomId, segmentLabel, zoomLabel) {
  if (DM_DETAIL_ZOOM_ONLY.has(zoomId)) {
    return `${zoomLabel} 작업 내역`
  }
  return `${segmentLabel} 작업 내역`
}

/** @param {'1' | '3' | '5' | '10'} h */
export function yearHorizonToGoalKey(h) {
  return /** @type {'1y' | '3y' | '5y' | '10y'} */ (`${h}y`)
}

/** 목표 헤더·트래커 예시: 빈 줄마다 문단, 단일 줄바꿈은 `pre-wrap`로 유지 */
export function splitGoalHeaderParagraphs(text) {
  const normalized = text.replace(/\r\n/g, '\n')
  const parts = normalized.split(/\n\s*\n/).map((chunk) => chunk.trimEnd())
  const nonEmpty = parts.filter((p) => p.length > 0)
  return nonEmpty.length > 0 ? nonEmpty : [normalized.trimEnd()]
}

const ZWSP = '\u200b'

/**
 * 표시용: 문단 안에서 단어·구 단위로 줄바꿈이 일어나도록 ZWSP 삽입.
 * - `Intl.Segmenter` (ko, word)
 * - 중점(·)·쉼표 뒤, 한글 뒤 조사(와/과/은/는/…)+다음 한글 앞
 */
export function applyGoalDisplayBreaks(paragraph) {
  if (!paragraph) return paragraph
  const normalized = paragraph.replace(/\r\n/g, '\n')
  return normalized
    .split('\n')
    .map((line) => insertSegmenterBreaks(attachMorphBreakHints(line)))
    .join('\n')
}

function attachMorphBreakHints(line) {
  let s = line
  s = s.replace(/·(?=\S)/g, `·${ZWSP}`)
  s = s.replace(/,(?=\S)/g, `,${ZWSP}`)
  s = s.replace(
    /([가-힣·]{2,})(은|는|이|가|을|를|와|과|도|만|으로|에서|까지|부터|라도|조차)(?=[\s가-힣·,]|$)/g,
    `$1$2${ZWSP}`,
  )
  return s
}

function insertSegmenterBreaks(line) {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') {
    return line
  }
  try {
    const segmenter = new Intl.Segmenter('ko', { granularity: 'word' })
    let out = ''
    for (const { segment } of segmenter.segment(line)) {
      if (out !== '') out += ZWSP
      out += segment
    }
    return out.replace(new RegExp(`${ZWSP}{2,}`, 'g'), ZWSP)
  } catch {
    return line
  }
}

/**
 * 트래커 메인: 툴팁을 닫은 뒤 고정 표시하는 1년 목표 **예시** 문구.
 * 설정에 저장되는 `1y` 값과는 별개입니다.
 */
export const GOAL_1Y_TRACKER_SAMPLE_TEXT =
  '올해는 메인 일러스트와 전신·반신 라인을 마무리하고,\n\nUI 디자인까지 포트폴리오로 잇는다.'
