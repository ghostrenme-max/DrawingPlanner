import { Fragment, useEffect, useMemo, useState } from 'react'
import { DEFAULT_APP_FEATURES } from './appFeatures.js'
import {
  applyGoalDisplayBreaks,
  createEmptyGoalTexts,
  getGoalDmDetailTitle,
  GOAL_DM_ZOOM,
  splitGoalHeaderParagraphs,
  yearHorizonToGoalKey,
} from './goalConfig.js'
import {
  computeYearTimeline,
  horizonYearsFromTab,
  normalizeGoalStart,
  pad2,
  timelineBarLabel,
} from './goalYearTimeline.js'
import BrandWordmark from './BrandWordmark'
import './GoalScreen.css'

/** 이미 지난 달(100% 채움) 막대 상승 — 빠르게 */
const GOAL_BAR_RISE_FAST_MS = 380
/** 이번 달(진행 중, 부분 채움) 막대 상승 — 기존 속도 유지 */
const GOAL_BAR_RISE_CURRENT_MS = 1100

/** 상단 진행률 가로 바 + % 숫자 — 트래커 헤더(mt-bar-fill)와 동일 시간·이징 */
const GOAL_HEADER_BAR_MS = 980

/** 이전 달 막대 애니가 이 비율만큼 진행된 뒤 다음 달 상승 시작 (1이면 100% 끝난 뒤) */
const GOAL_BAR_NEXT_START_AFTER_PREV_FRAC = 0.85

/** 상단 진행률·월별 막대가 끝난 뒤 작업 도트 바운스까지 여유(ms) */
const GOAL_TASK_DOTS_AFTER_BARS_MS = 160

/** 같은 행에서 이전 도트가 시작한 뒤 다음 도트 시작까지(ms) — 1→2→… 순차 */
const GOAL_TASK_DOT_STAGGER_MS = 100

/** 한 행 마지막 도트 애니가 끝난 뒤, 다음 행 첫 도트까지(ms) */
const GOAL_TASK_ROW_GAP_MS = 120

/** CSS .goal-task-dot-fill-bounce duration(0.58s)과 동기 */
const GOAL_TASK_DOT_ANIM_MS = 580

/** 일·월 보기 막대 — 데모용 고정 진행률 */
const GOAL_PROGRESS_PERCENT = 33

const EMPTY_TASK_LIST = []

const MONTH_TASKS = {
  '04': [
    { name: '메인일러스트', done: 5 },
    { name: '전신반신', done: 3 },
    { name: 'UI디자인', done: 1 },
  ],
  '05': [
    { name: '메인일러스트', done: 3 },
    { name: '캐릭터시트', done: 2 },
  ],
}

/** @param {{ key: string; year: number; mm: string }[]} slots */
function groupSlotsByCalendarYear(slots) {
  const map = new Map()
  for (const slot of slots) {
    if (!map.has(slot.year)) map.set(slot.year, [])
    map.get(slot.year).push(slot)
  }
  return /** @type {[number, typeof slots][]} */ ([...map.entries()].sort((a, b) => a[0] - b[0]))
}

/** @param {{ year: number; mm: string }[]} slots */
function formatSlotRangeLabel(slots) {
  if (slots.length === 0) return ''
  const first = slots[0]
  const last = slots[slots.length - 1]
  return `${first.year}.${first.mm} — ${last.year}.${last.mm}`
}

/**
 * 연도 카드용 — 슬롯에 등장한 월(mm) 순으로 데모 작업 합침
 * @param {{ year: number; mm: string }[]} slots
 */
function collectTasksForYearSlots(slots) {
  const mmOrder = []
  const seen = new Set()
  for (const s of slots) {
    if (seen.has(s.mm)) continue
    seen.add(s.mm)
    mmOrder.push(s.mm)
  }
  const out = []
  for (const mm of mmOrder) {
    const list = MONTH_TASKS[mm]
    if (!list) continue
    for (const t of list) {
      out.push({ ...t, _taskKey: `${mm}-${t.name}` })
    }
  }
  return out
}

