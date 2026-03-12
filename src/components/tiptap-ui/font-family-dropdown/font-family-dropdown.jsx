import { forwardRef, useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { ChevronDownIcon } from "@/components/tiptap-icons/chevron-down-icon"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

import { Button, ButtonGroup } from "@/components/tiptap-ui-primitive/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/tiptap-ui-primitive/dropdown-menu"
import { Card, CardBody } from "@/components/tiptap-ui-primitive/card"
import { GREEN_ITEM_STYLE } from "@/lib/editor-config"

const FONT_FAMILIES = [
  { label: "Inter", value: "Inter" },
  { label: "Arial", value: "Arial" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Georgia", value: "Georgia" },
  { label: "Verdana", value: "Verdana" },
  { label: "Courier New", value: "Courier New" },
]

function getActiveFontFamily(editor) {
  if (!editor || !editor.isEditable) return null
  const attrs = editor.getAttributes("textStyle")
  return attrs.fontFamily || null
}

export const FontFamilyDropdown = forwardRef(
  ({ editor: providedEditor, portal = false, onOpenChange, ...buttonProps }, ref) => {
    const { t } = useTranslation()
    const { editor } = useTiptapEditor(providedEditor)
    const [isOpen, setIsOpen] = useState(false)
    const [activeFont, setActiveFont] = useState(null)

    useEffect(() => {
      if (!editor) return

      const handleUpdate = () => {
        setActiveFont(getActiveFontFamily(editor))
      }

      handleUpdate()
      editor.on("selectionUpdate", handleUpdate)
      editor.on("transaction", handleUpdate)

      return () => {
        editor.off("selectionUpdate", handleUpdate)
        editor.off("transaction", handleUpdate)
      }
    }, [editor])

    const handleOpenChange = useCallback(
      (open) => {
        if (!editor) return
        setIsOpen(open)
        onOpenChange?.(open)
      },
      [editor, onOpenChange]
    )

    const handleSelect = useCallback(
      (fontValue) => {
        if (!editor) return
        if (activeFont === fontValue) {
          editor.chain().focus().unsetFontFamily().run()
        } else {
          editor.chain().focus().setFontFamily(fontValue).run()
        }
        setIsOpen(false)
      },
      [editor, activeFont]
    )

    if (!editor) return null

    const displayLabel = activeFont
      ? FONT_FAMILIES.find((f) => f.value === activeFont)?.label || activeFont
      : FONT_FAMILIES[0].label

    return (
      <DropdownMenu modal open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            role="button"
            tabIndex={-1}
            data-active-state={activeFont ? "on" : "off"}
            aria-label={t("toolbar.fontFamily")}
            tooltip={t("toolbar.fontFamily")}
            style={{ border: "1px solid rgba(0, 0, 0, 0.12)" }}
            {...buttonProps}
            ref={ref}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                width: "90px",
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayLabel}
            </span>
            <ChevronDownIcon className="tiptap-button-dropdown-small" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" portal={portal}>
          <Card>
            <CardBody>
              <ButtonGroup orientation="vertical">
                {FONT_FAMILIES.map((font) => (
                  <DropdownMenuItem key={font.value} asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      data-active-state={activeFont === font.value ? "on" : "off"}
                      onClick={() => handleSelect(font.value)}
                      style={{
                        justifyContent: "flex-start",
                        fontFamily: font.value,
                        minWidth: "160px",
                        ...GREEN_ITEM_STYLE,
                      }}
                    >
                      <span style={{ fontSize: "13px" }}>{font.label}</span>
                    </Button>
                  </DropdownMenuItem>
                ))}
              </ButtonGroup>
            </CardBody>
          </Card>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
)

FontFamilyDropdown.displayName = "FontFamilyDropdown"

export default FontFamilyDropdown
