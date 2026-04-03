import { createContext, createElement, useContext, useEffect, useState } from 'react'
import { ko } from '../locales/ko'
import { en } from '../locales/en'
import { ja } from '../locales/ja'

const locales = { ko, en, ja }

export function readInitialLang() {
  try {
    const s = localStorage.getItem('withworth_lang')
    if (s === 'en' || s === 'ja' || s === 'ko') return s
  } catch {
    /* ignore */
  }
  return 'ko'
}

export const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(readInitialLang)

  useEffect(() => {
    try {
      localStorage.setItem('withworth_lang', lang)
    } catch {
      /* ignore */
    }
  }, [lang])

  const t = locales[lang] ?? locales.ko

  return createElement(LanguageContext.Provider, { value: { lang, setLang, t } }, children)
}

export const useLang = () => useContext(LanguageContext)
