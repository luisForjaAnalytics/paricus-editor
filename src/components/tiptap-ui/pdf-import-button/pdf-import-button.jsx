import { forwardRef, useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { PdfUploadIcon } from "@/components/tiptap-icons/pdf-upload-icon"
// Lazy-loaded to avoid bundling pdfjs-dist + tesseract.js upfront
const loadPdfConverter = () => import("@/lib/pdf-converter")
import { sanitizeHtml } from "@/lib/sanitize-html"

export const PdfImportButton = forwardRef(
  ({ editor: providedEditor, text, ...buttonProps }, ref) => {
    const { t } = useTranslation()
    const { editor } = useTiptapEditor(providedEditor)
    const fileInputRef = useRef(null)
    const [isImporting, setIsImporting] = useState(false)
    const [progress, setProgress] = useState(null)

    const handleFileChange = useCallback(
      async (event) => {
        const file = event.target.files?.[0]
        if (!file || !editor) return

        setIsImporting(true)
        setProgress(null)

        try {
          const { convertPdfToHtml } = await loadPdfConverter()
          const { html } = await convertPdfToHtml(file, (current, total) => {
            setProgress(t("errors.pdfOcrProgress", { current, total }))
          })
          editor.commands.setContent(sanitizeHtml(html))
        } catch (error) {
          if (import.meta.env.DEV) console.error(t("errors.pdfImportFailed"), error)
        } finally {
          setIsImporting(false)
          setProgress(null)
          if (fileInputRef.current) {
            fileInputRef.current.value = ""
          }
        }
      },
      [editor, t]
    )

    const handleClick = useCallback(() => {
      fileInputRef.current?.click()
    }, [])

    const tooltip = progress || t("toolbar.importPdf")

    return (
      <>
        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        <Button
          type="button"
          variant="ghost"
          tooltip={tooltip}
          onClick={handleClick}
          disabled={!editor || isImporting}
          ref={ref}
          {...buttonProps}
        >
          <PdfUploadIcon className="tiptap-button-icon" />
          {text && <span className="tiptap-button-text">{text}</span>}
        </Button>
      </>
    )
  }
)

PdfImportButton.displayName = "PdfImportButton"
