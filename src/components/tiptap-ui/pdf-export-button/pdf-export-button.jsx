import { forwardRef } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { PdfDownloadIcon } from "@/components/tiptap-icons/pdf-download-icon"

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

function collectStyles() {
  const styles = []
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        styles.push(rule.cssText)
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

      try {
        const html = resolveVars(editor.getHTML(), editor.view.dom)
        const cssText = collectStyles()

        const iframe = document.createElement("iframe")
        iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;"
        document.body.appendChild(iframe)

        const doc = iframe.contentDocument
        doc.open()
        doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 15mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  ${cssText}
  body {
    margin: 0;
    padding: 20px 40px;
    background: white;
    color: #000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .print-content {
    max-width: 100%;
    line-height: 1.6;
  }
  a { color: #1a56db; }
</style>
</head>
<body>
  <div class="ProseMirror simple-editor print-content">${html}</div>
</body>
</html>`)
        doc.close()

        // Wait for content to render, then print
        iframe.contentWindow.focus()
        setTimeout(() => {
          iframe.contentWindow.print()

          // Clean up after dialog closes
          const cleanup = () => {
            try { document.body.removeChild(iframe) } catch { /* already removed */ }
          }
          iframe.contentWindow.addEventListener("afterprint", cleanup)
          // Fallback cleanup after 60s
          setTimeout(cleanup, 60000)
        }, 250)
      } catch (error) {
        console.error(t("errors.pdfExportFailed"), error)
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
