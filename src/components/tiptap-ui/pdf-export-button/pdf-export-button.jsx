import { forwardRef } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { PdfDownloadIcon } from "@/components/tiptap-icons/pdf-download-icon"
import { stampTableWidths } from "@/lib/stamp-table-widths"

function resolveVars(html, rootEl) {
  try {
    const root = rootEl?.getRootNode?.()?.host || document.documentElement
    const style = getComputedStyle(root)
    return html.replace(/var\(--([^)]+)\)/g, (match, varName) => {
      const value = style.getPropertyValue(`--${varName}`).trim()
      return value || match
    })
  } catch {
    return html
  }
}

// Patterns that indicate dark-theme or layout rules we don't want in print
const SKIP_RULE_PATTERNS = /color-scheme\s*:\s*dark|prefers-color-scheme\s*:\s*dark|\.dark\s|:root\s*\{[^}]*--tt-(gray-dark|bg-color|text-color)/i
const SKIP_SELECTOR_PATTERNS = /^(html|:root|\*|body)\s*\{/

function collectStyles() {
  const styles = []
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        const text = rule.cssText
        // Skip dark theme rules and root-level color overrides
        if (SKIP_RULE_PATTERNS.test(text)) continue
        // Skip html/body/root rules that set backgrounds or colors
        if (SKIP_SELECTOR_PATTERNS.test(text) && /background|color/i.test(text)) continue
        styles.push(text)
      }
    } catch {
      // Cross-origin stylesheets can't be read — skip
    }
  }
  return styles.join("\n")
}

