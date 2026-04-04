import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '../contexts/LanguageContext.js'
import { copySharePayloadToClipboard, fileToDataUrl, openExternalUrl } from '../lib/snsShareActions.js'
import { useSnsShareStore } from '../stores/snsShareStore.js'
import AppToast from './AppToast.jsx'

/** @param {{ id: string; className?: string }} p */
function SnsPlatformIcon({ id, className = '' }) {
  const cn = `sns-share-icon-svg ${className}`.trim()
  switch (id) {
    case 'twitter':
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
          />
        </svg>
      )
    case 'instagram':
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8A3.6 3.6 0 0 0 20 16.4V7.6A3.6 3.6 0 0 0 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z"
          />
        </svg>
      )
    case 'pixiv':
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M4 4h6.5c3.5 0 5.5 2.2 5.5 5.3 0 2.1-1 3.8-2.7 4.6L20 20h-4.2l-5.4-5.4H8V20H4V4zm4.2 3.6v5.4h2.1c1.8 0 2.8-1 2.8-2.7 0-1.7-1-2.7-2.8-2.7h-2.1z"
          />
        </svg>
      )
    case 'artstation':
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M2.5 20h4.8l2.1-3.6h9.8l2.3 3.6h4.7L14.1 4h-4.2L2.5 20zm8.5-6.2l3.5-6.1 3.5 6.1H11z"
          />
        </svg>
      )
    case 'blog':
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm2 0v14h12V5H6zm2 2h8v2H8V7zm0 4h8v2H8v-2zm0 4h5v2H8v-2z"
          />
        </svg>
      )
    default:
      return (
        <svg className={cn} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
          />
        </svg>
      )
  }
}

const PLATFORM_IDS = ['twitter', 'instagram', 'pixiv', 'artstation', 'blog', 'other']

