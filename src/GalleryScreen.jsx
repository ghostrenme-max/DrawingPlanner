import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_APP_FEATURES } from './appFeatures.js'
import BrandWordmark from './BrandWordmark'
import './GalleryScreen.css'

const MAX_GALLERY_PINS = 3
const PIN_LIMIT_TOAST_VISIBLE_MS = 2600
const PIN_LIMIT_TOAST_TRANSITION_MS = 380

const MARK_PATH =
  'M102.5,285.4c0,0,13,30,43,20s40-90,70-85s34,65,64,50c30-15,58-105,118-147'

function ReferenceFolderIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6.25c0-.966.784-1.75 1.75-1.75h3.3c.465 0 .91.184 1.238.513l1.212 1.212h6.5c.966 0 1.75.784 1.75 1.75v1.275H4V6.25z" />
      <path d="M4 8.25v9.5A1.75 1.75 0 005.75 19.5h12.5a1.75 1.75 0 001.75-1.75v-7.5a1.75 1.75 0 00-1.75-1.75H4z" />
    </svg>
  )
}

function PinIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={22}
      height={22}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 17v5" />
      <path d="M9 10.5V4a1 1 0 011-1h4a1 1 0 011 1v6.5" />
      <path d="M7 10.5h10l-1.2 6H8.2L7 10.5z" />
    </svg>
  )
}

/** 카드 썸네일 좌상단 고정 표시 */
function GalleryPinCornerBadge({ small = false }) {
  return (
    <span
      className={`gallery-card-pin-corner${small ? ' gallery-card-pin-corner--small' : ''}`}
      aria-hidden
    >
      <PinIcon className="gallery-card-pin-corner-icon" />
    </span>
  )
}

/** @param {string} itemId @param {number} imageIndex */
function galleryImagePinKey(itemId, imageIndex) {
  return `${itemId}::${imageIndex}`
}

function GalleryLogoMark() {
  return (
    <svg width={40} height={40} viewBox="0 0 500 500" aria-hidden className="gallery-empty-svg">
      <path
        d={MARK_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth={28}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="gallery-empty-dot-main" cx={136.7} cy={353.8} r={22.8} />
      <circle className="gallery-empty-dot-sub" cx={271.2} cy={320.7} r={25.7} />
    </svg>
  )
}

/**
 * @param {unknown} raw
 * @returns {{ id: string; images: { url: string; date: string }[]; grouped: boolean; finalImageIndex: number; month: string; createdAt: number } | null}
 */
function normalizeGalleryItem(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id) return null
  const imgs = raw.images
  if (!Array.isArray(imgs) || imgs.length === 0) return null

  if (typeof imgs[0] === 'object' && imgs[0] != null && 'url' in imgs[0]) {
    const month = normalizeMonthStr(raw.month)
    const list = imgs.map((x) => ({
      url: typeof x.url === 'string' ? x.url : '',
      date: typeof x.date === 'string' ? x.date : new Date().toISOString(),
    }))
    const fi = Math.min(Math.max(0, raw.finalImageIndex ?? 0), list.length - 1)
    return {
      id: raw.id,
      images: list,
      grouped: raw.grouped === true,
      finalImageIndex: fi,
      month,
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    }
  }

  const legacyDate =
    raw.dateTime || (raw.date ? `${raw.date}T12:00:00.000Z` : new Date().toISOString())
  const list = imgs.map((url) => ({
    url: typeof url === 'string' ? url : '',
    date: legacyDate,
  }))
  return {
    id: raw.id,
    images: list,
    grouped: false,
    finalImageIndex: Math.max(0, list.length - 1),
    month: normalizeMonthStr(raw.month),
    createdAt: raw.uploadedAt ?? Date.now(),
  }
}

function normalizeMonthStr(m) {
  if (!m || typeof m !== 'string') return ''
  if (m.includes('.')) return m
  return m.replace(/^(\d{4})-(\d{2})$/, '$1.$2')
}

function formatSectionMonthLabel(monthDot) {
  const [y, mo] = monthDot.split('.')
  if (!y || !mo) return monthDot
  return `${y} · ${mo}`
}

