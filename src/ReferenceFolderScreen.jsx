import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_APP_FEATURES } from './appFeatures.js'
import { NavIconGallery, NavIconGoal, NavIconSettings, NavIconTracker } from './bottomNavIcons.jsx'
import './ReferenceFolderScreen.css'

export const REFERENCE_TAGS = ['#무드', '#포즈', '#배경', '#컬러', '#아이디어']

const FILTER_LABELS = ['전체', ...REFERENCE_TAGS]

/**
 * @param {string} iso
 */
function formatSavedAt(iso) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return '—'
  }
}

/**
 * @param {{
 *   referenceImages: Array<{ id: string; url: string; tag: string; memo: string; savedAt: string }>
 *   onReferenceImagesChange: (
 *     next:
 *       | Array<{ id: string; url: string; tag: string; memo: string; savedAt: string }>
 *       | ((
 *           prev: Array<{ id: string; url: string; tag: string; memo: string; savedAt: string }>,
 *         ) => Array<{ id: string; url: string; tag: string; memo: string; savedAt: string }>),
 *   ) => void
 *   onBack: () => void
 *   onTabChange?: (tab: 'tracker' | 'goal' | 'gallery' | 'settings') => void
 *   features?: import('./appFeatures.js').AppFeatures
 * }} props
 */
