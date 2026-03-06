import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { RemoveFormattingIcon } from "@/components/tiptap-icons/remove-formatting-icon"

export function RemoveFormattingButton({ editor: providedEditor, ...props }) {
  const { t } = useTranslation()
  const { editor } = useTiptapEditor(providedEditor)

  const handleClick = useCallback(() => {
    if (!editor) return
    editor.chain().focus().clearNodes().unsetAllMarks().run()
  }, [editor])

  const label = t("toolbar.removeFormatting")

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={!editor}
      data-disabled={!editor}
      aria-label={label}
      tooltip={label}
      onClick={handleClick}
      {...props}
    >
      <RemoveFormattingIcon className="tiptap-button-icon" />
    </Button>
  )
}
