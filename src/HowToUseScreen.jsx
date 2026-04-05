import { useCallback, useRef, useState } from 'react'
import './HowToUseScreen.css'

const W_LOGO_PATH =
  'M102.5,285.4c0,0,13,30,43,20s40-90,70-85s34,65,64,50c30-15,58-105,118-147'

const SWIPE_THRESHOLD_PX = 48

/**
 * @param {{ currentCard: number; goPrev: () => void; goNext: () => void; onComplete: () => void }} props
 */
function HowToUseStepNav({ currentCard, goPrev, goNext, onComplete }) {
  const isFirst = currentCard === 0
  const isLast = currentCard === 3
  return (
    <div className={`how-to-use-nav${isFirst ? ' how-to-use-nav--single' : ''}`}>
      {!isFirst ? (
        <button type="button" className="how-to-use-nav-btn how-to-use-nav-btn--prev" onClick={goPrev}>
          ← 이전
        </button>
      ) : null}
      {isLast ? (
        <button type="button" className="how-to-use-nav-btn how-to-use-nav-btn--next" onClick={onComplete}>
          시작하기 →
        </button>
      ) : (
        <button type="button" className="how-to-use-nav-btn how-to-use-nav-btn--next" onClick={goNext}>
          다음 →
        </button>
      )}
    </div>
  )
}

/**
 * 온보딩: 사용법 4장 카드 (스와이프 / 도트 / 건너뛰기)
 *
 * @param {{ onComplete: () => void }} props
 */