/** 월별 섹션 키 (YYYY.MM). 저장된 month 우선, 없으면 업로드 시각(로컬 월). */
function sectionMonthKeyForItem(it) {
  const normalized = normalizeMonthStr(it.month)
  if (normalized && /^\d{4}\.\d{2}$/.test(normalized)) return normalized
  const d = new Date(it.createdAt)
  if (Number.isNaN(d.getTime())) {
    const f = it.images[it.finalImageIndex]
    const d2 = f?.date ? new Date(f.date) : new Date()
    return `${d2.getFullYear()}.${String(d2.getMonth() + 1).padStart(2, '0')}`
  }
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** @param {{ date: string }} x */
function stampFromDate(x) {
  const d = new Date(x.date)
  if (Number.isNaN(d.getTime())) return '—'
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}.${dd} ${hh}:${mi}`
}

/** 드래그해서 다른 카드에 놓았을 때만 묶음(과정) 생성 */
function mergeTwoItemsById(items, sourceId, targetId) {
  if (!sourceId || sourceId === targetId) return items.map((it) => ({ ...it }))
  const a = items.find((i) => i.id === sourceId)
  const b = items.find((i) => i.id === targetId)
  if (!a || !b) return items.map((it) => ({ ...it }))

  const flat = []
  for (const it of [a, b]) {
    for (const img of it.images) flat.push({ url: img.url, date: img.date })
  }
  flat.sort((x, y) => new Date(y.date) - new Date(x.date))
  if (flat.length === 0) return items.map((it) => ({ ...it }))

  const top = new Date(flat[0].date)
  const month = `${top.getFullYear()}.${String(top.getMonth() + 1).padStart(2, '0')}`

  const merged = {
    id: `bundle-${Date.now()}`,
    images: flat.map(({ url, date }) => ({ url, date })),
    grouped: true,
    finalImageIndex: 0,
    month,
    createdAt: Date.now(),
  }

  return [...items.filter((it) => it.id !== sourceId && it.id !== targetId), merged]
}

/**
 * @param {{
 *   galleryItems: unknown[]
 *   onGalleryItemsChange: (next: unknown[]) => void
 *   onTabChange?: (tab: 'tracker' | 'goal' | 'gallery' | 'settings') => void
 *   onRemoveGalleryImage?: (itemId: string, imageIndex: number) => void
 *   features?: import('./appFeatures.js').AppFeatures
 *   galleryPinnedKeys?: string[]
 *   onToggleGalleryPin?: (pinKey: string) => void
 *   onPruneGalleryPinsForItemIds?: (itemIds: string[]) => void
 * }} props
 */
export default function GalleryScreen({
  galleryItems,
  onGalleryItemsChange,
  onTabChange,
  onRemoveGalleryImage,
  features = DEFAULT_APP_FEATURES,
  galleryPinnedKeys = [],
  onToggleGalleryPin,
  onPruneGalleryPinsForItemIds,
}) {
  const [lightbox, setLightbox] = useState(
    /** @type {{ src: string; itemId: string; imageIndex: number } | null} */ (null),
  )

  const openLightbox = useCallback((src, itemId, imageIndex) => {
    setLightbox({ src, itemId, imageIndex })
  }, [])

  const closeLightbox = useCallback(() => setLightbox(null), [])
  const [draggingId, setDraggingId] = useState(/** @type {string | null} */ (null))
  const [dropTargetId, setDropTargetId] = useState(/** @type {string | null} */ (null))
  /** 월별 갤러리 필터: 전체 | 일반(미묶음) | 과정(묶음) */
  const [monthFilters, setMonthFilters] = useState(
    /** @type {Record<string, 'all' | 'general' | 'process'>} */ ({}),
  )

  const items = useMemo(() => {
    const out = []
    for (const raw of galleryItems) {
      const n = normalizeGalleryItem(raw)
      if (n) out.push(n)
    }
    return out.sort((a, b) => b.createdAt - a.createdAt)
  }, [galleryItems])

  const byMonth = useMemo(() => {
    const acc = /** @type {Record<string, typeof items>} */ ({})
    for (const it of items) {
      const k = sectionMonthKeyForItem(it)
      if (!acc[k]) acc[k] = []
      acc[k].push(it)
    }
    return acc
  }, [items])

  const monthKeys = useMemo(() => Object.keys(byMonth).sort().reverse(), [byMonth])

  const pinnedKeySet = useMemo(() => new Set(galleryPinnedKeys), [galleryPinnedKeys])

  const endDrag = useCallback(() => {
    setDraggingId(null)
    setDropTargetId(null)
  }, [])

  const handleDropMerge = useCallback(
    (sourceId, targetId) => {
      onPruneGalleryPinsForItemIds?.([sourceId, targetId])
      const next = mergeTwoItemsById(items, sourceId, targetId)
      onGalleryItemsChange(next.map((it) => ({ ...it })))
      endDrag()
    },
    [items, onGalleryItemsChange, endDrag, onPruneGalleryPinsForItemIds],
  )

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, closeLightbox])

  const lightboxPinKey =
    lightbox != null ? galleryImagePinKey(lightbox.itemId, lightbox.imageIndex) : ''
  const lightboxPinned = lightboxPinKey !== '' && galleryPinnedKeys.includes(lightboxPinKey)

  const [pinLimitToastOpen, setPinLimitToastOpen] = useState(false)
  const [pinLimitToastIn, setPinLimitToastIn] = useState(false)
  const pinLimitToastOpenRef = useRef(false)
  pinLimitToastOpenRef.current = pinLimitToastOpen
  const pinLimitToastTimersRef = useRef(
    /** @type {{ show: ReturnType<typeof setTimeout> | null; hide: ReturnType<typeof setTimeout> | null }} */ ({
      show: null,
      hide: null,
    }),
  )

  const showPinLimitToast = useCallback(() => {
    const t = pinLimitToastTimersRef.current
    if (t.show) clearTimeout(t.show)
    if (t.hide) clearTimeout(t.hide)
    t.show = null
    t.hide = null

    if (!pinLimitToastOpenRef.current) {
      setPinLimitToastOpen(true)
      setPinLimitToastIn(false)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPinLimitToastIn(true))
      })
    } else {
      setPinLimitToastOpen(true)
      setPinLimitToastIn(true)
    }

    t.hide = setTimeout(() => {
      setPinLimitToastIn(false)
      t.hide = null
      t.show = setTimeout(() => {
        setPinLimitToastOpen(false)
        t.show = null
      }, PIN_LIMIT_TOAST_TRANSITION_MS)
    }, PIN_LIMIT_TOAST_VISIBLE_MS)
  }, [])

  useEffect(() => {
    return () => {
      const t = pinLimitToastTimersRef.current
      if (t.show) clearTimeout(t.show)
      if (t.hide) clearTimeout(t.hide)
    }
  }, [])

  const handleLightboxPinClick = useCallback(() => {
    if (!onToggleGalleryPin || lightboxPinKey === '') return
    if (lightboxPinned) {
      onToggleGalleryPin(lightboxPinKey)
      return
    }
    if (galleryPinnedKeys.length >= MAX_GALLERY_PINS) {
      showPinLimitToast()
      return
    }
    onToggleGalleryPin(lightboxPinKey)
  }, [
    galleryPinnedKeys.length,
    lightboxPinned,
    lightboxPinKey,
    onToggleGalleryPin,
    showPinLimitToast,
  ])

  /** 표시할 카드 없음 — galleryItems가 비어 있거나 정규화 후 항목 없음 */
  const isEmpty = items.length === 0

  return (
    <div className="gallery-screen">
      {lightbox ? (
        <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label="이미지 전체 보기">
          <div className="gallery-lightbox-toolbar">
            <button
              type="button"
              className={`gallery-lightbox-pin${lightboxPinned ? ' gallery-lightbox-pin--on' : ''}`}
              aria-pressed={lightboxPinned}
              aria-label={lightboxPinned ? '고정 해제' : '이미지 고정'}
              onClick={handleLightboxPinClick}
            >
              <PinIcon />
            </button>
            <button type="button" className="gallery-lightbox-close" onClick={closeLightbox} aria-label="닫기">
              ✕
            </button>
          </div>
          <div className="gallery-lightbox-scroll">
            <img src={lightbox.src} alt="" className="gallery-lightbox-img" draggable={false} />
          </div>
        </div>
      ) : null}

      <header className="gallery-header">
        <div className="gallery-header-brand">
          <BrandWordmark />
          {!isEmpty ? (
            <p className="gallery-dnd-hint">카드를 다른 카드 위로 끌어다 놓으면 과정으로 묶을 수 있어요.</p>
          ) : null}
        </div>
      </header>

      <div className="gallery-body">
        <div className={`gallery-scroll${isEmpty ? ' gallery-scroll--empty' : ''}`}>
          {isEmpty ? (
            <div className="gallery-empty">
              <GalleryLogoMark />
              <div className="gallery-empty-lines">
                <p className="gallery-empty-text">아직 완성작이 없어요</p>
                <p className="gallery-empty-hint">트래커에서 완성 후 갤러리로 보내기</p>
              </div>
            </div>
          ) : (
            monthKeys.map((monthKey) => {
              const filter = monthFilters[monthKey] ?? 'all'
              const monthItems = byMonth[monthKey]
              const visibleItems = monthItems.filter((item) => {
                if (filter === 'general') return !item.grouped
                if (filter === 'process') return item.grouped
                return true
              })

              return (
              <section key={monthKey} className="gallery-month-block">
                <div className="gallery-month-head">
                  <div className="gallery-month-top-row">
                    <div className="gallery-month-label">{formatSectionMonthLabel(monthKey)}</div>
                    <div
                      className="gallery-month-filters"
                      role="radiogroup"
                      aria-label={`${formatSectionMonthLabel(monthKey)} 보기`}
                    >
                      {[
                        { id: 'all', label: '전체' },
                        { id: 'general', label: '일반' },
                        { id: 'process', label: '과정' },
                      ].map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          role="radio"
                          aria-checked={filter === id}
                          className={`gallery-month-filter${filter === id ? ' gallery-month-filter--on' : ''}`}
                          onClick={() =>
                            setMonthFilters((prev) => ({ ...prev, [monthKey]: id }))
                          }
                        >
                          <span className="gallery-month-filter-check" aria-hidden />
                          <span className="gallery-month-filter-text">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="gallery-month-folder-slot">
                    <button type="button" className="gallery-month-folder-btn" aria-label="Reference folder">
                      <ReferenceFolderIcon className="gallery-month-folder-icon" />
                    </button>
                    <span className="gallery-month-folder-label">Reference Folder</span>
                  </div>
                </div>
                <div className="gallery-card-list">
                  {visibleItems.length === 0 ? (
                    <p className="gallery-month-filter-empty" role="status">
                      이 구간에 표시할 항목이 없어요.
                    </p>
                  ) : null}
                  {visibleItems.map((item) => (
                    <DraggableGalleryRow
                      key={item.id}
                      item={item}
                      draggingId={draggingId}
                      dropTargetId={dropTargetId}
                      onDragStartId={setDraggingId}
                      onDragOverTarget={(id) => {
                        if (draggingId && draggingId !== id) setDropTargetId(id)
                      }}
                      onDragEnd={endDrag}
                      onDropMerge={handleDropMerge}
                    >
                      {item.grouped ? (
                        <GroupedCard
                          item={item}
                          pinnedKeySet={pinnedKeySet}
                          onOpenImage={(url, imageIndex) => openLightbox(url, item.id, imageIndex)}
                        />
                      ) : (
                        <SingleGalleryCard
                          item={item}
                          pinnedKeySet={pinnedKeySet}
                          onOpenLightbox={(url, imageIndex) => openLightbox(url, item.id, imageIndex)}
                          onRemoveGalleryImage={onRemoveGalleryImage}
                        />
                      )}
                    </DraggableGalleryRow>
                  ))}
                </div>
              </section>
              )
            })
          )}
        </div>

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

      {pinLimitToastOpen ? (
        <div
          className={`gallery-pin-limit-toast${pinLimitToastIn ? ' gallery-pin-limit-toast--in' : ''}`}
          role="status"
          aria-live="polite"
        >
          <div className="gallery-pin-limit-toast-lines">
            <span className="gallery-pin-limit-toast-line">상단바 고정 팝업</span>
            <span className="gallery-pin-limit-toast-line">{MAX_GALLERY_PINS}개까지 가능해요</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * @param {{
 *   item: NonNullable<ReturnType<typeof normalizeGalleryItem>>
 *   draggingId: string | null
 *   dropTargetId: string | null
 *   onDragStartId: (id: string) => void
 *   onDragOverTarget: (id: string) => void
 *   onDragEnd: () => void
 *   onDropMerge: (sourceId: string, targetId: string) => void
 *   children: import('react').ReactNode
 * }} props
 */
function DraggableGalleryRow({
  item,
  draggingId,
  dropTargetId,
  onDragStartId,
  onDragOverTarget,
  onDragEnd,
  onDropMerge,
  children,
}) {
  const isDragging = draggingId === item.id
  const showDropLayer = draggingId != null && draggingId !== item.id
  const isDropTarget = showDropLayer && dropTargetId === item.id

  return (
    <div
      className={`gallery-drag-row${isDragging ? ' gallery-drag-row--dragging' : ''}${isDropTarget ? ' gallery-drag-row--drop-target' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', item.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStartId(item.id)
      }}
      onDragEnd={onDragEnd}
    >
      <div className="gallery-drag-row__inner">{children}</div>
      {showDropLayer ? (
        <div
          className="gallery-drag-row__drop-layer"
          aria-hidden
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            onDragOverTarget(item.id)
          }}
          onDrop={(e) => {
            e.preventDefault()
            const sid = e.dataTransfer.getData('text/plain')
            if (sid && sid !== item.id) onDropMerge(sid, item.id)
          }}
        />
      ) : null}
    </div>
  )
}

