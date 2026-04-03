import { readInitialLang } from './contexts/LanguageContext.js'
import { ko } from './locales/ko.js'
import { en } from './locales/en.js'
import { ja } from './locales/ja.js'
import { ymFromDate } from './trackerMonth.js'

const localesByLang = { ko, en, ja }

const SEED_META = [
  { id: '1', accent: 'orange', workFinalized: false },
  { id: '2', accent: 'teal', workFinalized: false },
  { id: '3', accent: 'orange', workFinalized: false },
]

/**
 * @param {import('./locales/ko.js').ko | undefined} t
 */
export function createDefaultTrackerCards(t) {
  const tr = t ?? localesByLang[readInitialLang()] ?? ko
  const names = tr.tracker.sampleWorks
  const ym = ymFromDate(new Date())
  return SEED_META.map((meta, i) => {
    const label = names[i] ?? names[0] ?? 'Work'
    return {
      ...meta,
      displayTag: label,
      title: label,
      percent: 0,
      barIntroNonce: 0,
      activeMonthYm: ym,
      isKeyCard: false,
      isCarryOver: false,
      workFinalized: Boolean(meta.workFinalized),
    }
  })
}
