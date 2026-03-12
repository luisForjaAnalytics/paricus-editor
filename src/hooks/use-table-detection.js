import { useEffect, useState, useRef, useCallback } from "react"

/**
 * Hook that detects when the editor cursor is inside a table.
 * Returns the table DOM element for positioning floating toolbars.
 */
export function useTableDetection(editor) {
  const [isInTable, setIsInTable] = useState(false)
  const [tableElement, setTableElement] = useState(null)
  const tablePos = useRef(null)

  const detect = useCallback(() => {
    if (!editor || editor.isDestroyed) {
      setIsInTable(false)
      setTableElement(null)
      tablePos.current = null
      return
    }

    const { $from } = editor.state.selection
    let found = false

    for (let depth = $from.depth; depth >= 0; depth--) {
      if ($from.node(depth).type.name === "table") {
        const pos = $from.before(depth)
        found = true

        // Only update DOM ref if position changed
        if (tablePos.current !== pos) {
          tablePos.current = pos
          const dom = editor.view.nodeDOM(pos)
          if (dom) {
            const el = dom.tagName === "TABLE" ? dom : dom.querySelector("table")
            setTableElement(el || dom)
          }
        }
        break
      }
    }

    if (found !== isInTable) {
      setIsInTable(found)
      if (!found) {
        setTableElement(null)
        tablePos.current = null
      }
    }
  }, [editor, isInTable])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    const handler = () => detect()

    editor.on("selectionUpdate", handler)
    editor.on("transaction", handler)

    // Initial detection
    detect()

    return () => {
      editor.off("selectionUpdate", handler)
      editor.off("transaction", handler)
    }
  }, [editor, detect])

  return { isInTable, tableElement }
}
