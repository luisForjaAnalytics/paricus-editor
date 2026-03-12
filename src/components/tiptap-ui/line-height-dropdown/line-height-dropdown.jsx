import { forwardRef, useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { LineHeightIcon } from "@/components/tiptap-icons/line-height-icon"
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

const LINE_HEIGHTS = [0.5, 1, 1.15, 1.5, 2, 2.5, 3]

function getActiveLineHeight(editor) {
  if (!editor || !editor.isEditable) return null
  const attrs = editor.getAttributes("paragraph")
  if (!attrs.lineHeight) return null
  return parseFloat(attrs.lineHeight) || null
}

export const LineHeightDropdown = forwardRef(
  ({ editor: providedEditor, portal = false, onOpenChange, ...buttonProps }, ref) => {
    const { t } = useTranslation()
    const { editor } = useTiptapEditor(providedEditor)
    const [isOpen, setIsOpen] = useState(false)
    const [activeHeight, setActiveHeight] = useState(null)

    useEffect(() => {
      if (!editor) return

      const handleUpdate = () => {
        setActiveHeight(getActiveLineHeight(editor))
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
      (height) => {
        if (!editor) return
        if (activeHeight === height) {
          editor.chain().focus().unsetLineHeight().run()
        } else {
          editor.chain().focus().setLineHeight(String(height)).run()
        }
        setIsOpen(false)
      },
      [editor, activeHeight]
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
            data-active-state={activeHeight ? "on" : "off"}
            aria-label={t("toolbar.lineHeight")}
            tooltip={t("toolbar.lineHeight")}
            {...buttonProps}
            ref={ref}
          >
            <LineHeightIcon className="tiptap-button-icon" />
            <ChevronDownIcon className="tiptap-button-dropdown-small" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" portal={portal}>
          <Card>
            <CardBody>
              <ButtonGroup>
                {LINE_HEIGHTS.map((height) => (
                  <DropdownMenuItem key={height} asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      data-active-state={activeHeight === height ? "on" : "off"}
                      onClick={() => handleSelect(height)}
                      style={{ justifyContent: "center", minWidth: "40px", ...GREEN_ITEM_STYLE }}
                    >
                      <span style={{ fontSize: "13px" }}>{height}</span>
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

LineHeightDropdown.displayName = "LineHeightDropdown"

export default LineHeightDropdown
