import * as pdfjsLib from "pdfjs-dist"
import { createWorker } from "tesseract.js"
import i18next from "i18next"

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

const MAX_PDF_SIZE = 20 * 1024 * 1024 // 20MB

function validatePdfFile(file) {
  if (!file) {
    throw new Error(i18next.t("errors.noFileProvided"))
  }
  if (file.size > MAX_PDF_SIZE) {
    throw new Error(i18next.t("errors.pdfTooLarge", { size: MAX_PDF_SIZE / (1024 * 1024) }))
  }
  const hasValidExtension = file.name?.toLowerCase().endsWith(".pdf")
  if (file.type !== "application/pdf" && !hasValidExtension) {
    throw new Error(i18next.t("errors.pdfInvalidType"))
  }
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Detects bold/italic from the font name string.
 * PDF font names typically contain "Bold", "Italic", "Oblique", etc.
 */
function detectFontStyle(fontName) {
  const name = (fontName || "").toLowerCase()
  return {
    bold: /bold|black|heavy/i.test(name),
    italic: /italic|oblique/i.test(name),
  }
}

/**
 * Wraps text with inline style tags based on detected font properties.
 */
function wrapWithStyles(html, { bold, italic, fontFamily, fontSize }) {
  let result = html

  // Apply font family and size via a span
  const styleAttrs = []
  if (fontFamily) styleAttrs.push(`font-family: ${fontFamily}`)
  if (fontSize && fontSize !== 12) styleAttrs.push(`font-size: ${fontSize}px`)

  if (styleAttrs.length > 0) {
    result = `<span style="${styleAttrs.join("; ")}">${result}</span>`
  }

  if (italic) result = `<em>${result}</em>`
  if (bold) result = `<strong>${result}</strong>`

  return result
}

/**
 * Renders a PDF page to a canvas and returns it as a data URL.
 */
async function renderPageToCanvas(page, scale = 2) {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement("canvas")
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext("2d")
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas.toDataURL("image/png")
}

/**
 * Uses Tesseract.js OCR to extract text from page images.
 */
async function ocrPages(pdf, onProgress) {
  const worker = await createWorker("spa+eng")
  const results = []

  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      if (onProgress) onProgress(i, pdf.numPages)
      const page = await pdf.getPage(i)
      const imageDataUrl = await renderPageToCanvas(page)
      const { data } = await worker.recognize(imageDataUrl)
      results.push(data.text || "")
    }
  } finally {
    await worker.terminate()
  }

  return results
}

/**
 * Converts OCR text results into HTML paragraphs.
 */
function ocrTextToHtml(pagesText) {
  const pagesHtml = []

  for (const pageText of pagesText) {
    const trimmed = pageText.trim()
    if (!trimmed) continue

    const paragraphs = trimmed
      .split(/\n\s*\n/)
      .map((para) => para.trim())
      .filter(Boolean)
      .map((para) => {
        const escaped = escapeHtml(para).replace(/\n/g, "<br>")
        return `<p>${escaped}</p>`
      })

    if (paragraphs.length > 0) {
      pagesHtml.push(paragraphs.join("\n"))
    }
  }

  return pagesHtml
}

/**
 * Extracts styled text from a PDF page using pdfjs text layer.
 * Preserves bold, italic, font family, and font size per text run.
 */
