import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from './contexts/LanguageContext.js'
import { DEFAULT_APP_FEATURES } from './appFeatures.js'
import {
  applyGoalDisplayBreaks,
  createEmptyGoalTexts,
  GOAL_DM_ZOOM,
  splitGoalHeaderParagraphs,
} from './goalConfig.js'
import AppToast from './components/AppToast.jsx'
import BrandWordmark from './BrandWordmark'
import { NavIconGallery, NavIconGoal, NavIconSettings, NavIconTracker } from './bottomNavIcons.jsx'
import './GoalScreen.css'

/** 상단 진행률 가로 바 + % 숫자 — 트래커 헤더와 동기 */
const GOAL_HEADER_BAR_MS = 980
const GOAL_HEADER_LIVE_MS = 420


/** 월 막대 % 라벨: 저장 진행률이 이 값 미만이면 비렌더(애니 중엔 채움 overflow로 잘림 해제와 맞춤) */
const GOAL_MBAR_PCT_SHOW_MIN = 15

/** 12개월 막대 연쇄: 진행률별 duration (100%→600ms …) */
function getBarDurationMs(progress) {
  const p = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)))
  if (p <= 0) return 0
  if (p >= 100) return 600
  if (p <= 33) return Math.round((250 * p) / 33)
  if (p <= 60) return Math.round(250 + (150 * (p - 33)) / 27)
  return Math.round(400 + (200 * (p - 60)) / 40)
}

/** 이전 달이 85% 이상이면 그 달 애니의 85% 시점에서 다음 달 시작 */
function getCascadeStartDelay(monthIndex, progressArray) {
  let delay = 0
  for (let i = 0; i < monthIndex; i++) {
    const prev = progressArray[i] ?? 0
    const d = getBarDurationMs(prev)
    if (d <= 0) continue
    delay += prev >= 85 ? d * 0.85 : d
  }
  return Math.round(delay)
}

function getCascadeTotalEndMs(progressArray) {
  let maxEnd = 0
  for (let i = 0; i < 12; i++) {
    const p = progressArray[i] ?? 0
    const d = getBarDurationMs(p)
    if (d <= 0) continue
    const start = getCascadeStartDelay(i, progressArray)
    maxEnd = Math.max(maxEnd, start + d)
  }
  return maxEnd
}

const GOAL_WORK_DOTS = 5
/** 월별 작업 행 도트 애니메이션 타이밍 */
const GOAL_TASK_DOT_STAGGER_MS = 100
const GOAL_TASK_ROW_GAP_MS = 120
const GOAL_TASK_DOT_ANIM_MS = 580
const GOAL_TASK_DOTS_AFTER_MBARS_MS = 160

function currentYearMonth() {
  const d = new Date()
  return { year: d.getFullYear(), monthMm: String(d.getMonth() + 1).padStart(2, '0') }
}

function padMonth1to12(m) {
  return String(m).padStart(2, '0')
}

/** 월별: 연도 12칸 기준 분기 끝(3·6·9·12월) 서브컬러 강조 */
const QUARTER_HIGHLIGHT_MONTH_NUM = [3, 6, 9, 12]

function isQuarterHighlightMonth(monthIndex0) {
  return QUARTER_HIGHLIGHT_MONTH_NUM.includes(monthIndex0 + 1)
}

/** 일별 하단 그래프 축 눈금 */
const GOAL_DAILY_AXIS_TICKS = [1, 5, 10, 15, 20, 25, 30]

/** 일별 1~4주차에 대응하는 달의 일자(1~30, 겹침 없음): 1~6, 7~13, 14~21, 22~30 */
const DAILY_WEEK_DAY_RANGES = [
  { start: 1, end: 6 },
  { start: 7, end: 13 },
  { start: 14, end: 21 },
  { start: 22, end: 30 },
]

const DAILY_WEEK_DM_ZOOM_IDS = /** @type {const} */ (['dm_1d', 'dm_3d', 'dm_7d', 'dm_15d'])

/** 오늘 날짜(일)가 속한 이번 달 주차 1~4 (구간 밖 일은 말단 주차) */
function weekOfMonthForCalendarDay(dayOfMonth) {
  const d = Math.min(Math.max(1, dayOfMonth), 31)
  for (let i = 0; i < DAILY_WEEK_DAY_RANGES.length; i++) {
    const { start, end } = DAILY_WEEK_DAY_RANGES[i]
    if (d >= start && d <= end) return /** @type {1 | 2 | 3 | 4} */ (i + 1)
  }
  return 4
}

