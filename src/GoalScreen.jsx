import { useEffect, useMemo, useState } from 'react'
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

/** 월 막대 상승 — 지난 달·완료 구간은 짧게, 진행 중은 길게 (기존 GoalScreen 타이밍) */
const GOAL_MBAR_RISE_FAST_MS = 380
const GOAL_MBAR_RISE_CURRENT_MS = 1100
const GOAL_MBAR_STAGGER_MS = 85

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

  const goals12 = useMemo(() => {
    const g = Array.isArray(monthlyGoals) ? [...monthlyGoals] : []
    while (g.length < 12) g.push('')
    return g.slice(0, 12)
  }, [monthlyGoals])

  const cardsForSelectedMonth = useMemo(() => {
    const ym = ymForYearMonth(gridYear, selectedMonthIndex)
    return trackerCards.filter((c) => c && typeof c === 'object' && c.activeMonthYm === ym)
  }, [trackerCards, gridYear, selectedMonthIndex])

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
    setTaskDotsPlay(false)
    setHeaderPctDisplay(0)
    const t = window.setTimeout(() => setBarsPlay(true), 80)
    return () => window.clearTimeout(t)
  }, [goalScope, dmZoomId, activeHorizon])

  /** 월 막대 상승이 끝난 뒤 작업 도트·이름 이펙트 재생 */
  useEffect(() => {
    setTaskDotsPlay(false)
    if (!barsPlay) return
    if (prefersReducedMotion) {
      setTaskDotsPlay(true)
      return
    }
    const lastMbarDelay = 11 * GOAL_MBAR_STAGGER_MS
    const mbarEnd = lastMbarDelay + GOAL_MBAR_RISE_CURRENT_MS
    const id = window.setTimeout(() => setTaskDotsPlay(true), mbarEnd + GOAL_TASK_DOTS_AFTER_MBARS_MS)
    return () => window.clearTimeout(id)
  }, [barsPlay, prefersReducedMotion, selectedMonthIndex, cardsForSelectedMonth])

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
          <div className="goal-scope-row" role="tablist" aria-label="목표 범위">
            <button
              type="button"
              role="tab"
              aria-selected={goalScope === 'dayMonth'}
              className={`goal-scope-chip${goalScope === 'dayMonth' ? ' goal-scope-chip--active' : ''}`}
              onClick={() => setGoalScope('dayMonth')}
            >
              일 · 월
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={goalScope === 'year'}
              className={`goal-scope-chip${goalScope === 'year' ? ' goal-scope-chip--active' : ''}`}
              onClick={() => setGoalScope('year')}
            >
              연도
            </button>
          </div>

          {goalScope === 'year' ? (
            <div className="goal-tabs-scroll-wrap">
              <div className="goal-tabs-scroll" role="tablist" aria-label="목표 기간(스와이프)">
                <div className="goal-tabs-track">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeHorizon === '1'}
                    className={`goal-tab${activeHorizon === '1' ? ' goal-tab--active' : ''}`}
                    onClick={() => setActiveHorizon('1')}
                  >
                    1년
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeHorizon === '3'}
                    className={`goal-tab${activeHorizon === '3' ? ' goal-tab--active' : ''}`}
                    onClick={() => setActiveHorizon('3')}
                  >
                    3년
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeHorizon === '5'}
                    className={`goal-tab${activeHorizon === '5' ? ' goal-tab--active' : ''}`}
                    onClick={() => setActiveHorizon('5')}
                  >
                    5년
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeHorizon === '10'}
                    className={`goal-tab${activeHorizon === '10' ? ' goal-tab--active' : ''}`}
                    onClick={() => setActiveHorizon('10')}
                  >
                    10년
                  </button>
                  <span className="goal-tabs-track-spacer" aria-hidden />
                </div>
              </div>
            </div>
          ) : (
            <div className="goal-zoom-row goal-zoom-row--wrap" aria-label="일·월 단위">
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
                      {z.label}
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
              ? `${yearView.periodLabel} · ${activeHorizon}년`
              : `${dmSpec.label} 단위`}
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
              <p className="goal-text goal-text--muted">
                설정의 GOALS · YEAR에서 이 기간의 목표를 입력해 주세요.
              </p>
            ) : (
              <p className="goal-text goal-text--muted">목표 미정</p>
            )
          ) : isActiveGoalSettled ? (
            <p className="goal-text" style={{ whiteSpace: 'pre-wrap' }}>
              {goalTexts[dmZoomId]}
            </p>
          ) : (
            <p className="goal-text goal-text--muted">목표 미정</p>
          )}
        </div>

        <div>
          <div className="goal-progress-row">
            <span className="goal-progress-label">진행률</span>
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
            const ym = ymForYearMonth(gridYear, i)
            const monthCards = trackerCards.filter(
              (c) => c && typeof c === 'object' && c.activeMonthYm === ym,
            )
            const pct = averagePercent(monthCards)
            const selected = selectedMonthIndex === i
            const mbarAnimOn = barsPlay && !prefersReducedMotion
            const mbarStaticOn = barsPlay && prefersReducedMotion

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
                  {pct > 0 ? (
                    <div
                      className={[
                        'goal-mbar-fill',
                        !barsPlay ? 'goal-mbar-fill--idle' : '',
                        mbarAnimOn ? 'goal-mbar-fill--animate' : '',
                        mbarStaticOn ? 'goal-mbar-fill--shown' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{
                        ['--mbar-fill-pct']: `${pct}%`,
                        ['--mbar-rise-ms']: `${pct >= 100 ? GOAL_MBAR_RISE_FAST_MS : GOAL_MBAR_RISE_CURRENT_MS}ms`,
                        ['--mbar-delay-ms']: `${i * GOAL_MBAR_STAGGER_MS}ms`,
                        opacity: Math.max(0.12, pct / 100),
                      }}
                    />
                  ) : null}
                  {pct > 0 ? <span className="goal-mbar-pct">{pct}%</span> : null}
                </div>
                <span className="goal-mbar-lbl">{m}월</span>
              </div>
            )
          })}
        </div>

        <div className="goal-month-panel">
          <div className="goal-month-panel-head">
            <div className="goal-month-panel-head-label-row">
              <span className="goal-month-panel-head-dot" aria-hidden />
              <span className="goal-month-panel-head-title">{selectedMonthIndex + 1}월 목표</span>
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
                aria-label={`${selectedMonthIndex + 1}월 목표 편집`}
              />
            ) : showMonthGoalEmpty ? (
              <button type="button" className="goal-month-panel-goal-empty" onClick={beginEditMonthGoal}>
                목표를 탭해서 추가해요
              </button>
            ) : (
              <button type="button" className="goal-month-panel-goal-text" onClick={beginEditMonthGoal}>
                {selectedMonthGoalText}
              </button>
            )}

            <p className="goal-month-panel-head-hint">탭해서 수정 가능</p>
          </div>

          <div className="goal-month-panel-body">
            <div className="goal-month-panel-body-label">{selectedMonthIndex + 1}월 작업 내역</div>
            {cardsForSelectedMonth.length === 0 ? (
              <p className="goal-month-panel-empty-tasks">이달 작업이 없어요</p>
            ) : (
              cardsForSelectedMonth.map((card, rowIndex) => {
                const displayName =
                  typeof card.displayTag === 'string'
                    ? card.displayTag
                    : typeof card.title === 'string'
                      ? card.title
                      : '작업'
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

      <nav className="goal-nav" aria-label="하단 메뉴">
        <button type="button" className="goal-nav-item" onClick={() => onTabChange?.('tracker')}>
          <span className="goal-nav-icon" aria-hidden>
            <NavIconTracker />
          </span>
          트래커
        </button>
        <button type="button" className="goal-nav-item goal-nav-item--active">
          <span className="goal-nav-icon" aria-hidden>
            <NavIconGoal />
          </span>
          목표
        </button>
        {features.gallery ? (
          <button type="button" className="goal-nav-item" onClick={() => onTabChange?.('gallery')}>
            <span className="goal-nav-icon" aria-hidden>
              <NavIconGallery />
            </span>
            갤러리
          </button>
        ) : null}
        <button type="button" className="goal-nav-item" onClick={() => onTabChange?.('settings')}>
          <span className="goal-nav-icon" aria-hidden>
            <NavIconSettings />
          </span>
          설정
        </button>
      </nav>
    </div>
  )
}