function extractTextFromPage(textContent, viewport) {
  const styles = textContent.styles || {}
  const textItems = textContent.items.filter((item) => typeof item.str === "string")
  if (textItems.length === 0) return null

  const LINE_THRESHOLD = 3

  // Enrich each item with style info
  const enriched = textItems.map((item) => {
    const fontSize = Math.round(Math.abs(item.transform[0])) || 12
    const fontStyle = detectFontStyle(item.fontName)
    const styleInfo = styles[item.fontName] || {}
    const fontFamily = styleInfo.fontFamily || null

    return {
      str: item.str,
      x: item.transform[4],
      y: viewport.height - item.transform[5],
      fontSize,
      bold: fontStyle.bold,
      italic: fontStyle.italic,
      fontFamily,
    }
  })

  // Sort top-to-bottom, left-to-right
  enriched.sort((a, b) => {
    if (Math.abs(a.y - b.y) > LINE_THRESHOLD) return a.y - b.y
    return a.x - b.x
  })

  // Group into lines by Y position, keeping individual styled runs
  const lines = []
  let curLine = null

  for (const item of enriched) {
    if (!item.str) continue

    if (!curLine || Math.abs(item.y - curLine.y) > LINE_THRESHOLD) {
      curLine = { y: item.y, runs: [item], fontSize: item.fontSize }
      lines.push(curLine)
    } else {
      curLine.runs.push(item)
      // Use the largest font size in the line
      if (item.fontSize > curLine.fontSize) curLine.fontSize = item.fontSize
    }
  }

  // Find the left margin (minimum X across all lines)
  const allXPositions = lines
    .flatMap((line) => line.runs.map((r) => r.x))
    .filter((x) => x > 0)
  const leftMargin = allXPositions.length > 0 ? Math.min(...allXPositions) : 0
  const INDENT_STEP = 30 // ~30px per indent level in PDF coordinates

  // Compute indent level and detect list patterns per line
  for (const line of lines) {
    const firstRunX = line.runs[0]?.x || 0
    const indent = Math.max(0, Math.round((firstRunX - leftMargin) / INDENT_STEP))
    line.indent = indent

    const lineText = line.runs.map((r) => r.str).join("").trim()
    // Detect bullet patterns: •, -, ▪, ►, ○, ■
    if (/^[•\-▪►○■]\s/.test(lineText)) {
      line.listType = "bullet"
      // Remove the bullet character from first run
      line.runs[0].str = line.runs[0].str.replace(/^[•\-▪►○■]\s*/, "")
    }
    // Detect ordered list: 1. 2. a. b. i. ii.
    else if (/^\d+[.)]\s/.test(lineText) || /^[a-z][.)]\s/i.test(lineText)) {
      line.listType = "ordered"
      line.runs[0].str = line.runs[0].str.replace(/^(\d+|[a-z])[.)]\s*/i, "")
    } else {
      line.listType = null
    }
  }

  // Group lines into paragraphs by vertical gap, indent, or list type changes
  const paragraphs = []
  let curPara = null
  const PARA_GAP = 6

  for (let j = 0; j < lines.length; j++) {
    const line = lines[j]
    const hasText = line.runs.some((r) => r.str.trim())
    if (!hasText) continue

    let breakPara = false
    if (j > 0 && curPara) {
      const gap = line.y - lines[j - 1].y
      const prevFontSize = lines[j - 1].fontSize || 12
      if (gap > prevFontSize + PARA_GAP) breakPara = true
      // Break on indent change
      if (line.indent !== lines[j - 1].indent) breakPara = true
      // Break on list type change
      if (line.listType !== lines[j - 1].listType) breakPara = true
      // Each list item is its own paragraph
      if (line.listType) breakPara = true
    }

    if (breakPara && curPara) {
      paragraphs.push(curPara)
      curPara = null
    }

    if (!curPara) {
      curPara = {
        lines: [],
        fontSize: line.fontSize,
        indent: line.indent,
        listType: line.listType,
      }
    }
    curPara.lines.push(line)
  }
  if (curPara) paragraphs.push(curPara)

  // Helper: render lines of a paragraph to inner HTML
  function renderLinesHtml(paraLines) {
    return paraLines
      .map((line) => {
        const merged = []
        for (const run of line.runs) {
          const last = merged[merged.length - 1]
          if (
            last &&
            last.bold === run.bold &&
            last.italic === run.italic &&
            last.fontFamily === run.fontFamily &&
            last.fontSize === run.fontSize
          ) {
            last.str += run.str
          } else {
            merged.push({ ...run })
          }
        }

        return merged
          .map((run) => {
            const text = escapeHtml(run.str)
            if (!text.trim()) return text
            return wrapWithStyles(text, run)
          })
          .join("")
      })
      .filter((l) => l.trim())
      .join("<br>")
  }

  // Group consecutive list paragraphs into <ul>/<ol> blocks
  const htmlBlocks = []
  let listBuffer = []

  function flushList() {
    if (listBuffer.length === 0) return
    const tag = listBuffer[0].listType === "ordered" ? "ol" : "ul"
    const items = listBuffer
      .map((p) => `<li>${renderLinesHtml(p.lines)}</li>`)
      .join("\n")
    htmlBlocks.push(`<${tag}>\n${items}\n</${tag}>`)
    listBuffer = []
  }

  for (const para of paragraphs) {
    if (para.listType) {
      // Flush if list type changed
      if (listBuffer.length > 0 && listBuffer[0].listType !== para.listType) {
        flushList()
      }
      listBuffer.push(para)
      continue
    }

    flushList()

    const linesHtml = renderLinesHtml(para.lines)
    if (!linesHtml.trim()) continue

    const fs = para.fontSize || 12
    const indentStyle = para.indent > 0 ? ` style="margin-left: ${para.indent * 40}px"` : ""

    if (fs >= 22) htmlBlocks.push(`<h1${indentStyle}>${linesHtml}</h1>`)
    else if (fs >= 18) htmlBlocks.push(`<h2${indentStyle}>${linesHtml}</h2>`)
    else if (fs >= 15) htmlBlocks.push(`<h3${indentStyle}>${linesHtml}</h3>`)
    else htmlBlocks.push(`<p${indentStyle}>${linesHtml}</p>`)
  }
  flushList()

  const pageHtml = htmlBlocks
    .join("\n")

  return pageHtml || null
}

/**
 * Extracts text from a PDF and converts it to basic HTML.
 * First tries native text extraction with style detection.
 * If the PDF has no text (scanned/image), falls back to OCR via Tesseract.js.
 */
export async function convertPdfToHtml(file, onProgress) {
  validatePdfFile(file)

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  // First pass: try native text extraction
  const pagesHtml = []
  let totalTextItems = 0

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const viewport = page.getViewport({ scale: 1 })

    const textItems = textContent.items.filter((item) => typeof item.str === "string")
    totalTextItems += textItems.length

    const pageHtml = extractTextFromPage(textContent, viewport)
    if (pageHtml) pagesHtml.push(pageHtml)
  }

  // If no text found, fall back to OCR
  if (totalTextItems === 0) {
    const ocrResults = await ocrPages(pdf, onProgress)
    const ocrHtml = ocrTextToHtml(ocrResults)

    if (ocrHtml.length === 0) {
      return { html: "<p></p>", usedOcr: true }
    }

    const html = ocrHtml
      .map((pageHtml, idx) =>
        idx > 0 ? `<div data-type="page-break"></div>\n${pageHtml}` : pageHtml
      )
      .join("\n")

    return { html, usedOcr: true }
  }

  // Join pages with page breaks
  const html = pagesHtml
    .map((pageHtml, idx) =>
      idx > 0 ? `<div data-type="page-break"></div>\n${pageHtml}` : pageHtml
    )
    .join("\n")

  return { html: html || "<p></p>", usedOcr: false }
}
