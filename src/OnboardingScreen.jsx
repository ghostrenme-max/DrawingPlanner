import { useEffect, useRef, useState } from 'react'
import {
  buildInitialMonthlyGoals,
  getSuggestedMonthlyLine,
  ONBOARDING_FIELD_OPTIONS,
} from './onboardingTemplates.js'
import './OnboardingScreen.css'

const MONTH_KEYS = Array.from({ length: 12 }, (_, i) => String(i + 1))

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
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedEditMonth, setSelectedEditMonth] = useState('1')
  const [editModalTextareaFocused, setEditModalTextareaFocused] = useState(false)

  const areaRef = useRef(null)
  const inputRefs = useRef(/** @type {(HTMLInputElement | null)[]} */ ([]))
  const editTextareaRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null))
  const tabBtnRefs = useRef(/** @type {(HTMLButtonElement | null)[]} */ ([]))

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

  useEffect(() => {
    if (!showEditModal) return
    const onKey = (e) => {
      if (e.key === 'Escape') setShowEditModal(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showEditModal])

  useEffect(() => {
    if (!showEditModal) return
    const idx = parseInt(selectedEditMonth, 10) - 1
    const el = tabBtnRefs.current[idx]
    el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [selectedEditMonth, showEditModal])

  const openEditModal = () => {
    setSelectedEditMonth('1')
    setEditModalTextareaFocused(false)
    setShowEditModal(true)
  }

  const editMonthIndex = parseInt(selectedEditMonth, 10) - 1
  const goalTrimmed = goalText.trim()
  const suggestedMonthlyLine = getSuggestedMonthlyLine(goalTrimmed, selectedField, editMonthIndex)
  const editMonthRaw = monthlyGoals[editMonthIndex] ?? ''
  const editModalGhostMode =
    !editModalTextareaFocused && editMonthRaw === suggestedMonthlyLine && suggestedMonthlyLine.length > 0

  useEffect(() => {
    if (!showEditModal) setEditModalTextareaFocused(false)
  }, [showEditModal])

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
          올해의 목표
        </h1>

        {step === 1 ? (
          <>
            <p className="ob-lead">
              이루고 싶은 목표를
              <br />
              1년치만 떼서 적어보세요.
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
              <div className="ob-auto-hint-left">
                <span className="ob-auto-hint-dot" aria-hidden />
                <p className="ob-auto-hint-text">12개월로 자동 배분했어요</p>
              </div>
              <button
                type="button"
                className="ob-auto-hint-edit"
                aria-label="월별 목표 수정"
                onClick={openEditModal}
              >
                수정
              </button>
            </div>
            <div className="ob-month-scroll">
              {monthlyGoals.map((value, i) => {
                const has = value.trim().length > 0
                const monthNum = i + 1
                return (
                  <div key={i} className="ob-month-item">
                    <div className="ob-month-item-head">
                      <span className="ob-month-item-label">{monthNum}월</span>
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
                        aria-label={`${monthNum}월 목표`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <button type="button" className="ob-start-btn" onClick={handleStart}>
              목표 저장하고 시작
            </button>
            <button type="button" className="ob-skip-detail" onClick={handleSkipDetail}>
              나중에 채울게요
            </button>

            {showEditModal ? (
              <div
                className="ob-edit-modal"
                role="dialog"
                aria-modal="true"
                aria-label="월별 목표 수정"
              >
                <header className="ob-edit-modal-header">
                  <button
                    type="button"
                    className="ob-edit-modal-close"
                    onClick={() => setShowEditModal(false)}
                  >
                    ← 닫기
                  </button>
                  <button type="button" className="ob-edit-modal-done" onClick={() => setShowEditModal(false)}>
                    완료
                  </button>
                </header>
                <div className="ob-edit-modal-tabs-wrap">
                  <div className="ob-edit-modal-tabs">
                    <div className="ob-edit-modal-tabs-row" role="tablist" aria-label="월 선택">
                      {MONTH_KEYS.map((mm, idx) => {
                        const on = selectedEditMonth === mm
                        return (
                          <button
                            key={mm}
                            ref={(el) => {
                              tabBtnRefs.current[idx] = el
                            }}
                            type="button"
                            role="tab"
                            aria-selected={on}
                            className={`ob-edit-modal-tab${on ? ' ob-edit-modal-tab--on' : ''}`}
                            onClick={() => setSelectedEditMonth(mm)}
                          >
                            {mm}월
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <p className="ob-edit-modal-tabs-swipe-hint">옆으로 밀어 7~12월을 선택할 수 있어요</p>
                </div>
                <div className="ob-edit-modal-body">
                  <label className="ob-edit-modal-label" htmlFor="ob-edit-modal-textarea">
                    {selectedEditMonth}월 목표
                  </label>
                  <div className="ob-edit-modal-field-wrap">
                    {editModalGhostMode ? (
                      <div className="ob-edit-modal-textarea-mirror" aria-hidden>
                        <span className="ob-edit-modal-caret" />
                        <span className="ob-edit-modal-ghost-text">{suggestedMonthlyLine}</span>
                      </div>
                    ) : null}
                    <textarea
                      id="ob-edit-modal-textarea"
                      ref={editTextareaRef}
                      className={`ob-edit-modal-textarea${editModalGhostMode ? ' ob-edit-modal-textarea--ghost' : ''}`}
                      value={editMonthRaw}
                      onChange={(e) => {
                        const v = e.target.value
                        setMonthlyGoals((prev) => {
                          const next = [...prev]
                          next[editMonthIndex] = v
                          return next
                        })
                      }}
                      onFocus={() => {
                        setEditModalTextareaFocused(true)
                        if (editMonthRaw === suggestedMonthlyLine) {
                          setMonthlyGoals((prev) => {
                            const next = [...prev]
                            next[editMonthIndex] = ''
                            return next
                          })
                        }
                      }}
                      onBlur={() => {
                        setEditModalTextareaFocused(false)
                        setMonthlyGoals((prev) => {
                          const cur = prev[editMonthIndex] ?? ''
                          if (cur.trim() !== '') return prev
                          const next = [...prev]
                          next[editMonthIndex] = getSuggestedMonthlyLine(
                            goalTrimmed,
                            selectedField,
                            editMonthIndex,
                          )
                          return next
                        })
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Tab' || e.shiftKey) return
                        e.preventDefault()
                        setSelectedEditMonth((prev) => {
                          const n = parseInt(prev, 10)
                          const nextN = n >= 12 ? 1 : n + 1
                          return String(nextN)
                        })
                      }}
                    />
                  </div>
                  <p className="ob-edit-modal-hint">탭으로 다음 달로 넘어갈 수 있어요</p>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
