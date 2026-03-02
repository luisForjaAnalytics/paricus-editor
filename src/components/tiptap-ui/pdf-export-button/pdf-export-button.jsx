import { forwardRef } from "react"
import { useTranslation } from "react-i18next"
import pdfMake from "pdfmake/build/pdfmake"
import pdfFonts from "pdfmake/build/vfs_fonts"
import htmlToPdfmake from "html-to-pdfmake"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { PdfDownloadIcon } from "@/components/tiptap-icons/pdf-download-icon"

pdfMake.vfs = pdfFonts

export const PdfExportButton = forwardRef(
  ({ editor: providedEditor, text, ...buttonProps }, ref) => {
    const { t } = useTranslation()
    const { editor } = useTiptapEditor(providedEditor)

    const handleExport = async () => {
      if (!editor) return

      try {
        const html = editor.getHTML()

        // Resolve CSS variables (e.g. var(--tt-color-highlight-yellow)) to actual color values
        const computedStyle = getComputedStyle(document.documentElement)
        const resolvedHtml = html.replace(/var\(--([^)]+)\)/g, (match, varName) => {
          const value = computedStyle.getPropertyValue(`--${varName}`).trim()
          return value || match
        })

        // Convert images to base64 data URLs (pdfmake can't use relative paths)
        const container = document.createElement("div")
        container.innerHTML = resolvedHtml
        const images = container.querySelectorAll("img")

        for (const img of images) {
          if (img.src.startsWith("data:")) continue
          try {
            const dataUrl = await new Promise((resolve, reject) => {
              const imgEl = new Image()
              imgEl.crossOrigin = "anonymous"
              const timeout = setTimeout(() => {
                imgEl.src = ""
                reject(new Error(t("errors.imageTimeout")))
              }, 10000)
              imgEl.onload = () => {
                clearTimeout(timeout)
                const canvas = document.createElement("canvas")
                canvas.width = imgEl.naturalWidth
                canvas.height = imgEl.naturalHeight
                canvas.getContext("2d").drawImage(imgEl, 0, 0)
                resolve(canvas.toDataURL("image/png"))
              }
              imgEl.onerror = () => {
                clearTimeout(timeout)
                reject(new Error(t("errors.imageLoadFailed")))
              }
              imgEl.src = img.src
            })
            img.src = dataUrl
          } catch {
            img.remove()
          }
        }

        const content = htmlToPdfmake(container.innerHTML, { window })

        const docDefinition = {
          content,
          defaultStyle: {
            font: "Roboto",
          },
        }

        pdfMake.createPdf(docDefinition).download("document.pdf")
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
