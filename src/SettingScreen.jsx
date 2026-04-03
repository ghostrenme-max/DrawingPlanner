import { useCallback, useState } from 'react'
import { APP_THEME_PRESETS } from './appTheme.js'
import { NavIconGallery, NavIconGoal, NavIconSettings, NavIconTracker } from './bottomNavIcons.jsx'
import { createEmptyGoalTexts, GOAL_DAY_MONTH_ROWS, GOAL_YEAR_ROWS } from './goalConfig.js'
import './SettingScreen.css'

/** 스플래시와 동일 W 곡선 + 점 (viewBox 0 0 500 500) */
const MARK_PATH =
  'M102.5,285.4c0,0,13,30,43,20s40-90,70-85s34,65,64,50c30-15,58-105,118-147'

function SettingsMarkSvg({ size, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 500 500"
      aria-hidden
    >
      <path
        d={MARK_PATH}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={28}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="setting-mark-dot-main" cx={136.7} cy={353.8} r={22.8} />
      <circle className="setting-mark-dot-sub" cx={271.2} cy={320.7} r={25.7} />
    </svg>
  )
}

const FEATURE_ROWS = [
  { key: 'workTimer', label: '작업 타이머' },
  { key: 'selfFeedback', label: '셀프 피드백 / 별점' },
  { key: 'gallery', label: '갤러리' },
  { key: 'goalScreen', label: '목표 화면' },
  { key: 'imageUploadSlot', label: '이미지 업로드 슬롯' },
]

/**
 * @param {{
 *   onTabChange?: (tab: 'tracker' | 'goal' | 'gallery' | 'settings') => void
 *   features: import('./appFeatures.js').AppFeatures
 *   onFeaturesChange: (updater: (prev: import('./appFeatures.js').AppFeatures) => import('./appFeatures.js').AppFeatures) => void
 *   onResetApp: () => void
 *   onClearGallery: () => void
 *   themeIndex: number
 *   onThemeIndexChange: (index: number) => void
 *   goalTexts: Record<string, string>
 *   onGoalTextsChange: (value: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void
 *   goalStartDate: string
 *   onGoalStartDateChange: (value: string) => void
 * }} props
 */
