import { forwardRef, useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { FileUploadIcon } from "@/components/tiptap-icons/file-upload-icon"
import { convertDocxToHtml } from "@/lib/docx-converter"

export const DocxImportButton = forwardRef(
  ({ editor: providedEditor, text, ...buttonProps }, ref) => {
    const { t } = useTranslation()
    const { editor } = useTiptapEditor(providedEditor)
    const fileInputRef = useRef(null)
    const [isImporting, setIsImporting] = useState(false)

    const handleFileChange = useCallback(
      async (event) => {
        const file = event.target.files?.[0]
        if (!file || !editor) return

        setIsImporting(true)

        try {
          const { html, warnings } = await convertDocxToHtml(file)

          if (warnings.length > 0) {
            console.warn("Word import warnings:", warnings)
          }

          editor.commands.setContent(html)
        } catch (error) {
          console.error(t("errors.docxImportFailed"), error)
        } finally {
          setIsImporting(false)
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

    return (
      <>
        <input
          type="file"
          ref={fileInputRef}
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        <Button
          type="button"
          variant="ghost"
          tooltip={t("toolbar.importDocx")}
          onClick={handleClick}
          disabled={!editor || isImporting}
          ref={ref}
          {...buttonProps}
        >
          <FileUploadIcon className="tiptap-button-icon" />
          {text && <span className="tiptap-button-text">{text}</span>}
        </Button>
      </>
    )
  }
)

DocxImportButton.displayName = "DocxImportButton"