/** 선택한 연·월에서 주차 구간의 달력 일자 (MM.DD~MM.DD, 말일 초과는 클램프) */
function formatDailyWeekCalendarRange(year, monthIndex0, startDay, endDay) {
  if (startDay > endDay) return ''
  const lastDom = new Date(year, monthIndex0 + 1, 0).getDate()
  const s = Math.min(Math.max(1, startDay), lastDom)
  const e = Math.min(Math.max(1, endDay), lastDom)
  if (s > e) return ''
  const pad2 = (n) => String(n).padStart(2, '0')
  const mm = pad2(monthIndex0 + 1)
  return `${mm}.${pad2(s)}~${mm}.${pad2(e)}`
}

/**
 * 일별 헤더 기간: 주차 라벨 + 날짜 구간(「실제 날짜」 문구 없음)
 * @param {1 | 2 | 3 | 4} week1to4
 */
function formatDailyHeaderPeriodLine(week1to4, year, monthIndex0, t) {
  const r = DAILY_WEEK_DAY_RANGES[week1to4 - 1] ?? DAILY_WEEK_DAY_RANGES[0]
  const range = formatDailyWeekCalendarRange(year, monthIndex0, r.start, r.end)
  const label = t.goal.dailyWeekLabels[week1to4 - 1]
  if (!range) return label
  return t.goal.periodToolbarDailyWeek.replace('{label}', label).replace('{range}', range)
}

/** 1..30일 막대 높이 % (하단에서 상승) */
function risingHeightPercent(day1to30) {
  const t = day1to30 / 30
  return Math.max(5, Math.round(100 * t))
}

function ymForYearMonth(gridYear, monthIndex0) {
  return `${gridYear}-${padMonth1to12(monthIndex0 + 1)}`
}

function averagePercent(cards) {
  if (!cards.length) return 0
  return Math.round(cards.reduce((s, c) => s + (Number(c.percent) || 0), 0) / cards.length)
}

/** @param {Record<string, unknown>} card */
function filledWorkDots(card) {
  if (card.workFinalized) return GOAL_WORK_DOTS
  const p = Number(card.percent) || 0
  return Math.min(GOAL_WORK_DOTS, Math.max(0, Math.round((p / 100) * GOAL_WORK_DOTS)))
}

/** 각 행 첫 도트의 animation-delay 기준(ms) — 행 간 순차 */
function buildWorkRowDotBaseDelaysMs(rowsDone, staggerMs, gapMs, animMs) {
  const rowBases = []
  let acc = 0
  for (let r = 0; r < rowsDone.length; r++) {
    rowBases.push(acc)
    const d = Math.min(GOAL_WORK_DOTS, Math.max(0, rowsDone[r]))
    if (d > 0) acc += (d - 1) * staggerMs + animMs + gapMs
  }
  return rowBases
}

/**
 * @param {{
 *   name: string
 *   done: number
 *   carry: boolean
 *   rowDelayMs: number
 *   dotsPlay: boolean
 *   reducedMotion: boolean
 * }} props
 */