export default function SettingScreen({
  onTabChange,
  features,
  onFeaturesChange,
  onResetApp,
  onClearGallery,
  themeIndex,
  onThemeIndexChange,
  goalTexts,
  onGoalTextsChange,
  goalStartDate,
  onGoalStartDateChange,
}) {
  const [nickname, setNickname] = useState('')
  const [creativeField, setCreativeField] = useState('')
  const [goalOpenId, setGoalOpenId] = useState(/** @type {string | null} */ (null))
  const toggleFeature = useCallback(
    (key) => {
      onFeaturesChange((prev) => ({ ...prev, [key]: !prev[key] }))
    },
    [onFeaturesChange],
  )

  const handleResetAll = () => {
    if (!window.confirm('앱 데이터를 모두 초기화할까요? 이 작업은 되돌릴 수 없어요.')) return
    setNickname('')
    setCreativeField('')
    onGoalTextsChange(createEmptyGoalTexts())
    onGoalStartDateChange('')
    setGoalOpenId(null)
    onResetApp()
  }

  const handleClearGallery = () => {
    if (!window.confirm('갤러리 이미지를 모두 삭제할까요?')) return
    onClearGallery()
  }

  return (
    <div className="setting-screen">
      <header className="setting-header">
        <SettingsMarkSvg size={34} className="setting-header-mark" />
        <span className="setting-header-title">설정</span>
      </header>

      <div className="setting-scroll">
        <section className="setting-section">
          <h2 className="setting-section-label setting-section-label--profile">PROFILE</h2>
          <div className="setting-card">
            <div className="setting-row setting-row--input">
              <span className="setting-row-label">닉네임</span>
              <input
                type="text"
                className="setting-input-underline"
                placeholder="나의 이름"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                autoComplete="nickname"
              />
            </div>
            <div className="setting-divider" />
            <div className="setting-row setting-row--input">
              <span className="setting-row-label">창작 분야</span>
              <input
                type="text"
                className="setting-input-underline"
                placeholder="일러스트, 디자인..."
                value={creativeField}
                onChange={(e) => setCreativeField(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="setting-section">
          <h2 className="setting-section-label">FEATURES</h2>
          <div className="setting-card setting-card--flush">
            {FEATURE_ROWS.map((row, i) => (
              <div key={row.key}>
                {i > 0 ? <div className="setting-divider" /> : null}
                <div className="setting-row setting-row--toggle">
                  <span className="setting-feature-name">{row.label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={features[row.key]}
                    className={`setting-toggle${features[row.key] ? ' setting-toggle--on' : ''}`}
                    onClick={() => toggleFeature(row.key)}
                  >
                    <span className="setting-toggle-knob" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="setting-section">
          <h2 className="setting-section-label">GOALS</h2>
          <div className="setting-card setting-card--goals">
            <h3 className="setting-goals-subheading">DAY · MONTH</h3>
            {GOAL_DAY_MONTH_ROWS.map((row, idx) => (
              <div key={row.id}>
                {idx > 0 ? <div className="setting-divider" /> : null}
                <div className="setting-goal-block">
                  <button
                    type="button"
                    className="setting-row setting-row--chevron"
                    onClick={() => setGoalOpenId((o) => (o === row.id ? null : row.id))}
                  >
                    <span className="setting-row-label">{row.label} 목표 수정</span>
                    <span className="setting-row-chevron">수정 ›</span>
                  </button>
                  {goalOpenId === row.id ? (
                    <textarea
                      className="setting-goal-textarea"
                      rows={3}
                      value={goalTexts[row.id] ?? ''}
                      onChange={(e) =>
                        onGoalTextsChange((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <div className="setting-card setting-card--goals">
            <h3 className="setting-goals-subheading">YEAR</h3>
            {GOAL_YEAR_ROWS.map((row, idx) => (
              <div key={row.id}>
                {idx > 0 ? <div className="setting-divider" /> : null}
                <div className="setting-goal-block">
                  <button
                    type="button"
                    className="setting-row setting-row--chevron"
                    onClick={() => setGoalOpenId((o) => (o === row.id ? null : row.id))}
                  >
                    <span className="setting-row-label">{row.label}</span>
                    <span className="setting-row-chevron">수정 ›</span>
                  </button>
                  {goalOpenId === row.id ? (
                    <textarea
                      className="setting-goal-textarea"
                      rows={3}
                      value={goalTexts[row.id] ?? ''}
                      onChange={(e) =>
                        onGoalTextsChange((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                    />
                  ) : null}
                </div>
              </div>
            ))}
            <div className="setting-divider" />
            <div className="setting-row setting-row--input">
              <span className="setting-row-label">시작 날짜</span>
              <input
                type="date"
                className="setting-input-date"
                value={goalStartDate}
                onChange={(e) => onGoalStartDateChange(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="setting-section">
          <h2 className="setting-section-label">THEME</h2>
          <div className="setting-card">
            <div className="setting-theme-grid">
              {APP_THEME_PRESETS.map((t, idx) => (
                <button
                  key={t.id}
                  type="button"
                  className={`setting-theme-btn${themeIndex === idx ? ' setting-theme-btn--selected' : ''}`}
                  onClick={() => onThemeIndexChange(idx)}
                >
                  <span className="setting-theme-dots" aria-hidden>
                    <span className="setting-theme-dot" style={{ background: t.main }} />
                    <span className="setting-theme-dot" style={{ background: t.sub }} />
                  </span>
                  <span className="setting-theme-label">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="setting-section">
          <h2 className="setting-section-label">DATA</h2>
          <div className="setting-card setting-card--flush">
            <button type="button" className="setting-row setting-row--chevron" onClick={handleResetAll}>
              <span className="setting-row-label setting-row-label--warn">전체 초기화</span>
              <span className="setting-row-chevron">›</span>
            </button>
            <div className="setting-divider" />
            <button type="button" className="setting-row setting-row--chevron" onClick={handleClearGallery}>
              <span className="setting-row-label setting-row-label--danger">갤러리 이미지 삭제</span>
              <span className="setting-row-chevron">›</span>
            </button>
          </div>
        </section>

        <section className="setting-section">
          <h2 className="setting-section-label">ABOUT</h2>
          <div className="setting-card setting-card--about">
            <div className="setting-about-mark-wrap">
              <SettingsMarkSvg size={40} />
            </div>
            <p className="setting-about-wordmark" aria-label="with worth">
              <span>w</span>
              <span className="setting-about-i">i</span>
              <span>th</span>
              <span className="setting-about-sep" aria-hidden>
                _
              </span>
              <span>w</span>
              <span className="setting-about-o">o</span>
              <span>rth</span>
            </p>
            <p className="setting-about-tagline">같이, 가치있게</p>
            <div className="setting-divider" />
            <div className="setting-row setting-row--version">
              <span className="setting-version-left">version</span>
              <span className="setting-version-right">0.1.0</span>
            </div>
          </div>
        </section>
      </div>

      <nav className="setting-nav" aria-label="하단 메뉴">
        <button type="button" className="setting-nav-item" onClick={() => onTabChange?.('tracker')}>
          <span className="setting-nav-icon" aria-hidden>
            <NavIconTracker />
          </span>
          트래커
        </button>
        {features.goalScreen ? (
          <button type="button" className="setting-nav-item" onClick={() => onTabChange?.('goal')}>
            <span className="setting-nav-icon" aria-hidden>
              <NavIconGoal />
            </span>
            목표
          </button>
        ) : null}
        {features.gallery ? (
          <button type="button" className="setting-nav-item" onClick={() => onTabChange?.('gallery')}>
            <span className="setting-nav-icon" aria-hidden>
              <NavIconGallery />
            </span>
            갤러리
          </button>
        ) : null}
        <button type="button" className="setting-nav-item setting-nav-item--active">
          <span className="setting-nav-icon" aria-hidden>
            <NavIconSettings />
          </span>
          설정
        </button>
      </nav>
    </div>
  )
}
