import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLang } from './contexts/LanguageContext.js'
import { DEFAULT_APP_FEATURES } from './appFeatures.js'
import {
  applyGoalDisplayBreaks,
  createEmptyGoalTexts,
  GOAL_DM_ZOOM,
  splitGoalHeaderParagraphs,
  yearHorizonToGoalKey,
} from './goalConfig.js'
import {
  computeYearTimeline,
  horizonYearsFromTab,
  normalizeGoalStart,
} from './goalYearTimeline.js'
import BrandWordmark from './BrandWordmark'
import { NavIconGallery, NavIconGoal, NavIconSettings, NavIconTracker } from './bottomNavIcons.jsx'
import './GoalScreen.css'

/** 상단 진행률 가로 바 + % 숫자 — 트래커 헤더와 동기 */
const GOAL_HEADER_BAR_MS = 980

const GOAL_PROGRESS_PERCENT = 33

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
/** 작업 행 도트 — 기존 GoalScreen TaskRow 타이밍 */
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
 * @param {{
 *   onTabChange?: (tab: 'tracker' | 'goal' | 'gallery' | 'settings') => void
 *   goalTexts?: Record<string, string>
 *   goalStartDate?: string
 *   monthlyGoals?: string[]
 *   onMonthlyGoalsChange?: (updater: (prev: string[]) => string[]) => void
 *   trackerCards?: Record<string, unknown>[]
 * }} props
 */
