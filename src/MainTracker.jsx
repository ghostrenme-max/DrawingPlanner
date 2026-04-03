import { useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from './contexts/LanguageContext.js'
import { DEFAULT_APP_FEATURES } from './appFeatures.js'
import { applyGoalDisplayBreaks, splitGoalHeaderParagraphs } from './goalConfig.js'
import BrandWordmark from './BrandWordmark'
import { NavIconGallery, NavIconGoal, NavIconSettings, NavIconTracker } from './bottomNavIcons.jsx'
import PlusIcon from './PlusIcon'
import { readCarryProcessedYm, writeCarryProcessedYm } from './trackerPersistence.js'
import { prevYm, ymFromDate } from './trackerMonth.js'
import './MainTracker.css'

/**
 * @param {unknown[]} prevCards
 * @param {string} currentYm
 */
function applyCarryOver(prevCards, currentYm) {
  const p = prevYm(currentYm)
  const incomplete = prevCards.filter((c) => c.activeMonthYm === p && c.percent < 100)
  if (incomplete.length === 0) return prevCards
  const nowTs = Date.now()
  const additions = incomplete.map((c, i) => ({
    ...c,
    id: `co-${c.id}-${currentYm}-${nowTs}-${i}`,
    isCarryOver: true,
    isKeyCard: false,
    carriedFromYm: p,
    activeMonthYm: currentYm,
    barIntroNonce: nowTs + i * 0.001,
  }))
  const kept = prevCards.filter((c) => !(c.activeMonthYm === p && c.percent < 100))
  return [...kept, ...additions]
}

/**
 * 저장 배열 순서 기준, 이번 달에 해당하는 첫 카드 id (이월이면 그다음 일반 카드)
 * @param {unknown[]} cards
 * @param {string[]} monthlyGoals
 * @returns {string | null}
 */
function resolveKeyCardId(cards, monthlyGoals) {
  const now = new Date()
  const currentYm = ymFromDate(now)
  const mi = now.getMonth()
  const keyText = (monthlyGoals[mi] ?? '').trim()
  if (!keyText) return null
  const firstInStorage = cards.find((c) => c.activeMonthYm === currentYm)
  if (!firstInStorage) return null
  if (!firstInStorage.isCarryOver) return firstInStorage.id
  const pool = cards.filter((c) => c.activeMonthYm === currentYm)
  const fallback = pool.find((c) => !c.isCarryOver)
  return fallback?.id ?? null
}

/**
 * @param {unknown[]} cards
 * @param {string[]} monthlyGoals
 * @returns {{ card: Record<string, unknown>; kind: 'key' | 'carry' | 'normal'; keyGoalText?: string }[]}
 */
function buildTrackerDisplayEntries(cards, monthlyGoals) {
  const now = new Date()
  const currentYm = ymFromDate(now)
  const mi = now.getMonth()
  const keyText = (monthlyGoals[mi] ?? '').trim()
  const keyId = resolveKeyCardId(cards, monthlyGoals)

  const pool = cards.filter((c) => c.activeMonthYm === currentYm)
  const orderIndex = (id) => {
    const i = cards.findIndex((c) => c.id === id)
    return i === -1 ? 9999 : i
  }

  const keyCard = keyId ? cards.find((c) => c.id === keyId) ?? null : null

  const carries = [...pool.filter((c) => c.isCarryOver)].sort(
    (a, b) => orderIndex(a.id) - orderIndex(b.id),
  )
  const rest = [...pool.filter((c) => {
    if (keyCard && c.id === keyCard.id) return false
    if (c.isCarryOver) return false
    return true
  })].sort((a, b) => orderIndex(a.id) - orderIndex(b.id))

  /** @type {{ card: Record<string, unknown>; kind: 'key' | 'carry' | 'normal'; keyGoalText?: string }[]} */
  const entries = []
  if (keyCard) entries.push({ card: keyCard, kind: 'key', keyGoalText: keyText })
  for (const c of carries) entries.push({ card: c, kind: 'carry' })
  for (const c of rest) entries.push({ card: c, kind: 'normal' })
  return entries
}

/** @param {Record<string, unknown>} card @param {{ id: string; label: string }} stageDef */
function getStageLabel(card, stageDef) {
  const sl = card.stageLabels
  if (sl && typeof sl === 'object' && !Array.isArray(sl)) {
    const v = sl[stageDef.id]
    if (typeof v === 'string' && v.trim()) return v
  }
  return stageDef.label
}

/** @param {string} cardId @param {Record<string, boolean>} stageDone @param {Record<string, unknown>} card @param {{ id: string }[]} stages */
function countCheckedStages(cardId, stageDone, card, stages) {
  if (card.workFinalized) return stages.length
  return stages.filter((st) => stageDone[`${cardId}-${st.id}`]).length
}

/** @param {Record<string, unknown>} card @param {Record<string, boolean>} stageDone @param {{ id: string }[]} stages */
function cardProgressPercent(card, stageDone, stages) {
  if (card.workFinalized) return 100
  const n = stages.filter((st) => stageDone[`${card.id}-${st.id}`]).length
  return Math.round((n / stages.length) * 100)
}

function formatYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

/** 카드 헤더 인트로(틱 변경 시) — % 숫자·바와 동기 */
const MT_HEADER_BAR_MS = 980
/** 스테이지 토글·완성 확정 시 바·숫자 동기 */
const MT_LIVE_BAR_MS = 400

/** @param {{ displayTag: string; targetPct: number; cardKind: 'normal' | 'key' | 'carry'; replayKey: number; introNonce: number; barSubTone?: boolean; keyCardLabel: string; carryLabel: string }} props */
function CardHeadProgress({
  displayTag,
  targetPct,
  cardKind,
  replayKey,
  introNonce,
  barSubTone = false,
  keyCardLabel,
  carryLabel,
}) {
  const tickKey = `${replayKey}-${introNonce}`
  const [barOn, setBarOn] = useState(false)
  const [pctDisplay, setPctDisplay] = useState(0)
  const [barMs, setBarMs] = useState(MT_HEADER_BAR_MS)
  const [barEasing, setBarEasing] = useState('cubic-bezier(0.22, 1, 0.36, 1)')
  const prevTickKeyRef = useRef(null)
  const pctDisplayRef = useRef(0)
  pctDisplayRef.current = pctDisplay

  useEffect(() => {
    const tickChanged = prevTickKeyRef.current !== tickKey
    prevTickKeyRef.current = tickKey

    const easeOut = (x) => 1 - (1 - x) ** 2
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    const from = tickChanged ? 0 : pctDisplayRef.current
    const to = targetPct
    const dur = tickChanged ? MT_HEADER_BAR_MS : MT_LIVE_BAR_MS

    if (!tickChanged && from === to) {
      setBarOn(true)
      setPctDisplay(to)
      return
    }

    setBarMs(dur)
    setBarEasing(tickChanged ? 'cubic-bezier(0.22, 1, 0.36, 1)' : 'ease-out')

    if (reduced) {
      setPctDisplay(to)
      if (tickChanged) {
        setBarOn(false)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setBarOn(true))
        })
      } else {
        setBarOn(true)
      }
      return
    }

    let cancelled = false
    let raf = 0

    const runNumberAnim = () => {
      const t0 = performance.now()
      const step = (now) => {
        if (cancelled) return
        const t = Math.min(1, (now - t0) / dur)
        setPctDisplay(Math.round(from + easeOut(t) * (to - from)))
        if (t < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }

    if (tickChanged) {
      setBarOn(false)
      setPctDisplay(0)
      let id2 = 0
      const id1 = requestAnimationFrame(() => {
        id2 = requestAnimationFrame(() => {
          if (cancelled) return
          setBarOn(true)
          runNumberAnim()
        })
      })
      return () => {
        cancelled = true
        cancelAnimationFrame(id1)
        cancelAnimationFrame(id2)
        cancelAnimationFrame(raf)
      }
    }

    setBarOn(true)
    runNumberAnim()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [tickKey, targetPct])

  let fillClass =
    cardKind === 'normal'
      ? 'mt-card-bar-fill'
      : cardKind === 'carry'
        ? 'mt-card-bar-fill mt-card-bar-fill--carry'
        : 'mt-card-bar-fill mt-card-bar-fill--key'
  if (cardKind === 'normal' && barSubTone) {
    fillClass = `${fillClass} mt-card-bar-fill--teal`
  }

  return (
    <>
      <div className="mt-card-row">
        <span className="mt-card-tag-cluster">
          {cardKind === 'key' ? (
            <span className="mt-card-badge mt-card-badge--key" aria-hidden>
              {keyCardLabel}
            </span>
          ) : null}
          <span className="mt-card-tag">{displayTag}</span>
          {cardKind === 'carry' ? (
            <span className="mt-card-badge mt-card-badge--carry" aria-hidden>
              {carryLabel}
            </span>
          ) : null}
        </span>
        <span className="mt-card-pct">{pctDisplay}%</span>
      </div>
      <div className="mt-card-bar">
        <div
          className={`${fillClass}${barOn ? ' mt-card-bar-fill--active' : ''}`}
          style={{
            '--mt-card-target-pct': `${targetPct}%`,
            transition: `width ${barMs}ms ${barEasing}`,
          }}
        />
      </div>
    </>
  )
}

/**
 * @param {{ workTitle: string; title?: string; displayTag?: string }} card
 * @param {{ workTitle: string }} f
 */
function feedbackMatchesTrackerCard(card, f) {
  const wt = f.workTitle
  if (!wt) return false
  if (wt === card.title) return true
  if (wt === card.displayTag) return true
  return false
}

function FeedbackExportIcon({ className = '' }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 3h6v6M10 14L21 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const FB_SWIPE_REMOVE_PX = 84
const FB_SWIPE_MAX_DRAG = 140
const FB_SWIPE_SLOP = 14

/**
 * @param {{
 *   card: Record<string, unknown>
 *   onRemove?: (id: number) => void
 *   onToggleConfirmed?: (id: number) => void
 *   onPreviewImage?: (url: string, feedbackText: string) => void
 *   feedbackStrings: { titleTpl: string; workFallback: string; swipeAria: string; galleryLinkAria: string; highlightOnAria: string; highlightOffAria: string; deleteAria: string }
 * }} props
 */
function TrackerFeedbackCard({ card, onRemove, onToggleConfirmed, onPreviewImage, feedbackStrings }) {
  const work =
    typeof card.workTitle === 'string' && card.workTitle.trim()
      ? card.workTitle.trim()
      : feedbackStrings.workFallback
  const title = feedbackStrings.titleTpl.replace('{work}', work)
  const id = typeof card.id === 'number' ? card.id : Number(card.id)
  const previewUrl = typeof card.previewImageUrl === 'string' ? card.previewImageUrl : ''
  const hasPreview = Boolean(previewUrl)
  const feedbackText = typeof card.text === 'string' ? card.text : ''
  const confirmed = Boolean(card.confirmed)

  const [translateX, setTranslateX] = useState(0)
  const [surfaceTransition, setSurfaceTransition] = useState(false)
  const translateXRef = useRef(0)
  const gestureRef = useRef({
    startX: 0,
    startY: 0,
    active: false,
    horizontal: false,
  })

  const setTx = (x) => {
    translateXRef.current = x
    setTranslateX(x)
  }

  const resetGestureRef = () => {
    gestureRef.current = { startX: 0, startY: 0, active: false, horizontal: false }
  }

  useEffect(() => {
    if (!confirmed) {
      translateXRef.current = 0
      setTranslateX(0)
      setSurfaceTransition(false)
      resetGestureRef()
    }
  }, [confirmed])

  const onTouchStart = (e) => {
    if (!confirmed) return
    const t = e.touches[0]
    if (!t) return
    gestureRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      active: true,
      horizontal: false,
    }
    setSurfaceTransition(false)
  }

  const onTouchMove = (e) => {
    if (!confirmed || !gestureRef.current.active) return
    const t = e.touches[0]
    if (!t) return
    const dx = t.clientX - gestureRef.current.startX
    const dy = t.clientY - gestureRef.current.startY

    if (!gestureRef.current.horizontal) {
      if (Math.abs(dx) >= FB_SWIPE_SLOP && Math.abs(dx) > Math.abs(dy) * 1.12) {
        gestureRef.current.horizontal = true
      } else if (Math.abs(dy) >= FB_SWIPE_SLOP && Math.abs(dy) >= Math.abs(dx)) {
        gestureRef.current.active = false
        return
      } else {
        return
      }
    }

    if (dx <= 0) {
      setTx(Math.max(dx, -FB_SWIPE_MAX_DRAG))
    } else {
      setTx(Math.min(dx * 0.4, 0))
    }
  }

  const finishSwipe = () => {
    if (!confirmed) return
    const was = gestureRef.current
    resetGestureRef()

    if (!was.active || !was.horizontal) {
      if (translateXRef.current !== 0) {
        setSurfaceTransition(true)
        setTx(0)
        window.setTimeout(() => setSurfaceTransition(false), 220)
      }
      return
    }

    const x = translateXRef.current
    if (x <= -FB_SWIPE_REMOVE_PX && Number.isFinite(id)) {
      onRemove?.(id)
      setTx(0)
      return
    }
    setSurfaceTransition(true)
    setTx(0)
    window.setTimeout(() => setSurfaceTransition(false), 220)
  }

  const surfaceStyle = {
    transform: `translateX(${translateX}px)`,
    transition: surfaceTransition ? 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
  }

  return (
    <div
      className={`mt-feedback-card-wrap${confirmed ? ' mt-feedback-card-wrap--swipeable' : ''}`}
      role="status"
      aria-label={confirmed ? feedbackStrings.swipeAria : undefined}
    >
      <div
        className={`mt-feedback-card${confirmed ? ' mt-feedback-card--main' : ''} mt-feedback-card--surface`}
        style={surfaceStyle}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={finishSwipe}
        onTouchCancel={finishSwipe}
      >
        <div className="mt-feedback-card__bar" aria-hidden />
        <div className="mt-feedback-card__inner">
          <div className="mt-feedback-card__row">
            <span className="mt-feedback-card__title">{title}</span>
            <span className="mt-feedback-card__date">{card.date}</span>
          </div>
          <p className="mt-feedback-card__text">{card.text}</p>
          <div className="mt-feedback-card__actions">
            <button
              type="button"
              className="mt-feedback-card__icon-btn mt-feedback-card__export-btn"
              disabled={!hasPreview}
              aria-label={feedbackStrings.galleryLinkAria}
              onClick={() => {
                if (hasPreview) onPreviewImage?.(previewUrl, feedbackText)
              }}
            >
              <FeedbackExportIcon className="mt-feedback-card__export-svg" />
            </button>
            <button
              type="button"
              className="mt-feedback-card__icon-btn mt-feedback-card__check-btn"
              aria-pressed={confirmed}
              aria-label={confirmed ? feedbackStrings.highlightOffAria : feedbackStrings.highlightOnAria}
              onClick={() => {
                if (Number.isFinite(id)) onToggleConfirmed?.(id)
              }}
            >
              ✓
            </button>
            <button
              type="button"
              className="mt-feedback-card__icon-btn mt-feedback-card__dismiss-btn"
              aria-label={feedbackStrings.deleteAria}
              onClick={() => {
                if (Number.isFinite(id)) onRemove?.(id)
              }}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MainTracker({
  onTabChange,
  onAddGalleryItem,
  trackerBarReplayKey = 0,
  features = DEFAULT_APP_FEATURES,
  showGoal1yTipCard = false,
  showGoal1ySampleFixed = false,
  showGoal1yPinned = false,
  onConfirmGoal1yTip,
  onDismissGoal1yTip,
  goal1yValue = '',
  onGoal1yChange,
  monthlyGoals = Array.from({ length: 12 }, () => ''),
  trackerCards = [],
  onTrackerCardsChange = () => {},
  feedbackCards = [],
  onRemoveFeedbackCard,
  onToggleFeedbackCardConfirmed,
}) {
  const { t } = useLang()
  const STAGES = useMemo(
    () => [
      { id: 's1', label: t.tracker.stages.sketch },
      { id: 's2', label: t.tracker.stages.line },
      { id: 's3', label: t.tracker.stages.color },
    ],
    [t],
  )
  const feedbackStrings = useMemo(
    () => ({
      titleTpl: t.tracker.feedbackCardTitle,
      workFallback: t.common.workFallback,
      swipeAria: t.tracker.feedbackSwipeAria,
      galleryLinkAria: t.tracker.feedbackGalleryLinkAria,
      highlightOnAria: t.tracker.feedbackHighlightOnAria,
      highlightOffAria: t.tracker.feedbackHighlightOffAria,
      deleteAria: t.tracker.feedbackDeleteAria,
    }),
    [t],
  )
  const [expandedId, setExpandedId] = useState(
    () => trackerCards[0]?.id ?? '1',
  )
  const [cardImages, setCardImages] = useState({})
  const [stageDone, setStageDone] = useState({})
  const stageDoneRef = useRef(stageDone)
  stageDoneRef.current = stageDone
  const prevStageFillCountRef = useRef({})
  const [completeBtnGlowOnce, setCompleteBtnGlowOnce] = useState({})
  const [hdrBarActive, setHdrBarActive] = useState(false)
  const [hdrPctDisplay, setHdrPctDisplay] = useState(0)
  const [gallerySentOpen, setGallerySentOpen] = useState(false)
  const [galleryNeedImagesHint, setGalleryNeedImagesHint] = useState(false)
  const [feedbackPreview, setFeedbackPreview] = useState(
    /** @type {{ src: string; text: string } | null} */ (null),
  )
  const [editingStageId, setEditingStageId] = useState(/** @type {string | null} */ (null))
  const [stageLabelDraft, setStageLabelDraft] = useState('')
  const fileInputRef = useRef(null)
  const pendingCardIdRef = useRef(null)
  const gallerySentTimerRef = useRef(0)
  const galleryNeedImagesTimerRef = useRef(0)

  const overallPct = 64

  const displayEntries = useMemo(
    () => buildTrackerDisplayEntries(trackerCards, monthlyGoals),
    [trackerCards, monthlyGoals],
  )

  useEffect(() => {
    for (const card of trackerCards) {
      const n = countCheckedStages(card.id, stageDone, card, STAGES)
      const cid = card.id
      const prev = prevStageFillCountRef.current[cid]
      if (prev === undefined) {
        prevStageFillCountRef.current[cid] = n
        continue
      }
      if (n === STAGES.length && !card.workFinalized && prev < STAGES.length) {
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
        if (!reduced) {
          setCompleteBtnGlowOnce((g) => ({ ...g, [cid]: true }))
        }
      }
      prevStageFillCountRef.current[cid] = n
    }
  }, [trackerCards, stageDone, STAGES])

  /** monthlyGoals / 카드 변경 시 `isKeyCard` 한 장만 true 로 동기화 */
  useEffect(() => {
    const keyId = resolveKeyCardId(trackerCards, monthlyGoals)
    const mismatch = trackerCards.some(
      (c) => Boolean(c.isKeyCard) !== (keyId != null && c.id === keyId),
    )
    if (!mismatch) return
    onTrackerCardsChange((prev) =>
      prev.map((c) => ({ ...c, isKeyCard: keyId != null && c.id === keyId })),
    )
  }, [trackerCards, monthlyGoals, onTrackerCardsChange])

  useEffect(() => {
    const currentYm = ymFromDate(new Date())
    const last = readCarryProcessedYm()
    if (!last) {
      writeCarryProcessedYm(currentYm)
      return
    }
    if (last >= currentYm) return
    onTrackerCardsChange((prev) => applyCarryOver(prev, currentYm))
    writeCarryProcessedYm(currentYm)
  }, [onTrackerCardsChange])

  useEffect(() => {
    if (displayEntries.length === 0) return
    if (!displayEntries.some((e) => e.card.id === expandedId)) {
      setExpandedId(displayEntries[0].card.id)
    }
  }, [displayEntries, expandedId])

  useEffect(() => {
    setEditingStageId(null)
  }, [expandedId])

  useEffect(() => {
    if (!feedbackPreview) return
    const onKey = (e) => {
      if (e.key === 'Escape') setFeedbackPreview(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [feedbackPreview])

  useEffect(() => {
    setHdrBarActive(false)
    setHdrPctDisplay(0)
    let id2 = 0
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setHdrBarActive(true))
    })
    return () => {
      cancelAnimationFrame(id1)
      cancelAnimationFrame(id2)
    }
  }, [trackerBarReplayKey])

  useEffect(() => {
    if (!hdrBarActive) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (reduced) {
      setHdrPctDisplay(overallPct)
      return
    }
    let cancelled = false
    const target = overallPct
    const duration = MT_HEADER_BAR_MS
    const t0 = performance.now()
    const easeOut = (x) => 1 - (1 - x) ** 2
    let raf = 0
    const tick = (now) => {
      if (cancelled) return
      const t = Math.min(1, (now - t0) / duration)
      setHdrPctDisplay(Math.round(easeOut(t) * target))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [hdrBarActive, overallPct])

  useEffect(() => {
    return () => {
      if (gallerySentTimerRef.current) window.clearTimeout(gallerySentTimerRef.current)
      if (galleryNeedImagesTimerRef.current) window.clearTimeout(galleryNeedImagesTimerRef.current)
    }
  }, [])

  const closeGallerySentDialog = () => {
    if (gallerySentTimerRef.current) {
      window.clearTimeout(gallerySentTimerRef.current)
      gallerySentTimerRef.current = 0
    }
    setGallerySentOpen(false)
  }

  const openGallerySentDialog = () => {
    if (gallerySentTimerRef.current) window.clearTimeout(gallerySentTimerRef.current)
    setGallerySentOpen(true)
    gallerySentTimerRef.current = window.setTimeout(() => {
      gallerySentTimerRef.current = 0
      setGallerySentOpen(false)
    }, 2800)
  }

  const dismissGalleryNeedImagesHint = () => {
    if (galleryNeedImagesTimerRef.current) {
      window.clearTimeout(galleryNeedImagesTimerRef.current)
      galleryNeedImagesTimerRef.current = 0
    }
    setGalleryNeedImagesHint(false)
  }

  const showGalleryNeedImagesHint = () => {
    if (galleryNeedImagesTimerRef.current) window.clearTimeout(galleryNeedImagesTimerRef.current)
    setGalleryNeedImagesHint(true)
    galleryNeedImagesTimerRef.current = window.setTimeout(() => {
      galleryNeedImagesTimerRef.current = 0
      setGalleryNeedImagesHint(false)
    }, 3200)
  }

  const onGallerySendClick = (card) => {
    const urls = cardImages[card.id] || []
    if (urls.length === 0) {
      showGalleryNeedImagesHint()
      return
    }
    sendToGallery(card)
  }

  const addNewCard = () => {
    const ym = ymFromDate(new Date())
    onTrackerCardsChange((prev) => {
      const nonce = Date.now() + Math.random()
      const sameMonth = prev.filter((c) => c.activeMonthYm === ym).length
      return [
        ...prev,
        {
          id: `n-${Math.round(nonce)}`,
          displayTag: t.common.newWork,
          title: t.common.newWork,
          percent: 0,
          accent: sameMonth % 2 === 0 ? 'orange' : 'teal',
          barIntroNonce: nonce,
          activeMonthYm: ym,
          isKeyCard: false,
          isCarryOver: false,
          workFinalized: false,
        },
      ]
    })
  }

  const openFilePicker = (cardId) => {
    pendingCardIdRef.current = cardId
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    const cardId = pendingCardIdRef.current
    if (!file || !cardId) return
    const url = URL.createObjectURL(file)
    setCardImages((prev) => {
      const list = [...(prev[cardId] || [])]
      if (list.length < 3) list.push(url)
      return { ...prev, [cardId]: list }
    })
    e.target.value = ''
    pendingCardIdRef.current = null
  }

  const saveStageLabelFromDraft = (card, st) => {
    const trimmed = stageLabelDraft.trim()
    onTrackerCardsChange((prev) =>
      prev.map((c) => {
        if (c.id !== card.id) return c
        const prevSl =
          c.stageLabels && typeof c.stageLabels === 'object' && !Array.isArray(c.stageLabels)
            ? { ...c.stageLabels }
            : {}
        if (trimmed === '' || trimmed === st.label) {
          delete prevSl[st.id]
        } else {
          prevSl[st.id] = trimmed
        }
        const hasAny = Object.keys(prevSl).length > 0
        return { ...c, stageLabels: hasAny ? prevSl : undefined }
      }),
    )
    setEditingStageId(null)
  }

  const toggleStage = (cardId, stageId, card) => {
    const key = `${cardId}-${stageId}`
    const prev = stageDoneRef.current

    if (card.workFinalized) {
      const nextDone = { ...prev }
      for (const st of STAGES) {
        nextDone[`${cardId}-${st.id}`] = true
      }
      nextDone[key] = false
      setStageDone(nextDone)
      const n = STAGES.filter((st) => nextDone[`${cardId}-${st.id}`]).length
      const pct = Math.round((n / STAGES.length) * 100)
      onTrackerCardsChange((cards) =>
        cards.map((c) =>
          c.id === cardId ? { ...c, workFinalized: false, percent: pct } : c,
        ),
      )
      return
    }

    const nextDone = { ...prev, [key]: !prev[key] }
    setStageDone(nextDone)
    const n = STAGES.filter((st) => nextDone[`${cardId}-${st.id}`]).length
    const pct = Math.round((n / STAGES.length) * 100)
    onTrackerCardsChange((cards) =>
      cards.map((c) => (c.id === cardId ? { ...c, percent: pct } : c)),
    )
  }

  const finalizeWork = (cardId) => {
    const card = trackerCards.find((c) => c.id === cardId)
    if (!card || card.workFinalized) return
    setStageDone((prev) => {
      const next = { ...prev }
      for (const st of STAGES) {
        next[`${cardId}-${st.id}`] = true
      }
      return next
    })
    onTrackerCardsChange((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, percent: 100, workFinalized: true } : c,
      ),
    )
  }

  const unfinalizeWork = (cardId) => {
    const card = trackerCards.find((c) => c.id === cardId)
    if (!card?.workFinalized) return
    let n = STAGES.filter((st) => stageDoneRef.current[`${cardId}-${st.id}`]).length
    if (n === 0 && card.percent >= 100) n = STAGES.length
    const pct = Math.round((n / STAGES.length) * 100)
    onTrackerCardsChange((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, workFinalized: false, percent: pct } : c,
      ),
    )
  }

  const toggleCompleteWork = (cardId) => {
    const card = trackerCards.find((c) => c.id === cardId)
    if (!card) return
    if (card.workFinalized) unfinalizeWork(cardId)
    else finalizeWork(cardId)
  }

  const sendToGallery = (card) => {
    const urls = cardImages[card.id] || []
    if (urls.length === 0 || !onAddGalleryItem) return
    const now = new Date()
    const iso = now.toISOString()
    const month = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`
    const base = now.getTime()
    const workTitle = typeof card.title === 'string' && card.title ? card.title : card.displayTag
    urls.forEach((url, i) => {
      onAddGalleryItem({
        id: `${card.id}-${base}-${i}`,
        month,
        images: [{ url, date: iso }],
        grouped: false,
        finalImageIndex: 0,
        createdAt: base + i,
        workTitle: typeof workTitle === 'string' ? workTitle : t.common.workFallback,
        sourceCardId: card.id,
      })
    })
    setCardImages((prev) => ({ ...prev, [card.id]: [] }))
    openGallerySentDialog()
  }

  const todayYmd = formatYmd(new Date())

  return (
    <div className="mt-root">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="mt-file-input"
        onChange={handleFileChange}
      />

      {gallerySentOpen ? (
        <div
          className="mt-sent-overlay"
          role="presentation"
          onClick={closeGallerySentDialog}
        >
          <div
            className="mt-sent-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="mt-sent-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="mt-sent-title" className="mt-sent-title">
              {t.tracker.gallerySentTitle}
            </p>
            <p className="mt-sent-sub">
              {t.tracker.gallerySentBodyLine1}
              <br />
              {t.tracker.gallerySentBodyLine2}
            </p>
            <button type="button" className="mt-sent-ok" onClick={closeGallerySentDialog}>
              {t.common.ok}
            </button>
          </div>
        </div>
      ) : null}

      {feedbackPreview ? (
        <div
          className="mt-feedback-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t.tracker.galleryPreviewAria}
          onClick={() => setFeedbackPreview(null)}
        >
          <div
            className="mt-feedback-preview-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={feedbackPreview.src} alt="" className="mt-feedback-preview-img" draggable={false} />
            <button
              type="button"
              className="mt-feedback-preview-close"
              onClick={() => setFeedbackPreview(null)}
            >
              {t.common.close}
            </button>
            {feedbackPreview.text.trim() ? (
              <p className="mt-feedback-preview-caption">{feedbackPreview.text}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <header className="mt-header">
        <BrandWordmark className="mt-brand" />
        <div className="mt-prog-row">
          <div className="mt-prog-pct">
            {hdrPctDisplay}
            <sup>%</sup>
          </div>
          <div className="mt-prog-meta">
            <span className="mt-date-ymd">{todayYmd}</span>
            <span className="mt-today">{t.tracker.today}</span>
          </div>
        </div>
        <div className="mt-bar">
          <div
            className={`mt-bar-fill${hdrBarActive ? ' mt-bar-fill--hdr-active' : ''}`}
            style={{ '--mt-hdr-pct': `${overallPct}%` }}
          />
        </div>
      </header>

      {showGoal1yTipCard ? (
        <div className="mt-goal-tracker-strip" role="region" aria-label={t.tracker.goalTipRegionAria}>
          <p className="mt-goal-tip-bar-text">
            {t.tracker.goalTipBeforeYear}
            <strong>{t.tracker.goalTipYear}</strong>
            {t.tracker.goalTipMid1}
            <strong>{t.tracker.goalTipConfirm}</strong>
            {t.tracker.goalTipMid2}
            <strong>{t.tracker.goalTipSettings}</strong>
            {t.tracker.goalTipAfterSettings}
          </p>
          <textarea
            className="mt-goal-1y-quick-input"
            value={goal1yValue}
            onChange={(e) => onGoal1yChange?.(e.target.value)}
            placeholder={t.tracker.goal1yQuickPlaceholder}
            rows={2}
            aria-label={t.tracker.goal1yQuickAria}
          />
          <div className="mt-goal-tip-bar-actions">
            <button
              type="button"
              className="mt-goal-tip-bar-btn mt-goal-tip-bar-btn--primary"
              onClick={() => onConfirmGoal1yTip?.()}
            >
              {t.tracker.goalTipConfirm}
            </button>
            <button type="button" className="mt-goal-tip-bar-btn" onClick={() => onDismissGoal1yTip?.()}>
              {t.common.close}
            </button>
          </div>
        </div>
      ) : null}

      {showGoal1ySampleFixed ? (
        <div className="mt-goal-sample-stack" role="status" aria-label={t.tracker.goalSampleAria}>
          {splitGoalHeaderParagraphs(t.goal.trackerSampleText).map((para, i) => (
            <p key={i} className="mt-goal-sample-stack-p">
              {applyGoalDisplayBreaks(para)}
            </p>
          ))}
        </div>
      ) : null}

      {showGoal1yPinned ? (
        <div className="mt-goal-pinned-stack" role="status" aria-label={t.tracker.goalPinnedAria}>
          {splitGoalHeaderParagraphs(goal1yValue).map((para, i) => (
            <p key={i} className="mt-goal-pinned-stack-p">
              {applyGoalDisplayBreaks(para)}
            </p>
          ))}
        </div>
      ) : null}

      <main className="mt-scroll">
        {displayEntries.flatMap(({ card, kind, keyGoalText }) => {
          const expanded = expandedId === card.id
          const urls = cardImages[card.id] || []
          const stageFillCount = countCheckedStages(card.id, stageDone, card, STAGES)
          const completeBtnReady = stageFillCount === STAGES.length && !card.workFinalized
          const cardFeedbacks = feedbackCards.filter((f) => feedbackMatchesTrackerCard(card, f))

          const article = (
            <article
              key={card.id}
              className={`mt-card mt-card--${kind} ${expanded ? 'mt-card--open' : ''}`}
              data-accent={card.accent}
              data-card-type={kind}
              data-key-card={card.isKeyCard ? 'true' : undefined}
            >
              <button
                type="button"
                className="mt-card-head"
                onClick={() => setExpandedId(expanded ? null : card.id)}
              >
                <CardHeadProgress
                  displayTag={card.displayTag}
                  targetPct={cardProgressPercent(card, stageDone, STAGES)}
                  cardKind={kind}
                  replayKey={trackerBarReplayKey}
                  introNonce={card.barIntroNonce ?? 0}
                  barSubTone={kind === 'normal' && Boolean(card.workFinalized)}
                  keyCardLabel={t.tracker.keyCard}
                  carryLabel={t.tracker.carryOver}
                />
              </button>

              {expanded && (
                <div className="mt-card-detail">
                  {kind === 'key' && keyGoalText ? (
                    <p className="mt-card-monthly-goal">
                      {t.goal.thisMonthGoal}: {keyGoalText}
                    </p>
                  ) : null}
                  <div className="mt-stages">
                      {STAGES.map((st) => {
                        const done =
                          Boolean(card.workFinalized) ||
                          Boolean(stageDone[`${card.id}-${st.id}`])
                        const sealed = Boolean(card.workFinalized)
                        const mainStageDone = done && !sealed && kind === 'normal'
                        return (
                          <div
                            key={st.id}
                            className={`mt-detail-row${done ? ' mt-detail-row--done' : ''}${sealed && done ? ' mt-detail-row--sealed' : ''}`}
                          >
                            <button
                              type="button"
                              className={`mt-check ${done ? 'mt-check--on' : ''}${sealed ? ' mt-check--sealed' : ''}${mainStageDone ? ' mt-check--stage-main' : ''}`}
                              onClick={() => toggleStage(card.id, st.id, card)}
                              aria-pressed={done}
                            />
                            {editingStageId === st.id && expandedId === card.id ? (
                              <input
                                type="text"
                                className="mt-detail-stage-input"
                                value={stageLabelDraft}
                                autoFocus
                                onChange={(e) => setStageLabelDraft(e.target.value)}
                                onBlur={() => saveStageLabelFromDraft(card, st)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur()
                                }}
                                aria-label={t.tracker.stageNameAria.replace('{stage}', st.label)}
                              />
                            ) : (
                              <span
                                role="button"
                                tabIndex={0}
                                className="mt-detail-stage-text"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setStageLabelDraft(getStageLabel(card, st))
                                  setEditingStageId(st.id)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    setStageLabelDraft(getStageLabel(card, st))
                                    setEditingStageId(st.id)
                                  }
                                }}
                              >
                                {getStageLabel(card, st)}
                              </span>
                            )}
                          </div>
                        )
                      })}
                      <div
                        className={`mt-complete-block${completeBtnReady ? ' mt-complete-block--ready' : ''}`}
                      >
                        <span className="mt-complete-counter">
                          {t.tracker.completeWithStages
                            .replace('{n}', String(stageFillCount))
                            .replace('{m}', String(STAGES.length))}
                        </span>
                        <button
                          type="button"
                          className={`mt-complete-btn${card.workFinalized ? ' mt-complete-btn--on' : ''}${
                            completeBtnReady ? ' mt-complete-btn--ready' : ''
                          }`}
                          onClick={() => toggleCompleteWork(card.id)}
                          aria-pressed={Boolean(card.workFinalized)}
                        >
                          {completeBtnGlowOnce[card.id] ? (
                            <span
                              className="mt-complete-btn-shimmer"
                              aria-hidden
                              onAnimationEnd={(e) => {
                                if (!e.animationName.includes('mt-complete-shimmer')) return
                                setCompleteBtnGlowOnce((g) =>
                                  g[card.id] ? { ...g, [card.id]: false } : g,
                                )
                              }}
                            />
                          ) : null}
                          <span className="mt-complete-btn-text">
                            {card.workFinalized
                              ? t.tracker.completeDoneWithStages
                                  .replace('{n}', String(stageFillCount))
                                  .replace('{m}', String(STAGES.length))
                              : t.tracker.completeWithStages
                                  .replace('{n}', String(stageFillCount))
                                  .replace('{m}', String(STAGES.length))}
                          </span>
                        </button>
                      </div>
                    </div>

                  <div className="mt-slots">
                      {[0, 1, 2].map((slotIdx) => {
                        const url = urls[slotIdx]
                        if (url) {
                          return (
                            <button
                              key={slotIdx}
                              type="button"
                              className="mt-slot mt-slot--filled"
                              onClick={() => openFilePicker(card.id)}
                            >
                              <img src={url} alt="" />
                            </button>
                          )
                        }
                        return (
                          <button
                            key={slotIdx}
                            type="button"
                            className="mt-slot mt-slot--empty"
                            onClick={() => openFilePicker(card.id)}
                            aria-label={t.common.imageAddAria}
                          >
                            <PlusIcon className="mt-slot-plus" />
                          </button>
                        )
                      })}
                    </div>

                  {features.gallery ? (
                    <button
                      type="button"
                      className={`mt-gallery-send${urls.length === 0 && !card.workFinalized ? ' mt-gallery-send--empty' : ''}`}
                      onClick={() => onGallerySendClick(card)}
                      aria-disabled={urls.length === 0 && !card.workFinalized}
                    >
                      {kind === 'key'
                        ? t.tracker.sendGallerySimple
                        : urls.length === 0 && !card.workFinalized
                          ? t.tracker.sendGallerySimple
                          : t.tracker.sendGallery}
                    </button>
                  ) : null}
                </div>
              )}
            </article>
          )

          if (cardFeedbacks.length === 0) return [article]
          return [
            article,
            ...cardFeedbacks.map((f) => (
              <TrackerFeedbackCard
                key={`fb-${f.id}`}
                card={f}
                onRemove={onRemoveFeedbackCard}
                onToggleConfirmed={onToggleFeedbackCardConfirmed}
                feedbackStrings={feedbackStrings}
                onPreviewImage={(url, text) =>
                  setFeedbackPreview({ src: url, text: typeof text === 'string' ? text : '' })
                }
              />
            )),
          ]
        })}

        <button type="button" className="mt-card-add" onClick={addNewCard}>
          <span className="mt-card-add-label">{t.tracker.addWork}</span>
        </button>
      </main>

      <nav className="mt-nav" aria-label={t.common.bottomNavAria}>
        <button type="button" className="mt-nav-item mt-nav-item--active">
          <span className="mt-nav-icon" aria-hidden>
            <NavIconTracker />
          </span>
          {t.nav.tracker}
        </button>
        {features.goalScreen ? (
          <button type="button" className="mt-nav-item" onClick={() => onTabChange?.('goal')}>
            <span className="mt-nav-icon" aria-hidden>
              <NavIconGoal />
            </span>
            {t.nav.goal}
          </button>
        ) : null}
        {features.gallery ? (
          <button type="button" className="mt-nav-item" onClick={() => onTabChange?.('gallery')}>
            <span className="mt-nav-icon" aria-hidden>
              <NavIconGallery />
            </span>
            {t.nav.gallery}
          </button>
        ) : null}
        <button type="button" className="mt-nav-item" onClick={() => onTabChange?.('settings')}>
          <span className="mt-nav-icon" aria-hidden>
            <NavIconSettings />
          </span>
          {t.nav.setting}
        </button>
      </nav>

      {galleryNeedImagesHint && !gallerySentOpen ? (
        <button
          type="button"
          className="mt-hint-bar"
          role="status"
          aria-live="polite"
          onClick={dismissGalleryNeedImagesHint}
        >
          <span className="mt-hint-bar-text">
            {t.tracker.slotHintLine1}
            <br />
            {t.tracker.slotHintLine2}
          </span>
        </button>
      ) : null}
    </div>
  )
}

export default MainTracker
