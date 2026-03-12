import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { useFloating, offset, flip, shift, autoUpdate } from "@floating-ui/react"

import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { useTableDetection } from "@/hooks/use-table-detection"

import { TrashIcon } from "@/components/tiptap-icons/trash-icon"
import { BanIcon } from "@/components/tiptap-icons/ban-icon"
import { AlignLeftIcon } from "@/components/tiptap-icons/align-left-icon"
import { AlignCenterIcon } from "@/components/tiptap-icons/align-center-icon"
import { AlignRightIcon } from "@/components/tiptap-icons/align-right-icon"

import { Button } from "@/components/tiptap-ui-primitive/button"
import { Separator } from "@/components/tiptap-ui-primitive/separator"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/tiptap-ui-primitive/popover"

import "./table-floating-toolbar.scss"

const CELL_COLORS = [
  { label: "Gray", color: "#f3f4f6", border: "#d1d5db" },
  { label: "Red", color: "#fee2e2", border: "#fca5a5" },
  { label: "Orange", color: "#ffedd5", border: "#fdba74" },
  { label: "Yellow", color: "#fef9c3", border: "#fde68a" },
  { label: "Green", color: "#dcfce7", border: "#86efac" },
  { label: "Blue", color: "#dbeafe", border: "#93c5fd" },
  { label: "Purple", color: "#f3e8ff", border: "#d8b4fe" },
  { label: "Pink", color: "#fce7f3", border: "#f9a8d4" },
]

const WIDTH_OPTIONS = [
  { value: "100%", label: "100%" },
  { value: "75%", label: "75%" },
  { value: "50%", label: "50%" },
]

