import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from './contexts/LanguageContext.js'
import { DEFAULT_APP_FEATURES } from './appFeatures.js'
import { NavIconGallery, NavIconGoal, NavIconSettings, NavIconTracker } from './bottomNavIcons.jsx'
import './ReferenceFolderScreen.css'

/** 저장·필터용 안정 키 (표시는 `t.gallery.tags[key]`) */
const REFERENCE_TAG_KEYS = ['mood', 'pose', 'background', 'color', 'idea']

const LEGACY_TAG_TO_KEY = {
  '#무드': 'mood',
  '#포즈': 'pose',
  '#배경': 'background',
  '#컬러': 'color',
  '#아이디어': 'idea',
}

function normalizeReferenceTagKey(stored) {
  if (REFERENCE_TAG_KEYS.includes(stored)) return stored
  return LEGACY_TAG_TO_KEY[stored] ?? 'mood'
}

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
  const { t, lang } = useLang()
  const fileRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const [selectedFilter, setSelectedFilter] = useState(/** @type {'all' | typeof REFERENCE_TAG_KEYS[number]} */ ('all'))
  const [pendingFile, setPendingFile] = useState(/** @type {File | null} */ (null))
  const [modalTagKey, setModalTagKey] = useState(REFERENCE_TAG_KEYS[0])
  const [modalMemo, setModalMemo] = useState('')
  const [selectedImage, setSelectedImage] = useState(
    /** @type {{ id: string; url: string; tag: string; memo: string; savedAt: string } | null} */ (null),
  )
  const [viewerMemo, setViewerMemo] = useState('')

  const tagLabel = useCallback((key) => t.gallery.tags[key] ?? key, [t])

  const triggerFile = useCallback(() => {
    fileRef.current?.click()
  }, [])

  const onFileChange = useCallback((e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    setPendingFile(f)
    setModalTagKey(REFERENCE_TAG_KEYS[0])
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
      tag: modalTagKey,
      memo: modalMemo.trim(),
      savedAt: new Date().toISOString(),
    }
    onReferenceImagesChange((prev) => [...prev, entry])
    closeModal()
  }, [pendingFile, modalTagKey, modalMemo, onReferenceImagesChange, closeModal])

  const filtered = useMemo(() => {
    if (selectedFilter === 'all') return referenceImages
    return referenceImages.filter((x) => normalizeReferenceTagKey(x.tag) === selectedFilter)
  }, [referenceImages, selectedFilter])

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
    const memo = viewerMemo.trim()
    if (memo === (selectedImage.memo ?? '')) return
    patchImage(selectedImage.id, { memo })
    setSelectedImage((prev) => (prev ? { ...prev, memo } : null))
  }, [selectedImage, viewerMemo, patchImage])

  return (
    <div className={`ref-folder-screen${lang === 'en' ? ' ref-folder-screen--en' : ''}`}>
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
            {t.common.back}
          </button>
          <h1 className="ref-folder-title">{t.gallery.reference}</h1>
          <button type="button" className="ref-folder-add" onClick={triggerFile}>
            {t.common.add}
          </button>
        </div>
      </header>

      <div className="ref-folder-tags" role="tablist" aria-label={t.reference.filterAria}>
        <button
          type="button"
          role="tab"
          aria-selected={selectedFilter === 'all'}
          className={`ref-folder-tag${selectedFilter === 'all' ? ' ref-folder-tag--on' : ''}`}
          onClick={() => setSelectedFilter('all')}
        >
          {t.gallery.tags.all}
        </button>
        {REFERENCE_TAG_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={selectedFilter === key}
            className={`ref-folder-tag${selectedFilter === key ? ' ref-folder-tag--on' : ''}`}
            onClick={() => setSelectedFilter(key)}
          >
            {tagLabel(key)}
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
                <span className="ref-folder-card-badge">{tagLabel(normalizeReferenceTagKey(img.tag))}</span>
              </div>
              {img.memo ? <p className="ref-folder-card-memo">{img.memo}</p> : null}
            </button>
          ))}
          <button
            type="button"
            className="ref-folder-card ref-folder-card--add"
            onClick={triggerFile}
            aria-label={t.reference.addImageAria}
          >
            +
          </button>
        </div>
      </div>

      <nav className="ref-folder-nav" aria-label={t.common.bottomNavAria}>
        <button type="button" className="ref-folder-nav-item" onClick={() => onTabChange?.('tracker')}>
          <span className="ref-folder-nav-icon" aria-hidden>
            <NavIconTracker />
          </span>
          {t.nav.tracker}
        </button>
        {features.goalScreen ? (
          <button type="button" className="ref-folder-nav-item" onClick={() => onTabChange?.('goal')}>
            <span className="ref-folder-nav-icon" aria-hidden>
              <NavIconGoal />
            </span>
            {t.nav.goal}
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
          {t.nav.gallery}
        </button>
        <button type="button" className="ref-folder-nav-item" onClick={() => onTabChange?.('settings')}>
          <span className="ref-folder-nav-icon" aria-hidden>
            <NavIconSettings />
          </span>
          {t.nav.setting}
        </button>
      </nav>

      {pendingFile ? (
        <div className="ref-folder-modal-overlay" role="presentation" onClick={closeModal}>
          <div
            className="ref-folder-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ref-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="ref-modal-title" className="ref-folder-modal-title">
              {t.reference.tagModalTitle}
            </h2>
            <div className="ref-folder-modal-tags">
              {REFERENCE_TAG_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`ref-folder-modal-tag${modalTagKey === key ? ' ref-folder-modal-tag--on' : ''}`}
                  onClick={() => setModalTagKey(key)}
                >
                  {tagLabel(key)}
                </button>
              ))}
            </div>
            <label className="ref-folder-modal-label" htmlFor="ref-modal-memo">
              {t.reference.memoOptional}
            </label>
            <input
              id="ref-modal-memo"
              type="text"
              className="ref-folder-modal-input"
              value={modalMemo}
              onChange={(e) => setModalMemo(e.target.value)}
              placeholder={t.reference.memoPlaceholder}
              autoComplete="off"
            />
            <button type="button" className="ref-folder-modal-save" onClick={saveNewReference}>
              {t.common.save}
            </button>
            <button type="button" className="ref-folder-modal-cancel" onClick={closeModal}>
              {t.common.cancel}
            </button>
          </div>
        </div>
      ) : null}

      {selectedImage ? (
        <div className="ref-folder-viewer" role="dialog" aria-modal="true" aria-label={t.reference.viewerAria}>
          <div className="ref-folder-viewer-head">
            <button type="button" className="ref-folder-viewer-back" onClick={() => setSelectedImage(null)}>
              {t.common.back}
            </button>
            <span className="ref-folder-viewer-tag">
              {tagLabel(normalizeReferenceTagKey(selectedImage.tag))}
            </span>
          </div>
          <div className="ref-folder-viewer-img-wrap">
            <img src={selectedImage.url} alt="" className="ref-folder-viewer-img" draggable={false} />
          </div>
          <div className="ref-folder-viewer-body">
            <p className="ref-folder-viewer-label">{t.reference.viewerMemoLabel}</p>
            <textarea
              className="ref-folder-viewer-memo"
              value={viewerMemo}
              onChange={(e) => setViewerMemo(e.target.value)}
              onBlur={flushViewerMemo}
              rows={4}
              placeholder={t.reference.viewerMemoPlaceholder}
            />
            <p className="ref-folder-viewer-date">
              {t.reference.savedAt.replace('{date}', formatSavedAt(selectedImage.savedAt))}
            </p>
            <div className="ref-folder-viewer-tag-row">
              <p className="ref-folder-viewer-label">{t.reference.viewerTagLabel}</p>
              <div className="ref-folder-viewer-tag-chips">
                {REFERENCE_TAG_KEYS.map((key) => {
                  const isCurrent = normalizeReferenceTagKey(selectedImage.tag) === key
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`ref-folder-viewer-chip${isCurrent ? ' ref-folder-viewer-chip--current' : ''}`}
                      disabled={isCurrent}
                      onClick={() => {
                        patchImage(selectedImage.id, { tag: key })
                        setSelectedImage((prev) => (prev ? { ...prev, tag: key } : null))
                      }}
                    >
                      {tagLabel(key)}
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
