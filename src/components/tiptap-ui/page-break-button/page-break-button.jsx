import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { PageBreakIcon } from "@/components/tiptap-icons/page-break-icon"

export function PageBreakButton({ editor: providedEditor, ...props }) {
  const { t } = useTranslation()
  const { editor } = useTiptapEditor(providedEditor)

  const handleClick = useCallback(() => {
    if (!editor) return
    editor.commands.setPageBreak()
  }, [editor])

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={!editor}
      data-disabled={!editor}
      aria-label={t("toolbar.pageBreak")}
      tooltip={t("toolbar.pageBreak")}
      onClick={handleClick}
      {...props}
    >
      <PageBreakIcon className="tiptap-button-icon" />
    </Button>
  )
}
