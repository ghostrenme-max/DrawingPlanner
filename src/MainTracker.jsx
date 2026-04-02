import { useState, useRef } from 'react'
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

function MainTracker({ onTabChange, onAddGalleryItem }) {
  const [expandedId, setExpandedId] = useState('1')
  const [cardImages, setCardImages] = useState({})
  const [stageDone, setStageDone] = useState({})
  const fileInputRef = useRef(null)
  const pendingCardIdRef = useRef(null)

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
    })
    setCardImages((prev) => ({ ...prev, [card.id]: [] }))
  }

  const overallPct = 64
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

      <header className="mt-header">
        <BrandWordmark className="mt-brand" />
        <div className="mt-prog-row">
          <div className="mt-prog-pct">
            {overallPct}
            <sup>%</sup>
          </div>
          <div className="mt-prog-meta">
            <span className="mt-date-ymd">{todayYmd}</span>
            <span className="mt-today">TODAY</span>
          </div>
        </div>
        <div className="mt-bar">
          <div className="mt-bar-fill" style={{ width: `${overallPct}%` }} />
        </div>
      </header>

      <main className="mt-scroll">
        {SAMPLE_CARDS.map((card) => {
          const expanded = expandedId === card.id
          const urls = cardImages[card.id] || []
          const barClass =
            card.accent === 'teal' ? 'mt-card-bar-fill mt-card-bar-fill--teal' : 'mt-card-bar-fill'

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
                <div className="mt-card-row">
                  <span className="mt-card-tag">{card.displayTag}</span>
                  <span className="mt-card-pct">{card.percent}%</span>
                </div>
                <div className="mt-card-bar">
                  <div className={barClass} style={{ width: `${card.percent}%` }} />
                </div>
              </button>

              {expanded && (
                <div className="mt-card-detail">
                  {STAGES.map((st) => {
                    const done = stageDone[`${card.id}-${st.id}`]
                    return (
                      <div key={st.id} className="mt-detail-row">
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
                    className="mt-gallery-send"
                    onClick={() => sendToGallery(card)}
                    disabled={urls.length === 0}
                  >
                    ✓ 완성 — 갤러리로 보내기
                  </button>
                </div>
              )}
            </article>
          )
        })}

        <button type="button" className="mt-card-add">
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
    </div>
  )
}

export default MainTracker
