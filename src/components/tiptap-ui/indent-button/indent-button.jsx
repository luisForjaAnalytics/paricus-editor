import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { IndentIcon } from "@/components/tiptap-icons/indent-icon"
import { OutdentIcon } from "@/components/tiptap-icons/outdent-icon"

export function IndentButton({ direction = "indent", editor: providedEditor, ...props }) {
  const { t } = useTranslation()
  const { editor } = useTiptapEditor(providedEditor)

  const isIndent = direction === "indent"

  const command = isIndent ? "sinkListItem" : "liftListItem"
  const canList = editor?.isEditable && editor.can()[command]("listItem")
  const canTask = editor?.isEditable && editor.can()[command]("taskItem")
  const enabled = canList || canTask

  const handleClick = useCallback(() => {
    if (!editor) return
    const cmd = isIndent ? "sinkListItem" : "liftListItem"
    if (editor.can()[cmd]("listItem")) {
      editor.chain().focus()[cmd]("listItem").run()
    } else if (editor.can()[cmd]("taskItem")) {
      editor.chain().focus()[cmd]("taskItem").run()
    }
  }, [editor, isIndent])

  const label = isIndent ? t("toolbar.indent") : t("toolbar.outdent")

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={handleClick}
      disabled={!enabled}
      data-disabled={!enabled}
      aria-label={label}
      tooltip={label}
      {...props}
    >
      {isIndent ? (
        <IndentIcon className="tiptap-button-icon" />
      ) : (
        <OutdentIcon className="tiptap-button-icon" />
      )}
    </Button>
  )
}
