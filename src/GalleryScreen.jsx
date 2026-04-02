import BrandWordmark from './BrandWordmark'
import PlusIcon from './PlusIcon'
import './GalleryScreen.css'

/**
 * @typedef {{ id: string; title: string; month: string; images: string[]; date: string }} GalleryItem
 */

/**
 * @param {{
 *   galleryItems: GalleryItem[]
 *   onTabChange?: (tab: 'tracker' | 'goal' | 'gallery' | 'settings') => void
 * }} props
 */
export default function GalleryScreen({ galleryItems, onTabChange }) {
  const byMonth = galleryItems.reduce((acc, item) => {
    const m = item.month
    if (!acc[m]) acc[m] = []
    acc[m].push(item)
    return acc
  }, /** @type {Record<string, GalleryItem[]>} */ ({}))

  const monthKeys = Object.keys(byMonth).sort().reverse()

  const formatMonthLabel = (key) => {
    const [y, mo] = key.split('-')
    return `${y} · ${mo}`
  }

  return (
    <div className="gallery-screen">
      <header className="gallery-header">
        <div className="gallery-header-brand">
          <BrandWordmark />
          <div className="gallery-subtitle">갤러리</div>
        </div>
      </header>

      <div className="gallery-scroll">
        {galleryItems.length === 0 ? (
          <div className="gallery-empty">
            <div className="gallery-empty-tile" aria-hidden>
              <PlusIcon className="gallery-empty-plus" />
            </div>
            <p className="gallery-empty-text">아직 완성작이 없어요</p>
          </div>
        ) : (
          monthKeys.map((monthKey) => (
            <section key={monthKey} className="gallery-month-block">
              <div className="gallery-month-label">{formatMonthLabel(monthKey)}</div>
              <div className="gallery-grid">
                {byMonth[monthKey].flatMap((item) =>
                  item.images.map((src, i) => (
                    <div key={`${item.id}-${i}`} className="gallery-cell">
                      <img src={src} alt="" className="gallery-cell-img" />
                    </div>
                  )),
                )}
                <div className="gallery-cell gallery-cell--placeholder" aria-hidden>
                  <PlusIcon className="gallery-placeholder-plus" />
                </div>
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
        <button type="button" className="gallery-nav-item" onClick={() => onTabChange?.('goal')}>
          <span className="gallery-nav-icon" aria-hidden />
          목표
        </button>
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
