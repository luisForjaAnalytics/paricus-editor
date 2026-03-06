import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { SpecialCharsIcon } from "@/components/tiptap-icons/special-chars-icon"
import { ChevronDownIcon } from "@/components/tiptap-icons/chevron-down-icon"
import { Button } from "@/components/tiptap-ui-primitive/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/tiptap-ui-primitive/dropdown-menu"

import "./special-chars-button.scss"

const CATEGORIES = {
  symbols: ["©", "®", "™", "§", "¶", "†", "‡", "°", "±", "×", "÷", "≠", "≈", "≤", "≥", "∞", "√", "∑", "∏", "∫", "∂", "Δ", "π", "µ"],
  arrows: ["←", "→", "↑", "↓", "↔", "↕", "⇐", "⇒", "⇑", "⇓", "⇔", "➜"],
  currency: ["€", "£", "¥", "¢", "₹", "₿", "₽", "₩", "₫", "₺", "₴", "₸"],
  punctuation: ["—", "–", "…", "•", "·", "«", "»", "¿", "¡", "‰", "‹", "›"],
}

const CATEGORY_KEYS = Object.keys(CATEGORIES)

export function SpecialCharsButton({ editor: providedEditor, portal = false, ...props }) {
  const { t } = useTranslation()
  const { editor } = useTiptapEditor(providedEditor)
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(CATEGORY_KEYS[0])

  const handleInsert = useCallback(
    (char) => {
      if (!editor) return
      editor.chain().focus().insertContent(char).run()
      setIsOpen(false)
    },
    [editor]
  )

  const tabLabels = {
    symbols: t("toolbar.specialCharsSymbols"),
    arrows: t("toolbar.specialCharsArrows"),
    currency: t("toolbar.specialCharsCurrency"),
    punctuation: t("toolbar.specialCharsPunctuation"),
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={!editor}
          data-disabled={!editor}
          aria-label={t("toolbar.specialChars")}
          tooltip={t("toolbar.specialChars")}
          {...props}
        >
          <SpecialCharsIcon className="tiptap-button-icon" />
          <ChevronDownIcon className="tiptap-button-dropdown-small" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" portal={portal}>
        <div className="special-chars-panel">
          <div className="special-chars-tabs">
            {CATEGORY_KEYS.map((key) => (
              <button
                key={key}
                className={activeTab === key ? "active" : ""}
                onClick={() => setActiveTab(key)}
              >
                {tabLabels[key]}
              </button>
            ))}
          </div>
          <div className="special-chars-grid">
            {CATEGORIES[activeTab].map((char) => (
              <button
                key={char}
                onClick={() => handleInsert(char)}
                title={char}
              >
                {char}
              </button>
            ))}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