/**
 * 대표(완성) + 과정 썸네일 — 사용자가 DnD로 묶은 카드만
 * @param {{
 *   item: NonNullable<ReturnType<typeof normalizeGalleryItem>>
 *   onOpenImage: (url: string, imageIndex: number) => void
 *   showFinalBadge?: boolean
 *   shellClassName?: string
 *   pinnedKeySet?: Set<string>
 * }} props
 */
function FinalProcessBlock({
  item,
  onOpenImage,
  showFinalBadge = false,
  shellClassName = 'gallery-card-grouped',
  pinnedKeySet = new Set(),
}) {
  const final = item.images[item.finalImageIndex]
  const processIdxs = item.images.map((_, i) => i).filter((i) => i !== item.finalImageIndex)
  const thumbs = processIdxs.slice(0, 2)
  const extra = processIdxs.length - 2

  if (!final) return null

  const isIdxPinned = (idx) => pinnedKeySet.has(galleryImagePinKey(item.id, idx))
  const finalPinned = isIdxPinned(item.finalImageIndex)

  return (
    <div className={shellClassName}>
      <button
        type="button"
        className={`gallery-card-grouped-final${finalPinned ? ' gallery-card-grouped-final--pinned' : ''}`}
        onClick={() => onOpenImage(final.url, item.finalImageIndex)}
        aria-label={showFinalBadge ? '완성본 크게 보기' : '대표 이미지 크게 보기'}
      >
        <img src={final.url} alt="" className="gallery-card-grouped-final-img" draggable={false} />
        {finalPinned ? <GalleryPinCornerBadge /> : null}
        {showFinalBadge ? <span className="gallery-badge-final">완성본</span> : null}
        <span className="gallery-card-stamp-bl">{stampFromDate(final)}</span>
      </button>
      {processIdxs.length > 0 ? (
        <div className="gallery-process-bar">
          <span className="gallery-process-label">과정</span>
          <div className="gallery-process-thumbs">
            {extra > 0 ? (
              <span className="gallery-process-more" aria-label={`외 ${extra}장`}>
                +{extra}
              </span>
            ) : null}
            {thumbs.map((idx) => {
              const thumbPinned = isIdxPinned(idx)
              return (
                <button
                  key={idx}
                  type="button"
                  className={`gallery-process-thumb${thumbPinned ? ' gallery-process-thumb--pinned' : ''}`}
                  onClick={() => onOpenImage(item.images[idx].url, idx)}
                  aria-label="과정 샷 보기"
                >
                  {thumbPinned ? <GalleryPinCornerBadge small /> : null}
                  <img src={item.images[idx].url} alt="" draggable={false} />
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * @param {{
 *   item: NonNullable<ReturnType<typeof normalizeGalleryItem>>
 *   pinnedKeySet?: Set<string>
 *   onOpenLightbox: (url: string, imageIndex: number) => void
 *   onRemoveGalleryImage?: (itemId: string, imageIndex: number) => void
 * }} props
 */
function SingleGalleryCard({ item, onOpenLightbox, onRemoveGalleryImage, pinnedKeySet = new Set() }) {
  const heroIdx = item.images[item.finalImageIndex] != null ? item.finalImageIndex : 0
  const hero = item.images[heroIdx]
  const heroPinned = pinnedKeySet.has(galleryImagePinKey(item.id, heroIdx))

  return (
    <div className="gallery-card-single-outer">
      <button
        type="button"
        className={`gallery-card-single${heroPinned ? ' gallery-card-single--pinned' : ''}`}
        onClick={() => onOpenLightbox(hero.url, heroIdx)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {heroPinned ? <GalleryPinCornerBadge /> : null}
        <img src={hero.url} alt="" className="gallery-card-single-img" draggable={false} />
        <span className="gallery-card-stamp-br">{stampFromDate(hero)}</span>
      </button>
      {onRemoveGalleryImage ? (
        <button
          type="button"
          className="gallery-card-remove-test"
          aria-label="이미지 삭제(테스트)"
          onClick={(e) => {
            e.stopPropagation()
            onRemoveGalleryImage(item.id, item.finalImageIndex)
          }}
        >
          ✕
        </button>
      ) : null}
    </div>
  )
}

/**
 * @param {{
 *   item: NonNullable<ReturnType<typeof normalizeGalleryItem>>
 *   pinnedKeySet?: Set<string>
 *   onOpenImage: (url: string, imageIndex: number) => void
 * }} props
 */
function GroupedCard({ item, onOpenImage, pinnedKeySet }) {
  return (
    <FinalProcessBlock
      item={item}
      pinnedKeySet={pinnedKeySet}
      onOpenImage={onOpenImage}
      showFinalBadge
      shellClassName="gallery-card-grouped"
    />
  )
}
