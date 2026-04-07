export const CHASE_CONCEPT_OPTIONS = [
  '빛과 그림자',
  '색 이론',
  '인체 구조',
  '원근법',
  '구도',
  '질감 표현',
  '연출·분위기',
  '상징·모티브',
  '동세·포즈',
  '배경·공간',
]

export const CHASE_STEP_LABELS = ['관찰', '개념 분석', '적용 계획', '검증']

/** 보조 라벨 패널 + 헤더 − 패널에서 골라 붙이는 태그(약 10개) */
export const CHASE_INSIGHT_LABEL_OPTIONS = [
  '구체적',
  '실험적',
  '복습용',
  '강조',
  '참고',
  '다음 적용',
  '보완점',
  '잘한 점',
  '보완할 점',
  '아쉬운 점',
]

/** 태그 하나당 보조 라벨 최대 개수 */
export const CHASE_INSIGHT_SUBLABEL_MAX = 4

/** 헤더 − 패널: 핵심·디테일·리마인드 + 위 라벨 목록 전부 */
export const CHASE_INSIGHT_KIND_OPTIONS = [
  { kind: 'acc', label: '핵심' },
  { kind: 'acc2', label: '디테일' },
  { kind: 'acc3', label: '리마인드' },
  ...CHASE_INSIGHT_LABEL_OPTIONS.map((label) => ({ kind: label, label })),
]

const CHASE_INSIGHT_KIND_TONE_INDEX = new Map(
  CHASE_INSIGHT_KIND_OPTIONS.map((o, i) => [o.kind, i]),
)

/** CSS 클래스 `chase-insight--tone{n}` — 태그·유형 버튼에 동일 적용 */
export function chaseInsightToneClass(kind) {
  const i = CHASE_INSIGHT_KIND_TONE_INDEX.get(kind)
  if (typeof i === 'number') return `chase-insight--tone${i}`
  let h = 0
  for (let k = 0; k < kind.length; k++) h = ((h << 5) - h + kind.charCodeAt(k)) | 0
  const n = Math.abs(h) % CHASE_INSIGHT_KIND_OPTIONS.length
  return `chase-insight--tone${n}`
}

/**
 * @typedef {{ kind: string; labels: string[] }} ChaseInsightEntry
 * @param {unknown} raw
 * @returns {ChaseInsightEntry[]}
 */
export function normalizeInsightEntries(raw) {
  const arr = Array.isArray(raw) ? raw : []
  if (arr.length === 0) return []
  if (typeof arr[0] === 'string') {
    return /** @type {string[]} */ (arr).map((k) => ({ kind: k, labels: [] }))
  }
  return arr.map((x) => {
    if (typeof x === 'string') return { kind: x, labels: [] }
    const o = /** @type {{ kind?: string; labels?: unknown }} */ (x)
    const labels = Array.isArray(o.labels)
      ? /** @type {string[]} */ (o.labels).filter((l) => typeof l === 'string').slice(0, CHASE_INSIGHT_SUBLABEL_MAX)
      : []
    return { kind: typeof o.kind === 'string' ? o.kind : 'acc', labels }
  })
}
