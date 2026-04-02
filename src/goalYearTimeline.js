/** 연도(1·3·5·10년) 목표 탭 — 시작일·기간·진행률·월별 막대 */

export function pad2(n) {
  return String(n).padStart(2, '0')
}

/** 설정 날짜 없으면 올해 1월 1일(달 기준) */
export function normalizeGoalStart(goalStartDate) {
  const now = new Date()
  if (goalStartDate && /^\d{4}-\d{2}-\d{2}$/.test(goalStartDate)) {
    const [y, m] = goalStartDate.split('-').map(Number)
    return new Date(y, m - 1, 1, 12, 0, 0, 0)
  }
  return new Date(now.getFullYear(), 0, 1, 12, 0, 0, 0)
}

/** @param {'1' | '3' | '5' | '10'} h */
export function horizonYearsFromTab(h) {
  return Number(h)
}

/**
 * @param {Date} startNorm
 * @param {number} horizonYears
 * @returns {{ key: string; year: number; month0: number; mm: string }[]}
 */
export function buildTimelineSlots(startNorm, horizonYears) {
  const total = horizonYears * 12
  const out = []
  for (let i = 0; i < total; i++) {
    const d = new Date(startNorm.getFullYear(), startNorm.getMonth() + i, 1, 12, 0, 0, 0)
    const y = d.getFullYear()
    const m0 = d.getMonth()
    const mm = pad2(m0 + 1)
    out.push({ key: `${y}-${mm}`, year: y, month0: m0, mm })
  }
  return out
}

function slotBarFillPercent(slotStart, slotEnd, now) {
  const nowT = now.getTime()
  const a = slotStart.getTime()
  const b = slotEnd.getTime()
  if (nowT < a) return 0
  if (nowT >= b) return 100
  return Math.min(100, Math.max(0, ((nowT - a) / (b - a)) * 100))
}

/**
 * @param {Date} startNorm
 * @param {number} horizonYears
 * @param {Date} [now]
 */
export function computeYearTimeline(startNorm, horizonYears, now = new Date()) {
  const totalMonths = horizonYears * 12
  const slots = buildTimelineSlots(startNorm, horizonYears)
  if (slots.length === 0) {
    return {
      slots: [],
      barTargetPcts: [],
      overallPct: 0,
      currentSlotIndex: -1,
      periodLabel: '',
      totalMonths: 0,
    }
  }

  const endBound = new Date(startNorm.getFullYear(), startNorm.getMonth() + totalMonths, 1, 12, 0, 0, 0)
  const nowT = now.getTime()
  const startT = startNorm.getTime()
  const endT = endBound.getTime()

  let overallPct = 0
  if (nowT >= endT) overallPct = 100
  else if (nowT <= startT) overallPct = 0
  else overallPct = Math.round((100 * (nowT - startT)) / (endT - startT))

  const barTargetPcts = slots.map((_, i) => {
    const ss = new Date(startNorm.getFullYear(), startNorm.getMonth() + i, 1, 12, 0, 0, 0)
    const se = new Date(startNorm.getFullYear(), startNorm.getMonth() + i + 1, 1, 12, 0, 0, 0)
    return slotBarFillPercent(ss, se, now)
  })

  let currentSlotIndex = -1
  for (let i = 0; i < slots.length; i++) {
    const ss = new Date(startNorm.getFullYear(), startNorm.getMonth() + i, 1, 12, 0, 0, 0)
    const se = new Date(startNorm.getFullYear(), startNorm.getMonth() + i + 1, 1, 12, 0, 0, 0)
    if (nowT >= ss.getTime() && nowT < se.getTime()) {
      currentSlotIndex = i
      break
    }
  }
  if (currentSlotIndex < 0 && nowT >= endT) currentSlotIndex = slots.length - 1

  const first = slots[0]
  const last = slots[slots.length - 1]
  const periodLabel = `${first.year}.${first.mm} — ${last.year}.${last.mm}`

  return {
    slots,
    barTargetPcts,
    overallPct,
    currentSlotIndex,
    periodLabel,
    totalMonths,
  }
}

/** 막대 아래 라벨: 12개 이하면 N월, 더 많으면 yy.mm */
export function timelineBarLabel(slot, compact) {
  if (compact) {
    return `${String(slot.year).slice(2)}.${slot.mm}`
  }
  return `${Number(slot.mm)}월`
}