function GoalPanelWorkRow({ name, done, carry, rowDelayMs, dotsPlay, reducedMotion }) {
  const [nameFull, setNameFull] = useState(false)

  useEffect(() => {
    if (done < GOAL_WORK_DOTS) {
      setNameFull(false)
      return
    }
    if (!dotsPlay) {
      setNameFull(false)
      return
    }
    if (reducedMotion) {
      setNameFull(true)
      return
    }
    const ms =
      rowDelayMs +
      (GOAL_WORK_DOTS - 1) * GOAL_TASK_DOT_STAGGER_MS +
      Math.round(GOAL_TASK_DOT_ANIM_MS * 0.72)
    const id = window.setTimeout(() => setNameFull(true), ms)
    return () => window.clearTimeout(id)
  }, [done, dotsPlay, rowDelayMs, reducedMotion])

  return (
    <div className="goal-work-row">
      <span className={`goal-work-row-name${nameFull ? ' goal-work-row-name--full' : ''}`}>{name}</span>
      <div className="goal-work-row-dots" aria-hidden>
        {Array.from({ length: GOAL_WORK_DOTS }, (_, di) => {
          const on = di < done
          const filled = on && dotsPlay
          const animate =
            filled && !reducedMotion ? (carry ? 'goal-work-dot--carry-animate' : 'goal-work-dot--animate') : ''
          const delayMs = rowDelayMs + di * GOAL_TASK_DOT_STAGGER_MS
          return (
            <span
              key={di}
              className={[
                'goal-work-dot',
                on ? (carry ? 'goal-work-dot--carry' : 'goal-work-dot--on') : '',
                animate,
              ]
                .filter(Boolean)
                .join(' ')}
              style={filled && !reducedMotion ? { animationDelay: `${delayMs}ms` } : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}

/**
 * 일별: 수행해야 할 작업 세로 목록 (완성 시 줄 긋기)
 * @param {{ cards: Record<string, unknown>[]; t: { goal: Record<string, string>; common: Record<string, string> } }} props
 */
function GoalTrackerWorkList({ cards, t }) {
  let strikeSeq = 0
  return (
    <ul className="goal-daily-tracker-list" role="list">
      {cards.map((card, idx) => {
        const finalized = Boolean(card.workFinalized)
        const strikeI = finalized ? strikeSeq++ : null
        const displayName =
          typeof card.displayTag === 'string'
            ? card.displayTag
            : typeof card.title === 'string'
              ? card.title
              : t.common.workFallback
        const key = card.id != null ? String(card.id) : `tracker-${idx}`
        return (
          <li
            key={key}
            className={[
              'goal-daily-tracker-item',
              finalized ? 'goal-daily-tracker-item--finalized' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={
              finalized ? `${displayName} — ${t.goal.dailyTrackerFinalizedSuffix}` : displayName
            }
          >
            <span
              className="goal-daily-tracker-item-name"
              style={strikeI != null ? { ['--strike-i']: String(strikeI) } : undefined}
            >
              {displayName}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * @param {{
 *   onTabChange?: (tab: 'tracker' | 'goal' | 'gallery' | 'settings') => void
 *   goalTexts?: Record<string, string>
 *   monthlyGoals?: string[]
 *   onMonthlyGoalsChange?: (updater: (prev: string[]) => string[]) => void
 *   trackerCards?: Record<string, unknown>[]
 * }} props
 */
export default function GoalScreen({
  onTabChange,
  features = DEFAULT_APP_FEATURES,
  goalTexts = createEmptyGoalTexts(),
  monthlyGoals = [],
  onMonthlyGoalsChange,
  trackerCards = [],
}) {
  const { t } = useLang()
  const { year: calendarYear } = currentYearMonth()
  const gridYear = calendarYear

  const [goalScope, setGoalScope] = useState(/** @type {'monthly' | 'daily'} */ ('monthly'))
  const [dmZoomId, setDmZoomId] = useState(GOAL_DM_ZOOM[0].id)
  const [barsPlay, setBarsPlay] = useState(false)
  const [headerPctDisplay, setHeaderPctDisplay] = useState(0)
  const headerPctDisplayRef = useRef(0)
  headerPctDisplayRef.current = headerPctDisplay
  const headerAnimCtxRef = useRef(/** @type {{ goalScope: string; selectedMonthIndex: number } | null} */ (null))
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => new Date().getMonth())
  const [monthGoalEditing, setMonthGoalEditing] = useState(false)
  const [monthGoalDraft, setMonthGoalDraft] = useState('')
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [taskDotsPlay, setTaskDotsPlay] = useState(false)
  const [startAnim, setStartAnim] = useState(false)
  /** 일별 하단: 1~4주차 — 초기값은 오늘 기준 주차 */
  const [selectedWeekOfMonth, setSelectedWeekOfMonth] = useState(
    () => weekOfMonthForCalendarDay(new Date().getDate()),
  )
  /** 일별 탭을 누를 때마다 증가 → 완성 작업 줄 긋기 애니 재생 */
  const [dailyStrikeReplay, setDailyStrikeReplay] = useState(0)
  /** 이번 달에서 ‘오늘 주차’가 아닌 주 탭 시 토스트 (key로 타이머 리셋) */
  const [weekNavToast, setWeekNavToast] = useState(() => ({ key: 0, msg: '' }))
  const closeWeekNavToast = useCallback(() => {
    setWeekNavToast((prev) => ({ ...prev, msg: '' }))
  }, [])

  useEffect(() => {
    if (!GOAL_DM_ZOOM.some((z) => z.id === dmZoomId)) {
      setDmZoomId(GOAL_DM_ZOOM[0].id)
    }
  }, [dmZoomId])

  useEffect(() => {
    if (goalScope !== 'daily') return
    const idx = Math.min(Math.max(selectedWeekOfMonth, 1), 4) - 1
    setDmZoomId(DAILY_WEEK_DM_ZOOM_IDS[idx])
  }, [goalScope, selectedWeekOfMonth])

  /** 목표 탭이 ‘이번 달’일 때 선택 주차를 항상 오늘 주차에 맞춤 */
  useEffect(() => {
    if (goalScope !== 'daily') return
    const now = new Date()
    if (gridYear !== now.getFullYear() || selectedMonthIndex !== now.getMonth()) return
    const tw = weekOfMonthForCalendarDay(now.getDate())
    setSelectedWeekOfMonth(tw)
  }, [goalScope, selectedMonthIndex, gridYear])

  const goals12 = useMemo(() => {
    const g = Array.isArray(monthlyGoals) ? [...monthlyGoals] : []
    while (g.length < 12) g.push('')
    return g.slice(0, 12)
  }, [monthlyGoals])

  const cardsForSelectedMonth = useMemo(() => {
    const ym = ymForYearMonth(gridYear, selectedMonthIndex)
    return trackerCards.filter((c) => c && typeof c === 'object' && c.activeMonthYm === ym)
  }, [trackerCards, gridYear, selectedMonthIndex])

  /** 일별 탭: 트래커 전체 카드(읽기 전용) */
  const allTrackerCardsList = useMemo(
    () => trackerCards.filter((c) => c && typeof c === 'object'),
    [trackerCards],
  )

  const monthProgress = useMemo(
    () =>
      Array.from({ length: 12 }, (_, mi) => {
        const ym = ymForYearMonth(gridYear, mi)
        const monthCards = trackerCards.filter(
          (c) => c && typeof c === 'object' && c.activeMonthYm === ym,
        )
        return averagePercent(monthCards)
      }),
    [trackerCards, gridYear],
  )

  const workRowsDone = useMemo(
    () => cardsForSelectedMonth.map((c) => filledWorkDots(c)),
    [cardsForSelectedMonth],
  )

  const workRowDotBaseDelaysMs = useMemo(
    () =>
      buildWorkRowDotBaseDelaysMs(
        workRowsDone,
        GOAL_TASK_DOT_STAGGER_MS,
        GOAL_TASK_ROW_GAP_MS,
        GOAL_TASK_DOT_ANIM_MS,
      ),
    [workRowsDone],
  )

  useEffect(() => {
    setMonthGoalEditing(false)
  }, [selectedMonthIndex])

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return undefined
    setPrefersReducedMotion(mq.matches)
    const onChange = () => setPrefersReducedMotion(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  useEffect(() => {
    setBarsPlay(false)
    setStartAnim(false)
    setTaskDotsPlay(false)
    setHeaderPctDisplay(0)
    const t = window.setTimeout(() => setBarsPlay(true), 80)
    return () => window.clearTimeout(t)
  }, [goalScope, dmZoomId, selectedMonthIndex])

  const monthProgressRef = useRef(monthProgress)
  monthProgressRef.current = monthProgress

  /**
   * 연쇄 애니 중에는 진행률 스냅샷 고정 — trackerCards 갱신으로 CSS 변수가 바뀌며 애니가 처음부터 다시 도는 것 방지
   */
  const [mbarSnap, setMbarSnap] = useState(/** @type {number[] | null} */ (null))

  useLayoutEffect(() => {
    if (!barsPlay || !startAnim || prefersReducedMotion) {
      setMbarSnap(null)
      return
    }
    setMbarSnap([...monthProgressRef.current])
  }, [barsPlay, startAnim, prefersReducedMotion])

  /** 막대 연쇄: barsPlay 후 400ms 뒤 트리거 */
  useEffect(() => {
    setStartAnim(false)
    if (!barsPlay) return
    const t = window.setTimeout(() => setStartAnim(true), 400)
    return () => window.clearTimeout(t)
  }, [barsPlay])

  /** 스냅샷 기준 연쇄 종료 시 스냅 해제 + 월별 작업 도트 행 시작 */
  useEffect(() => {
    if (!mbarSnap || !barsPlay || prefersReducedMotion) return
    const endMs = getCascadeTotalEndMs(mbarSnap) + GOAL_TASK_DOTS_AFTER_MBARS_MS
    const id = window.setTimeout(() => {
      setMbarSnap(null)
      setTaskDotsPlay(true)
    }, endMs)
    return () => window.clearTimeout(id)
  }, [mbarSnap, barsPlay, prefersReducedMotion])

  /** 감소 동작: 막대 연쇄 없이 도트만 */
  useEffect(() => {
    setTaskDotsPlay(false)
    if (!barsPlay) return
    if (prefersReducedMotion) {
      const id = window.setTimeout(() => setTaskDotsPlay(true), 400)
      return () => window.clearTimeout(id)
    }
  }, [barsPlay, prefersReducedMotion])

  /** 연쇄 끝난 뒤 월만 바꿀 때 작업 행 도트 표시 */
  useEffect(() => {
    if (!barsPlay || prefersReducedMotion || mbarSnap) return
    if (startAnim) setTaskDotsPlay(true)
  }, [selectedMonthIndex, barsPlay, prefersReducedMotion, mbarSnap, startAnim])

  const headerTargetPct =
    goalScope === 'monthly'
      ? monthProgress[selectedMonthIndex] ?? 0
      : averagePercent(cardsForSelectedMonth)

  const isMonthlyHeaderCentered =
    goalScope === 'monthly' && (goals12[selectedMonthIndex] ?? '').trim().length > 0

  const isActiveGoalSettled = useMemo(() => {
    if (goalScope === 'monthly') return (goals12[selectedMonthIndex] ?? '').trim().length > 0
    return (goalTexts[dmZoomId] ?? '').trim().length > 0
  }, [goalScope, selectedMonthIndex, goals12, dmZoomId, goalTexts])

  useEffect(() => {
    if (!barsPlay) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    const prev = headerAnimCtxRef.current
    const ctxChanged =
      prev == null ||
      prev.goalScope !== goalScope ||
      prev.selectedMonthIndex !== selectedMonthIndex
    headerAnimCtxRef.current = { goalScope, selectedMonthIndex }

    if (reduced) {
      setHeaderPctDisplay(headerTargetPct)
      return
    }

    const from = ctxChanged ? 0 : headerPctDisplayRef.current
    const target = headerTargetPct
    const duration = ctxChanged ? GOAL_HEADER_BAR_MS : GOAL_HEADER_LIVE_MS

    if (!ctxChanged && from === target) return

    let cancelled = false
    const t0 = performance.now()
    const easeOut = (x) => 1 - (1 - x) ** 2
    let raf = 0
    const tick = (now) => {
      if (cancelled) return
      const t = Math.min(1, (now - t0) / duration)
      setHeaderPctDisplay(Math.round(from + easeOut(t) * (target - from)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [barsPlay, headerTargetPct, goalScope, selectedMonthIndex])

  const selectedMonthGoalText = goals12[selectedMonthIndex] ?? ''
  const showMonthGoalEmpty = !selectedMonthGoalText.trim() && !monthGoalEditing

  const beginEditMonthGoal = () => {
    setMonthGoalDraft(selectedMonthGoalText)
    setMonthGoalEditing(true)
  }

  const commitMonthGoal = () => {
    if (!onMonthlyGoalsChange) {
      setMonthGoalEditing(false)
      return
    }
    const v = monthGoalDraft.trim()
    onMonthlyGoalsChange((prev) => {
      const next = [...(Array.isArray(prev) ? prev : [])]
      while (next.length < 12) next.push('')
      next[selectedMonthIndex] = v
      return next
    })
    setMonthGoalEditing(false)
  }

  const weekNavToastOpen = (weekNavToast.msg ?? '').length > 0

  return (
    <>
    <div className={`goal-screen${barsPlay ? ' goal-screen--bars-play' : ''}`}>
      <header className="goal-header">
        <div className="goal-header-brand">
          <BrandWordmark />
        </div>

        <div className="goal-period-toolbar">
          <div className="goal-scope-row" role="tablist" aria-label={t.goal.scopeTabAria}>
            <button
              type="button"
              role="tab"
              aria-selected={goalScope === 'daily'}
              className={`goal-scope-chip${goalScope === 'daily' ? ' goal-scope-chip--active' : ''}`}
              onClick={() => {
                setGoalScope('daily')
                setDailyStrikeReplay((n) => n + 1)
              }}
            >
              {t.goal.scopeDaily}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={goalScope === 'monthly'}
              className={`goal-scope-chip${goalScope === 'monthly' ? ' goal-scope-chip--active' : ''}`}
              onClick={() => setGoalScope('monthly')}
            >
              {t.goal.scopeMonthly}
            </button>
          </div>

          {goalScope === 'monthly' ? (
            <div className="goal-tabs-scroll-wrap">
              <div className="goal-tabs-scroll" role="tablist" aria-label={t.goal.monthTabAria}>
                <div className="goal-tabs-track">
                  {Array.from({ length: 12 }, (_, mi) => {
                    const m = mi + 1
                    const label = t.common.monthSuffix ? `${m}${t.common.monthSuffix}` : String(m)
                    const isQuarterHighlight = isQuarterHighlightMonth(mi)
                    return (
                      <button
                        key={mi}
                        type="button"
                        role="tab"
                        aria-selected={selectedMonthIndex === mi}
                        className={[
                          'goal-tab',
                          selectedMonthIndex === mi ? 'goal-tab--active' : '',
                          isQuarterHighlight ? 'goal-tab--quarter-highlight' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => setSelectedMonthIndex(mi)}
                      >
                        {label}
                      </button>
                    )
                  })}
                  <span className="goal-tabs-track-spacer" aria-hidden />
                </div>
              </div>
            </div>
          ) : (
            <div className="goal-daily-week-stack" role="tablist" aria-label={t.goal.dailyWeekRowAria}>
              {DAILY_WEEK_DAY_RANGES.map((rangeRow, i) => {
                const w = /** @type {1 | 2 | 3 | 4} */ (i + 1)
                const now = new Date()
                const isThisCalendarMonth =
                  gridYear === now.getFullYear() && selectedMonthIndex === now.getMonth()
                const todayWeek = isThisCalendarMonth
                  ? weekOfMonthForCalendarDay(now.getDate())
                  : null
                const lockedPast = isThisCalendarMonth && todayWeek != null && w < todayWeek
                const lockedFuture = isThisCalendarMonth && todayWeek != null && w > todayWeek
                const weekDisabled = lockedPast || lockedFuture
                const weekLbl = t.goal.dailyWeekLabels[w - 1]
                const dateRange = formatDailyWeekCalendarRange(
                  gridYear,
                  selectedMonthIndex,
                  rangeRow.start,
                  rangeRow.end,
                )
                const tabAria = dateRange ? `${weekLbl}, ${dateRange}` : weekLbl
                const disableTitle = lockedPast
                  ? t.goal.dailyWeekPastHint
                  : lockedFuture
                    ? t.goal.dailyWeekFutureHint
                    : undefined
                return (
                  <div
                    key={w}
                    className={[
                      'goal-daily-week-block',
                      lockedFuture ? 'goal-daily-week-block--future' : '',
                      lockedPast ? 'goal-daily-week-block--past' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <button
                      type="button"
                      role="tab"
                      tabIndex={weekDisabled ? -1 : 0}
                      aria-disabled={weekDisabled}
                      aria-selected={selectedWeekOfMonth === w}
                      aria-label={tabAria}
                      title={disableTitle}
                      className={[
                        'goal-daily-week-chip',
                        selectedWeekOfMonth === w ? 'goal-daily-week-chip--active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => {
                        if (weekDisabled) {
                          setWeekNavToast((prev) => ({
                            key: prev.key + 1,
                            msg: lockedPast ? t.goal.dailyWeekPastHint : t.goal.dailyWeekFutureHint,
                          }))
                          return
                        }
                        setSelectedWeekOfMonth(w)
                      }}
                    >
                      <span className="goal-daily-week-chip-week">{weekLbl}</span>
                      {dateRange ? (
                        <span className="goal-daily-week-chip-dates" aria-hidden>
                          {dateRange}
                        </span>
                      ) : null}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div
          className={['goal-block', isMonthlyHeaderCentered ? 'goal-block--1y-centered' : '']
            .filter(Boolean)
            .join(' ')}
        >
          <div className="goal-period">
            {goalScope === 'monthly'
              ? t.goal.periodToolbarMonthly
                  .replace('{y}', String(gridYear))
                  .replace('{n}', String(selectedMonthIndex + 1))
              : formatDailyHeaderPeriodLine(
                  selectedWeekOfMonth,
                  gridYear,
                  selectedMonthIndex,
                  t,
                )}
          </div>
          {goalScope === 'monthly' ? (
            selectedMonthGoalText.trim() ? (
              splitGoalHeaderParagraphs(selectedMonthGoalText).map((para, idx) => (
                <p key={idx} className="goal-text goal-text--1y-body">
                  {applyGoalDisplayBreaks(para)}
                </p>
              ))
            ) : (
              <p className="goal-text goal-text--muted">{t.goal.hintMonthlyFromSettings}</p>
            )
          ) : isActiveGoalSettled ? (
            <p className="goal-text" style={{ whiteSpace: 'pre-wrap' }}>
              {goalTexts[dmZoomId]}
            </p>
          ) : (
            <p className="goal-text goal-text--muted">{t.goal.hintDailyWeekGoalsFromSettings}</p>
          )}
        </div>

        <div>
          <div className="goal-progress-row">
            <span className="goal-progress-label">{t.goal.progress}</span>
            <span className="goal-progress-pct">{headerPctDisplay}%</span>
          </div>
          <div className="goal-progress-track">
            <div
              className={`goal-progress-fill${barsPlay ? ' goal-progress-fill--active' : ''}`}
              style={{ ['--goal-progress-target-pct']: `${headerTargetPct}%` }}
            />
          </div>
        </div>
      </header>

      <div className="goal-scroll">
        {goalScope === 'monthly' ? (
          <>
            <div className="goal-mbar-grid">
              {Array.from({ length: 12 }, (_, i) => {
                const m = i + 1
                const isQuarterHighlight = isQuarterHighlightMonth(i)
                const pctLive = monthProgress[i] ?? 0
                const prog = mbarSnap !== null ? mbarSnap[i] ?? 0 : pctLive
                const selected = selectedMonthIndex === i
                const barMs = getBarDurationMs(prog)
                const cascadeDelay = getCascadeStartDelay(i, mbarSnap ?? monthProgress)
                const showBar = pctLive > 0 || (mbarSnap !== null && prog > 0)

                const fillCascade =
                  mbarSnap !== null &&
                  barsPlay &&
                  !prefersReducedMotion &&
                  startAnim &&
                  barMs > 0
                const fillStaticRm =
                  barsPlay && prefersReducedMotion && getBarDurationMs(pctLive) > 0 && pctLive > 0
                const fillStaticDone =
                  mbarSnap === null &&
                  barsPlay &&
                  !prefersReducedMotion &&
                  startAnim &&
                  pctLive > 0 &&
                  getBarDurationMs(pctLive) > 0
                const fillIdle =
                  showBar && !fillCascade && !fillStaticRm && !fillStaticDone

                return (
                  <div
                    key={i}
                    className="goal-mbar"
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedMonthIndex(i)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedMonthIndex(i)
                      }
                    }}
                  >
                    <div className={`goal-mbar-outer${selected ? ' goal-mbar-outer--selected' : ''}`}>
                      {showBar ? (
                        <div
                          className={[
                            'goal-mbar-fill',
                            fillStaticRm || fillStaticDone ? 'goal-mbar-fill--cascade-static' : '',
                            fillCascade ? 'goal-mbar-fill--cascade' : '',
                            fillIdle ? 'goal-mbar-fill--cascade-idle' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          style={{
                            ['--target-height']: `${fillCascade || fillIdle ? prog : pctLive}%`,
                            ['--cascade-duration']: `${barMs}ms`,
                            ['--cascade-delay']: `${cascadeDelay}ms`,
                          }}
                        >
                          {pctLive >= GOAL_MBAR_PCT_SHOW_MIN ? (
                            <span className="goal-mbar-pct">{pctLive}%</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <span
                      className={[
                        'goal-mbar-lbl',
                        isQuarterHighlight ? 'goal-mbar-lbl--quarter-highlight' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {t.common.monthSuffix ? `${m}${t.common.monthSuffix}` : `${m}`}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="goal-month-panel">
              <div className="goal-month-panel-head">
                <div className="goal-month-panel-head-label-row">
                  <span className="goal-month-panel-head-dot" aria-hidden />
                  <span className="goal-month-panel-head-title">
                    {t.goal.monthGoalTitle.replace('{n}', String(selectedMonthIndex + 1))}
                  </span>
                </div>

                {monthGoalEditing ? (
                  <input
                    type="text"
                    className="goal-month-panel-goal-input"
                    value={monthGoalDraft}
                    autoFocus
                    onChange={(e) => setMonthGoalDraft(e.target.value)}
                    onBlur={commitMonthGoal}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
                    aria-label={t.goal.monthGoalEditAria.replace('{n}', String(selectedMonthIndex + 1))}
                  />
                ) : showMonthGoalEmpty ? (
                  <button type="button" className="goal-month-panel-goal-empty" onClick={beginEditMonthGoal}>
                    {t.goal.addGoal}
                  </button>
                ) : (
                  <button type="button" className="goal-month-panel-goal-text" onClick={beginEditMonthGoal}>
                    {selectedMonthGoalText}
                  </button>
                )}

                <p className="goal-month-panel-head-hint">{t.goal.tapToEdit}</p>
              </div>

              <div className="goal-month-panel-body">
                <div className="goal-month-panel-body-label">
                  {t.goal.monthWorkHistory.replace('{n}', String(selectedMonthIndex + 1))}
                </div>
                {cardsForSelectedMonth.length === 0 ? (
                  <p className="goal-month-panel-empty-tasks">{t.goal.noWork}</p>
                ) : (
                  cardsForSelectedMonth.map((card, rowIndex) => {
                    const displayName =
                      typeof card.displayTag === 'string'
                        ? card.displayTag
                        : typeof card.title === 'string'
                          ? card.title
                          : t.common.workFallback
                    const done = filledWorkDots(card)
                    return (
                      <GoalPanelWorkRow
                        key={String(card.id)}
                        name={displayName}
                        done={done}
                        carry={Boolean(card.isCarryOver)}
                        rowDelayMs={workRowDotBaseDelaysMs[rowIndex] ?? 0}
                        dotsPlay={taskDotsPlay}
                        reducedMotion={prefersReducedMotion}
                      />
                    )
                  })
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="goal-daily-chart">
            <div className="goal-dbar-rising-card">
              <div
                className="goal-dbar-rising"
                role="img"
                aria-label={t.goal.dailyRisingAria}
              >
                {Array.from({ length: 30 }, (_, i) => {
                  const day = i + 1
                  const h = risingHeightPercent(day)
                  const delayMs = prefersReducedMotion ? 0 : i * 22
                  return (
                    <div key={day} className="goal-dbar-col">
                      <div className="goal-dbar-track">
                        <div
                          className={[
                            'goal-dbar-fill',
                            barsPlay ? 'goal-dbar-fill--active' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          style={{
                            ['--dbar-height-pct']: `${h}%`,
                            transitionDelay: barsPlay ? `${delayMs}ms` : '0ms',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="goal-dbar-axis" aria-hidden>
                {GOAL_DAILY_AXIS_TICKS.map((d) => (
                  <span key={d} className="goal-dbar-axis-tick">
                    {t.goal.dayAxisLabel.replace('{d}', String(d))}
                  </span>
                ))}
              </div>
            </div>

            <div className="goal-daily-tracker-panel">
              <div className="goal-daily-tracker-head">{t.goal.dailyTrackerListTitle}</div>
              {allTrackerCardsList.length === 0 ? (
                <p className="goal-daily-tracker-empty">{t.goal.dailyTrackerEmpty}</p>
              ) : (
                <GoalTrackerWorkList key={dailyStrikeReplay} cards={allTrackerCardsList} t={t} />
              )}
              <p className="goal-daily-tracker-hint">{t.goal.dailyTrackerReadOnlyHint}</p>
            </div>
          </div>
        )}
      </div>

      <nav className="goal-nav" aria-label={t.common.bottomNavAria}>
        <button type="button" className="goal-nav-item" onClick={() => onTabChange?.('tracker')}>
          <span className="goal-nav-icon" aria-hidden>
            <NavIconTracker />
          </span>
          {t.nav.tracker}
        </button>
        <button type="button" className="goal-nav-item goal-nav-item--active">
          <span className="goal-nav-icon" aria-hidden>
            <NavIconGoal />
          </span>
          {t.nav.goal}
        </button>
        {features.gallery ? (
          <button type="button" className="goal-nav-item" onClick={() => onTabChange?.('gallery')}>
            <span className="goal-nav-icon" aria-hidden>
              <NavIconGallery />
            </span>
            {t.nav.gallery}
          </button>
        ) : null}
        <button type="button" className="goal-nav-item" onClick={() => onTabChange?.('settings')}>
          <span className="goal-nav-icon" aria-hidden>
            <NavIconSettings />
          </span>
          {t.nav.setting}
        </button>
      </nav>
    </div>
    {createPortal(
      <AppToast
        key={weekNavToast.key}
        message={weekNavToast.msg ?? ''}
        open={weekNavToastOpen}
        onClose={closeWeekNavToast}
      />,
      document.body,
    )}
    </>
  )
}