export default function HowToUseScreen({ onComplete }) {
  const [currentCard, setCurrentCard] = useState(0)
  const touchStartX = useRef(/** @type {number | null} */ (null))

  const goNext = useCallback(() => {
    setCurrentCard((c) => Math.min(3, c + 1))
  }, [])

  const goPrev = useCallback(() => {
    setCurrentCard((c) => Math.max(0, c - 1))
  }, [])

  const onTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }, [])

  const onTouchEnd = useCallback(
    (e) => {
      const start = touchStartX.current
      touchStartX.current = null
      if (start == null) return
      const end = e.changedTouches[0]?.clientX
      if (end == null) return
      const dx = end - start
      if (dx < -SWIPE_THRESHOLD_PX) goNext()
      else if (dx > SWIPE_THRESHOLD_PX) goPrev()
    },
    [goNext, goPrev],
  )

  return (
    <div
      className="how-to-use"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="region"
      aria-roledescription="carousel"
      aria-label="앱 사용법 안내"
    >
      <button type="button" className="how-to-use-skip" onClick={onComplete}>
        건너뛰기
      </button>

      <div className="how-to-use-slides">
        {currentCard === 0 ? (
          <div className="how-to-use-card">
            <div className="how-to-use-step-body">
              <div className="how-to-use-preview-wrap">
                <div className="how-to-use-preview" aria-hidden>
              <div className="how-to-use-p1-head">
                <div className="how-to-use-p1-brand">
                  Dr<span className="how-to-use-p1-a how-to-use-p1-a--draw">a</span>wing{' '}
                  Pl<span className="how-to-use-p1-a how-to-use-p1-a--plan">a</span>nner
                </div>
                <div className="how-to-use-p1-pct">64%</div>
                <div className="how-to-use-p1-bar">
                  <div className="how-to-use-p1-bar-fill" />
                </div>
              </div>
              <div className="how-to-use-p1-scroll">
                <div className="how-to-use-p1-mini">
                  <div className="how-to-use-p1-tag how-to-use-p1-tag--orange">메인 일러스트</div>
                  <div className="how-to-use-p1-chips">
                    <span className="how-to-use-p1-chip how-to-use-p1-chip--done">레퍼런스✓</span>
                    <span className="how-to-use-p1-chip how-to-use-p1-chip--done">스케치✓</span>
                    <span className="how-to-use-p1-chip how-to-use-p1-chip--idle">채색</span>
                    <span className="how-to-use-p1-chip how-to-use-p1-chip--idle">이펙트</span>
                  </div>
                </div>
                <div className="how-to-use-p1-mini how-to-use-p1-mini--teal">
                  <div className="how-to-use-p1-tag how-to-use-p1-tag--teal">이달의 핵심</div>
                  <div className="how-to-use-p1-chips">
                    <span className="how-to-use-p1-chip how-to-use-p1-chip--idle">기획</span>
                  </div>
                </div>
              </div>
                </div>
              </div>
            <h2 className="how-to-use-title">{'작업을 카드로\n기록해요'}</h2>
            <p className="how-to-use-desc">
              {'스테이지 체크 + 이미지 업로드로\n과정을 남겨요'}
            </p>
            </div>
            <HowToUseStepNav
              currentCard={currentCard}
              goPrev={goPrev}
              goNext={goNext}
              onComplete={onComplete}
            />
          </div>
        ) : null}

        {currentCard === 1 ? (
          <div className="how-to-use-card">
            <div className="how-to-use-step-body">
              <div className="how-to-use-preview-wrap">
                <div className="how-to-use-preview" aria-hidden>
              <div className="how-to-use-p2-head">
                <div className="how-to-use-p2-goal">
                  <span className="how-to-use-p2-goal-w">일러스트 </span>
                  <span className="how-to-use-p2-goal-n">20개</span>
                  <span className="how-to-use-p2-goal-w"> 완성</span>
                </div>
                <div className="how-to-use-p2-bar">
                  <div className="how-to-use-p2-bar-fill" />
                </div>
              </div>
              <div className="how-to-use-p2-grid">
                {Array.from({ length: 12 }, (_, i) => {
                  const m = i + 1
                  const barClass =
                    m <= 4
                      ? `how-to-use-p2-bar-col how-to-use-p2-bar-col--${m}`
                      : 'how-to-use-p2-bar-col'
                  return (
                    <div key={m} className="how-to-use-p2-cell">
                      <div className={barClass} />
                      <span className="how-to-use-p2-mo">{m}</span>
                    </div>
                  )
                })}
              </div>
                </div>
              </div>
            <h2 className="how-to-use-title">{'목표를 12개월로\n나눠요'}</h2>
            <p className="how-to-use-desc">
              {'1년 목표가 월별로 자동 배분돼요\n막대로 진행상황 한눈에 확인'}
            </p>
            </div>
            <HowToUseStepNav
              currentCard={currentCard}
              goPrev={goPrev}
              goNext={goNext}
              onComplete={onComplete}
            />
          </div>
        ) : null}

        {currentCard === 2 ? (
          <div className="how-to-use-card">
            <div className="how-to-use-step-body">
              <div className="how-to-use-preview-wrap">
                <div className="how-to-use-preview" aria-hidden>
              <div className="how-to-use-p3-label">2026 · 04</div>
              <div className="how-to-use-p3-grid">
                <div className="how-to-use-p3-bundle">
                  <div className="how-to-use-p3-final how-to-use-p3-final--a">
                    <span className="how-to-use-p3-badge">완성본</span>
                  </div>
                  <div className="how-to-use-p3-process">
                    <span className="how-to-use-p3-process-lbl">과정</span>
                    <span className="how-to-use-p3-thumb how-to-use-p3-thumb--1" />
                    <span className="how-to-use-p3-thumb how-to-use-p3-thumb--2" />
                    <span className="how-to-use-p3-more">+2</span>
                  </div>
                </div>
                <div className="how-to-use-p3-bundle">
                  <div className="how-to-use-p3-final how-to-use-p3-final--b">
                    <span className="how-to-use-p3-badge">완성본</span>
                  </div>
                  <div className="how-to-use-p3-process">
                    <span className="how-to-use-p3-process-lbl">과정</span>
                    <span className="how-to-use-p3-thumb how-to-use-p3-thumb--2" />
                    <span className="how-to-use-p3-more">+N</span>
                  </div>
                </div>
              </div>
                </div>
              </div>
            <h2 className="how-to-use-title">{'완성작을 갤러리로\n모아요'}</h2>
            <p className="how-to-use-desc">
              {'완성본 + 과정샷을 묶어서\n나만의 포트폴리오를 만들어요'}
            </p>
            </div>
            <HowToUseStepNav
              currentCard={currentCard}
              goPrev={goPrev}
              goNext={goNext}
              onComplete={onComplete}
            />
          </div>
        ) : null}

        {currentCard === 3 ? (
          <div className="how-to-use-card how-to-use-card--final">
            <div className="how-to-use-final-body">
              <svg
                className="how-to-use-logo"
                viewBox="0 0 500 500"
                width={72}
                height={72}
                aria-hidden
              >
                <path className="how-to-use-logo-path" d={W_LOGO_PATH} />
                <circle cx={152} cy={342} r={36} fill="#fb923c" />
                <circle cx={284} cy={306} r={36} fill="#2dd4bf" />
              </svg>
              <p className="how-to-use-final-title">스케치부터 완성까지</p>
              <p className="how-to-use-final-sub">Drawing Planner</p>
            </div>
            <HowToUseStepNav
              currentCard={currentCard}
              goPrev={goPrev}
              goNext={goNext}
              onComplete={onComplete}
            />
          </div>
        ) : null}
      </div>

      <div className="how-to-use-dots" role="tablist" aria-label="카드 위치">
        {[0, 1, 2, 3].map((i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={currentCard === i}
            aria-label={`${i + 1} / 4`}
            className={`how-to-use-dot ${currentCard === i ? 'how-to-use-dot--active' : 'how-to-use-dot--idle'}`}
            onClick={() => setCurrentCard(i)}
          />
        ))}
      </div>
    </div>
  )
}

/** @returns {boolean} */
export function readHowToUseTutorialDone() {
  try {
    return window.localStorage.getItem('withworth_tutorial') === 'true'
  } catch {
    return false
  }
}
