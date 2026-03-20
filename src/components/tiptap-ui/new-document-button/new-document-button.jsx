import { forwardRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { Button } from "@/components/tiptap-ui-primitive/button"

function NewDocumentModal({ isOpen, onClose, onAccept }) {
  const { t } = useTranslation()

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") onClose()
      if (e.key === "Enter") onAccept()
    },
    [onClose, onAccept],
  )

  if (!isOpen) return null

  return createPortal(
    <div
      className="html-import-overlay"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="html-import-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 400, borderRadius: "1.5rem" }}
      >
        <div className="html-import-header">
          <div className="html-import-title">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1CAD5D"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            {t("toolbar.newDocument")}
          </div>
          <button
            type="button"
            className="html-import-close"
            onClick={onClose}
            aria-label={t("toolbar.close")}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div
          className="html-import-body"
          style={{ padding: "1.5rem", textAlign: "center" }}
        >
          <p style={{ margin: 0, fontSize: 14, color: "var(--tt-text-color, #333)" }}>
            {t("toolbar.newDocumentConfirm")}
          </p>
        </div>

        <div className="html-import-footer">
          <div className="html-import-actions">
            <button
              type="button"
              className="html-import-btn html-import-btn--accept"
              onClick={onAccept}
            >
              {t("toolbar.importHtmlAccept")}
            </button>
            <button
              type="button"
              className="html-import-btn html-import-btn--cancel"
              onClick={onClose}
            >
              {t("toolbar.importHtmlCancel")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export const NewDocumentButton = forwardRef(
  ({ editor: providedEditor, text, ...buttonProps }, ref) => {
    const { t } = useTranslation()
    const { editor } = useTiptapEditor(providedEditor)
    const [isOpen, setIsOpen] = useState(false)

    const hasContent = editor && !editor.isEmpty

    const handleOpen = useCallback(() => setIsOpen(true), [])
    const handleClose = useCallback(() => setIsOpen(false), [])

    const handleAccept = useCallback(() => {
      if (!editor) return
      try {
        editor.commands.clearContent()
      } catch {
        // clearContent may fail if editor is destroyed
      }
      setIsOpen(false)
    }, [editor])

    if (!editor) return null

    return (
      <>
        <Button
          ref={ref}
          type="button"
          variant="ghost"
          tooltip={t("toolbar.newDocument")}
          disabled={!hasContent}
          onClick={handleOpen}
          aria-label={t("toolbar.newDocument")}
          {...buttonProps}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          {text}
        </Button>
        <NewDocumentModal
          isOpen={isOpen}
          onClose={handleClose}
          onAccept={handleAccept}
        />
      </>
    )
  },
)

NewDocumentButton.displayName = "NewDocumentButton"
