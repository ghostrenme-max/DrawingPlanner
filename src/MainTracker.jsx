import { useEffect, useRef, useState } from 'react'
import BrandWordmark from './BrandWordmark'
import PlusIcon from './PlusIcon'
import './MainTracker.css'

const SAMPLE_CARDS = [
  {
    id: '1',
    displayTag: '메인 일러스트',
    title: '메인 일러스트',
    percent: 60,
    accent: 'orange',
  },
  {
    id: '2',
    displayTag: '전신/반신',
    title: '전신/반신',
    percent: 40,
    accent: 'teal',
  },
  {
    id: '3',
    displayTag: 'UI 디자인',
    title: 'UI 디자인',
    percent: 20,
    accent: 'orange',
  },
]

const STAGES = [
  { id: 's1', label: '스케치' },
  { id: 's2', label: '라인' },
  { id: 's3', label: '색' },
  { id: 's4', label: '완성' },
]

function formatYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

/** 상단·카드 가로 바 채움 시간 — % 숫자 카운트와 동기 */
const MT_HEADER_BAR_MS = 980

function CardHeadProgress({ displayTag, targetPct, accent, replayKey, introNonce }) {
  const [barActive, setBarActive] = useState(false)
  const [pctDisplay, setPctDisplay] = useState(0)
  const tickKey = `${replayKey}-${introNonce}`

  useEffect(() => {
    setBarActive(false)
    setPctDisplay(0)
    let id2 = 0
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setBarActive(true))
    })
    return () => {
      cancelAnimationFrame(id1)
      cancelAnimationFrame(id2)
    }
  }, [tickKey])

  useEffect(() => {
    if (!barActive) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (reduced) {
      setPctDisplay(targetPct)
      return
    }
    let cancelled = false
    const target = targetPct
    const duration = MT_HEADER_BAR_MS
    const t0 = performance.now()
    const easeOut = (x) => 1 - (1 - x) ** 2
    let raf = 0
    const tick = (now) => {
      if (cancelled) return
      const t = Math.min(1, (now - t0) / duration)
      setPctDisplay(Math.round(easeOut(t) * target))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [barActive, targetPct])

  const fillClass =
    accent === 'teal' ? 'mt-card-bar-fill mt-card-bar-fill--teal' : 'mt-card-bar-fill'

  return (
    <>
      <div className="mt-card-row">
        <span className="mt-card-tag">{displayTag}</span>
        <span className="mt-card-pct">{pctDisplay}%</span>
      </div>
      <div className="mt-card-bar">
        <div
          className={`${fillClass}${barActive ? ' mt-card-bar-fill--active' : ''}`}
          style={{ '--mt-card-target-pct': `${targetPct}%` }}
        />
      </div>
    </>
  )
}

function MainTracker({ onTabChange, onAddGalleryItem, trackerBarReplayKey = 0 }) {
  const [cards, setCards] = useState(() =>
    SAMPLE_CARDS.map((c) => ({ ...c, barIntroNonce: 0 })),
  )
  const [expandedId, setExpandedId] = useState('1')
  const [cardImages, setCardImages] = useState({})
  const [stageDone, setStageDone] = useState({})
  const [hdrBarActive, setHdrBarActive] = useState(false)
  const [hdrPctDisplay, setHdrPctDisplay] = useState(0)
  const [gallerySentOpen, setGallerySentOpen] = useState(false)
  const [galleryNeedImagesHint, setGalleryNeedImagesHint] = useState(false)
  const fileInputRef = useRef(null)
  const pendingCardIdRef = useRef(null)
  const gallerySentTimerRef = useRef(0)
  const galleryNeedImagesTimerRef = useRef(0)

  const overallPct = 64

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
    setCards((prev) => {
      const nonce = Date.now() + Math.random()
      return [
        ...prev,
        {
          id: `n-${Math.round(nonce)}`,
          displayTag: '새 작업',
          title: '새 작업',
          percent: 0,
          accent: prev.length % 2 === 0 ? 'orange' : 'teal',
          barIntroNonce: nonce,
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

  const toggleStage = (cardId, stageId) => {
    const key = `${cardId}-${stageId}`
    setStageDone((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const sendToGallery = (card) => {
    const urls = cardImages[card.id] || []
    if (urls.length === 0 || !onAddGalleryItem) return
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const date = now.toISOString().slice(0, 10)
    onAddGalleryItem({
      id: `${card.id}-${Date.now()}`,
      title: card.title,
      month,
      images: [...urls],
      date,
      dateTime: now.toISOString(),
      uploadedAt: now.getTime(),
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
              갤러리에 잘 담아 두었어요
            </p>
            <p className="mt-sent-sub">
              소중한 완성작은 언제든 갤러리 탭에서
              <br />
              편하게 다시 볼 수 있어요.
            </p>
            <button type="button" className="mt-sent-ok" onClick={closeGallerySentDialog}>
              확인
            </button>
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
            <span className="mt-today">TODAY</span>
          </div>
        </div>
        <div className="mt-bar">
          <div
            className={`mt-bar-fill${hdrBarActive ? ' mt-bar-fill--hdr-active' : ''}`}
            style={{ '--mt-hdr-pct': `${overallPct}%` }}
          />
        </div>
      </header>

      <main className="mt-scroll">
        {cards.map((card) => {
          const expanded = expandedId === card.id
          const urls = cardImages[card.id] || []

          return (
            <article
              key={card.id}
              className={`mt-card ${expanded ? 'mt-card--open' : ''}`}
              data-accent={card.accent}
            >
              <button
                type="button"
                className="mt-card-head"
                onClick={() => setExpandedId(expanded ? null : card.id)}
              >
                <CardHeadProgress
                  displayTag={card.displayTag}
                  targetPct={card.percent}
                  accent={card.accent}
                  replayKey={trackerBarReplayKey}
                  introNonce={card.barIntroNonce ?? 0}
                />
              </button>

              {expanded && (
                <div className="mt-card-detail">
                  {STAGES.map((st) => {
                    const done = stageDone[`${card.id}-${st.id}`]
                    return (
                      <div key={st.id} className={`mt-detail-row${done ? ' mt-detail-row--done' : ''}`}>
                        <button
                          type="button"
                          className={`mt-check ${done ? 'mt-check--on' : ''}`}
                          onClick={() => toggleStage(card.id, st.id)}
                          aria-pressed={done}
                        />
                        <span className="mt-detail-label">{st.label}</span>
                      </div>
                    )
                  })}

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
                          aria-label="이미지 추가"
                        >
                          <PlusIcon className="mt-slot-plus" />
                        </button>
                      )
                    })}
                  </div>

                  <button
                    type="button"
                    className={`mt-gallery-send${urls.length === 0 ? ' mt-gallery-send--empty' : ''}`}
                    onClick={() => onGallerySendClick(card)}
                    aria-disabled={urls.length === 0}
                  >
                    ✓ 완성했어요 — 갤러리에 담기
                  </button>
                </div>
              )}
            </article>
          )
        })}

        <button type="button" className="mt-card-add" onClick={addNewCard}>
          <span className="mt-card-add-label">+ 새 작업</span>
        </button>
      </main>

      <nav className="mt-nav" aria-label="하단 메뉴">
        <button type="button" className="mt-nav-item mt-nav-item--active">
          <span className="mt-nav-icon" aria-hidden />
          트래커
        </button>
        <button type="button" className="mt-nav-item" onClick={() => onTabChange?.('goal')}>
          <span className="mt-nav-icon" aria-hidden />
          목표
        </button>
        <button type="button" className="mt-nav-item" onClick={() => onTabChange?.('gallery')}>
          <span className="mt-nav-icon" aria-hidden />
          갤러리
        </button>
        <button type="button" className="mt-nav-item" onClick={() => onTabChange?.('settings')}>
          <span className="mt-nav-icon" aria-hidden />
          설정
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
            먼저 위 슬롯에 완성 이미지를
            <br />
            업로드한 뒤 다시 눌러 주세요.
          </span>
        </button>
      ) : null}
    </div>
  )
}

export default MainTracker
