import { useEffect, useState } from 'react'
import { DEFAULT_APP_FEATURES } from './appFeatures.js'
import BrandWordmark from './BrandWordmark'
import './GalleryScreen.css'

/**
 * @typedef {{ id: string; title: string; month: string; images: string[]; date: string; dateTime?: string; uploadedAt?: number }} GalleryItem
 */

/** 업로드 순간(로컬 표시용). uploadedAt(ms) → Date.getHours 등이 기기 현재 시간대 기준. */
function galleryItemMoment(item) {
  const ts = item.uploadedAt
  if (ts != null && Number.isFinite(Number(ts))) {
    return { d: new Date(Number(ts)), includeTime: true }
  }
  if (item.dateTime) {
    const d = new Date(item.dateTime)
    if (!Number.isNaN(d.getTime())) return { d, includeTime: true }
  }
  if (item.date) {
    const [y, m, day] = item.date.split('-').map(Number)
    if (y && m && day) return { d: new Date(y, m - 1, day), includeTime: false }
  }
  const d = new Date()
  return { d, includeTime: true }
}

/** 시각 있음: 04.02 14:30 (로컬). 날짜만 있으면 04.02 (자정 00:00 오표시 방지). */
function formatCellStamp({ d, includeTime }) {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  if (!includeTime) return `${mm}.${dd}`
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}.${dd} ${hh}:${mi}`
}

/**
 * @param {{
 *   galleryItems: GalleryItem[]
 *   onTabChange?: (tab: 'tracker' | 'goal' | 'gallery' | 'settings') => void
 *   onRemoveGalleryImage?: (itemId: string, imageIndex: number) => void
 *   features?: import('./appFeatures.js').AppFeatures
 * }} props
 */
export default function GalleryScreen({
  galleryItems,
  onTabChange,
  onRemoveGalleryImage,
  features = DEFAULT_APP_FEATURES,
}) {
  const [lightboxSrc, setLightboxSrc] = useState(/** @type {string | null} */ (null))

  useEffect(() => {
    if (!lightboxSrc) return
    const onKey = (e) => {
      if (e.key === 'Escape') setLightboxSrc(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxSrc])

  const byMonth = galleryItems.reduce((acc, item) => {
    const m = item.month
    if (!acc[m]) acc[m] = []
    acc[m].push(item)
    return acc
  }, /** @type {Record<string, GalleryItem[]>} */ ({}))

  const monthKeys = Object.keys(byMonth).sort().reverse()

  const formatMonthLabel = (key) => {
    const [y, mo] = key.split('-')
    return `${y}.${mo}`
  }

  return (
    <div className="gallery-screen">
      {lightboxSrc ? (
        <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label="이미지 전체 보기">
          <button
            type="button"
            className="gallery-lightbox-close"
            onClick={() => setLightboxSrc(null)}
            aria-label="닫기"
          >
            ✕
          </button>
          <div className="gallery-lightbox-scroll">
            <img src={lightboxSrc} alt="" className="gallery-lightbox-img" draggable={false} />
          </div>
        </div>
      ) : null}

      <header className="gallery-header">
        <div className="gallery-header-brand">
          <BrandWordmark />
        </div>
      </header>

      <div className="gallery-scroll">
        {galleryItems.length === 0 ? (
          <div className="gallery-empty">
            <p className="gallery-empty-text">아직 완성작이 없어요</p>
            <p className="gallery-empty-hint">
              트래커에서 &quot;완성했어요 — 갤러리에 담기&quot;로
              <br />
              보낸 작업만 여기에 모여요.
            </p>
          </div>
        ) : (
          monthKeys.map((monthKey) => (
            <section key={monthKey} className="gallery-month-block">
              <div className="gallery-month-label">{formatMonthLabel(monthKey)}</div>
              <div className="gallery-grid">
                {byMonth[monthKey].flatMap((item) =>
                  item.images.map((src, i) => (
                    <div key={`${item.id}-${i}`} className="gallery-cell-shell">
                      <button
                        type="button"
                        className="gallery-cell gallery-cell--photo"
                        onClick={() => setLightboxSrc(src)}
                        aria-label="전체 화면으로 보기"
                      >
                        <img src={src} alt="" className="gallery-cell-img" draggable={false} />
                        <span className="gallery-cell-stamp">
                          {formatCellStamp(galleryItemMoment(item))}
                        </span>
                      </button>
                      {onRemoveGalleryImage ? (
                        <button
                          type="button"
                          className="gallery-cell-remove-test"
                          aria-label="이미지 삭제(테스트)"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onRemoveGalleryImage(item.id, i)
                          }}
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>
                  )),
                )}
              </div>
            </section>
          ))
        )}
      </div>

      <nav className="gallery-nav" aria-label="하단 메뉴">
        <button type="button" className="gallery-nav-item" onClick={() => onTabChange?.('tracker')}>
          <span className="gallery-nav-icon" aria-hidden />
          트래커
        </button>
        {features.goalScreen ? (
          <button type="button" className="gallery-nav-item" onClick={() => onTabChange?.('goal')}>
            <span className="gallery-nav-icon" aria-hidden />
            목표
          </button>
        ) : null}
        <button type="button" className="gallery-nav-item gallery-nav-item--active">
          <span className="gallery-nav-icon" aria-hidden />
          갤러리
        </button>
        <button type="button" className="gallery-nav-item" onClick={() => onTabChange?.('settings')}>
          <span className="gallery-nav-icon" aria-hidden />
          설정
        </button>
      </nav>
    </div>
  )
}