function currentYearMonth() {
  const d = new Date()
  return { year: d.getFullYear(), monthMm: pad2(d.getMonth() + 1) }
}

function monthLabel(mm) {
  return `${Number(mm)}월`
}

function buildBarAnimScheduleFromPcts(targetPcts) {
  let accDelay = 0
  return targetPcts.map((targetPct) => {
    const riseMs =
      targetPct <= 0 ? 0 : targetPct >= 100 ? GOAL_BAR_RISE_FAST_MS : GOAL_BAR_RISE_CURRENT_MS
    const delayMs = targetPct > 0 ? accDelay : 0
    if (targetPct > 0) accDelay += riseMs * GOAL_BAR_NEXT_START_AFTER_PREV_FRAC
    return { delayMs, riseMs, targetPct }
  })
}

function barFillPercentDm(segIdx, currentSegIdx, progressPct) {
  if (segIdx < currentSegIdx) return 100
  if (segIdx === currentSegIdx) return progressPct
  return 0
}

function buildBarAnimScheduleDm(nSegments, currentSegIdx, progressPct) {
  let accDelay = 0
  return Array.from({ length: nSegments }, (_, segIdx) => {
    const targetPct = barFillPercentDm(segIdx, currentSegIdx, progressPct)
    const riseMs =
      targetPct <= 0 ? 0 : targetPct >= 100 ? GOAL_BAR_RISE_FAST_MS : GOAL_BAR_RISE_CURRENT_MS
    const delayMs = targetPct > 0 ? accDelay : 0
    if (targetPct > 0) accDelay += riseMs * GOAL_BAR_NEXT_START_AFTER_PREV_FRAC
    return { delayMs, riseMs, targetPct, segIdx }
  })
}

/** barsPlay 시점 기준으로 막대 fill CSS 애니가 가장 늦게 끝나는 시각(ms) */
function maxBarAnimEndMs(schedule) {
  let max = 0
  for (const { delayMs, riseMs } of schedule) {
    if (riseMs <= 0) continue
    max = Math.max(max, delayMs + riseMs)
  }
  return max
}

/** 각 작업 행 첫 도트의 animation-delay 기준(ms) — 이전 행은 마지막 도트 애니 종료 직후까지 대기 */
function buildTaskRowDotBaseDelaysMs(taskList, staggerMs, gapMs, animMs) {
  const rowBases = []
  let acc = 0
  for (let r = 0; r < taskList.length; r++) {
    rowBases.push(acc)
    const d = Math.min(5, Math.max(0, taskList[r].done))
    if (d > 0) acc += (d - 1) * staggerMs + animMs + gapMs
  }
  return rowBases
}

