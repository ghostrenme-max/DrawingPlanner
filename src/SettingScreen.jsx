import BrandWordmark from './BrandWordmark'
import './SettingScreen.css'

/**
 * @param {{ onTabChange?: (tab: 'tracker' | 'goal' | 'gallery' | 'settings') => void }} props
 */
export default function SettingScreen({ onTabChange }) {
  return (
    <div className="setting-screen">
      <header className="setting-header">
        <div className="setting-header-brand">
          <BrandWordmark />
          <div className="setting-subtitle">설정</div>
        </div>
      </header>
      <div className="setting-body" />
      <nav className="setting-nav" aria-label="하단 메뉴">
        <button type="button" className="setting-nav-item" onClick={() => onTabChange?.('tracker')}>
          <span className="setting-nav-icon" aria-hidden />
          트래커
        </button>
        <button type="button" className="setting-nav-item" onClick={() => onTabChange?.('goal')}>
          <span className="setting-nav-icon" aria-hidden />
          목표
        </button>
        <button type="button" className="setting-nav-item" onClick={() => onTabChange?.('gallery')}>
          <span className="setting-nav-icon" aria-hidden />
          갤러리
        </button>
        <button type="button" className="setting-nav-item setting-nav-item--active">
          <span className="setting-nav-icon" aria-hidden />
          설정
        </button>
      </nav>
    </div>
  )
}
