import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { TocIcon } from "@/components/tiptap-icons/toc-icon"

export function TocButton({ editor: providedEditor, ...props }) {
  const { t } = useTranslation()
  const { editor } = useTiptapEditor(providedEditor)

  const handleClick = useCallback(() => {
    if (!editor) return
    editor.commands.setTableOfContents()
  }, [editor])

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={!editor}
      data-disabled={!editor}
      aria-label={t("toolbar.tableOfContents")}
      tooltip={t("toolbar.tableOfContents")}
      onClick={handleClick}
      {...props}
    >
      <TocIcon className="tiptap-button-icon" />
    </Button>
  )
}