function GoalBarAnimatedPct({ target, play, riseMs, delayMs }) {
  const [v, setV] = useState(0)

  useEffect(() => {
    if (!play || target <= 0) {
      setV(0)
      return
    }

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (reduced) {
      const id = window.setTimeout(() => setV(target), delayMs)
      return () => window.clearTimeout(id)
    }

    let raf = 0
    const t0 = performance.now() + delayMs

    const easeOut = (x) => 1 - (1 - x) ** 2

    const frame = (now) => {
      if (now < t0) {
        raf = requestAnimationFrame(frame)
        return
      }
      const t = Math.min(1, (now - t0) / riseMs)
      setV(Math.round(easeOut(t) * target))
      if (t < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [play, target, riseMs, delayMs])

  if (target <= 0) return null
  return <span className="goal-bar-pct">{v}%</span>
}

function TaskRow({ name, done, dotsPlay, rowDelayMs, dotStaggerMs, reducedMotion }) {
  const [nameOrange, setNameOrange] = useState(false)

  useEffect(() => {
    if (done < 5) {
      setNameOrange(false)
      return
    }
    if (!dotsPlay) {
      setNameOrange(false)
      return
    }
    if (reducedMotion) {
      setNameOrange(true)
      return
    }
    const ms =
      rowDelayMs + 4 * dotStaggerMs + Math.round(GOAL_TASK_DOT_ANIM_MS * 0.72)
    const id = window.setTimeout(() => setNameOrange(true), ms)
    return () => window.clearTimeout(id)
  }, [done, dotsPlay, rowDelayMs, dotStaggerMs, reducedMotion])

  return (
    <div className="goal-task">
      <span className={`goal-task-name${nameOrange ? ' goal-task-name--full' : ''}`}>{name}</span>
      <div className="goal-task-dots" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => {
          const on = i < done
          const filled = on && dotsPlay
          const delayMs = rowDelayMs + i * dotStaggerMs
          return (
            <span
              key={i}
              className={`goal-task-dot${filled ? ' goal-task-dot--on' : ''}${filled && !reducedMotion ? ' goal-task-dot--animate' : ''}`}
              style={
                filled && !reducedMotion ? { animationDelay: `${delayMs}ms` } : undefined
              }
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
 * }} props
 */
export default function GoalScreen({
  onTabChange,
  features = DEFAULT_APP_FEATURES,
  goalTexts = createEmptyGoalTexts(),
  goalStartDate = '',
}) {
  const { year: calendarYear, monthMm: currentMonthMm } = currentYearMonth()
  /** 기본 보기: 연도 */
  const [goalScope, setGoalScope] = useState(/** @type {'year' | 'dayMonth'} */ ('year'))
  const [activeHorizon, setActiveHorizon] = useState(/** @type {'1' | '3' | '5' | '10'} */ ('1'))
  const [dmZoomId, setDmZoomId] = useState(GOAL_DM_ZOOM[0].id)
  const [selectedTimelineKey, setSelectedTimelineKey] = useState(/** @type {string | null} */ (null))
  const [selectedDmSegIdx, setSelectedDmSegIdx] = useState(0)
  const [barsPlay, setBarsPlay] = useState(false)
  const [taskDotsPlay, setTaskDotsPlay] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [headerPctDisplay, setHeaderPctDisplay] = useState(0)

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

  useEffect(() => {
    setSelectedDmSegIdx(0)
  }, [dmZoomId])

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

  const headerTargetPct = goalScope === 'year' ? yearView.overallPct : GOAL_PROGRESS_PERCENT
  const isYear1HeaderLayout = goalScope === 'year' && activeHorizon === '1'

  useEffect(() => {
    if (goalScope !== 'year') return
    const keyThisMonth = `${calendarYear}-${currentMonthMm}`
    const match = yearView.slots.find((s) => s.key === keyThisMonth)
    const next =
      match?.key ??
      (yearView.currentSlotIndex >= 0
        ? yearView.slots[yearView.currentSlotIndex]?.key
        : yearView.slots[0]?.key) ??
      null
    if (next) setSelectedTimelineKey(next)
  }, [goalScope, yearView, calendarYear, currentMonthMm])

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

  const dmSpec = useMemo(
    () => GOAL_DM_ZOOM.find((z) => z.id === dmZoomId) ?? GOAL_DM_ZOOM[0],
    [dmZoomId],
  )

  const dmCurrentSegIdx = useMemo(
    () => Math.min(2, Math.max(0, dmSpec.segments.length - 1)),
    [dmSpec.segments.length],
  )

  const selectedYearSlot = useMemo(() => {
    if (!selectedTimelineKey) return null
    return yearView.slots.find((s) => s.key === selectedTimelineKey) ?? null
  }, [yearView.slots, selectedTimelineKey])

  const isActiveGoalSettled = useMemo(() => {
    const key = goalScope === 'year' ? yearHorizonToGoalKey(activeHorizon) : dmZoomId
    return (goalTexts[key] ?? '').trim().length > 0
  }, [goalScope, activeHorizon, dmZoomId, goalTexts])

  const tasks = useMemo(() => {
    if (goalScope !== 'year' || !selectedYearSlot) return EMPTY_TASK_LIST
    return MONTH_TASKS[selectedYearSlot.mm] ?? EMPTY_TASK_LIST
  }, [goalScope, selectedYearSlot])

  const barAnimSchedule = useMemo(() => {
    if (goalScope === 'year') {
      return buildBarAnimScheduleFromPcts(yearView.barTargetPcts)
    }
    return buildBarAnimScheduleDm(
      dmSpec.segments.length,
      dmCurrentSegIdx,
      GOAL_PROGRESS_PERCENT,
    )
  }, [goalScope, yearView.barTargetPcts, dmSpec.segments.length, dmCurrentSegIdx])

  const slotIndexByKey = useMemo(() => {
    const m = new Map()
    yearView.slots.forEach((s, i) => m.set(s.key, i))
    return m
  }, [yearView.slots])

  const useMultiYearSections =
    goalScope === 'year' && (activeHorizon === '3' || activeHorizon === '5' || activeHorizon === '10')

  const yearSectionGroups = useMemo(
    () => (useMultiYearSections ? groupSlotsByCalendarYear(yearView.slots) : []),
    [useMultiYearSections, yearView.slots],
  )

  const useDenseYearGrid = goalScope === 'dayMonth'

  const taskDotsDelayAfterBarsPlayMs = useMemo(() => {
    const barEnd = maxBarAnimEndMs(barAnimSchedule)
    return Math.max(GOAL_HEADER_BAR_MS, barEnd) + GOAL_TASK_DOTS_AFTER_BARS_MS
  }, [barAnimSchedule])

  const taskRowDotBaseDelaysMs = useMemo(
    () =>
      buildTaskRowDotBaseDelaysMs(
        tasks,
        GOAL_TASK_DOT_STAGGER_MS,
        GOAL_TASK_ROW_GAP_MS,
        GOAL_TASK_DOT_ANIM_MS,
      ),
    [tasks],
  )

  useEffect(() => {
    if (!barsPlay) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (reduced) {
      setTaskDotsPlay(true)
      return
    }
    const id = window.setTimeout(() => setTaskDotsPlay(true), taskDotsDelayAfterBarsPlayMs)
    return () => window.clearTimeout(id)
  }, [barsPlay, taskDotsDelayAfterBarsPlayMs])

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
        {useMultiYearSections ? (
          <>
            {yearSectionGroups.map(([calendarYear, slots]) => {
              const yearTasks = collectTasksForYearSlots(slots)
              const yearTaskDelays = buildTaskRowDotBaseDelaysMs(
                yearTasks,
                GOAL_TASK_DOT_STAGGER_MS,
                GOAL_TASK_ROW_GAP_MS,
                GOAL_TASK_DOT_ANIM_MS,
              )
              return (
                <Fragment key={calendarYear}>
                  <section className="goal-year-section" aria-label={`${calendarYear}년`}>
                    <p className="goal-year-range-label">{formatSlotRangeLabel(slots)}</p>
                    <div className="goal-grid">
                      {slots.map((slot) => {
                        const idx = slotIndexByKey.get(slot.key)
                        if (idx === undefined) return null
                        const targetPct = yearView.barTargetPcts[idx] ?? 0
                        const { delayMs, riseMs } = barAnimSchedule[idx] ?? {
                          delayMs: 0,
                          riseMs: 0,
                          targetPct: 0,
                        }
                        const isCurrent = idx === yearView.currentSlotIndex
                        const monthReached =
                          yearView.currentSlotIndex >= 0 ? idx <= yearView.currentSlotIndex : false
                        const isSelected = selectedTimelineKey === slot.key
                        const fillOpacity = targetPct >= 100 ? 0.55 : 1
                        const barClass = [
                          'goal-bar',
                          targetPct <= 0 ? 'goal-bar--future' : '',
                          isSelected ? 'goal-bar--selected' : '',
                          isCurrent ? 'goal-bar--current' : '',
                          targetPct > 0 ? 'goal-bar--filled' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')

                        return (
                          <div key={slot.key} className="goal-bar-wrap">
                            <button
                              type="button"
                              className={barClass}
                              onClick={() => setSelectedTimelineKey(slot.key)}
                            >
                              {targetPct > 0 ? (
                                <span
                                  className={`goal-bar-fill${barsPlay ? ' goal-bar-fill--animate' : ''}`}
                                  style={{
                                    ['--fill-pct']: `${targetPct}%`,
                                    ['--bar-rise-ms']: `${riseMs}ms`,
                                    ['--bar-delay-ms']: `${delayMs}ms`,
                                    background: `rgba(var(--ww-main-rgb), ${fillOpacity})`,
                                  }}
                                />
                              ) : null}
                              <GoalBarAnimatedPct
                                target={targetPct}
                                play={barsPlay}
                                riseMs={riseMs}
                                delayMs={delayMs}
                              />
                            </button>
                            <span
                              className={[
                                'goal-month-label',
                                monthReached ? 'goal-month-label--past' : 'goal-month-label--future',
                              ].join(' ')}
                            >
                              {timelineBarLabel(slot, false)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                  <div className="goal-detail goal-detail--year-rollup">
                    <div className="goal-detail-title">{calendarYear}년 작업 내역</div>
                    {!isActiveGoalSettled ? (
                      <p className="goal-detail-empty">목표 미정</p>
                    ) : yearTasks.length > 0 ? (
                      yearTasks.map((t, rowIndex) => (
                        <TaskRow
                          key={`${calendarYear}-${t._taskKey}`}
                          name={t.name}
                          done={t.done}
                          dotsPlay={taskDotsPlay}
                          rowDelayMs={yearTaskDelays[rowIndex] ?? 0}
                          dotStaggerMs={GOAL_TASK_DOT_STAGGER_MS}
                          reducedMotion={prefersReducedMotion}
                        />
                      ))
                    ) : (
                      <p className="goal-detail-empty">아직 작업 기록이 없어요</p>
                    )}
                  </div>
                </Fragment>
              )
            })}
          </>
        ) : (
          <>
            <div className={`goal-grid${useDenseYearGrid ? ' goal-grid--dense' : ''}`}>
              {goalScope === 'year'
                ? yearView.slots.map((slot, idx) => {
                    const targetPct = yearView.barTargetPcts[idx] ?? 0
                    const { delayMs, riseMs } = barAnimSchedule[idx] ?? {
                      delayMs: 0,
                      riseMs: 0,
                      targetPct: 0,
                    }
                    const isCurrent = idx === yearView.currentSlotIndex
                    const monthReached =
                      yearView.currentSlotIndex >= 0 ? idx <= yearView.currentSlotIndex : false
                    const isSelected = selectedTimelineKey === slot.key
                    const fillOpacity = targetPct >= 100 ? 0.55 : 1
                    const barClass = [
                      'goal-bar',
                      targetPct <= 0 ? 'goal-bar--future' : '',
                      isSelected ? 'goal-bar--selected' : '',
                      isCurrent ? 'goal-bar--current' : '',
                      targetPct > 0 ? 'goal-bar--filled' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')

                    return (
                      <div key={slot.key} className="goal-bar-wrap">
                        <button
                          type="button"
                          className={barClass}
                          onClick={() => setSelectedTimelineKey(slot.key)}
                        >
                          {targetPct > 0 ? (
                            <span
                              className={`goal-bar-fill${barsPlay ? ' goal-bar-fill--animate' : ''}`}
                              style={{
                                ['--fill-pct']: `${targetPct}%`,
                                ['--bar-rise-ms']: `${riseMs}ms`,
                                ['--bar-delay-ms']: `${delayMs}ms`,
                                background: `rgba(var(--ww-main-rgb), ${fillOpacity})`,
                              }}
                            />
                          ) : null}
                          <GoalBarAnimatedPct
                            target={targetPct}
                            play={barsPlay}
                            riseMs={riseMs}
                            delayMs={delayMs}
                          />
                        </button>
                        <span
                          className={[
                            'goal-month-label',
                            monthReached ? 'goal-month-label--past' : 'goal-month-label--future',
                          ].join(' ')}
                        >
                          {timelineBarLabel(slot, false)}
                        </span>
                      </div>
                    )
                  })
                : dmSpec.segments.map((segLabel, idx) => {
                    const { delayMs, riseMs, targetPct } = barAnimSchedule[idx]
                    const segReached = idx <= dmCurrentSegIdx
                    const isCurrent = idx === dmCurrentSegIdx
                    const isSelected = selectedDmSegIdx === idx
                    const fillOpacity = targetPct >= 100 ? 0.55 : 1
                    const barClass = [
                      'goal-bar',
                      !segReached ? 'goal-bar--future' : '',
                      isSelected ? 'goal-bar--selected' : '',
                      isCurrent ? 'goal-bar--current' : '',
                      targetPct > 0 ? 'goal-bar--filled' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')

                    return (
                      <div key={`${dmZoomId}-${idx}`} className="goal-bar-wrap">
                        <button type="button" className={barClass} onClick={() => setSelectedDmSegIdx(idx)}>
                          {targetPct > 0 ? (
                            <span
                              className={`goal-bar-fill${barsPlay ? ' goal-bar-fill--animate' : ''}`}
                              style={{
                                ['--fill-pct']: `${targetPct}%`,
                                ['--bar-rise-ms']: `${riseMs}ms`,
                                ['--bar-delay-ms']: `${delayMs}ms`,
                                background: `rgba(var(--ww-main-rgb), ${fillOpacity})`,
                              }}
                            />
                          ) : null}
                          <GoalBarAnimatedPct
                            target={targetPct}
                            play={barsPlay}
                            riseMs={riseMs}
                            delayMs={delayMs}
                          />
                        </button>
                        <span
                          className={[
                            'goal-month-label',
                            segReached ? 'goal-month-label--past' : 'goal-month-label--future',
                          ].join(' ')}
                        >
                          {segLabel}
                        </span>
                      </div>
                    )
                  })}
            </div>

            {goalScope === 'year' && activeHorizon === '1' && selectedYearSlot ? (
              <div className="goal-detail">
                <div className="goal-detail-title">
                  {selectedYearSlot.year}년 {monthLabel(selectedYearSlot.mm)} 작업 내역
                </div>
                {tasks.length > 0 ? (
                  tasks.map((t, rowIndex) => (
                    <TaskRow
                      key={`${selectedTimelineKey}-${t.name}`}
                      name={t.name}
                      done={t.done}
                      dotsPlay={taskDotsPlay}
                      rowDelayMs={taskRowDotBaseDelaysMs[rowIndex] ?? 0}
                      dotStaggerMs={GOAL_TASK_DOT_STAGGER_MS}
                      reducedMotion={prefersReducedMotion}
                    />
                  ))
                ) : (
                  <p className="goal-detail-empty">아직 작업 기록이 없어요</p>
                )}
              </div>
            ) : goalScope === 'dayMonth' ? (
              <div className="goal-detail">
                <div className="goal-detail-title">
                  {getGoalDmDetailTitle(
                    dmZoomId,
                    dmSpec.segments[selectedDmSegIdx] ?? '—',
                    dmSpec.label,
                  )}
                </div>
                {!isActiveGoalSettled ? (
                  <p className="goal-detail-empty">목표 미정</p>
                ) : (
                  <p className="goal-detail-empty">이 구간 작업은 추후 연동할 수 있어요</p>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>

      <nav className="goal-nav" aria-label="하단 메뉴">
        <button type="button" className="goal-nav-item" onClick={() => onTabChange?.('tracker')}>
          <span className="goal-nav-icon" aria-hidden />
          트래커
        </button>
        <button type="button" className="goal-nav-item goal-nav-item--active">
          <span className="goal-nav-icon" aria-hidden />
          목표
        </button>
        {features.gallery ? (
          <button type="button" className="goal-nav-item" onClick={() => onTabChange?.('gallery')}>
            <span className="goal-nav-icon" aria-hidden />
            갤러리
          </button>
        ) : null}
        <button type="button" className="goal-nav-item" onClick={() => onTabChange?.('settings')}>
          <span className="goal-nav-icon" aria-hidden />
          설정
        </button>
      </nav>
    </div>
  )
}