export default function ReferenceFolderScreen({
  referenceImages,
  onReferenceImagesChange,
  onBack,
  onTabChange,
  features = DEFAULT_APP_FEATURES,
}) {
  const fileRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const [selectedTag, setSelectedTag] = useState('전체')
  const [pendingFile, setPendingFile] = useState(/** @type {File | null} */ (null))
  const [modalTag, setModalTag] = useState(REFERENCE_TAGS[0])
  const [modalMemo, setModalMemo] = useState('')
  const [selectedImage, setSelectedImage] = useState(
    /** @type {{ id: string; url: string; tag: string; memo: string; savedAt: string } | null} */ (null),
  )
  const [viewerMemo, setViewerMemo] = useState('')

  const triggerFile = useCallback(() => {
    fileRef.current?.click()
  }, [])

  const onFileChange = useCallback((e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    setPendingFile(f)
    setModalTag(REFERENCE_TAGS[0])
    setModalMemo('')
  }, [])

  const closeModal = useCallback(() => {
    setPendingFile(null)
    setModalMemo('')
  }, [])

  const saveNewReference = useCallback(() => {
    if (!pendingFile) return
    const url = URL.createObjectURL(pendingFile)
    const entry = {
      id: `ref-${Date.now()}`,
      url,
      tag: modalTag,
      memo: modalMemo.trim(),
      savedAt: new Date().toISOString(),
    }
    onReferenceImagesChange((prev) => [...prev, entry])
    closeModal()
  }, [pendingFile, modalTag, modalMemo, onReferenceImagesChange, closeModal])

  const filtered = useMemo(() => {
    if (selectedTag === '전체') return referenceImages
    return referenceImages.filter((x) => x.tag === selectedTag)
  }, [referenceImages, selectedTag])

  const patchImage = useCallback(
    (id, patch) => {
      onReferenceImagesChange((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    },
    [onReferenceImagesChange],
  )

  useEffect(() => {
    const id = selectedImage?.id
    if (!id) return
    const exists = referenceImages.some((x) => x.id === id)
    if (!exists) setSelectedImage(null)
  }, [referenceImages, selectedImage?.id])

  useEffect(() => {
    if (!selectedImage) {
      setViewerMemo('')
      return
    }
    setViewerMemo(selectedImage.memo ?? '')
  }, [selectedImage?.id, selectedImage?.memo])

  useEffect(() => {
    if (!pendingFile) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingFile, closeModal])

  useEffect(() => {
    if (!selectedImage) return
    const onKey = (e) => {
      if (e.key === 'Escape') setSelectedImage(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedImage])

  const flushViewerMemo = useCallback(() => {
    if (!selectedImage) return
    const t = viewerMemo.trim()
    if (t === (selectedImage.memo ?? '')) return
    patchImage(selectedImage.id, { memo: t })
    setSelectedImage((prev) => (prev ? { ...prev, memo: t } : null))
  }, [selectedImage, viewerMemo, patchImage])

  return (
    <div className="ref-folder-screen">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="ref-folder-file"
        aria-hidden
        onChange={onFileChange}
      />

      <header className="ref-folder-header">
        <div className="ref-folder-header-row">
          <button type="button" className="ref-folder-back" onClick={onBack}>
            ← 뒤로
          </button>
          <h1 className="ref-folder-title">레퍼런스</h1>
          <button type="button" className="ref-folder-add" onClick={triggerFile}>
            + 추가
          </button>
        </div>
      </header>

      <div className="ref-folder-tags" role="tablist" aria-label="태그 필터">
        {FILTER_LABELS.map((label) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={selectedTag === label}
            className={`ref-folder-tag${selectedTag === label ? ' ref-folder-tag--on' : ''}`}
            onClick={() => setSelectedTag(label)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="ref-folder-scroll">
        <div className="ref-folder-grid">
          {filtered.map((img) => (
            <button
              key={img.id}
              type="button"
              className="ref-folder-card"
              onClick={() => setSelectedImage(img)}
            >
              <div className="ref-folder-card-img-wrap">
                {img.url ? (
                  <img src={img.url} alt="" className="ref-folder-card-img" draggable={false} />
                ) : null}
                <span className="ref-folder-card-badge">{img.tag}</span>
              </div>
              {img.memo ? <p className="ref-folder-card-memo">{img.memo}</p> : null}
            </button>
          ))}
          <button
            type="button"
            className="ref-folder-card ref-folder-card--add"
            onClick={triggerFile}
            aria-label="이미지 추가"
          >
            +
          </button>
        </div>
      </div>

      <nav className="ref-folder-nav" aria-label="하단 메뉴">
        <button type="button" className="ref-folder-nav-item" onClick={() => onTabChange?.('tracker')}>
          <span className="ref-folder-nav-icon" aria-hidden>
            <NavIconTracker />
          </span>
          트래커
        </button>
        {features.goalScreen ? (
          <button type="button" className="ref-folder-nav-item" onClick={() => onTabChange?.('goal')}>
            <span className="ref-folder-nav-icon" aria-hidden>
              <NavIconGoal />
            </span>
            목표
          </button>
        ) : null}
        <button
          type="button"
          className="ref-folder-nav-item ref-folder-nav-item--active"
          onClick={() => onTabChange?.('gallery')}
        >
          <span className="ref-folder-nav-icon" aria-hidden>
            <NavIconGallery />
          </span>
          갤러리
        </button>
        <button type="button" className="ref-folder-nav-item" onClick={() => onTabChange?.('settings')}>
          <span className="ref-folder-nav-icon" aria-hidden>
            <NavIconSettings />
          </span>
          설정
        </button>
      </nav>

      {pendingFile ? (
        <div
          className="ref-folder-modal-overlay"
          role="presentation"
          onClick={closeModal}
        >
          <div
            className="ref-folder-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ref-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="ref-modal-title" className="ref-folder-modal-title">
              태그 선택
            </h2>
            <div className="ref-folder-modal-tags">
              {REFERENCE_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`ref-folder-modal-tag${modalTag === t ? ' ref-folder-modal-tag--on' : ''}`}
                  onClick={() => setModalTag(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <label className="ref-folder-modal-label" htmlFor="ref-modal-memo">
              메모 추가 (선택)
            </label>
            <input
              id="ref-modal-memo"
              type="text"
              className="ref-folder-modal-input"
              value={modalMemo}
              onChange={(e) => setModalMemo(e.target.value)}
              placeholder="짧게 적어두기"
              autoComplete="off"
            />
            <button type="button" className="ref-folder-modal-save" onClick={saveNewReference}>
              저장
            </button>
            <button type="button" className="ref-folder-modal-cancel" onClick={closeModal}>
              취소
            </button>
          </div>
        </div>
      ) : null}

      {selectedImage ? (
        <div className="ref-folder-viewer" role="dialog" aria-modal="true" aria-label="이미지 보기">
          <div className="ref-folder-viewer-head">
            <button type="button" className="ref-folder-viewer-back" onClick={() => setSelectedImage(null)}>
              ← 뒤로
            </button>
            <span className="ref-folder-viewer-tag">{selectedImage.tag}</span>
          </div>
          <div className="ref-folder-viewer-img-wrap">
            <img src={selectedImage.url} alt="" className="ref-folder-viewer-img" draggable={false} />
          </div>
          <div className="ref-folder-viewer-body">
            <p className="ref-folder-viewer-label">메모</p>
            <textarea
              className="ref-folder-viewer-memo"
              value={viewerMemo}
              onChange={(e) => setViewerMemo(e.target.value)}
              onBlur={flushViewerMemo}
              rows={4}
              placeholder="메모를 입력하세요"
            />
            <p className="ref-folder-viewer-date">저장일 {formatSavedAt(selectedImage.savedAt)}</p>
            <div className="ref-folder-viewer-tag-row">
              <p className="ref-folder-viewer-label">태그</p>
              <div className="ref-folder-viewer-tag-chips">
                {REFERENCE_TAGS.map((t) => {
                  const isCurrent = selectedImage.tag === t
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`ref-folder-viewer-chip${isCurrent ? ' ref-folder-viewer-chip--current' : ''}`}
                      disabled={isCurrent}
                      onClick={() => {
                        patchImage(selectedImage.id, { tag: t })
                        setSelectedImage((prev) => (prev ? { ...prev, tag: t } : null))
                      }}
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
