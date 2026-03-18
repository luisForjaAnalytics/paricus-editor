import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { createPortal } from "react-dom"

import { PagePortraitIcon } from "@/components/tiptap-icons/page-portrait-icon"
import { PageLandscapeIcon } from "@/components/tiptap-icons/page-landscape-icon"

export function PageOrientationModal({ editor, totalPages, onClose }) {
  const { t } = useTranslation()
  const globalO = editor.storage.pageBreak?.globalOrientation || "portrait"

  const buildPages = useCallback(() => {
    const pages = []
    const breakOrientations = []
    editor.state.doc.descendants((node) => {
      if (node.type.name === "pageBreak") {
        breakOrientations.push(node.attrs.orientation || null)
      }
    })
    for (let i = 0; i < totalPages; i++) {
      const orientation = i === 0
        ? globalO
        : (breakOrientations[i - 1] || globalO)
      pages.push({ index: i, label: String(i + 1), orientation })
    }
    return pages
  }, [editor, totalPages, globalO])

  const [pages, setPages] = useState(buildPages)

  useEffect(() => {
    setPages(buildPages())
  }, [buildPages])

  const togglePage = useCallback(
    (page) => {
      const newOrientation =
        page.orientation === "portrait" ? "landscape" : "portrait"

      setPages((prev) =>
        prev.map((p) =>
          p.index === page.index ? { ...p, orientation: newOrientation } : p
        )
      )
    },
    []
  )

  const handleAccept = useCallback(() => {
    if (pages.length > 0) {
      editor.commands.setGlobalOrientation(pages[0].orientation)
    }
    onClose()
  }, [editor, pages, onClose])

  const handleOverlayClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose]
  )

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [onClose])

  return createPortal(
    <div
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.4)",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
          padding: "1.5rem",
          minWidth: "320px",
          maxWidth: "90vw",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
            {t("toolbar.perPageTitle")}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.25rem",
              cursor: "pointer",
              color: "#666",
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>

        {/* Page list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", overflow: "auto", flex: 1 }}>
          {pages.map((page) => (
            <div
              key={page.index}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                cursor: "pointer",
              }}
              onClick={() => togglePage(page)}
            >
              <span style={{ fontSize: "14px", fontWeight: 500 }}>
                {t("toolbar.pageLabel")} {page.label}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {page.orientation === "portrait" ? (
                  <PagePortraitIcon style={{ width: 18, height: 18 }} />
                ) : (
                  <PageLandscapeIcon style={{ width: 18, height: 18 }} />
                )}
                <span style={{ fontSize: "13px", color: "#666" }}>
                  {t(`toolbar.${page.orientation}`)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "8px",
            marginTop: "1rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid #e5e7eb",
          }}
        >
          <button
            onClick={handleAccept}
            style={{
              padding: "6px 16px",
              borderRadius: "6px",
              border: "none",
              background: "#2563eb",
              color: "#fff",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            {t("toolbar.importHtmlAccept")}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "6px 16px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              background: "#fff",
              cursor: "pointer",
              fontSize: "13px",
              color: "#374151",
            }}
          >
            {t("toolbar.importHtmlCancel")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
