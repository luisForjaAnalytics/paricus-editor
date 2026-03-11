import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/tiptap-ui-primitive/button"

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
]

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()

  const handleToggle = useCallback(() => {
    const currentIndex = LANGUAGES.findIndex((l) => l.code === i18n.language)
    const next = LANGUAGES[(currentIndex + 1) % LANGUAGES.length]
    i18n.changeLanguage(next.code)
  }, [i18n])

  const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0]

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={handleToggle}
      aria-label={t("toolbar.language")}
      tooltip={t("toolbar.language")}
    >
      <span
        style={{
          fontSize: "12px",
          fontWeight: 600,
          minWidth: "20px",
          textAlign: "center",
        }}
      >
        {current.label}
      </span>
    </Button>
  )
}
