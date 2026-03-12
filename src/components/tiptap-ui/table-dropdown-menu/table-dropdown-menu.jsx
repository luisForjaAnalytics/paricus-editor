import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { useTableDetection } from "@/hooks/use-table-detection"
import { TableIcon } from "@/components/tiptap-icons/table-icon"
import { ChevronDownIcon } from "@/components/tiptap-icons/chevron-down-icon"
import { TrashIcon } from "@/components/tiptap-icons/trash-icon"
import { BanIcon } from "@/components/tiptap-icons/ban-icon"
import { AlignLeftIcon } from "@/components/tiptap-icons/align-left-icon"
import { AlignCenterIcon } from "@/components/tiptap-icons/align-center-icon"
import { AlignRightIcon } from "@/components/tiptap-icons/align-right-icon"
import { Button, ButtonGroup } from "@/components/tiptap-ui-primitive/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/tiptap-ui-primitive/dropdown-menu"
import { Card, CardBody } from "@/components/tiptap-ui-primitive/card"
import { Separator } from "@/components/tiptap-ui-primitive/separator"

const CELL_COLORS = [
  { i18nKey: "gray", color: "#f3f4f6", border: "#d1d5db" },
  { i18nKey: "red", color: "#fee2e2", border: "#fca5a5" },
  { i18nKey: "orange", color: "#ffedd5", border: "#fdba74" },
  { i18nKey: "yellow", color: "#fef9c3", border: "#fde68a" },
  { i18nKey: "green", color: "#dcfce7", border: "#86efac" },
  { i18nKey: "blue", color: "#dbeafe", border: "#93c5fd" },
  { i18nKey: "purple", color: "#f3e8ff", border: "#d8b4fe" },
  { i18nKey: "pink", color: "#fce7f3", border: "#f9a8d4" },
]

const WIDTH_OPTIONS = ["100%", "75%", "50%"]

const sectionLabelStyle = {
  fontSize: "0.7rem",
  fontWeight: 600,
  color: "var(--tt-gray-light-a-500)",
  padding: "0.25rem 0.5rem 0.1rem",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
}

/* ─── Grid Picker (insert table) ─── */

