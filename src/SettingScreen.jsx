import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useLang } from './contexts/LanguageContext.js'
import { APP_THEME_PRESETS } from './appTheme.js'
import { NavIconGallery, NavIconGoal, NavIconSettings, NavIconTracker } from './bottomNavIcons.jsx'
import { createEmptyGoalTexts } from './goalConfig.js'
import BrandWordmark from './BrandWordmark.jsx'
import { hideBanner, shouldShowBannerOnThisTabVisit, showBanner } from './hooks/useAdMob.js'

/** 설정 GOALS · DAY 탭 (goalTexts 키는 기존 dm_* 와 동일) */
const GOAL_TAB_DAY_ROWS = [
  { id: 'dm_1d', label: '1 day' },
  { id: 'dm_3d', label: '3 days' },
  { id: 'dm_7d', label: '7 days' },
  { id: 'dm_15d', label: '15 days' },
]

const GOAL_TAB_YEAR_ROWS = [
  { id: '1y', label: '1 year' },
  { id: '3y', label: '3 years' },
  { id: '5y', label: '5 years' },
  { id: '10y', label: '10 years' },
]
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
 *   monthlyGoals: string[]
 *   onMonthlyGoalsChange: (value: string[] | ((prev: string[]) => string[])) => void
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
  monthlyGoals,
  onMonthlyGoalsChange,
}) {
  const { t, lang, setLang } = useLang()
  const settingsHeaderBannerRef = useRef(/** @type {HTMLElement | null} */ (null))
  const [showBannerThisVisit] = useState(() => shouldShowBannerOnThisTabVisit())

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined

    let cancelled = false
    const placeBanner = () => {
      if (cancelled) return
      const el = settingsHeaderBannerRef.current
      const h = el ? Math.round(el.getBoundingClientRect().height) : 0
      if (showBannerThisVisit) {
        void showBanner(h > 0 ? h : 72)
      } else {
        void hideBanner()
      }
    }

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(placeBanner)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      void hideBanner()
    }
  }, [showBannerThisVisit])

  const [nickname, setNickname] = useState('')
  const [creativeField, setCreativeField] = useState('')
  const [goalOpenId, setGoalOpenId] = useState(/** @type {string | null} */ (null))
  const [activeGoalTab, setActiveGoalTab] = useState(/** @type {'day' | 'month' | 'year'} */ ('day'))
  const [expandedMonth, setExpandedMonth] = useState(/** @type {number | null} */ (null))
  const toggleFeature = useCallback(
    (key) => {
      onFeaturesChange((prev) => ({ ...prev, [key]: !prev[key] }))
    },
    [onFeaturesChange],
  )

  const featureRows = [
    { key: 'gallery', label: t.setting.featureGallery },
    { key: 'goalScreen', label: t.setting.featureGoalScreen },
  ]

  const handleResetAll = () => {
    if (!window.confirm(t.setting.confirmResetAll)) return
    setNickname('')
    setCreativeField('')
    onGoalTextsChange(createEmptyGoalTexts())
    onGoalStartDateChange('')
    setGoalOpenId(null)
    setExpandedMonth(null)
    setActiveGoalTab('day')
    onResetApp()
  }

  const handleClearGallery = () => {
    if (!window.confirm(t.setting.confirmClearGallery)) return
    onClearGallery()
  }

  return (
    <div
      className={`setting-screen${
        Capacitor.isNativePlatform() && showBannerThisVisit ? ' setting-screen--top-banner' : ''
      }`}
    >
      <header className="setting-header" ref={settingsHeaderBannerRef}>
        <div className="setting-header-brand">
          <BrandWordmark />
        </div>
      </header>

      <div className="setting-scroll">
        <section className="setting-section">
          <h2 className="setting-section-label setting-section-label--profile">{t.setting.sections.profile}</h2>
          <div className="setting-card">
            <div className="setting-row setting-row--input">
              <span className="setting-row-label">{t.setting.nickname}</span>
              <input
                type="text"
                className="setting-input-underline"
                placeholder={t.setting.nicknamePh}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                autoComplete="nickname"
              />
            </div>
            <div className="setting-divider" />
            <div className="setting-row setting-row--input">
              <span className="setting-row-label">{t.setting.creativeField}</span>
              <input
                type="text"
                className="setting-input-underline"
                placeholder={t.setting.creativeFieldPh}
                value={creativeField}
                onChange={(e) => setCreativeField(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="setting-section">
          <h2 className="setting-section-label">{t.setting.sections.features}</h2>
          <div className="setting-card setting-card--flush">
            {featureRows.map((row, i) => (
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
          <h2 className="setting-section-label">{t.setting.sections.goals}</h2>
          <div className="setting-card setting-card--goals">
            <div className="setting-goals-tabs" role="tablist" aria-label={t.setting.goalsTabAria}>
              <button
                type="button"
                role="tab"
                aria-selected={activeGoalTab === 'day'}
                className={`setting-goals-tab${activeGoalTab === 'day' ? ' setting-goals-tab--active' : ''}`}
                onClick={() => setActiveGoalTab('day')}
              >
                {t.setting.goalsTabDay}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeGoalTab === 'month'}
                className={`setting-goals-tab${activeGoalTab === 'month' ? ' setting-goals-tab--active' : ''}`}
                onClick={() => setActiveGoalTab('month')}
              >
                {t.setting.goalsTabMonth}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeGoalTab === 'year'}
                className={`setting-goals-tab${activeGoalTab === 'year' ? ' setting-goals-tab--active' : ''}`}
                onClick={() => setActiveGoalTab('year')}
              >
                {t.setting.goalsTabYear}
              </button>
            </div>

            {activeGoalTab === 'day' ? (
              <div role="tabpanel" aria-label="DAY">
                {GOAL_TAB_DAY_ROWS.map((row, idx) => (
                  <div key={row.id}>
                    {idx > 0 ? <div className="setting-divider" /> : null}
                    <div className="setting-goal-block">
                      <button
                        type="button"
                        className="setting-row setting-row--chevron"
                        onClick={() => setGoalOpenId((o) => (o === row.id ? null : row.id))}
                      >
                        <span className="setting-row-label setting-row-label--goal-en">{row.label}</span>
                        <span className="setting-row-chevron">{t.setting.editChevron}</span>
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
            ) : null}

            {activeGoalTab === 'month' ? (
              <div role="tabpanel" aria-label="MONTH">
                {Array.from({ length: 12 }, (_, monthIndex) => {
                  const padded = String(monthIndex + 1).padStart(2, '0')
                  const raw = monthlyGoals[monthIndex] ?? ''
                  const normalized = raw.replace(/\s+/g, ' ').trim()
                  const hasValue = normalized.length > 0
                  const preview =
                    hasValue && normalized.length > 10
                      ? `${normalized.slice(0, 10)}…`
                      : normalized
                  return (
                    <div key={monthIndex}>
                      {monthIndex > 0 ? <div className="setting-divider" /> : null}
                      <div className="setting-goal-block">
                        <button
                          type="button"
                          className="setting-row setting-row--chevron setting-row--month-goal"
                          onClick={() =>
                            setExpandedMonth((o) => (o === monthIndex ? null : monthIndex))
                          }
                        >
                          <span className="setting-month-label">
                            {t.common.monthSuffix
                              ? `${padded}${t.common.monthSuffix}`
                              : `${padded}`}
                          </span>
                          <span
                            className={`setting-month-preview${hasValue ? '' : ' setting-month-preview--empty'}`}
                          >
                            {hasValue ? preview : t.setting.monthEmpty}
                          </span>
                        </button>
                        {expandedMonth === monthIndex ? (
                          <textarea
                            className="setting-month-textarea"
                            rows={3}
                            value={monthlyGoals[monthIndex] ?? ''}
                            onChange={(e) => {
                              const v = e.target.value
                              onMonthlyGoalsChange((prev) => {
                                const next = [...prev]
                                while (next.length < 12) next.push('')
                                next[monthIndex] = v
                                return next
                              })
                            }}
                          />
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {activeGoalTab === 'year' ? (
              <div role="tabpanel" aria-label="YEAR">
                {GOAL_TAB_YEAR_ROWS.map((row, idx) => (
                  <div key={row.id}>
                    {idx > 0 ? <div className="setting-divider" /> : null}
                    <div className="setting-goal-block">
                      <button
                        type="button"
                        className="setting-row setting-row--chevron"
                        onClick={() => setGoalOpenId((o) => (o === row.id ? null : row.id))}
                      >
                        <span className="setting-row-label setting-row-label--goal-en">{row.label}</span>
                        <span className="setting-row-chevron">{t.setting.editChevron}</span>
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
                  <span className="setting-row-label">{t.setting.startDate}</span>
                  <input
                    type="date"
                    className="setting-input-date"
                    value={goalStartDate}
                    onChange={(e) => onGoalStartDateChange(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="setting-section">
          <h2 className="setting-section-label">{t.setting.sections.theme}</h2>
          <div className="setting-card">
            <div className="setting-theme-grid">
              {APP_THEME_PRESETS.map((preset, idx) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`setting-theme-btn${themeIndex === idx ? ' setting-theme-btn--selected' : ''}`}
                  onClick={() => onThemeIndexChange(idx)}
                >
                  <span className="setting-theme-dots" aria-hidden>
                    <span className="setting-theme-dot" style={{ background: preset.main }} />
                    <span className="setting-theme-dot" style={{ background: preset.sub }} />
                  </span>
                  <span className="setting-theme-label">
                    {t.setting.themePresets[preset.id] ?? preset.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="setting-section">
          <h2 className="setting-section-label">{t.setting.sections.language}</h2>
          <div className="setting-card">
            <p
              style={{
                fontFamily: "'DM Mono', ui-monospace, monospace",
                fontSize: '10px',
                color: 'rgba(255,255,255,0.6)',
                margin: '0 0 12px',
              }}
            >
              {t.setting.language.title}
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(['ko', 'en', 'ja']).map((code) => {
                const on = lang === code
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLang(code)}
                    style={{
                      fontFamily: "'DM Mono', ui-monospace, monospace",
                      fontSize: '10px',
                      cursor: 'pointer',
                      borderRadius: '20px',
                      padding: '8px 16px',
                      border: on ? '1px solid #FB923C' : '1px solid rgba(255,255,255,0.1)',
                      color: on ? '#FB923C' : 'rgba(255,255,255,0.3)',
                      background: on ? 'rgba(251,146,60,0.12)' : 'transparent',
                    }}
                  >
                    {t.setting.language[code]}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section className="setting-section">
          <h2 className="setting-section-label">{t.setting.sections.data}</h2>
          <div className="setting-card setting-card--flush">
            <button type="button" className="setting-row setting-row--chevron" onClick={handleResetAll}>
              <span className="setting-row-label setting-row-label--warn">{t.setting.data.reset}</span>
              <span className="setting-row-chevron">›</span>
            </button>
            <div className="setting-divider" />
            <button type="button" className="setting-row setting-row--chevron" onClick={handleClearGallery}>
              <span className="setting-row-label setting-row-label--danger">{t.setting.data.deleteGallery}</span>
              <span className="setting-row-chevron">›</span>
            </button>
          </div>
        </section>

        <section className="setting-section">
          <h2 className="setting-section-label">{t.setting.sections.about}</h2>
          <div className="setting-card setting-card--about">
            <div className="setting-about-mark-wrap">
              <SettingsMarkSvg size={40} />
            </div>
            <p className="setting-about-wordmark" aria-label={t.setting.aboutWordmarkAria}>
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
            {t.tagline?.trim() ? (
              <p className="setting-about-tagline">{t.tagline}</p>
            ) : null}
            <div className="setting-divider" />
            <div className="setting-row setting-row--version">
              <span className="setting-version-left">{t.setting.version}</span>
              <span className="setting-version-right">0.1.0</span>
            </div>
          </div>
        </section>
      </div>

      <nav className="setting-nav" aria-label={t.common.bottomNavAria}>
        <button type="button" className="setting-nav-item" onClick={() => onTabChange?.('tracker')}>
          <span className="setting-nav-icon" aria-hidden>
            <NavIconTracker />
          </span>
          {t.nav.tracker}
        </button>
        {features.goalScreen ? (
          <button type="button" className="setting-nav-item" onClick={() => onTabChange?.('goal')}>
            <span className="setting-nav-icon" aria-hidden>
              <NavIconGoal />
            </span>
            {t.nav.goal}
          </button>
        ) : null}
        {features.gallery ? (
          <button type="button" className="setting-nav-item" onClick={() => onTabChange?.('gallery')}>
            <span className="setting-nav-icon" aria-hidden>
              <NavIconGallery />
            </span>
            {t.nav.gallery}
          </button>
        ) : null}
        <button type="button" className="setting-nav-item setting-nav-item--active">
          <span className="setting-nav-icon" aria-hidden>
            <NavIconSettings />
          </span>
          {t.nav.setting}
        </button>
      </nav>
    </div>
  )
}