export default function SnsShareHubSection() {
  const { t } = useLang()
  const s = t.setting.snsShare
  const sectionHeading = t.setting.sections.shareChannels
  const channels = useSnsShareStore((st) => st.channels)
  const addChannel = useSnsShareStore((st) => st.addChannel)
  const removeChannel = useSnsShareStore((st) => st.removeChannel)

  const [newPlatform, setNewPlatform] = useState(/** @type {string} */ ('twitter'))
  const [newUrl, setNewUrl] = useState('')
  const [newCustomLabel, setNewCustomLabel] = useState('')
  const [shareText, setShareText] = useState('')
  const [shareImagePreview, setShareImagePreview] = useState(/** @type {string | null} */ (null))
  const shareImageFileRef = useRef(/** @type {File | null} */ (null))
  const fileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null))

  const [prepared, setPrepared] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  useEffect(() => {
    return () => {
      if (shareImagePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(shareImagePreview)
      }
    }
  }, [shareImagePreview])

  const onPickImage = useCallback((e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    shareImageFileRef.current = f
    setShareImagePreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return URL.createObjectURL(f)
    })
    setPrepared(false)
  }, [])

  const clearImage = useCallback(() => {
    shareImageFileRef.current = null
    setShareImagePreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return null
    })
    setPrepared(false)
  }, [])

  const handleAddChannel = useCallback(() => {
    const url = newUrl.trim()
    if (!url) return
    if (newPlatform === 'other' && !newCustomLabel.trim()) return
    addChannel({
      platform: newPlatform,
      url,
      customLabel: newPlatform === 'other' ? newCustomLabel.trim() : undefined,
    })
    setNewUrl('')
    setNewCustomLabel('')
    setPrepared(false)
  }, [addChannel, newCustomLabel, newPlatform, newUrl])

  const handlePrepareShare = useCallback(async () => {
    try {
      let imageDataUrl
      const file = shareImageFileRef.current
      if (file) {
        imageDataUrl = await fileToDataUrl(file)
      }
      await copySharePayloadToClipboard(shareText, imageDataUrl)
      setPrepared(true)
      setToastMessage(s.toastCopied)
      setToastOpen(true)
    } catch {
      setToastMessage(s.toastFailed)
      setToastOpen(true)
    }
  }, [shareText, s.toastCopied, s.toastFailed])

  const platformLabel = useCallback(
    (platform, customLabel) => {
      if (platform === 'other' && customLabel) return customLabel
      const key = `platform_${platform}`
      return s[key] ?? platform
    },
    [s],
  )

  return (
    <section className="setting-section">
      <h2 className="setting-section-label">{sectionHeading}</h2>
      <p className="sns-share-lead">{s.lead}</p>

      <div className="setting-card sns-share-card">
        <h3 className="sns-share-subtitle">{s.channelsTitle}</h3>
        <div className="sns-share-add-row">
          <label className="sns-share-label" htmlFor="sns-platform">
            {s.platformLabel}
          </label>
          <select
            id="sns-platform"
            className="sns-share-select"
            value={newPlatform}
            onChange={(e) => setNewPlatform(e.target.value)}
          >
            {PLATFORM_IDS.map((id) => (
              <option key={id} value={id}>
                {s[`platform_${id}`]}
              </option>
            ))}
          </select>
        </div>
        {newPlatform === 'other' ? (
          <div className="sns-share-add-row">
            <label className="sns-share-label" htmlFor="sns-custom">
              {s.customNameLabel}
            </label>
            <input
              id="sns-custom"
              type="text"
              className="setting-input-underline sns-share-input"
              value={newCustomLabel}
              onChange={(e) => setNewCustomLabel(e.target.value)}
              placeholder={s.customNamePh}
            />
          </div>
        ) : null}
        <div className="sns-share-add-row">
          <label className="sns-share-label" htmlFor="sns-url">
            {s.urlLabel}
          </label>
          <input
            id="sns-url"
            type="url"
            inputMode="url"
            className="setting-input-underline sns-share-input"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder={s.urlPh}
          />
        </div>
        <button type="button" className="sns-share-btn sns-share-btn--add" onClick={handleAddChannel}>
          {s.addChannel}
        </button>

        {channels.length === 0 ? (
          <p className="sns-share-empty">{s.emptyChannels}</p>
        ) : (
          <ul className="sns-share-channel-list">
            {channels.map((ch) => (
              <li key={ch.id} className="sns-share-channel-item">
                <span className="sns-share-channel-icon" aria-hidden>
                  <SnsPlatformIcon id={ch.platform} />
                </span>
                <div className="sns-share-channel-body">
                  <span className="sns-share-channel-name">{platformLabel(ch.platform, ch.customLabel)}</span>
                  <span className="sns-share-channel-url">{ch.url}</span>
                </div>
                <button
                  type="button"
                  className="sns-share-channel-remove"
                  onClick={() => {
                    removeChannel(ch.id)
                    setPrepared(false)
                  }}
                  aria-label={s.removeChannelAria}
                >
                  {s.removeChannel}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="setting-divider sns-share-divider" />

        <h3 className="sns-share-subtitle">{s.prepTitle}</h3>
        <label className="sns-share-label" htmlFor="sns-caption">
          {s.captionLabel}
        </label>
        <textarea
          id="sns-caption"
          className="sns-share-textarea"
          rows={4}
          value={shareText}
          onChange={(e) => {
            setShareText(e.target.value)
            setPrepared(false)
          }}
          placeholder={s.captionPh}
        />

        <p className="sns-share-label">{s.imageLabel}</p>
        <div className="sns-share-image-row">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sns-share-file-input"
            onChange={onPickImage}
          />
          <button
            type="button"
            className="sns-share-btn sns-share-btn--ghost"
            onClick={() => fileInputRef.current?.click()}
          >
            {s.pickImage}
          </button>
          {shareImagePreview ? (
            <button type="button" className="sns-share-btn sns-share-btn--ghost" onClick={clearImage}>
              {s.clearImage}
            </button>
          ) : null}
        </div>
        {shareImagePreview ? (
          <div className="sns-share-preview-wrap">
            <img src={shareImagePreview} alt="" className="sns-share-preview-img" />
          </div>
        ) : null}

        <button type="button" className="sns-share-btn sns-share-btn--primary" onClick={handlePrepareShare}>
          {s.prepareBtn}
        </button>

        {prepared && channels.length > 0 ? (
          <div className="sns-share-open-wrap">
            <p className="sns-share-open-hint">{s.openHint}</p>
            <div className="sns-share-open-grid">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  className="sns-share-open-btn"
                  onClick={() => void openExternalUrl(ch.url)}
                >
                  <SnsPlatformIcon id={ch.platform} />
                  <span>{platformLabel(ch.platform, ch.customLabel)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <AppToast message={toastMessage} open={toastOpen} onClose={() => setToastOpen(false)} />
    </section>
  )
}