function CellColorPicker({ editor, t }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="small"
          tooltip={t("toolbar.tableCellColor")}
          aria-label={t("toolbar.tableCellColor")}
          className="table-floating-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 0 0 0 20 2 2 0 0 0 2-2v-1a2 2 0 0 1 2-2h1a2 2 0 0 0 2-2 10 10 0 0 0-7-13z" />
            <circle cx="8" cy="10" r="1.5" fill="currentColor" />
            <circle cx="12" cy="7" r="1.5" fill="currentColor" />
            <circle cx="16" cy="10" r="1.5" fill="currentColor" />
            <circle cx="10" cy="14" r="1.5" fill="currentColor" />
          </svg>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="center" style={{ padding: "8px", width: "auto" }}>
        <div className="table-color-grid">
          {CELL_COLORS.map((c) => (
            <button
              key={c.color}
              type="button"
              className="table-color-swatch"
              onClick={() => editor.chain().focus().setCellAttribute("backgroundColor", c.color).run()}
              title={c.label}
              style={{
                backgroundColor: c.color,
                borderColor: c.border,
              }}
            />
          ))}
          <button
            type="button"
            className="table-color-swatch table-color-swatch--remove"
            onClick={() => editor.chain().focus().setCellAttribute("backgroundColor", null).run()}
            title={t("toolbar.tableCellColorRemove")}
          >
            <BanIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function TableFloatingToolbar({ editor: providedEditor }) {
  const { t } = useTranslation()
  const { editor } = useTiptapEditor(providedEditor)
  const { isInTable, tableElement } = useTableDetection(editor)
  const [visible, setVisible] = useState(false)

  // Virtual reference for floating-ui
  const virtualRef = useRef({
    getBoundingClientRect: () => new DOMRect(),
  })

  const { refs, floatingStyles } = useFloating({
    placement: "top",
    middleware: [offset(8), flip({ fallbackPlacements: ["bottom"] }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    elements: {
      reference: virtualRef.current,
    },
  })

  // Sync table element to virtual reference
  useEffect(() => {
    if (tableElement) {
      virtualRef.current = {
        getBoundingClientRect: () => tableElement.getBoundingClientRect(),
      }
      refs.setReference(virtualRef.current)
      setVisible(true)
    } else {
      setVisible(false)
    }
  }, [tableElement, refs])

  const runCmd = useCallback(
    (cmd) => {
      editor?.chain().focus()[cmd]().run()
    },
    [editor]
  )

  if (!editor || !isInTable || !visible) return null

  return createPortal(
    <div
      ref={refs.setFloating}
      className="table-floating-toolbar"
      style={floatingStyles}
      role="toolbar"
      aria-label={t("toolbar.tableToolbar")}
    >
      {/* Row/Column operations */}
      <Button variant="ghost" size="small" className="table-floating-btn" tooltip={t("toolbar.tableAddRowBefore")} onClick={() => runCmd("addRowBefore")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M3 12h18M12 3v6" />
        </svg>
      </Button>
      <Button variant="ghost" size="small" className="table-floating-btn" tooltip={t("toolbar.tableAddRowAfter")} onClick={() => runCmd("addRowAfter")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h18M3 18h18M12 15v6" />
        </svg>
      </Button>
      <Button variant="ghost" size="small" className="table-floating-btn" tooltip={t("toolbar.tableAddColBefore")} onClick={() => runCmd("addColumnBefore")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3v18M12 3v18M3 12h6" />
        </svg>
      </Button>
      <Button variant="ghost" size="small" className="table-floating-btn" tooltip={t("toolbar.tableAddColAfter")} onClick={() => runCmd("addColumnAfter")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v18M18 3v18M15 12h6" />
        </svg>
      </Button>

      <Separator orientation="vertical" />

      <Button variant="ghost" size="small" className="table-floating-btn" tooltip={t("toolbar.tableDeleteRow")} onClick={() => runCmd("deleteRow")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h18M9 9l6 6M15 9l-6 6" />
        </svg>
      </Button>
      <Button variant="ghost" size="small" className="table-floating-btn" tooltip={t("toolbar.tableDeleteCol")} onClick={() => runCmd("deleteColumn")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v18M9 9l6 6M15 9l-6 6" />
        </svg>
      </Button>

      <Separator orientation="vertical" />

      <Button variant="ghost" size="small" className="table-floating-btn" tooltip={t("toolbar.tableMergeCells")} onClick={() => runCmd("mergeCells")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18M15 3v18M3 12h18" />
        </svg>
      </Button>
      <Button variant="ghost" size="small" className="table-floating-btn" tooltip={t("toolbar.tableSplitCell")} onClick={() => runCmd("splitCell")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M12 3v18" />
        </svg>
      </Button>

      <Separator orientation="vertical" />

      <Button variant="ghost" size="small" className="table-floating-btn" tooltip={t("toolbar.tableToggleHeader")} onClick={() => runCmd("toggleHeaderRow")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
          <rect x="4" y="4" width="16" height="4" fill="currentColor" opacity="0.3" />
        </svg>
      </Button>

      <Separator orientation="vertical" />

      {/* Table Alignment */}
      <Button variant="ghost" size="small" className="table-floating-btn" tooltip={t("toolbar.tableAlignLeft")} onClick={() => editor.chain().focus().setTableAlignment("left").run()}>
        <AlignLeftIcon style={{ width: 16, height: 16 }} />
      </Button>
      <Button variant="ghost" size="small" className="table-floating-btn" tooltip={t("toolbar.tableAlignCenter")} onClick={() => editor.chain().focus().setTableAlignment("center").run()}>
        <AlignCenterIcon style={{ width: 16, height: 16 }} />
      </Button>
      <Button variant="ghost" size="small" className="table-floating-btn" tooltip={t("toolbar.tableAlignRight")} onClick={() => editor.chain().focus().setTableAlignment("right").run()}>
        <AlignRightIcon style={{ width: 16, height: 16 }} />
      </Button>

      <Separator orientation="vertical" />

      {/* Table Width */}
      {WIDTH_OPTIONS.map(({ value, label }) => (
        <Button
          key={value}
          variant="ghost"
          size="small"
          className="table-floating-btn table-floating-btn--text"
          tooltip={t("toolbar.tableWidth") + ": " + label}
          onClick={() => editor.chain().focus().setTableWidth(value).run()}
        >
          {label}
        </Button>
      ))}

      <Separator orientation="vertical" />

      {/* Cell Color */}
      <CellColorPicker editor={editor} t={t} />

      <Separator orientation="vertical" />

      {/* Delete Table */}
      <Button
        variant="ghost"
        size="small"
        className="table-floating-btn table-floating-btn--danger"
        tooltip={t("toolbar.tableDelete")}
        onClick={() => runCmd("deleteTable")}
      >
        <TrashIcon style={{ width: 16, height: 16 }} />
      </Button>
    </div>,
    document.body
  )
}
