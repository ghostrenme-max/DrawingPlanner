import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useLang } from './contexts/LanguageContext.js'
import { APP_THEME_PRESETS } from './appTheme.js'
import { NavIconGallery, NavIconGoal, NavIconSettings, NavIconTracker } from './bottomNavIcons.jsx'
import { createEmptyGoalTexts } from './goalConfig.js'
import BrandWordmark from './BrandWordmark.jsx'
import SnsShareHubSection from './components/SnsShareHubSection.jsx'
import { hideBanner, shouldShowBannerOnThisTabVisit, showBanner } from './hooks/useAdMob.js'

/** 설정 GOALS · WEEK 탭 (goalTexts 키는 dm_1d…dm_15d 그대로 — 목표 탭 1~4주차와 대응) */
const GOAL_TAB_WEEK_ROW_IDS = /** @type {const} */ (['dm_1d', 'dm_3d', 'dm_7d', 'dm_15d'])

import './SettingScreen.css'

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
  const [weekGoalDraft, setWeekGoalDraft] = useState('')
  const [activeGoalTab, setActiveGoalTab] = useState(/** @type {'week' | 'month'} */ ('week'))
  const [expandedMonth, setExpandedMonth] = useState(/** @type {number | null} */ (null))
  const [monthGoalDraft, setMonthGoalDraft] = useState('')

  useEffect(() => {
    if (!goalOpenId) return
    setWeekGoalDraft(goalTexts[goalOpenId] ?? '')
  }, [goalOpenId, goalTexts])

  useEffect(() => {
    if (expandedMonth === null) return
    setMonthGoalDraft(monthlyGoals[expandedMonth] ?? '')
  }, [expandedMonth])
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
    setGoalOpenId(null)
    setExpandedMonth(null)
    setActiveGoalTab('week')
    onResetApp()
  }

  const handleClearGallery = () => {
    if (!window.confirm(t.setting.confirmClearGallery)) return
    onClearGallery()
  }

  const applyWeekGoal = useCallback(() => {
    if (!goalOpenId) return
    const id = goalOpenId
    onGoalTextsChange((prev) => ({ ...prev, [id]: weekGoalDraft }))
    setGoalOpenId(null)
  }, [goalOpenId, weekGoalDraft, onGoalTextsChange])

  const cancelWeekGoal = useCallback(() => {
    setGoalOpenId(null)
  }, [])

  const applyMonthGoal = useCallback(() => {
    if (expandedMonth === null) return
    const mi = expandedMonth
    onMonthlyGoalsChange((prev) => {
      const next = [...(Array.isArray(prev) ? prev : [])]
      while (next.length < 12) next.push('')
      next[mi] = monthGoalDraft
      return next
    })
    setExpandedMonth(null)
  }, [expandedMonth, monthGoalDraft, onMonthlyGoalsChange])

  const cancelMonthGoal = useCallback(() => {
    setExpandedMonth(null)
  }, [])

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
                aria-selected={activeGoalTab === 'week'}
                className={`setting-goals-tab${activeGoalTab === 'week' ? ' setting-goals-tab--active' : ''}`}
                onClick={() => setActiveGoalTab('week')}
              >
                {t.setting.goalsTabWeek}
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
            </div>

            {activeGoalTab === 'week' ? (
              <div role="tabpanel" aria-label={t.setting.goalsTabWeekPanelAria}>
                {GOAL_TAB_WEEK_ROW_IDS.map((id, idx) => (
                  <div key={id}>
                    {idx > 0 ? <div className="setting-divider" /> : null}
                    <div className="setting-goal-block">
                      <button
                        type="button"
                        className="setting-row setting-row--chevron"
                        onClick={() => setGoalOpenId((o) => (o === id ? null : id))}
                      >
                        <span className="setting-row-label setting-row-label--goal-en">
                          {t.goal.dailyWeekLabels[idx]}
                        </span>
                        <span className="setting-row-chevron">{t.setting.editChevron}</span>
                      </button>
                      {goalOpenId === id ? (
                        <>
                          <textarea
                            className="setting-goal-textarea"
                            rows={3}
                            value={weekGoalDraft}
                            onChange={(e) => setWeekGoalDraft(e.target.value)}
                          />
                          <div className="setting-goal-edit-actions">
                            <button
                              type="button"
                              className="setting-goal-action setting-goal-action--ghost"
                              onClick={cancelWeekGoal}
                            >
                              {t.common.cancel}
                            </button>
                            <button
                              type="button"
                              className="setting-goal-action setting-goal-action--primary"
                              onClick={applyWeekGoal}
                            >
                              {t.common.ok}
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {activeGoalTab === 'month' ? (
              <div role="tabpanel" aria-label="MONTH">
                {Array.from({ length: 12 }, (_, monthIndex) => {
                  const monthNum = monthIndex + 1
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
                              ? `${monthNum}${t.common.monthSuffix}`
                              : String(monthNum)}
                          </span>
                          <span
                            className={`setting-month-preview${hasValue ? '' : ' setting-month-preview--empty'}`}
                          >
                            {hasValue ? preview : t.setting.monthEmpty}
                          </span>
                        </button>
                        {expandedMonth === monthIndex ? (
                          <>
                            <textarea
                              className="setting-month-textarea"
                              rows={3}
                              value={monthGoalDraft}
                              onChange={(e) => setMonthGoalDraft(e.target.value)}
                            />
                            <div className="setting-goal-edit-actions">
                              <button
                                type="button"
                                className="setting-goal-action setting-goal-action--ghost"
                                onClick={cancelMonthGoal}
                              >
                                {t.common.cancel}
                              </button>
                              <button
                                type="button"
                                className="setting-goal-action setting-goal-action--primary"
                                onClick={applyMonthGoal}
                              >
                                {t.common.ok}
                              </button>
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
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

        <SnsShareHubSection />

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
