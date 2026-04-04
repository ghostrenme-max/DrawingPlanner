import { Browser } from '@capacitor/browser'
import { Clipboard } from '@capacitor/clipboard'
import { Capacitor } from '@capacitor/core'

/**
 * @param {string} raw
 * @returns {string}
 */
export function normalizeShareUrl(raw) {
  const t = raw.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

/**
 * @param {string} text
 * @param {string | undefined} imageDataUrl
 */
export async function copySharePayloadToClipboard(text, imageDataUrl) {
  const str = text ?? ''
  if (Capacitor.isNativePlatform()) {
    if (imageDataUrl) {
      await Clipboard.write({ string: str, image: imageDataUrl, label: 'Drawing Planner' })
    } else {
      await Clipboard.write({ string: str, label: 'Drawing Planner' })
    }
    return
  }
  if (navigator.clipboard?.write && window.ClipboardItem) {
    try {
      /** @type {Record<string, Blob>} */
      const parts = {}
      if (str) parts['text/plain'] = new Blob([str], { type: 'text/plain' })
      if (imageDataUrl) {
        const res = await fetch(imageDataUrl)
        const blob = await res.blob()
        parts[blob.type] = blob
      }
      if (Object.keys(parts).length > 0) {
        await navigator.clipboard.write([new ClipboardItem(parts)])
        return
      }
    } catch {
      /* fall through */
    }
  }
  if (navigator.clipboard?.writeText && str) {
    await navigator.clipboard.writeText(str)
    return
  }
  throw new Error('Clipboard unavailable')
}

/**
 * @param {string} url
 */
export async function openExternalUrl(url) {
  const u = normalizeShareUrl(url)
  if (!u) return
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url: u, presentationStyle: 'fullscreen' })
  } else {
    window.open(u, '_blank', 'noopener,noreferrer')
  }
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}
