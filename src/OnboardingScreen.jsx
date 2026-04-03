import { useEffect, useRef, useState } from 'react'
import {
  buildInitialMonthlyGoals,
  ONBOARDING_FIELD_OPTIONS,
} from './onboardingTemplates.js'
import './OnboardingScreen.css'

/**
 * 1단계: 1년 목표 텍스트 + 창작 분야
 * 2단계: 확정 박스 + 월별 자동 배분(수정 가능) + 시작
 *
 * @param {{
 *   initialText?: string
 *   onDismiss?: () => void
 *   onFinishWithMonthly?: (goalText: string, monthlyGoals: string[]) => void
 *   onFinishGoalOnly?: (goalText: string) => void
 * }} props
 */
export default function OnboardingScreen({
  initialText = '',
  onDismiss,
  onFinishWithMonthly,
  onFinishGoalOnly,
}) {
  const [step, setStep] = useState(/** @type {1 | 2} */ (1))
  const [goalText, setGoalText] = useState(initialText)
  const [selectedField, setSelectedField] = useState(/** @type {string | null} */ (null))
  const [monthlyGoals, setMonthlyGoals] = useState(() => buildInitialMonthlyGoals('', null))

  const areaRef = useRef(null)
  const inputRefs = useRef(/** @type {(HTMLInputElement | null)[]} */ ([]))

  useEffect(() => {
    setGoalText(initialText)
  }, [initialText])

  useEffect(() => {
    if (step !== 1) return
    const id = window.requestAnimationFrame(() => {
      areaRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [step])

  const goStep2 = () => {
    setMonthlyGoals(buildInitialMonthlyGoals(goalText.trim(), selectedField))
    setStep(2)
  }

  const handleStart = () => {
    onFinishWithMonthly?.(goalText.trim(), [...monthlyGoals])
  }

  const handleSkipDetail = () => {
    onFinishGoalOnly?.(goalText.trim())
  }

  return (
    <div className="ob-overlay" role="presentation">
      <div
        className={`ob-dialog${step === 2 ? ' ob-dialog--step2' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ob-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h1 id="ob-title" className="ob-title">
          1years goals
        </h1>

        {step === 1 ? (
          <>
            <p className="ob-lead">
              이루고 싶은 목표를 1년치만 떼서 적어보세요.
              <br />
              목표는 설정 탭에서 수정 가능합니다.
            </p>
            <textarea
              ref={areaRef}
              className="ob-textarea"
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              placeholder="한줄이어도 괜찮아요."
              rows={6}
              aria-label="1년 목표 입력"
            />
            <p className="ob-field-label">창작 분야</p>
            <div className="ob-field-chips" role="group" aria-label="창작 분야 선택">
              {ONBOARDING_FIELD_OPTIONS.map(({ field, label }) => {
                const on = selectedField === field
                return (
                  <button
                    key={label}
                    type="button"
                    className={`ob-field-chip${on ? ' ob-field-chip--on' : ''}`}
                    aria-pressed={on}
                    onClick={() => setSelectedField(field)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <div className="ob-actions">
              <button type="button" className="ob-btn ob-btn--ghost" onClick={() => onDismiss?.()}>
                나중에
              </button>
              <button type="button" className="ob-btn ob-btn--primary" onClick={goStep2}>
                다음
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="ob-confirm-box">
              <p className="ob-confirm-label">1년 목표</p>
              <p className="ob-confirm-text">{goalText.trim() || '—'}</p>
            </div>
            <div className="ob-auto-hint">
              <span className="ob-auto-hint-dot" aria-hidden />
              <p className="ob-auto-hint-text">12개월로 자동 배분했어요 — 수정 가능해요</p>
            </div>
            <div className="ob-month-scroll">
              {monthlyGoals.map((value, i) => {
                const has = value.trim().length > 0
                const mm = String(i + 1).padStart(2, '0')
                return (
                  <div key={i} className="ob-month-item">
                    <div className="ob-month-item-head">
                      <span className="ob-month-item-label">{mm}월</span>
                      {has ? (
                        <span className="ob-month-item-done" aria-hidden>
                          ✓
                        </span>
                      ) : (
                        <span />
                      )}
                    </div>
                    <div className="ob-month-item-bar" aria-hidden>
                      <div
                        className={`ob-month-item-bar-fill${has ? ' ob-month-item-bar-fill--on' : ''}`}
                      />
                    </div>
                    <div className="ob-month-item-field">
                      <input
                        ref={(el) => {
                          inputRefs.current[i] = el
                        }}
                        className="ob-month-item-input"
                        value={value}
                        onChange={(e) => {
                          const v = e.target.value
                          setMonthlyGoals((prev) => {
                            const next = [...prev]
                            next[i] = v
                            return next
                          })
                        }}
                        aria-label={`${mm}월 목표`}
                      />
                      <button
                        type="button"
                        className="ob-month-item-edit"
                        onClick={() => inputRefs.current[i]?.focus()}
                      >
                        수정
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <button type="button" className="ob-start-btn" onClick={handleStart}>
              시작하기 →
            </button>
            <button type="button" className="ob-skip-detail" onClick={handleSkipDetail}>
              그냥 시작하기
            </button>
          </>
        )}
      </div>
    </div>
  )
}