export default function GoalScreen({
  onTabChange,
  features = DEFAULT_APP_FEATURES,
  goalTexts = createEmptyGoalTexts(),
  goalStartDate = '',
  monthlyGoals = [],
  onMonthlyGoalsChange,
  trackerCards = [],
}) {
  const { t } = useLang()
  const { year: calendarYear } = currentYearMonth()
  const gridYear = calendarYear

  const [goalScope, setGoalScope] = useState(/** @type {'year' | 'dayMonth'} */ ('year'))
  const [activeHorizon, setActiveHorizon] = useState(/** @type {'1' | '3' | '5' | '10'} */ ('1'))
  const [dmZoomId, setDmZoomId] = useState(GOAL_DM_ZOOM[0].id)
  const [barsPlay, setBarsPlay] = useState(false)
  const [headerPctDisplay, setHeaderPctDisplay] = useState(0)
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => new Date().getMonth())
  const [monthGoalEditing, setMonthGoalEditing] = useState(false)
  const [monthGoalDraft, setMonthGoalDraft] = useState('')
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [taskDotsPlay, setTaskDotsPlay] = useState(false)
  const [startAnim, setStartAnim] = useState(false)

  const goals12 = useMemo(() => {
    const g = Array.isArray(monthlyGoals) ? [...monthlyGoals] : []
    while (g.length < 12) g.push('')
    return g.slice(0, 12)
  }, [monthlyGoals])

  const cardsForSelectedMonth = useMemo(() => {
    const ym = ymForYearMonth(gridYear, selectedMonthIndex)
    return trackerCards.filter((c) => c && typeof c === 'object' && c.activeMonthYm === ym)
  }, [trackerCards, gridYear, selectedMonthIndex])

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
  }, [goalScope, dmZoomId, activeHorizon])

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

  /** 스냅샷 기준 연쇄 종료 시 스냅 해제 + 작업 도트 시작 (타이밍이 진행률 실시간 변경과 무관) */
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

  const yearView = useMemo(() => {
    if (goalScope !== 'year') {
      return {
        slots: [],
        barTargetPcts: [],
        overallPct: 0,
        currentSlotIndex: -1,
        periodLabel: '',
        totalMonths: 0,
      }
    }
    const start = normalizeGoalStart(goalStartDate)
    const hy = horizonYearsFromTab(activeHorizon)
    return computeYearTimeline(start, hy)
  }, [goalScope, goalStartDate, activeHorizon])

  /** 올해 트래커 카드 평균 진행률 — 있으면 헤더·숫자 애니가 100%까지 올라갈 수 있음 */
  const yearTrackerAvgPct = useMemo(() => {
    const yp = `${gridYear}-`
    const list = trackerCards.filter(
      (c) =>
        c &&
        typeof c === 'object' &&
        typeof c.activeMonthYm === 'string' &&
        c.activeMonthYm.startsWith(yp),
    )
    if (list.length === 0) return null
    return Math.round(
      list.reduce((s, c) => s + (Number(c.percent) || 0), 0) / list.length,
    )
  }, [trackerCards, gridYear])

  const headerTargetPct =
    goalScope === 'year'
      ? yearTrackerAvgPct != null
        ? yearTrackerAvgPct
        : yearView.overallPct
      : GOAL_PROGRESS_PERCENT
  const isYear1HeaderLayout = goalScope === 'year' && activeHorizon === '1'

  const dmSpec = useMemo(
    () => GOAL_DM_ZOOM.find((z) => z.id === dmZoomId) ?? GOAL_DM_ZOOM[0],
    [dmZoomId],
  )
  const dmZoomDisplayLabel = t.goal.dmZoom[dmZoomId] ?? dmSpec.label

  const isActiveGoalSettled = useMemo(() => {
    const key = goalScope === 'year' ? yearHorizonToGoalKey(activeHorizon) : dmZoomId
    return (goalTexts[key] ?? '').trim().length > 0
  }, [goalScope, activeHorizon, dmZoomId, goalTexts])

  useEffect(() => {
    if (!barsPlay) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (reduced) {
      setHeaderPctDisplay(headerTargetPct)
      return
    }
    let cancelled = false
    const target = headerTargetPct
    const duration = GOAL_HEADER_BAR_MS
    const t0 = performance.now()
    const easeOut = (x) => 1 - (1 - x) ** 2
    let raf = 0
    const tick = (now) => {
      if (cancelled) return
      const t = Math.min(1, (now - t0) / duration)
      setHeaderPctDisplay(Math.round(easeOut(t) * target))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [barsPlay, headerTargetPct])

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

  return (
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
              aria-selected={goalScope === 'dayMonth'}
              className={`goal-scope-chip${goalScope === 'dayMonth' ? ' goal-scope-chip--active' : ''}`}
              onClick={() => setGoalScope('dayMonth')}
            >
              {t.goal.scopeDayMonth}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={goalScope === 'year'}
              className={`goal-scope-chip${goalScope === 'year' ? ' goal-scope-chip--active' : ''}`}
              onClick={() => setGoalScope('year')}
            >
              {t.goal.scopeYear}
            </button>
          </div>

          {goalScope === 'year' ? (
            <div className="goal-tabs-scroll-wrap">
              <div className="goal-tabs-scroll" role="tablist" aria-label={t.goal.horizonTabAria}>
                <div className="goal-tabs-track">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeHorizon === '1'}
                    className={`goal-tab${activeHorizon === '1' ? ' goal-tab--active' : ''}`}
                    onClick={() => setActiveHorizon('1')}
                  >
                    {t.goal.tabs.one}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeHorizon === '3'}
                    className={`goal-tab${activeHorizon === '3' ? ' goal-tab--active' : ''}`}
                    onClick={() => setActiveHorizon('3')}
                  >
                    {t.goal.tabs.three}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeHorizon === '5'}
                    className={`goal-tab${activeHorizon === '5' ? ' goal-tab--active' : ''}`}
                    onClick={() => setActiveHorizon('5')}
                  >
                    {t.goal.tabs.five}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeHorizon === '10'}
                    className={`goal-tab${activeHorizon === '10' ? ' goal-tab--active' : ''}`}
                    onClick={() => setActiveHorizon('10')}
                  >
                    {t.goal.tabs.ten}
                  </button>
                  <span className="goal-tabs-track-spacer" aria-hidden />
                </div>
              </div>
            </div>
          ) : (
            <div className="goal-zoom-row goal-zoom-row--wrap" aria-label={t.goal.dmZoomAria}>
              <div className="goal-zoom-chips goal-zoom-chips--wrap" role="group">
                {GOAL_DM_ZOOM.map((z, i) => (
                  <span key={z.id} className="goal-zoom-chip-wrap">
                    {i > 0 ? (
                      <span className="goal-zoom-slash" aria-hidden>
                        /
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`goal-zoom-chip${dmZoomId === z.id ? ' goal-zoom-chip--active' : ''}`}
                      onClick={() => setDmZoomId(z.id)}
                    >
                      {t.goal.dmZoom[z.id] ?? z.label}
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={['goal-block', isYear1HeaderLayout ? 'goal-block--1y-centered' : ''].filter(Boolean).join(' ')}>
          <div className="goal-period">
            {goalScope === 'year'
              ? t.goal.periodToolbarYear
                  .replace('{label}', yearView.periodLabel)
                  .replace('{n}', activeHorizon)
              : t.goal.periodToolbarDm.replace('{label}', dmZoomDisplayLabel)}
          </div>
          {goalScope === 'year' ? (
            (goalTexts[yearHorizonToGoalKey(activeHorizon)] ?? '').trim() ? (
              isYear1HeaderLayout ? (
                splitGoalHeaderParagraphs(goalTexts[yearHorizonToGoalKey(activeHorizon)] ?? '').map((para, idx) => (
                  <p key={idx} className="goal-text goal-text--1y-body">
                    {applyGoalDisplayBreaks(para)}
                  </p>
                ))
              ) : (
                <p className="goal-text" style={{ whiteSpace: 'pre-wrap' }}>
                  {goalTexts[yearHorizonToGoalKey(activeHorizon)]}
                </p>
              )
            ) : activeHorizon === '1' ? (
              <p className="goal-text goal-text--muted">{t.goal.hintYearFromSettings}</p>
            ) : (
              <p className="goal-text goal-text--muted">{t.goal.unset}</p>
            )
          ) : isActiveGoalSettled ? (
            <p className="goal-text" style={{ whiteSpace: 'pre-wrap' }}>
              {goalTexts[dmZoomId]}
            </p>
          ) : (
            <p className="goal-text goal-text--muted">{t.goal.unset}</p>
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
        <div className="goal-mbar-grid">
          {Array.from({ length: 12 }, (_, i) => {
            const m = i + 1
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
            const fillStaticRm = barsPlay && prefersReducedMotion && getBarDurationMs(pctLive) > 0 && pctLive > 0
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
                    />
                  ) : null}
                  {pctLive > 0 ? <span className="goal-mbar-pct">{pctLive}%</span> : null}
                </div>
                <span className="goal-mbar-lbl">
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
  )
}
