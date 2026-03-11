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

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48]

function getActiveFontSize(editor) {
  if (!editor || !editor.isEditable) return null
  const attrs = editor.getAttributes("textStyle")
  if (!attrs.fontSize) return null
  return parseInt(attrs.fontSize, 10) || null
}

export const FontSizeDropdown = forwardRef(
  ({ editor: providedEditor, portal = false, onOpenChange, ...buttonProps }, ref) => {
    const { t } = useTranslation()
    const { editor } = useTiptapEditor(providedEditor)
    const [isOpen, setIsOpen] = useState(false)
    const [activeSize, setActiveSize] = useState(null)

    useEffect(() => {
      if (!editor) return

      const handleUpdate = () => {
        setActiveSize(getActiveFontSize(editor))
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
      (size) => {
        if (!editor) return
        if (activeSize === size) {
          editor.chain().focus().unsetFontSize().run()
        } else {
          editor.chain().focus().setFontSize(size).run()
        }
        setIsOpen(false)
      },
      [editor, activeSize]
    )

    if (!editor) return null

    return (
      <DropdownMenu modal open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            role="button"
            tabIndex={-1}
            aria-label={t("toolbar.fontSize")}
            tooltip={t("toolbar.fontSize")}
            {...buttonProps}
            ref={ref}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                minWidth: "20px",
                textAlign: "center",
              }}
            >
              {activeSize || 12}
            </span>
            <ChevronDownIcon className="tiptap-button-dropdown-small" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" portal={portal}>
          <Card>
            <CardBody>
              <ButtonGroup>
                {FONT_SIZES.map((size) => (
                  <DropdownMenuItem key={size} asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      data-active-state={activeSize === size ? "on" : "off"}
                      onClick={() => handleSelect(size)}
                      style={{ justifyContent: "center", minWidth: "40px" }}
                    >
                      <span style={{ fontSize: "13px" }}>{size}</span>
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

FontSizeDropdown.displayName = "FontSizeDropdown"

export default FontSizeDropdown