function GridPicker({ onSelect }) {
  const { t } = useTranslation()
  const [hover, setHover] = useState({ row: 0, col: 0 })

  const rows = 6
  const cols = 6

  return (
    <div style={{ padding: "0.25rem" }}>
      <div
        style={{ fontSize: "0.75rem", marginBottom: "0.25rem", textAlign: "center", color: "var(--tt-gray-light-a-500)" }}
      >
        {hover.row > 0 ? `${hover.row} × ${hover.col}` : t("toolbar.tableSelect")}
      </div>
      <div
        style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "2px" }}
        onMouseLeave={() => setHover({ row: 0, col: 0 })}
      >
        {Array.from({ length: rows * cols }, (_, i) => {
          const r = Math.floor(i / cols) + 1
          const c = (i % cols) + 1
          const active = r <= hover.row && c <= hover.col
          return (
            <div
              key={i}
              onMouseEnter={() => setHover({ row: r, col: c })}
              onClick={() => onSelect(r, c)}
              style={{
                width: "18px",
                height: "18px",
                border: "1px solid var(--tt-gray-light-a-300)",
                borderRadius: "2px",
                cursor: "pointer",
                backgroundColor: active ? "var(--tt-blue-500, #3b82f6)" : "transparent",
                opacity: active ? 0.7 : 1,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

/* ─── Insert Table Button ─── */

export function TableDropdownMenu({ editor: providedEditor, portal = false, ...props }) {
  const { t } = useTranslation()
  const { editor } = useTiptapEditor(providedEditor)
  const [isOpen, setIsOpen] = useState(false)

  const insertTable = useCallback(
    (rows, cols) => {
      if (!editor) return
      editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
      setIsOpen(false)
    },
    [editor]
  )

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={!editor}
          data-disabled={!editor}
          aria-label={t("toolbar.table")}
          tooltip={t("toolbar.table")}
          {...props}
        >
          <TableIcon className="tiptap-button-icon" />
          <ChevronDownIcon className="tiptap-button-dropdown-small" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" portal={portal}>
        <Card>
          <CardBody>
            <GridPicker onSelect={insertTable} />
          </CardBody>
        </Card>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ─── Edit Table Button (enabled only when cursor is in a table) ─── */

export function TableEditMenu({ editor: providedEditor, portal = false, ...props }) {
  const { t } = useTranslation()
  const { editor } = useTiptapEditor(providedEditor)
  const { isInTable } = useTableDetection(editor)
  const [isOpen, setIsOpen] = useState(false)

  const runCommand = useCallback(
    (command) => {
      editor?.chain().focus()[command]().run()
      setIsOpen(false)
    },
    [editor]
  )

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={!isInTable}
          data-disabled={!isInTable}
          data-active-state={isInTable ? "on" : "off"}
          aria-label={t("toolbar.tableToolbar")}
          tooltip={t("toolbar.tableToolbar")}
          style={{ opacity: isInTable ? 1 : 0.4 }}
          {...props}
        >
          {/* Grid + pencil table-edit icon */}
          <svg className="tiptap-button-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="1" y="1" width="5" height="5" rx="1" />
            <rect x="8" y="1" width="5" height="5" rx="1" />
            <rect x="1" y="8" width="5" height="5" rx="1" />
            <rect x="8" y="8" width="5" height="5" rx="1" opacity="0.35" />
            <rect x="15" y="1" width="5" height="5" rx="1" opacity="0.35" />
            <rect x="1" y="15" width="5" height="5" rx="1" opacity="0.35" />
            {/* Pencil pointing bottom-left */}
            <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 7 L12 16" />
              <path d="M23 9 L14 18" />
              <path d="M21 7 L23 9" />
              <path d="M12 16 L14 18" />
              <path d="M12 16 L10 22 L16 20 L14 18" fill="currentColor" />
            </g>
          </svg>
          <ChevronDownIcon className="tiptap-button-dropdown-small" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" portal={portal}>
        <Card>
          <CardBody>
            <div style={{ minWidth: "200px" }}>
              <ButtonGroup orientation="vertical">
                {[
                  { cmd: "addRowBefore", label: "tableAddRowBefore" },
                  { cmd: "addRowAfter", label: "tableAddRowAfter" },
                  { cmd: "addColumnBefore", label: "tableAddColBefore" },
                  { cmd: "addColumnAfter", label: "tableAddColAfter" },
                  { cmd: "deleteRow", label: "tableDeleteRow" },
                  { cmd: "deleteColumn", label: "tableDeleteCol" },
                  { cmd: "mergeCells", label: "tableMergeCells" },
                  { cmd: "splitCell", label: "tableSplitCell" },
                  { cmd: "toggleHeaderRow", label: "tableToggleHeader" },
                ].map(({ cmd, label }) => (
                  <DropdownMenuItem key={cmd} asChild>
                    <Button variant="ghost" onClick={() => runCommand(cmd)} style={{ justifyContent: "flex-start", width: "100%" }}>
                      {t(`toolbar.${label}`)}
                    </Button>
                  </DropdownMenuItem>
                ))}
              </ButtonGroup>

              <Separator orientation="horizontal" />

              {/* Table Alignment */}
              <div style={sectionLabelStyle}>{t("toolbar.tableAlign")}</div>
              <div style={{ display: "flex", gap: "2px", padding: "0.25rem 0.5rem" }}>
                <Button variant="ghost" onClick={() => { editor?.chain().focus().setTableAlignment("left").run() }} tooltip={t("toolbar.tableAlignLeft")} style={{ flex: 1 }}>
                  <AlignLeftIcon className="tiptap-button-icon" />
                </Button>
                <Button variant="ghost" onClick={() => { editor?.chain().focus().setTableAlignment("center").run() }} tooltip={t("toolbar.tableAlignCenter")} style={{ flex: 1 }}>
                  <AlignCenterIcon className="tiptap-button-icon" />
                </Button>
                <Button variant="ghost" onClick={() => { editor?.chain().focus().setTableAlignment("right").run() }} tooltip={t("toolbar.tableAlignRight")} style={{ flex: 1 }}>
                  <AlignRightIcon className="tiptap-button-icon" />
                </Button>
              </div>

              {/* Table Width */}
              <div style={sectionLabelStyle}>{t("toolbar.tableWidth")}</div>
              <div style={{ display: "flex", gap: "2px", padding: "0.25rem 0.5rem" }}>
                {WIDTH_OPTIONS.map((value) => (
                  <Button
                    key={value}
                    variant="ghost"
                    onClick={() => { editor?.chain().focus().setTableWidth(value).run() }}
                    tooltip={value}
                    style={{ flex: 1, fontSize: "0.7rem", padding: "0.25rem" }}
                  >
                    {value}
                  </Button>
                ))}
              </div>

              <Separator orientation="horizontal" />

              {/* Cell Background Color */}
              <div style={sectionLabelStyle}>{t("toolbar.tableCellColor")}</div>
              <div style={{ display: "flex", gap: "3px", padding: "0.25rem 0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                {CELL_COLORS.map((c) => (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() => { editor?.chain().focus().setCellAttribute("backgroundColor", c.color).run() }}
                    title={t(`cellColors.${c.i18nKey}`)}
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      border: `2px solid ${c.border}`,
                      backgroundColor: c.color,
                      cursor: "pointer",
                      padding: 0,
                      flexShrink: 0,
                    }}
                  />
                ))}
                <Button
                  variant="ghost"
                  onClick={() => { editor?.chain().focus().setCellAttribute("backgroundColor", null).run() }}
                  tooltip={t("toolbar.tableCellColorRemove")}
                  style={{ padding: "0.15rem", minWidth: "auto" }}
                >
                  <BanIcon className="tiptap-button-icon" />
                </Button>
              </div>

              <Separator orientation="horizontal" />

              {/* Delete Table */}
              <ButtonGroup orientation="vertical">
                <DropdownMenuItem asChild>
                  <Button variant="ghost" onClick={() => runCommand("deleteTable")} style={{ justifyContent: "flex-start", width: "100%", color: "var(--tt-red-500, #ef4444)" }}>
                    <TrashIcon className="tiptap-button-icon" />
                    {t("toolbar.tableDelete")}
                  </Button>
                </DropdownMenuItem>
              </ButtonGroup>
            </div>
          </CardBody>
        </Card>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
