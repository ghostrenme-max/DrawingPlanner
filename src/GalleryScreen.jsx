import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from './contexts/LanguageContext.js'
import { DEFAULT_APP_FEATURES } from './appFeatures.js'
import BrandWordmark from './BrandWordmark'
import { NavIconGallery, NavIconGoal, NavIconSettings, NavIconTracker } from './bottomNavIcons.jsx'
import './GalleryScreen.css'
import { hideGalleryBanner, showGalleryBanner } from './hooks/useAdMob.js'

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

function TrashIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={20}
      height={20}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

/**
 * @param {NonNullable<ReturnType<typeof normalizeGalleryItem>>} item
 * @param {{ url: string; date: string }} slotImg
 */
const PROMOTE_FINAL_MIME = 'application/x-worthwith-promote-final'

function resolveProcessImageGlobalIndex(item, slotImg) {
  if (!slotImg) return -1
  const fi = item.finalImageIndex
  return item.images.findIndex((g, i) => (fi < 0 || i !== fi) && g.url === slotImg.url && g.date === slotImg.date)
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
 * @param {unknown[]} trackerCards
 * @param {string} [sourceCardId]
 */
function resolveGalleryFeedbackType(trackerCards, sourceCardId) {
  if (!sourceCardId || !Array.isArray(trackerCards)) return 'orange'
  const c = trackerCards.find((tc) => tc && typeof tc === 'object' && tc.id === sourceCardId)
  if (!c) return 'orange'
  return c.isCarryOver ? 'teal' : 'orange'
}

/** 갤러리 상세에서 피드백 미리보기용 대표 이미지 URL */
function feedbackPreviewUrlFromGalleryItem(item) {
  if (!item?.images?.length) return ''
  const fi = item.finalImageIndex
  if (fi >= 0 && item.images[fi]) {
    const u = item.images[fi].url
    return typeof u === 'string' ? u : ''
  }
  const u0 = item.images[0]?.url
  return typeof u0 === 'string' ? u0 : ''
}

/**
 * @param {unknown} raw
 * @returns {{ id: string; images: { url: string; date: string }[]; grouped: boolean; finalImageIndex: number; month: string; createdAt: number; workTitle?: string; sourceCardId?: string } | null}
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
    const rawFi = raw.finalImageIndex
    const fi =
      rawFi === null || rawFi === undefined || rawFi === -1
        ? -1
        : Math.min(Math.max(0, Number(rawFi)), list.length - 1)
    const workTitle = typeof raw.workTitle === 'string' ? raw.workTitle : ''
    const sourceCardId = typeof raw.sourceCardId === 'string' ? raw.sourceCardId : ''
    return {
      id: raw.id,
      images: list,
      grouped: raw.grouped === true,
      finalImageIndex: fi,
      month,
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
      ...(workTitle ? { workTitle } : {}),
      ...(sourceCardId ? { sourceCardId } : {}),
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

/** 현재 월 포함 과거 12개월 키 (YYYY.MM) */
function last12MonthKeysFromDate(anchor = new Date()) {
  const out = []
  for (let i = 0; i < 12; i++) {
    const x = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1)
    out.push(`${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

/** 월별 섹션 키 (YYYY.MM). 저장된 month 우선, 없으면 업로드 시각(로컬 월). */
function sectionMonthKeyForItem(it) {
  const normalized = normalizeMonthStr(it.month)
  if (normalized && /^\d{4}\.\d{2}$/.test(normalized)) return normalized
  const d = new Date(it.createdAt)
  if (Number.isNaN(d.getTime())) {
    const fi = it.finalImageIndex
    const f = fi >= 0 ? it.images[fi] : it.images[0]
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

  const wt = (typeof b.workTitle === 'string' && b.workTitle) || (typeof a.workTitle === 'string' && a.workTitle) || ''
  const sc = (typeof b.sourceCardId === 'string' && b.sourceCardId) || (typeof a.sourceCardId === 'string' && a.sourceCardId) || ''
  const merged = {
    id: `bundle-${Date.now()}`,
    images: flat.map(({ url, date }) => ({ url, date })),
    grouped: true,
    finalImageIndex: 0,
    month,
    createdAt: Date.now(),
    ...(wt ? { workTitle: wt } : {}),
    ...(sc ? { sourceCardId: sc } : {}),
  }

  return [...items.filter((it) => it.id !== sourceId && it.id !== targetId), merged]
}

/** @param {{ url: string; date: string }[]} images @param {number} finalIndex -1 이면 전부 과정 */
function extractProcessImages(images, finalIndex) {
  if (finalIndex == null || finalIndex < 0) return images.map((img) => ({ ...img }))
  return images.filter((_, i) => i !== finalIndex).map((img) => ({ ...img }))
}

/** 완성본 → 과정 맨 아래로 */
function demoteFinalFromItem(item) {
  const fi = item.finalImageIndex
  if (fi == null || fi < 0 || fi >= item.images.length) return item
  const finalImg = item.images[fi]
  const rest = item.images.filter((_, i) => i !== fi)
  return {
    ...item,
    images: [...rest, finalImg],
    finalImageIndex: -1,
  }
}

/** 과정 한 장을 완성본(맨 앞)으로 */
function promoteProcessImageToFinal(item, slotImg) {
  if (item.finalImageIndex >= 0 || !slotImg) return item
  const gi = item.images.findIndex((g) => g.url === slotImg.url && g.date === slotImg.date)
  if (gi < 0) return item
  const chosen = item.images[gi]
  const rest = item.images.filter((_, i) => i !== gi)
  return {
    ...item,
    images: [chosen, ...rest],
    finalImageIndex: 0,
  }
}

/**
 * @param {number} finalIndex
 * @param {{ url: string; date: string }[]} fullImages
 * @param {{ url: string; date: string }[]} reorderedProcess
 */
function buildImagesFromProcessOrder(finalIndex, fullImages, reorderedProcess) {
  const finalImg = fullImages[finalIndex]
  const newLen = reorderedProcess.length + 1
  const out = []
  let p = 0
  for (let i = 0; i < newLen; i++) {
    if (i === finalIndex) out.push(finalImg)
    else out.push(reorderedProcess[p++] ?? { url: '', date: new Date().toISOString() })
  }
  return out
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
 *   trackerCards?: unknown[]
 *   onAppendFeedbackCard?: (entry: { id: number; text: string; workTitle: string; date: string; type: 'orange' | 'teal'; month: string; previewImageUrl?: string; confirmed?: boolean }) => void
 *   onOpenReferenceFolder?: () => void
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
  trackerCards = [],
  onAppendFeedbackCard,
  onOpenReferenceFolder,
}) {
  const { t, lang } = useLang()

  useEffect(() => {
    void showGalleryBanner()
    return () => {
      void hideGalleryBanner()
    }
  }, [])

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
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [selectedMonthKey, setSelectedMonthKey] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const [showDetailView, setShowDetailView] = useState(false)
  const [selectedGroupCard, setSelectedGroupCard] = useState(
    /** @type {NonNullable<ReturnType<typeof normalizeGalleryItem>> | null} */ (null),
  )
  const [detailProcessImages, setDetailProcessImages] = useState(
    /** @type {{ url: string; date: string }[]} */ ([]),
  )
  const [detailEditOrder, setDetailEditOrder] = useState(false)
  const [detailDragOver, setDetailDragOver] = useState(/** @type {number | null} */ (null))
  const [detailDragOverFinal, setDetailDragOverFinal] = useState(false)
  const detailFileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const [detailFeedbackDraft, setDetailFeedbackDraft] = useState('')
  const [feedbackSavedToast, setFeedbackSavedToast] = useState(false)

  const pickerMonthKeys = useMemo(() => last12MonthKeysFromDate(), [])

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

  const pinnedKeySet = useMemo(() => new Set(galleryPinnedKeys), [galleryPinnedKeys])

  const selectedMonthFilter = monthFilters[selectedMonthKey] ?? 'all'
  const visibleItemsForSelectedMonth = useMemo(() => {
    const monthItems = byMonth[selectedMonthKey] ?? []
    return monthItems.filter((item) => {
      if (selectedMonthFilter === 'general') return !item.grouped
      if (selectedMonthFilter === 'process') return item.grouped
      return true
    })
  }, [byMonth, selectedMonthKey, selectedMonthFilter])

  const detailLiveItem = useMemo(
    () =>
      selectedGroupCard ? items.find((i) => i.id === selectedGroupCard.id) ?? null : null,
    [items, selectedGroupCard],
  )

  const detailIsGrouped = Boolean(detailLiveItem?.grouped)

  const openGalleryDetail = useCallback((item) => {
    setSelectedGroupCard(item)
    setDetailProcessImages(extractProcessImages(item.images, item.finalImageIndex))
    setDetailEditOrder(false)
    setDetailDragOver(null)
    setDetailDragOverFinal(false)
    setShowDetailView(true)
  }, [])

  const closeGroupDetail = useCallback(() => {
    setShowDetailView(false)
    setSelectedGroupCard(null)
    setDetailEditOrder(false)
    setDetailDragOver(null)
    setDetailDragOverFinal(false)
  }, [])

  const persistDetailProcessImages = useCallback(
    (nextProcess) => {
      if (!selectedGroupCard) return
      const live = items.find((i) => i.id === selectedGroupCard.id)
      if (!live) return
      const fi = live.finalImageIndex
      const newImages =
        fi == null || fi < 0
          ? nextProcess.map((x) => ({ ...x }))
          : buildImagesFromProcessOrder(fi, live.images, nextProcess)
      onGalleryItemsChange(items.map((it) => (it.id === live.id ? { ...it, images: newImages } : it)))
    },
    [items, onGalleryItemsChange, selectedGroupCard],
  )

  const finishDetailEditOrder = useCallback(() => {
    persistDetailProcessImages(detailProcessImages)
    setDetailEditOrder(false)
    setDetailDragOver(null)
    setDetailDragOverFinal(false)
  }, [detailProcessImages, persistDetailProcessImages])

  const handleDemoteFinal = useCallback(() => {
    if (!detailLiveItem) return
    const fi = detailLiveItem.finalImageIndex
    if (fi == null || fi < 0 || !detailLiveItem.images[fi]) return
    const next = demoteFinalFromItem(detailLiveItem)
    onGalleryItemsChange(items.map((it) => (it.id === next.id ? next : it)))
    setDetailEditOrder(false)
    setDetailDragOver(null)
    setDetailDragOverFinal(false)
    setDetailProcessImages(extractProcessImages(next.images, next.finalImageIndex))
  }, [detailLiveItem, items, onGalleryItemsChange])

  const handlePromoteProcessToFinal = useCallback(
    (processIdx) => {
      if (!detailLiveItem || detailLiveItem.finalImageIndex >= 0) return
      const slotImg = detailProcessImages[processIdx]
      if (!slotImg) return
      const next = promoteProcessImageToFinal(detailLiveItem, slotImg)
      onGalleryItemsChange(items.map((it) => (it.id === next.id ? next : it)))
      setDetailDragOverFinal(false)
    },
    [detailLiveItem, detailProcessImages, items, onGalleryItemsChange],
  )

  const appendDetailProcessImage = useCallback(
    (file) => {
      const url = URL.createObjectURL(file)
      setDetailProcessImages((prev) => {
        const next = [...prev, { url, date: new Date().toISOString() }]
        queueMicrotask(() => persistDetailProcessImages(next))
        return next
      })
    },
    [persistDetailProcessImages],
  )

  useEffect(() => {
    if (!showMonthPicker) return
    const onKey = (e) => {
      if (e.key === 'Escape') setShowMonthPicker(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showMonthPicker])

  useEffect(() => {
    if (!showDetailView) return
    const onKey = (e) => {
      if (e.key === 'Escape' && lightbox == null) closeGroupDetail()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showDetailView, lightbox, closeGroupDetail])

  useEffect(() => {
    if (showDetailView && selectedGroupCard && !items.some((i) => i.id === selectedGroupCard.id)) {
      closeGroupDetail()
    }
  }, [showDetailView, selectedGroupCard, items, closeGroupDetail])

  useEffect(() => {
    if (!showDetailView || detailEditOrder || !detailLiveItem) return
    setDetailProcessImages(extractProcessImages(detailLiveItem.images, detailLiveItem.finalImageIndex))
  }, [detailLiveItem, showDetailView, detailEditOrder])

  useEffect(() => {
    if (!selectedGroupCard?.id) return
    setDetailFeedbackDraft('')
  }, [selectedGroupCard?.id])

  useEffect(() => {
    if (!feedbackSavedToast) return
    const t = window.setTimeout(() => setFeedbackSavedToast(false), 1500)
    return () => window.clearTimeout(t)
  }, [feedbackSavedToast])

  const handleSaveDetailFeedback = useCallback(() => {
    const text = detailFeedbackDraft.trim()
    if (!text || !onAppendFeedbackCard || !detailLiveItem) return
    const now = new Date()
    const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`
    const month = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`
    const workTitleRaw = detailLiveItem.workTitle
    const workTitle =
      typeof workTitleRaw === 'string' && workTitleRaw.trim() ? workTitleRaw.trim() : t.gallery.feedbackWorkFallback
    const type = resolveGalleryFeedbackType(trackerCards, detailLiveItem.sourceCardId)
    onAppendFeedbackCard({
      id: Date.now(),
      text,
      workTitle,
      date: dateStr,
      type,
      month,
      previewImageUrl: feedbackPreviewUrlFromGalleryItem(detailLiveItem),
      confirmed: false,
    })
    setDetailFeedbackDraft('')
    setFeedbackSavedToast(true)
  }, [detailFeedbackDraft, detailLiveItem, onAppendFeedbackCard, trackerCards, t.gallery.feedbackWorkFallback])

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

  const handleLightboxDelete = useCallback(() => {
    if (!lightbox || !onRemoveGalleryImage) return
    if (lightboxPinned && onToggleGalleryPin && lightboxPinKey !== '') {
      onToggleGalleryPin(lightboxPinKey)
    }
    onRemoveGalleryImage(lightbox.itemId, lightbox.imageIndex)
    closeLightbox()
  }, [
    lightbox,
    lightboxPinned,
    lightboxPinKey,
    onRemoveGalleryImage,
    onToggleGalleryPin,
    closeLightbox,
  ])

  /** 표시할 카드 없음 — galleryItems가 비어 있거나 정규화 후 항목 없음 */
  const isEmpty = items.length === 0

  return (
    <div className={`gallery-screen${lang === 'en' ? ' gallery-screen--en' : ''}`}>
      {showDetailView && detailLiveItem ? (
        <div
          className="gallery-group-detail"
          role="dialog"
          aria-modal="true"
          aria-label={detailIsGrouped ? t.gallery.detailGroupedAria : t.gallery.detailSingleAria}
        >
          {detailIsGrouped ? (
            <input
              ref={detailFileInputRef}
              type="file"
              accept="image/*"
              className="gallery-group-detail-file"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) appendDetailProcessImage(f)
                e.target.value = ''
              }}
            />
          ) : null}
          <header className="gallery-group-detail-header">
            <button type="button" className="gallery-group-detail-back" onClick={closeGroupDetail}>
              {t.common.back}
            </button>
            {detailIsGrouped ? (
              detailEditOrder ? (
                <button type="button" className="gallery-group-detail-action" onClick={finishDetailEditOrder}>
                  {t.common.done}
                </button>
              ) : (
                <button
                  type="button"
                  className="gallery-group-detail-action"
                  onClick={() => setDetailEditOrder(true)}
                >
                  {t.common.edit}
                </button>
              )
            ) : null}
          </header>
          {detailIsGrouped ? (
            <>
              <div className="gallery-group-detail-final-block">
                <div className="gallery-group-detail-final-label-row">
                  <p className="gallery-group-detail-section-label gallery-group-detail-section-label--final">
                    {t.gallery.final}
                  </p>
                  {detailLiveItem.finalImageIndex >= 0 &&
                  detailLiveItem.images[detailLiveItem.finalImageIndex] &&
                  !detailEditOrder ? (
                    <button type="button" className="gallery-group-detail-demote-btn" onClick={handleDemoteFinal}>
                      {t.gallery.finalDemote}
                    </button>
                  ) : null}
                </div>
                {(() => {
                  const dfi = detailLiveItem.finalImageIndex
                  const hasFinal = dfi >= 0 && detailLiveItem.images[dfi]
                  if (hasFinal) {
                    const f = detailLiveItem.images[dfi]
                    return (
                      <>
                        {detailEditOrder ? (
                          <img src={f.url} alt="" className="gallery-group-detail-final-img" draggable={false} />
                        ) : (
                          <button
                            type="button"
                            className="gallery-group-detail-final-img-btn"
                            onClick={() => openLightbox(f.url, detailLiveItem.id, dfi)}
                          >
                            <img src={f.url} alt="" className="gallery-group-detail-final-img" draggable={false} />
                          </button>
                        )}
                        <p className="gallery-group-detail-final-date">{stampFromDate(f)}</p>
                      </>
                    )
                  }
                  return (
                    <div
                      className={`gallery-group-detail-final-dropzone${
                        detailDragOverFinal ? ' gallery-group-detail-final-dropzone--active' : ''
                      }`}
                      onDragOver={(e) => {
                        if (detailEditOrder) return
                        if (!Array.from(e.dataTransfer.types || []).includes(PROMOTE_FINAL_MIME)) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'copy'
                        setDetailDragOverFinal(true)
                      }}
                      onDragEnter={(e) => {
                        if (detailEditOrder) return
                        if (Array.from(e.dataTransfer.types || []).includes(PROMOTE_FINAL_MIME)) {
                          e.preventDefault()
                          setDetailDragOverFinal(true)
                        }
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) setDetailDragOverFinal(false)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        setDetailDragOverFinal(false)
                        if (detailEditOrder) return
                        const raw = e.dataTransfer.getData(PROMOTE_FINAL_MIME)
                        const pi = Number.parseInt(raw, 10)
                        if (!Number.isFinite(pi) || pi < 0) return
                        handlePromoteProcessToFinal(pi)
                      }}
                    >
                      <span className="gallery-group-detail-final-dropzone-icon" aria-hidden>
                        +
                      </span>
                      <span className="gallery-group-detail-final-dropzone-text">{t.gallery.finalDropHint}</span>
                    </div>
                  )
                })()}
              </div>
              <div className="gallery-group-detail-rule" aria-hidden />
            </>
          ) : (
            <>
              <div className="gallery-group-detail-final-block">
                <p className="gallery-group-detail-section-label gallery-group-detail-section-label--final">
                  {t.gallery.workLabel}
                </p>
                {(() => {
                  const sIdx =
                    detailLiveItem.finalImageIndex >= 0 &&
                    detailLiveItem.images[detailLiveItem.finalImageIndex]
                      ? detailLiveItem.finalImageIndex
                      : 0
                  const sh = detailLiveItem.images[sIdx]
                  if (!sh) return null
                  return (
                    <>
                      <button
                        type="button"
                        className="gallery-group-detail-final-img-btn"
                        onClick={() => openLightbox(sh.url, detailLiveItem.id, sIdx)}
                      >
                        <img src={sh.url} alt="" className="gallery-group-detail-final-img" draggable={false} />
                      </button>
                      <p className="gallery-group-detail-final-date">{stampFromDate(sh)}</p>
                    </>
                  )
                })()}
              </div>
              <div className="gallery-group-detail-rule" aria-hidden />
            </>
          )}
          <div className="gallery-group-detail-scroll">
            {detailIsGrouped ? (
              <>
                <p className="gallery-group-detail-section-label gallery-group-detail-section-label--process">
                  {t.gallery.process}
                </p>
                {detailProcessImages.map((img, idx) => (
                  <div
                    key={`${img.url}-${idx}`}
                    className={`gallery-group-detail-process-item${
                      detailDragOver === idx ? ' gallery-group-detail-process-item--drop' : ''
                    }${
                      !detailEditOrder && detailLiveItem.finalImageIndex < 0
                        ? ' gallery-group-detail-process-item--promote-source'
                        : ''
                    }`}
                    draggable={detailEditOrder || (!detailEditOrder && detailLiveItem.finalImageIndex < 0)}
                    onDragStart={(e) => {
                      if (detailEditOrder) {
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', String(idx))
                        return
                      }
                      if (detailLiveItem.finalImageIndex >= 0) return
                      e.dataTransfer.effectAllowed = 'copy'
                      e.dataTransfer.setData(PROMOTE_FINAL_MIME, String(idx))
                    }}
                    onDragOver={(e) => {
                      if (!detailEditOrder) return
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      setDetailDragOver(idx)
                    }}
                    onDragLeave={() => {
                      setDetailDragOver((v) => (v === idx ? null : v))
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const from = Number.parseInt(e.dataTransfer.getData('text/plain'), 10)
                      const to = idx
                      if (!Number.isFinite(from) || from < 0 || from === to) {
                        setDetailDragOver(null)
                        return
                      }
                      setDetailProcessImages((prev) => {
                        if (from >= prev.length || to >= prev.length) return prev
                        const next = [...prev]
                        const tmp = next[from]
                        next[from] = next[to]
                        next[to] = tmp
                        return next
                      })
                      setDetailDragOver(null)
                    }}
                    onDragEnd={() => {
                      setDetailDragOver(null)
                      setDetailDragOverFinal(false)
                    }}
                  >
                    {detailEditOrder ? (
                      <span className="gallery-group-detail-dnd-handle" aria-hidden>
                        ⠿
                      </span>
                    ) : null}
                    <div className="gallery-group-detail-process-body">
                      {detailEditOrder ? (
                        <img src={img.url} alt="" className="gallery-group-detail-process-img" draggable={false} />
                      ) : (
                        <button
                          type="button"
                          className="gallery-group-detail-process-img-btn"
                          onClick={() => {
                            const gi = resolveProcessImageGlobalIndex(detailLiveItem, img)
                            if (gi < 0) return
                            openLightbox(img.url, detailLiveItem.id, gi)
                          }}
                        >
                          <img src={img.url} alt="" className="gallery-group-detail-process-img" draggable={false} />
                        </button>
                      )}
                      <div className="gallery-group-detail-process-meta">
                        <span className="gallery-group-detail-process-ord">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="gallery-group-detail-process-stamp">{stampFromDate(img)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="gallery-group-detail-add"
                  onClick={() => detailFileInputRef.current?.click()}
                >
                  {t.gallery.addProcessShot}
                </button>
              </>
            ) : null}

            {onAppendFeedbackCard ? (
              <>
                <div className="gallery-detail-feedback-rule" aria-hidden />
                <section className="gallery-detail-feedback" aria-label={t.gallery.detailFeedbackSectionAria}>
                  <div className="gallery-detail-feedback-box">
                    <div className="gallery-detail-feedback-head">
                      <span className="gallery-detail-feedback-label">{t.feedback.label}</span>
                      <span
                        className={`gallery-detail-feedback-count${
                          detailFeedbackDraft.length > 20 ? ' gallery-detail-feedback-count--warn' : ''
                        }`}
                      >
                        {detailFeedbackDraft.length} / 20
                      </span>
                    </div>
                    <textarea
                      className="gallery-detail-feedback-input"
                      value={detailFeedbackDraft}
                      onChange={(e) => setDetailFeedbackDraft(e.target.value)}
                      maxLength={20}
                      rows={2}
                      placeholder={t.feedback.placeholder}
                      aria-label={t.common.feedbackInputAria}
                    />
                    <p className="gallery-detail-feedback-hint">{t.feedback.hint}</p>
                    <button
                      type="button"
                      className="gallery-detail-feedback-save"
                      disabled={!detailFeedbackDraft.trim()}
                      onClick={handleSaveDetailFeedback}
                    >
                      {t.feedback.saveBtn}
                    </button>
                  </div>
                </section>
              </>
            ) : null}
          </div>
          {feedbackSavedToast ? (
            <div className="gallery-detail-feedback-toast" role="status">
              {t.gallery.feedbackSavedToast}
            </div>
          ) : null}
        </div>
      ) : null}

      {lightbox ? (
        <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={t.common.imageViewerAria}>
          <div className="gallery-lightbox-toolbar">
            <button
              type="button"
              className={`gallery-lightbox-pin${lightboxPinned ? ' gallery-lightbox-pin--on' : ''}`}
              aria-pressed={lightboxPinned}
              aria-label={lightboxPinned ? t.common.unpinImage : t.common.pinImage}
              onClick={handleLightboxPinClick}
            >
              <PinIcon />
            </button>
            <div className="gallery-lightbox-toolbar-end">
              {onRemoveGalleryImage ? (
                <button
                  type="button"
                  className="gallery-lightbox-delete"
                  aria-label={t.common.deleteImage}
                  onClick={handleLightboxDelete}
                >
                  <TrashIcon />
                </button>
              ) : null}
              <button
                type="button"
                className="gallery-lightbox-close"
                onClick={closeLightbox}
                aria-label={t.common.close}
              >
                ✕
              </button>
            </div>
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
            <p className="gallery-dnd-hint">
              {t.gallery.dndHintLine1}
              <br />
              <strong className="gallery-dnd-hint-strong">{t.gallery.process}</strong>
              {t.gallery.dndHintLine2}
            </p>
          ) : null}
        </div>
      </header>

      <div className="gallery-body">
        <div className={`gallery-scroll${isEmpty ? ' gallery-scroll--empty' : ''}`}>
          {isEmpty ? (
            <div className="gallery-empty">
              <GalleryLogoMark />
              <div className="gallery-empty-lines">
                <p className="gallery-empty-text">{t.gallery.noItems}</p>
                <p className="gallery-empty-hint">{t.gallery.noItemsSub}</p>
              </div>
              <button
                type="button"
                className="gallery-ref-folder-card gallery-ref-folder-card--empty"
                onClick={() => onOpenReferenceFolder?.()}
              >
                <span className="gallery-ref-folder-card-icon-wrap" aria-hidden>
                  <ReferenceFolderIcon className="gallery-ref-folder-card-icon" />
                </span>
                <span className="gallery-ref-folder-card-text">
                  <span className="gallery-ref-folder-card-title">{t.gallery.reference}</span>
                  <span className="gallery-ref-folder-card-desc">{t.gallery.refCardDescEmpty}</span>
                </span>
                <span className="gallery-ref-folder-card-arrow" aria-hidden />
              </button>
            </div>
          ) : (
            <div
              className={`gallery-month-picker-root${showMonthPicker ? ' gallery-month-picker-root--open' : ''}`}
            >
              {showMonthPicker ? (
                <div
                  className="gallery-month-picker-overlay"
                  role="presentation"
                  aria-hidden
                  onClick={() => setShowMonthPicker(false)}
                />
              ) : null}
              <section className="gallery-month-block">
                <div className="gallery-month-head">
                  <div className="gallery-month-picker-anchor">
                    <div className="gallery-month-top-row">
                      <button
                        type="button"
                        className="gallery-month-label-btn"
                        aria-expanded={showMonthPicker}
                        aria-haspopup="listbox"
                        aria-label={t.common.monthPickAria}
                        onClick={() => setShowMonthPicker((v) => !v)}
                      >
                        <span className="gallery-month-label-btn-text">
                          {formatSectionMonthLabel(selectedMonthKey)}
                        </span>
                        <svg
                          className="gallery-month-label-chevron"
                          viewBox="0 0 10 7"
                          width={10}
                          height={7}
                          aria-hidden
                        >
                          <path d="M0 0L10 0L5 7z" fill="currentColor" />
                        </svg>
                      </button>
                      <div
                        className="gallery-month-filters"
                        role="radiogroup"
                        aria-label={`${formatSectionMonthLabel(selectedMonthKey)} 보기`}
                      >
                        {[
                          { id: 'all', label: t.gallery.tags.all },
                          { id: 'general', label: t.gallery.filterGeneral },
                          { id: 'process', label: t.gallery.process },
                        ].map(({ id, label }) => (
                          <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={selectedMonthFilter === id}
                            className={`gallery-month-filter${selectedMonthFilter === id ? ' gallery-month-filter--on' : ''}`}
                            onClick={() =>
                              setMonthFilters((prev) => ({ ...prev, [selectedMonthKey]: id }))
                            }
                          >
                            <span className="gallery-month-filter-check" aria-hidden />
                            <span className="gallery-month-filter-text">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {showMonthPicker ? (
                      <div className="gallery-month-picker-popup" role="listbox" aria-label={t.common.monthPickAria}>
                        {pickerMonthKeys.map((key) => {
                          const selected = key === selectedMonthKey
                          return (
                            <button
                              key={key}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              className={`gallery-month-picker-item${selected ? ' gallery-month-picker-item--selected' : ''}`}
                              onClick={() => {
                                setSelectedMonthKey(key)
                                setShowMonthPicker(false)
                              }}
                            >
                              <span className="gallery-month-picker-item-inner">
                                {selected ? (
                                  <span className="gallery-month-picker-dot" aria-hidden>
                                    ●
                                  </span>
                                ) : (
                                  <span className="gallery-month-picker-dot-spacer" aria-hidden />
                                )}
                                <span className="gallery-month-picker-item-label">{key}</span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="gallery-ref-folder-card"
                    onClick={() => onOpenReferenceFolder?.()}
                  >
                    <span className="gallery-ref-folder-card-icon-wrap" aria-hidden>
                      <ReferenceFolderIcon className="gallery-ref-folder-card-icon" />
                    </span>
                    <span className="gallery-ref-folder-card-text">
                      <span className="gallery-ref-folder-card-title">{t.gallery.reference}</span>
                      <span className="gallery-ref-folder-card-desc">{t.gallery.refCardDescMain}</span>
                    </span>
                    <span className="gallery-ref-folder-card-arrow" aria-hidden />
                  </button>
                </div>
                <div className="gallery-card-list">
                  {visibleItemsForSelectedMonth.length === 0 ? (
                    <p className="gallery-month-filter-empty" role="status">
                      {t.gallery.filterEmpty}
                    </p>
                  ) : null}
                  {visibleItemsForSelectedMonth.map((item) => (
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
                          onOpenGalleryDetail={openGalleryDetail}
                          t={t}
                        />
                      ) : (
                        <SingleGalleryCard
                          item={item}
                          pinnedKeySet={pinnedKeySet}
                          onOpenGalleryDetail={openGalleryDetail}
                          onRemoveGalleryImage={onRemoveGalleryImage}
                          t={t}
                        />
                      )}
                    </DraggableGalleryRow>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>

      </div>

      <nav className="gallery-nav" aria-label={t.common.bottomNavAria}>
        <button type="button" className="gallery-nav-item" onClick={() => onTabChange?.('tracker')}>
          <span className="gallery-nav-icon" aria-hidden>
            <NavIconTracker />
          </span>
          {t.nav.tracker}
        </button>
        {features.goalScreen ? (
          <button type="button" className="gallery-nav-item" onClick={() => onTabChange?.('goal')}>
            <span className="gallery-nav-icon" aria-hidden>
              <NavIconGoal />
            </span>
            {t.nav.goal}
          </button>
        ) : null}
        <button type="button" className="gallery-nav-item gallery-nav-item--active">
          <span className="gallery-nav-icon" aria-hidden>
            <NavIconGallery />
          </span>
          {t.nav.gallery}
        </button>
        <button type="button" className="gallery-nav-item" onClick={() => onTabChange?.('settings')}>
          <span className="gallery-nav-icon" aria-hidden>
            <NavIconSettings />
          </span>
          {t.nav.setting}
        </button>
      </nav>

      {pinLimitToastOpen ? (
        <div
          className={`gallery-pin-limit-toast${pinLimitToastIn ? ' gallery-pin-limit-toast--in' : ''}`}
          role="status"
          aria-live="polite"
        >
          <div className="gallery-pin-limit-toast-lines">
            <span className="gallery-pin-limit-toast-line">{t.gallery.pinToastLine1}</span>
            <span className="gallery-pin-limit-toast-line">
              {t.gallery.pinToastLine2.replace('{n}', String(MAX_GALLERY_PINS))}
            </span>
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
 *   t: import('./locales/ko.js').ko
 * }} props
 */
function FinalProcessBlock({
  item,
  onOpenImage,
  showFinalBadge = false,
  shellClassName = 'gallery-card-grouped',
  pinnedKeySet = new Set(),
  presentationOnly = false,
  t,
}) {
  const fi = item.finalImageIndex
  const hasFinal = fi >= 0 && fi < item.images.length && item.images[fi]
  const final = hasFinal ? item.images[fi] : null
  const processIdxs = hasFinal
    ? item.images.map((_, i) => i).filter((i) => i !== fi)
    : item.images.map((_, i) => i)
  const thumbs = processIdxs.slice(0, 2)
  const extra = processIdxs.length - 2

  const isIdxPinned = (idx) => pinnedKeySet.has(galleryImagePinKey(item.id, idx))
  const finalPinned = hasFinal && isIdxPinned(fi)

  const finalInner = hasFinal ? (
    <>
      <img src={final.url} alt="" className="gallery-card-grouped-final-img" draggable={false} />
      {finalPinned ? <GalleryPinCornerBadge /> : null}
      {showFinalBadge ? <span className="gallery-badge-final">{t.gallery.badgeFinal}</span> : null}
      <span className="gallery-card-stamp-bl">{stampFromDate(final)}</span>
    </>
  ) : (
    <>
      <div className="gallery-card-grouped-final-placeholder" aria-hidden>
        <span className="gallery-card-grouped-final-placeholder-icon">+</span>
        <span className="gallery-card-grouped-final-placeholder-text">{t.gallery.placeholderFinal}</span>
      </div>
      {showFinalBadge ? (
        <span className="gallery-badge-final gallery-badge-final--muted">{t.gallery.badgeAwaiting}</span>
      ) : null}
    </>
  )

  const finalShellClass = `gallery-card-grouped-final${finalPinned ? ' gallery-card-grouped-final--pinned' : ''}${
    !hasFinal ? ' gallery-card-grouped-final--empty' : ''
  }`

  return (
    <div className={shellClassName}>
      {presentationOnly ? (
        <div className={finalShellClass} aria-hidden>
          {finalInner}
        </div>
      ) : hasFinal ? (
        <button
          type="button"
          className={finalShellClass}
          onClick={() => onOpenImage(final.url, fi)}
          aria-label={showFinalBadge ? t.gallery.openFinalAria : t.gallery.openHeroAria}
        >
          {finalInner}
        </button>
      ) : (
        <div className={finalShellClass} aria-hidden>
          {finalInner}
        </div>
      )}
      {processIdxs.length > 0 ? (
        <div className="gallery-process-bar">
          <span className="gallery-process-label">{t.gallery.processStripLabel}</span>
          <div className="gallery-process-thumbs">
            {extra > 0 ? (
              <span className="gallery-process-more" aria-label={t.gallery.moreImagesAria.replace('{n}', String(extra))}>
                +{extra}
              </span>
            ) : null}
            {thumbs.map((idx) => {
              const thumbPinned = isIdxPinned(idx)
              return presentationOnly ? (
                <div
                  key={idx}
                  className={`gallery-process-thumb${thumbPinned ? ' gallery-process-thumb--pinned' : ''}`}
                  aria-hidden
                >
                  {thumbPinned ? <GalleryPinCornerBadge small /> : null}
                  <img src={item.images[idx].url} alt="" draggable={false} />
                </div>
              ) : (
                <button
                  key={idx}
                  type="button"
                  className={`gallery-process-thumb${thumbPinned ? ' gallery-process-thumb--pinned' : ''}`}
                  onClick={() => onOpenImage(item.images[idx].url, idx)}
                  aria-label={t.gallery.openProcessAria}
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
 *   onOpenGalleryDetail: (item: NonNullable<ReturnType<typeof normalizeGalleryItem>>) => void
 *   onRemoveGalleryImage?: (itemId: string, imageIndex: number) => void
 *   t: import('./locales/ko.js').ko
 * }} props
 */
function SingleGalleryCard({ item, onOpenGalleryDetail, onRemoveGalleryImage, pinnedKeySet = new Set(), t }) {
  const heroIdx = item.images[item.finalImageIndex] != null ? item.finalImageIndex : 0
  const hero = item.images[heroIdx]
  const heroPinned = pinnedKeySet.has(galleryImagePinKey(item.id, heroIdx))

  return (
    <div className="gallery-card-single-outer">
      <button
        type="button"
        className={`gallery-card-single${heroPinned ? ' gallery-card-single--pinned' : ''}`}
        onClick={() => onOpenGalleryDetail(item)}
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
          aria-label={t.common.deleteImageTestAria}
          onClick={(e) => {
            e.stopPropagation()
            onRemoveGalleryImage(item.id, heroIdx)
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
 *   onOpenGalleryDetail: (item: NonNullable<ReturnType<typeof normalizeGalleryItem>>) => void
 *   t: import('./locales/ko.js').ko
 * }} props
 */
function GroupedCard({ item, pinnedKeySet, onOpenGalleryDetail, t }) {
  return (
    <div
      className="gallery-card-grouped gallery-card-grouped--detail-entry"
      role="button"
      tabIndex={0}
      onClick={() => onOpenGalleryDetail(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenGalleryDetail(item)
        }
      }}
    >
      <FinalProcessBlock
        item={item}
        pinnedKeySet={pinnedKeySet}
        onOpenImage={() => {}}
        showFinalBadge
        presentationOnly
        shellClassName="gallery-card-grouped-inner"
        t={t}
      />
    </div>
  )
}
