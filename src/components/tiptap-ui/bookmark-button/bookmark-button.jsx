import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { BookmarkIcon } from "@/components/tiptap-icons/bookmark-icon"
import { TrashIcon } from "@/components/tiptap-icons/trash-icon"
import { ChevronDownIcon } from "@/components/tiptap-icons/chevron-down-icon"
import { Button, ButtonGroup } from "@/components/tiptap-ui-primitive/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/tiptap-ui-primitive/dropdown-menu"
import { Card, CardBody } from "@/components/tiptap-ui-primitive/card"

function getBookmarks(editor) {
  if (!editor) return []
  const bookmarks = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "bookmark") {
      bookmarks.push({ id: node.attrs.id, label: node.attrs.label, pos })
    }
  })
  return bookmarks
}

export function BookmarkButton({ editor: providedEditor, portal = false, ...props }) {
  const { t } = useTranslation()
  const { editor } = useTiptapEditor(providedEditor)
  const [isOpen, setIsOpen] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [name, setName] = useState("")

  const bookmarks = isOpen ? getBookmarks(editor) : []

  const handleAdd = useCallback(() => {
    if (!editor || !name.trim()) return
    const id = name.trim().toLowerCase().replace(/\s+/g, "-")
    editor.commands.setBookmark({ id, label: name.trim() })
    setName("")
    setShowInput(false)
    setIsOpen(false)
  }, [editor, name])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleAdd()
      } else if (e.key === "Escape") {
        setShowInput(false)
        setName("")
      }
    },
    [handleAdd]
  )

  const handleGoTo = useCallback(
    (pos) => {
      if (!editor) return
      editor.chain().focus().setTextSelection(pos).scrollIntoView().run()
      setIsOpen(false)
    },
    [editor]
  )

  const handleDelete = useCallback(
    (e, id) => {
      e.stopPropagation()
      if (!editor) return
      editor.commands.removeBookmark(id)
    },
    [editor]
  )

  return (
    <DropdownMenu open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) { setShowInput(false); setName("") } }}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={!editor}
          data-disabled={!editor}
          aria-label={t("toolbar.bookmark")}
          tooltip={t("toolbar.bookmark")}
          {...props}
        >
          <BookmarkIcon className="tiptap-button-icon" />
          <ChevronDownIcon className="tiptap-button-dropdown-small" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" portal={portal}>
        <Card>
          <CardBody>
            <ButtonGroup orientation="vertical">
              {!showInput ? (
                <DropdownMenuItem asChild onSelect={(e) => { e.preventDefault(); setShowInput(true) }}>
                  <Button variant="ghost" style={{ justifyContent: "flex-start", width: "100%" }}>
                    {t("toolbar.bookmarkAdd")}
                  </Button>
                </DropdownMenuItem>
              ) : (
                <div style={{ display: "flex", gap: "4px", padding: "4px", alignItems: "center" }}>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t("toolbar.bookmarkName")}
                    autoFocus
                    style={{
                      flex: 1,
                      padding: "4px 8px",
                      fontSize: "0.8125rem",
                      border: "1px solid var(--tt-gray-light-a-300)",
                      borderRadius: "4px",
                      outline: "none",
                      minWidth: 0,
                    }}
                  />
                  <Button variant="ghost" onClick={handleAdd} disabled={!name.trim()} style={{ padding: "4px 8px", fontSize: "0.75rem" }}>
                    {t("toolbar.bookmarkConfirm")}
                  </Button>
                </div>
              )}
              {bookmarks.length > 0 && (
                <>
                  <div style={{ fontSize: "0.6875rem", color: "var(--tt-gray-light-a-500)", padding: "6px 8px 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {t("toolbar.bookmarkList")}
                  </div>
                  {bookmarks.map((bm) => (
                    <DropdownMenuItem key={bm.id} asChild>
                      <Button
                        variant="ghost"
                        onClick={() => handleGoTo(bm.pos)}
                        style={{ justifyContent: "space-between", width: "100%", gap: "8px" }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {bm.label}
                        </span>
                        <span
                          onClick={(e) => handleDelete(e, bm.id)}
                          style={{ cursor: "pointer", flexShrink: 0, display: "flex" }}
                        >
                          <TrashIcon className="tiptap-button-icon" style={{ width: "14px", height: "14px", color: "var(--tt-red-500, #ef4444)" }} />
                        </span>
                      </Button>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </ButtonGroup>
          </CardBody>
        </Card>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
