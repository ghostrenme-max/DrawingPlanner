import { useCallback, useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { AdMob, BannerAdPosition, BannerAdSize } from '@capacitor-community/admob'

const TEST_GALLERY_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111'
const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712'

let initializePromise = null

/**
 * AdMob SDK 초기화 (네이티브에서 한 번만 수행)
 * @returns {Promise<void>}
 */
export function initializeAdMob() {
  if (!Capacitor.isNativePlatform()) return Promise.resolve()
  if (!initializePromise) {
    initializePromise = AdMob.initialize({
      testingDevices: ['EMULATOR'],
      initializeForTesting: true,
    }).catch((e) => {
      initializePromise = null
      throw e
    })
  }
  return initializePromise
}

/**
 * 갤러리 화면 전용 하단 배너
 */
export async function showGalleryBanner() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await initializeAdMob()
    await AdMob.showBanner({
      adId: TEST_GALLERY_BANNER_ID,
      adSize: BannerAdSize.BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 56,
      isTesting: true,
    })
  } catch (e) {
    console.warn('[AdMob] gallery banner', e)
  }
}

/**
 * 갤러리 이탈 시 배너 숨김
 */
export async function hideGalleryBanner() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await AdMob.hideBanner()
  } catch (e) {
    console.warn('[AdMob] hide gallery banner', e)
  }
}

/**
 * @param {{ adsEnabled?: boolean }} opts — false면 초기화 생략(예: 웹 스플래시 구간)
 */
export function useAdMob(opts = {}) {
  const { adsEnabled = true } = opts
  const interstitialCountRef = useRef(0)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined
    if (!adsEnabled) return undefined

    let cancelled = false
    async function run() {
      try {
        await initializeAdMob()
      } catch (e) {
        if (!cancelled) console.warn('[AdMob] init', e)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [adsEnabled])

  const showInterstitialAfterGallerySend = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return
    interstitialCountRef.current += 1
    const n = interstitialCountRef.current
    if (n % 3 !== 0) return
    try {
      await initializeAdMob()
      await AdMob.prepareInterstitial({
        adId: TEST_INTERSTITIAL_ID,
        isTesting: true,
      })
      await AdMob.showInterstitial()
    } catch (e) {
      console.warn('[AdMob] interstitial', e)
    }
  }, [])

  return { showInterstitialAfterGallerySend }
}
