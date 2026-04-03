import { useEffect, useRef, useState } from 'react'
import { useLang } from './contexts/LanguageContext.js'
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
  const { t, lang } = useLang()
  const onboardingI18n = lang !== 'ko'
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
        className={`ob-dialog${step === 2 ? ' ob-dialog--step2' : ''}${onboardingI18n ? ' ob-dialog--i18n' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ob-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h1 id="ob-title" className="ob-title" style={{ whiteSpace: 'pre-line' }}>
          {t.onboarding.title}
        </h1>

        {step === 1 ? (
          <>
            <p className="ob-lead" style={{ whiteSpace: 'pre-line' }}>
              {t.onboarding.subtitle}
            </p>
            <textarea
              ref={areaRef}
              className="ob-textarea"
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              placeholder={t.onboarding.placeholder}
              rows={6}
              aria-label={t.onboarding.goalInputAria}
            />
            <p className="ob-field-label">{t.onboarding.fieldLabel}</p>
            <div className="ob-field-chips" role="group" aria-label={t.onboarding.fieldGroupAria}>
              {ONBOARDING_FIELD_OPTIONS.map(({ field, label }) => {
                const on = selectedField === field
                const chipLabel =
                  field == null
                    ? t.onboarding.fieldLabelOther
                    : t.onboarding.fieldLabels[field] ?? label
                return (
                  <button
                    key={label}
                    type="button"
                    className={`ob-field-chip${on ? ' ob-field-chip--on' : ''}`}
                    aria-pressed={on}
                    onClick={() => setSelectedField(field)}
                  >
                    {chipLabel}
                  </button>
                )
              })}
            </div>
            <div className="ob-actions">
              <button type="button" className="ob-btn ob-btn--ghost" onClick={() => onDismiss?.()}>
                {t.onboarding.later}
              </button>
              <button type="button" className="ob-btn ob-btn--primary" onClick={goStep2}>
                {t.onboarding.next}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="ob-confirm-box">
              <p className="ob-confirm-label">{t.onboarding.yearGoalBox}</p>
              <p className="ob-confirm-text">{goalText.trim() || '—'}</p>
            </div>
            <div className="ob-auto-hint">
              <div className="ob-auto-hint-left">
                <span className="ob-auto-hint-dot" aria-hidden />
                <p className="ob-auto-hint-text">{t.onboarding.autoHintShort}</p>
              </div>
              <button
                type="button"
                className="ob-auto-hint-edit"
                aria-label={t.onboarding.editMonthsAria}
                onClick={openEditModal}
              >
                {t.common.edit}
              </button>
            </div>
            <div className="ob-month-scroll">
              {monthlyGoals.map((value, i) => {
                const has = value.trim().length > 0
                const monthNum = i + 1
                return (
                  <div key={i} className="ob-month-item">
                    <div className="ob-month-item-head">
                      <span className="ob-month-item-label">
                        {t.onboarding.monthUnit.replace('{n}', String(monthNum))}
                      </span>
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
                        aria-label={t.onboarding.monthGoalInputAria.replace('{n}', String(monthNum))}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <button type="button" className="ob-start-btn" onClick={handleStart}>
              {t.onboarding.startBtn}
            </button>
            <button type="button" className="ob-skip-detail" onClick={handleSkipDetail}>
              {t.onboarding.skipBtn}
            </button>

            {showEditModal ? (
              <div
                className="ob-edit-modal"
                role="dialog"
                aria-modal="true"
                aria-label={t.onboarding.editModalAria}
              >
                <header className="ob-edit-modal-header">
                  <button
                    type="button"
                    className="ob-edit-modal-close"
                    onClick={() => setShowEditModal(false)}
                  >
                    {t.onboarding.editModalClose}
                  </button>
                  <button type="button" className="ob-edit-modal-done" onClick={() => setShowEditModal(false)}>
                    {t.onboarding.editModalDone}
                  </button>
                </header>
                <div className="ob-edit-modal-tabs-wrap">
                  <div className="ob-edit-modal-tabs">
                    <div className="ob-edit-modal-tabs-row" role="tablist" aria-label={t.onboarding.monthTabsAria}>
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
                            {t.onboarding.monthUnit.replace('{n}', mm)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <p className="ob-edit-modal-tabs-swipe-hint">{t.onboarding.swipeMonthsHint}</p>
                </div>
                <div className="ob-edit-modal-body">
                  <label className="ob-edit-modal-label" htmlFor="ob-edit-modal-textarea">
                    {t.onboarding.monthGoalLabel.replace('{n}', selectedEditMonth)}
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
                  <p className="ob-edit-modal-hint">{t.onboarding.tabNextMonthHint}</p>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
