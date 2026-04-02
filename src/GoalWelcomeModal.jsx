import { useEffect, useRef, useState } from 'react'
import './GoalWelcomeModal.css'

/**
 * 첫 실행 시 1년 목표 입력 — 제목은 기획 문구 그대로 "1years goals"
 */
export default function GoalWelcomeModal({ initialText = '', onSave, onSkip }) {
  const [draft, setDraft] = useState(initialText)
  const areaRef = useRef(null)

  useEffect(() => {
    setDraft(initialText)
  }, [initialText])

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      areaRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [])

  const handleSave = () => {
    onSave?.(draft.trim())
  }

  return (
    <div className="gw-modal-overlay" role="presentation">
      <div
        className="gw-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gw-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h1 id="gw-modal-title" className="gw-modal-title">
          1years goals
        </h1>
        <p className="gw-modal-lead">
          이루고 싶은 목표를 1년치만 떼서 적어보세요.
          <br />
          목표는 설정 탭에서 수정 가능합니다.
        </p>
        <textarea
          ref={areaRef}
          className="gw-modal-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="한줄이어도 괜찮아요."
          rows={6}
          aria-label="1년 목표 입력"
        />
        <div className="gw-modal-actions">
          <button type="button" className="gw-modal-btn gw-modal-btn--ghost" onClick={() => onSkip?.()}>
            나중에
          </button>
          <button type="button" className="gw-modal-btn gw-modal-btn--primary" onClick={handleSave}>
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
