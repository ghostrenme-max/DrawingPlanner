import { Capacitor } from '@capacitor/core'

/**
 * 네이티브: 카메라/갤러리 프롬프트. 웹에서는 빈 문자열 (웹은 `<input type="file">` 사용).
 * @returns {Promise<string>} Capacitor webPath 등
 */
export async function pickChaseImageNative() {
  if (!Capacitor.isNativePlatform()) return ''
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
  const photo = await Camera.getPhoto({
    quality: 85,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: CameraSource.Prompt,
  })
  return photo.webPath ?? ''
}
