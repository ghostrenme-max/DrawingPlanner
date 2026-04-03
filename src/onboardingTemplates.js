/** @type {Record<string, string[]>} */
export const MONTHLY_GOAL_TEMPLATES_BY_FIELD = {
  '그림 / 일러스트': [
    '레퍼런스 수집 + 스타일 탐색',
    '기초 드로잉 + 완성작 2장',
    '채색 스타일 연습 + 2장',
    '배경 작업 + 완성작 2장',
    '캐릭터 심화 + 2장',
    '중간 점검 + 완성작 2장',
    '이펙트/후보정 연습 + 2장',
    '포트폴리오 구성 시작',
    '피드백 반영 + 2장',
    '완성도 높이기 + 2장',
    '최종 점검 + 2장',
    '포트폴리오 완성 + 정리',
  ],
  'UI / 그래픽 디자인': [
    '디자인 시스템 공부 + 레퍼런스',
    '컴포넌트 설계 연습',
    '랜딩페이지 1개 완성',
    '모바일 UI 2개 완성',
    '브랜드 아이덴티티 작업',
    '중간 점검 + 포트폴리오 정리',
    '대시보드 UI 완성',
    '인터랙션 디자인 연습',
    '프로토타입 2개 완성',
    '케이스스터디 작성',
    '포트폴리오 다듬기',
    '최종 포트폴리오 완성',
  ],
  '3D / 모션': [
    '툴 기초 익히기',
    '오브젝트 모델링 연습',
    '텍스처 + 라이팅 연습',
    '단편 애니메이션 1개',
    '캐릭터 모델링 시작',
    '중간 점검 + 렌더링 연습',
    '모션그래픽 2개 완성',
    '파티클 이펙트 연습',
    '쇼릴 구성 시작',
    '작업물 다듬기',
    '쇼릴 편집',
    '최종 쇼릴 완성',
  ],
  '글쓰기 / 기획': [
    '글쓰기 루틴 잡기 + 초안 3편',
    '피드백 받고 수정',
    '완성 글 2편 발행',
    '주제 확장 + 3편',
    '시리즈 기획 시작',
    '중간 점검 + 발행 5편',
    '독자 반응 분석',
    '글 퀄리티 집중 향상',
    '완성 글 3편 발행',
    '아카이빙 정리',
    '연간 결산 글 작성',
    '포트폴리오 완성',
  ],
}

export const DEFAULT_MONTHLY_GOAL_TEMPLATE = [
  '목표 구체화 + 루틴 잡기',
  '기초 다지기',
  '첫 번째 결과물 완성',
  '피드백 반영',
  '속도 붙이기',
  '중간 점검',
  '퀄리티 높이기',
  '두 번째 결과물 완성',
  '심화 작업',
  '마무리 준비',
  '최종 점검',
  '완성 + 정리',
]

export const ONBOARDING_FIELD_OPTIONS = [
  { field: '그림 / 일러스트', label: '그림 / 일러스트' },
  { field: 'UI / 그래픽 디자인', label: 'UI / 그래픽' },
  { field: '3D / 모션', label: '3D / 모션' },
  { field: '글쓰기 / 기획', label: '글쓰기 / 기획' },
  { field: null, label: '기타 / 직접' },
]

/**
 * @param {string | null} selectedField
 * @returns {string[]}
 */
export function getMonthlyTemplateForField(selectedField) {
  if (selectedField && MONTHLY_GOAL_TEMPLATES_BY_FIELD[selectedField]) {
    return MONTHLY_GOAL_TEMPLATES_BY_FIELD[selectedField]
  }
  return DEFAULT_MONTHLY_GOAL_TEMPLATE
}

/**
 * @param {number} total
 * @param {number} n
 * @returns {number[]}
 */
export function distributeCountAcrossMonths(total, n = 12) {
  const base = Math.floor(total / n)
  const rem = total % n
  return Array.from({ length: n }, (_, i) => (i < rem ? base + 1 : base))
}

/**
 * @param {string} goalText
 * @param {string | null} selectedField
 * @returns {string[]}
 */
export function buildInitialMonthlyGoals(goalText, selectedField) {
  const template = getMonthlyTemplateForField(selectedField)
  const match = typeof goalText === 'string' ? goalText.match(/\d+/) : null
  const total = match ? parseInt(match[0], 10) : 0
  const counts = total > 0 ? distributeCountAcrossMonths(total, 12) : null

  return template.map((base, i) => {
    const c = counts?.[i] ?? 0
    const suffix = c > 0 ? ` (목표: ${c}개)` : ''
    return base + suffix
  })
}
