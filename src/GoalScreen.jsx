import { useEffect, useMemo, useState } from 'react'
import BrandWordmark from './BrandWordmark'
import './GoalScreen.css'

/** 이미 지난 달(100% 채움) 막대 상승 — 빠르게 */
const GOAL_BAR_RISE_FAST_MS = 380
/** 이번 달(진행 중, 부분 채움) 막대 상승 — 기존 속도 유지 */
const GOAL_BAR_RISE_CURRENT_MS = 1100

/** 1월 ~ 12월 */
const MONTH_ORDER = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

/** 상단 진행률(%) — 현재 월 막대 높이와 동일하게 사용 */
const GOAL_PROGRESS_PERCENT = 33

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
    if (targetPct > 0) accDelay += riseMs
    return { delayMs, riseMs, targetPct }
  })
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

function TaskRow({ name, done }) {
  return (
    <div className="goal-task">
      <span className="goal-task-name">{name}</span>
      <div className="goal-task-dots" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={`goal-task-dot${i < done ? ' goal-task-dot--on' : ''}`} />
        ))}
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

  useEffect(() => {
    const t = window.setTimeout(() => setBarsPlay(true), 80)
    return () => window.clearTimeout(t)
  }, [])

  const tasks = MONTH_TASKS[selectedMonth] ?? []

  const barAnimSchedule = useMemo(
    () => buildBarAnimSchedule(MONTH_ORDER, currentMonthMm, GOAL_PROGRESS_PERCENT),
    [currentMonthMm],
  )

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
            <span className="goal-progress-pct">{GOAL_PROGRESS_PERCENT}%</span>
          </div>
          <div className="goal-progress-track">
            <div
              className="goal-progress-fill"
              style={{ width: `${GOAL_PROGRESS_PERCENT}%` }}
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
              tasks.map((t) => <TaskRow key={t.name} name={t.name} done={t.done} />)
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
