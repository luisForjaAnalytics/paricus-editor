import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { TableIcon } from "@/components/tiptap-icons/table-icon"
import { ChevronDownIcon } from "@/components/tiptap-icons/chevron-down-icon"
import { TrashIcon } from "@/components/tiptap-icons/trash-icon"
import { Button, ButtonGroup } from "@/components/tiptap-ui-primitive/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/tiptap-ui-primitive/dropdown-menu"
import { Card, CardBody } from "@/components/tiptap-ui-primitive/card"

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

export function TableDropdownMenu({ editor: providedEditor, portal = false, ...props }) {
  const { t } = useTranslation()
  const { editor } = useTiptapEditor(providedEditor)
  const [isOpen, setIsOpen] = useState(false)

  const isInTable = editor?.isActive("table")

  const insertTable = useCallback(
    (rows, cols) => {
      if (!editor) return
      editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
      setIsOpen(false)
    },
    [editor]
  )

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
          data-active-state={isInTable ? "on" : "off"}
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
            {!isInTable ? (
              <GridPicker onSelect={insertTable} />
            ) : (
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
                <DropdownMenuItem asChild>
                  <Button variant="ghost" onClick={() => runCommand("deleteTable")} style={{ justifyContent: "flex-start", width: "100%", color: "var(--tt-red-500, #ef4444)" }}>
                    <TrashIcon className="tiptap-button-icon" />
                    {t("toolbar.tableDelete")}
                  </Button>
                </DropdownMenuItem>
              </ButtonGroup>
            )}
          </CardBody>
        </Card>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
