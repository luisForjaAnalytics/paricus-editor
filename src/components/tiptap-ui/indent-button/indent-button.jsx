import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { IndentIcon } from "@/components/tiptap-icons/indent-icon"
import { OutdentIcon } from "@/components/tiptap-icons/outdent-icon"

function canIndentBlock(editor, isIndent) {
  if (!editor?.state) return false
  const { $from } = editor.state.selection
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d)
    if (node.type.name === "paragraph" || node.type.name === "heading") {
      return isIndent ? true : (node.attrs.indent || 0) > 0
    }
  }
  return false
}

export function IndentButton({ direction = "indent", editor: providedEditor, ...props }) {
  const { t } = useTranslation()
  const { editor } = useTiptapEditor(providedEditor)

  const isIndent = direction === "indent"
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (!editor) return

    const update = () => {
      const isEditable = editor.isEditable
      if (!isEditable) { setEnabled(false); return }

      const listCmd = isIndent ? "sinkListItem" : "liftListItem"
      const canList = editor.can()[listCmd]("listItem")
      const canTask = editor.can()[listCmd]("taskItem")
      const canBlock = canIndentBlock(editor, isIndent)
      setEnabled(canList || canTask || canBlock)
    }

    update()
    editor.on("transaction", update)
    return () => editor.off("transaction", update)
  }, [editor, isIndent])

  const handleClick = useCallback(() => {
    if (!editor) return
    const cmd = isIndent ? "sinkListItem" : "liftListItem"
    if (editor.can()[cmd]("listItem")) {
      editor.chain().focus()[cmd]("listItem").run()
    } else if (editor.can()[cmd]("taskItem")) {
      editor.chain().focus()[cmd]("taskItem").run()
    } else if (isIndent) {
      editor.chain().focus().indent().run()
    } else {
      editor.chain().focus().outdent().run()
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
