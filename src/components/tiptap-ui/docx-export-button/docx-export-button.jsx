import { forwardRef, useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { WordDownloadIcon } from "@/components/tiptap-icons/word-download-icon"
// Lazy-loaded to avoid bundling docx upfront
const loadDocxExporter = () => import("@/lib/docx-exporter")

export const DocxExportButton = forwardRef(
  ({ editor: providedEditor, text, ...buttonProps }, ref) => {
    const { t } = useTranslation()
    const { editor } = useTiptapEditor(providedEditor)
    const [isExporting, setIsExporting] = useState(false)

    const handleExport = useCallback(async () => {
      if (!editor) return

      setIsExporting(true)
      try {
        const { convertHtmlToDocx, downloadDocx } = await loadDocxExporter()
        const html = editor.getHTML()

        // Collect orientation data from PageBreak extension
        const globalOrientation = editor.storage.pageBreak?.globalOrientation || "portrait"
        const perPage = []
        editor.state.doc.descendants((node) => {
          if (node.type.name === "pageBreak") {
            perPage.push({ orientation: node.attrs.orientation || globalOrientation })
          }
        })
        const orientationData = { global: globalOrientation, perPage }

        const blob = await convertHtmlToDocx(html, orientationData)
        downloadDocx(blob)
      } catch (error) {
        if (import.meta.env.DEV) console.error(t("errors.docxExportFailed"), error)
      } finally {
        setIsExporting(false)
      }
    }, [editor, t])

    return (
      <Button
        type="button"
        variant="ghost"
        tooltip={t("toolbar.exportDocx")}
        onClick={handleExport}
        disabled={!editor || editor.isEmpty || isExporting}
        ref={ref}
        {...buttonProps}
      >
        <WordDownloadIcon className="tiptap-button-icon" />
        {text && <span className="tiptap-button-text">{text}</span>}
      </Button>
    )
  }
)

DocxExportButton.displayName = "DocxExportButton"
