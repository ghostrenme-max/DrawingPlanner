import { useCallback, useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { AdMob, BannerAdPosition, BannerAdSize } from '@capacitor-community/admob'

const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111'
const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712'

/**
 * @param {{ adsEnabled?: boolean }} opts — false면 배너 제거(예: 웹 스플래시 구간)
 */
export function useAdMob(opts = {}) {
  const { adsEnabled = true } = opts
  const interstitialCountRef = useRef(0)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined

    let cancelled = false

    async function run() {
      if (!adsEnabled) {
        try {
          await AdMob.removeBanner()
        } catch {
          /* ignore */
        }
        return
      }
      try {
        await AdMob.initialize({
          testingDevices: ['EMULATOR'],
          initializeForTesting: true,
        })
        if (cancelled) return
        await AdMob.showBanner({
          adId: TEST_BANNER_ID,
          adSize: BannerAdSize.BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 56,
          isTesting: true,
        })
      } catch (e) {
        console.warn('[AdMob] init/banner', e)
      }
    }

    void run()

    return () => {
      cancelled = true
      AdMob.removeBanner().catch(() => {})
    }
  }, [adsEnabled])

  const showInterstitialAfterGallerySend = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return
    interstitialCountRef.current += 1
    const n = interstitialCountRef.current
    if (n % 3 !== 0) return
    try {
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