export const PdfExportButton = forwardRef(
  ({ editor: providedEditor, text, ...buttonProps }, ref) => {
    const { t } = useTranslation()
    const { editor } = useTiptapEditor(providedEditor)

    const handleExport = () => {
      if (!editor) return

      let iframe = null
      try {
        const html = resolveVars(editor.getHTML(), editor.view.dom)
        const cssText = collectStyles()

        // Read orientation from PageBreak extension storage
        const globalOrientation = editor.storage.pageBreak?.globalOrientation || "portrait"

        // Check for per-page orientations
        const pageOrientations = []
        editor.state.doc.descendants((node) => {
          if (node.type.name === "pageBreak") {
            pageOrientations.push(node.attrs.orientation || globalOrientation)
          }
        })
        const hasMixedOrientations = pageOrientations.some((o) => o !== globalOrientation)

        // Build @page CSS rules
        let pageRules
        if (hasMixedOrientations) {
          pageRules = `
            @page { size: A4 ${globalOrientation}; margin: 10mm; }
            @page portrait-page { size: A4 portrait; margin: 10mm; }
            @page landscape-page { size: A4 landscape; margin: 10mm; }
            .page-section-portrait { page: portrait-page; break-before: page; }
            .page-section-landscape { page: landscape-page; break-before: page; }
            .page-section-portrait:first-child, .page-section-landscape:first-child { break-before: auto; }
          `
        } else {
          pageRules = `@page { size: A4 ${globalOrientation}; margin: 10mm; }`
        }

        iframe = document.createElement("iframe")
        iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;"
        document.body.appendChild(iframe)

        const doc = iframe.contentDocument
        if (!doc) throw new Error("Cannot access iframe document")
        doc.open()
        doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  ${pageRules}
  ${cssText}
  /* Print overrides — must come after editor styles with max specificity */
  html, body, :root {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    background-color: #fff !important;
    color: #000 !important;
    color-scheme: light !important;
  }
  body {
    padding: 10px 15px !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    height: auto !important;
    overflow: visible !important;
  }
  @media print {
    html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff !important; color: #000 !important; }
  }
  .ProseMirror, .print-content, .simple-editor, .tiptap {
    max-width: 100% !important;
    height: auto !important;
    overflow: visible !important;
    line-height: 1.6;
    background: transparent !important;
    color: #000 !important;
  }
  a { color: #1a56db; }
  table { border-collapse: collapse; margin: 1em 0; width: 100%; max-width: 100%; }
  table table { margin: 0.3em 0; }
  table td, table th { border: 1px solid #d1d5db !important; padding: 0.3em 0.4em; vertical-align: top; }
  table td > p, table th > p { margin: 0 !important; }
  table ul, table ol { padding-left: 1.2em; margin: 0; }
  .print-content img { max-width: 100%; height: auto; }
  ul[data-type="taskList"] { list-style: none !important; padding-left: 0.25em !important; }
  ul[data-type="taskList"] li { display: flex !important; flex-direction: row !important; align-items: flex-start !important; }
  ul[data-type="taskList"] li > label { flex-shrink: 0; padding-top: 0.25rem; padding-right: 0.5rem; }
  ul[data-type="taskList"] li > div { flex: 1 1 0%; min-width: 0; }
  ul[data-type="taskList"] li > div > p:first-child { margin-top: 0 !important; }
  ul[data-type="taskList"] li[data-checked="true"] > div > p { text-decoration: line-through; opacity: 0.5; }
  ul[data-type="taskList"] li[data-checked="true"] > div > p span { text-decoration: line-through; }
  table th:not([style*="background-color"]) { font-weight: bold; text-align: left; background-color: #f3f4f6 !important; }
  table th[style*="background-color"] { font-weight: bold; text-align: left; }
</style>
</head>
<body>
  <div class="ProseMirror simple-editor print-content">${html}</div>
</body>
</html>`)
        doc.close()

        // Stamp actual column widths from the editor DOM onto the iframe tables
        // so that column resizes are reflected in the PDF
        try {
          const editorEl = document.querySelector(".tiptap.ProseMirror")
          if (editorEl) {
            stampTableWidths(editorEl, doc, { mode: "style" })
          }
        } catch { /* non-critical — columns will use auto layout */ }

        // Wrap content in orientation sections for mixed page orientations
        if (hasMixedOrientations) {
          try {
            const container = doc.querySelector(".print-content")
            if (container) {
              const children = Array.from(container.childNodes)
              let orientIdx = -1
              let currentO = globalOrientation

              // Create first section
              let section = doc.createElement("div")
              section.className = `page-section-${currentO}`

              const newChildren = []
              for (const child of children) {
                if (child.nodeType === 1 && child.getAttribute("data-type") === "page-break") {
                  // Save current section
                  if (section.childNodes.length > 0) newChildren.push(section)
                  // Read next orientation
                  orientIdx++
                  currentO = pageOrientations[orientIdx] || globalOrientation
                  section = doc.createElement("div")
                  section.className = `page-section-${currentO}`
                } else {
                  section.appendChild(child)
                }
              }
              if (section.childNodes.length > 0) newChildren.push(section)

              container.innerHTML = ""
              for (const s of newChildren) container.appendChild(s)
            }
          } catch { /* non-critical — will use global orientation */ }
        }

        // Wait for content to render, then print
        const win = iframe.contentWindow
        if (!win) throw new Error("Cannot access iframe window")

        const cleanup = () => {
          win.removeEventListener("afterprint", cleanup)
          try { iframe.parentNode?.removeChild(iframe) } catch { /* already removed */ }
        }

        win.focus()
        setTimeout(() => {
          win.addEventListener("afterprint", cleanup)
          win.print()
          // Fallback: remove iframe after 5s regardless (covers cancelled dialogs)
          setTimeout(cleanup, 5000)
        }, 250)
      } catch (error) {
        // Ensure iframe is removed even on error
        if (iframe) {
          try { iframe.parentNode?.removeChild(iframe) } catch { /* already removed */ }
        }
        if (import.meta.env.DEV) console.error(t("errors.pdfExportFailed"), error)
      }
    }

    return (
      <Button
        type="button"
        variant="ghost"
        tooltip={t("toolbar.exportPdf")}
        onClick={handleExport}
        disabled={!editor || editor.isEmpty}
        ref={ref}
        {...buttonProps}
      >
        <PdfDownloadIcon className="tiptap-button-icon" />
        {text && <span className="tiptap-button-text">{text}</span>}
      </Button>
    )
  }
)

PdfExportButton.displayName = "PdfExportButton"
