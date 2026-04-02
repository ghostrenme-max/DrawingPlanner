import { useEffect, useMemo, useState } from 'react'
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

/** 1월 ~ 12월 */
const MONTH_ORDER = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

/** 상단 진행률(%) — 현재 월 막대 높이와 동일하게 사용 */
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

function pad2(n) {
  return String(n).padStart(2, '0')
}

function currentYearMonth() {
  const d = new Date()
  return { year: d.getFullYear(), monthMm: pad2(d.getMonth() + 1) }
}

/** 이번 달 이전: 100%, 이번 달: 진행률%, 미래: 0 */
function barFillPercent(monthMm, currentMm, progressPct) {
  const m = Number(monthMm)
  const c = Number(currentMm)
  if (m < c) return 100
  if (m === c) return progressPct
  return 0
}

function monthLabel(mm) {
  return `${Number(mm)}월`
}

/** 1월→12월 순서로, 앞선 막대 duration 누적한 delay + 달별 riseMs */
function buildBarAnimSchedule(monthOrder, currentMm, progressPct) {
  let accDelay = 0
  return monthOrder.map((m) => {
    const targetPct = barFillPercent(m, currentMm, progressPct)
    const riseMs =
      targetPct <= 0 ? 0 : targetPct >= 100 ? GOAL_BAR_RISE_FAST_MS : GOAL_BAR_RISE_CURRENT_MS
    const delayMs = targetPct > 0 ? accDelay : 0
    if (targetPct > 0) accDelay += riseMs * GOAL_BAR_NEXT_START_AFTER_PREV_FRAC
    return { delayMs, riseMs, targetPct }
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
 * @param {{ onTabChange?: (tab: 'tracker' | 'goal' | 'gallery' | 'settings') => void }} props
 */
const ZOOM_OPTIONS = [
  { id: '1d', label: '1일' },
  { id: '3d', label: '3일' },
  { id: '7d', label: '7일' },
  { id: '1m', label: '1개월' },
]

export default function GoalScreen({ onTabChange }) {
  const { year: calendarYear, monthMm: currentMonthMm } = currentYearMonth()
  const [activeHorizon, setActiveHorizon] = useState(/** @type {'1' | '3' | '5'} */ ('1'))
  const [zoomUnit, setZoomUnit] = useState(/** @type {'1d' | '3d' | '7d' | '1m'} */ ('1d'))
  const [selectedMonth, setSelectedMonth] = useState(currentMonthMm)
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
    const t = window.setTimeout(() => setBarsPlay(true), 80)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!barsPlay) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (reduced) {
      setHeaderPctDisplay(GOAL_PROGRESS_PERCENT)
      return
    }
    let cancelled = false
    const target = GOAL_PROGRESS_PERCENT
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
  }, [barsPlay])

  const tasks = useMemo(
    () => MONTH_TASKS[selectedMonth] ?? EMPTY_TASK_LIST,
    [selectedMonth],
  )

  const barAnimSchedule = useMemo(
    () => buildBarAnimSchedule(MONTH_ORDER, currentMonthMm, GOAL_PROGRESS_PERCENT),
    [currentMonthMm],
  )

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
          <div className="goal-zoom-row" aria-label="보기 단위">
            <span className="goal-zoom-prefix">1년</span>
            <span className="goal-zoom-chev" aria-hidden>
              &lt;
            </span>
            <div className="goal-zoom-chips" role="group">
              {ZOOM_OPTIONS.map((z, i) => (
                <span key={z.id} className="goal-zoom-chip-wrap">
                  {i > 0 ? (
                    <span className="goal-zoom-slash" aria-hidden>
                      /
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className={`goal-zoom-chip${zoomUnit === z.id ? ' goal-zoom-chip--active' : ''}`}
                    onClick={() => setZoomUnit(z.id)}
                  >
                    {z.label}
                  </button>
                </span>
              ))}
            </div>
            <span className="goal-zoom-chev" aria-hidden>
              &lt;
            </span>
          </div>

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
                <span className="goal-tab--locked" aria-disabled title="잠금">
                  10년 🔒
                </span>
                <span className="goal-tabs-track-spacer" aria-hidden />
              </div>
            </div>
          </div>
        </div>

        <div className="goal-block">
          <div className="goal-period">
            {calendarYear}.01 — {calendarYear}.12
          </div>
          <p className="goal-text">
            연 매출 <span className="goal-text-num">1억</span> 달성하고
            <br />
            <span className="goal-text-num">3명</span> 팀으로 안정화하기
          </p>
        </div>

        <div>
          <div className="goal-progress-row">
            <span className="goal-progress-label">진행률</span>
            <span className="goal-progress-pct">{headerPctDisplay}%</span>
          </div>
          <div className="goal-progress-track">
            <div
              className={`goal-progress-fill${barsPlay ? ' goal-progress-fill--active' : ''}`}
              style={{ ['--goal-progress-target-pct']: `${GOAL_PROGRESS_PERCENT}%` }}
            />
          </div>
        </div>
      </header>

      <div className="goal-scroll">
        <div className="goal-grid">
          {MONTH_ORDER.map((m, idx) => {
            const targetPct = barFillPercent(m, currentMonthMm, GOAL_PROGRESS_PERCENT)
            const { delayMs, riseMs } = barAnimSchedule[idx]
            const isCurrent = m === currentMonthMm
            /** 1~12월 중 이번 달까지(포함) = 올해에서 이미 도달한 구간 → 주황, 그 이후 = 청록 */
            const monthReached = Number(m) <= Number(currentMonthMm)
            const isSelected = selectedMonth === m
            const fillOpacity = targetPct >= 100 ? 0.55 : 1
            const barClass = [
              'goal-bar',
              !monthReached ? 'goal-bar--future' : '',
              isSelected ? 'goal-bar--selected' : '',
              isCurrent ? 'goal-bar--current' : '',
              targetPct > 0 ? 'goal-bar--filled' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <div key={m} className="goal-bar-wrap">
                <button type="button" className={barClass} onClick={() => setSelectedMonth(m)}>
                  {targetPct > 0 ? (
                    <span
                      className={`goal-bar-fill${barsPlay ? ' goal-bar-fill--animate' : ''}`}
                      style={{
                        ['--fill-pct']: `${targetPct}%`,
                        ['--bar-rise-ms']: `${riseMs}ms`,
                        ['--bar-delay-ms']: `${delayMs}ms`,
                        background: `rgba(251, 146, 60, ${fillOpacity})`,
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
                  {monthLabel(m)}
                </span>
              </div>
            )
          })}
        </div>

        {selectedMonth ? (
          <div className="goal-detail">
            <div className="goal-detail-title">{monthLabel(selectedMonth)} 작업 내역</div>
            {tasks.length > 0 ? (
              tasks.map((t, rowIndex) => (
                <TaskRow
                  key={`${selectedMonth}-${t.name}`}
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
        ) : null}
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
        <button type="button" className="goal-nav-item" onClick={() => onTabChange?.('gallery')}>
          <span className="goal-nav-icon" aria-hidden />
          갤러리
        </button>
        <button type="button" className="goal-nav-item" onClick={() => onTabChange?.('settings')}>
          <span className="goal-nav-icon" aria-hidden />
          설정
        </button>
      </nav>
    </div>
  )
}
