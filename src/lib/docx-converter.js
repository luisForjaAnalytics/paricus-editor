import mammoth from "mammoth"
import JSZip from "jszip"
import i18next from "i18next"

const MAX_DOCX_SIZE = 10 * 1024 * 1024 // 10MB

function validateDocxFile(file) {
  if (!file) {
    throw new Error(i18next.t("errors.noFileProvided"))
  }

  if (file.size > MAX_DOCX_SIZE) {
    throw new Error(
      i18next.t("errors.docxTooLarge", { size: MAX_DOCX_SIZE / (1024 * 1024) })
    )
  }

  const validTypes = [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]
  const hasValidExtension = file.name?.toLowerCase().endsWith(".docx")

  if (!validTypes.includes(file.type) && !hasValidExtension) {
    throw new Error(i18next.t("errors.docxInvalidType"))
  }
}

// Map Word highlight color names to their actual hex values
const WORD_HIGHLIGHT_COLORS = {
  yellow: "#FFFF00",
  green: "#00FF00",
  cyan: "#00FFFF",
  blue: "#0000FF",
  magenta: "#FF00FF",
  red: "#FF0000",
  darkBlue: "#000080",
  darkCyan: "#008080",
  darkGreen: "#008000",
  darkMagenta: "#800080",
  darkRed: "#800000",
  darkYellow: "#808000",
  darkGray: "#808080",
  lightGray: "#C0C0C0",
  black: "#000000",
}

// Build mammoth styleMap entries for highlight colors → <mark>
const highlightStyleMap = Object.keys(WORD_HIGHLIGHT_COLORS).map(
  (wordColor) => `highlight[color='${wordColor}'] => mark:fresh`
)

/**
 * Extracts a sequential list of text runs with their formatting from raw .docx XML.
 * Each run has: { text, fontColor, highlightColor }
 * This preserves document order so we can match against mammoth's HTML output sequentially.
 */
async function extractFormattingFromXml(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer)
  const docXml = await zip.file("word/document.xml")?.async("string")
  if (!docXml) return { formattedRuns: [] }

  const parser = new DOMParser()
  const doc = parser.parseFromString(docXml, "application/xml")

  const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  const formattedRuns = []

  const runs = doc.getElementsByTagNameNS(ns, "r")
  for (const run of runs) {
    const textEls = run.getElementsByTagNameNS(ns, "t")
    let text = ""
    for (const t of textEls) {
      text += t.textContent || ""
    }
    if (!text) continue

    const rPr = run.getElementsByTagNameNS(ns, "rPr")[0]
    let fontColor = null
    let highlightColor = null
    let fontFamily = null
    let fontSize = null

    if (rPr) {
      // Font family (w:rFonts)
      const rFontsEl = rPr.getElementsByTagNameNS(ns, "rFonts")[0]
      if (rFontsEl) {
        const font =
          rFontsEl.getAttributeNS(ns, "ascii") ||
          rFontsEl.getAttribute("w:ascii") ||
          rFontsEl.getAttributeNS(ns, "hAnsi") ||
          rFontsEl.getAttribute("w:hAnsi")
        if (font) {
          fontFamily = font
        }
      }

      // Font size (w:sz) — value is in half-points, so 24 = 12pt
      const szEl = rPr.getElementsByTagNameNS(ns, "sz")[0]
      if (szEl) {
        const sz = szEl.getAttributeNS(ns, "val") || szEl.getAttribute("w:val")
        if (sz) {
          fontSize = parseInt(sz, 10) / 2
        }
      }

      // Font color (w:color)
      const colorEl = rPr.getElementsByTagNameNS(ns, "color")[0]
      if (colorEl) {
        const color = colorEl.getAttributeNS(ns, "val") || colorEl.getAttribute("w:val")
        if (color && color.toLowerCase() !== "auto" && color !== "000000") {
          fontColor = color
        }
      }

      // Highlight (w:highlight)
      const highlightEl = rPr.getElementsByTagNameNS(ns, "highlight")[0]
      if (highlightEl) {
        const hlColor = highlightEl.getAttributeNS(ns, "val") || highlightEl.getAttribute("w:val")
        if (hlColor && hlColor !== "none") {
          const hexColor = WORD_HIGHLIGHT_COLORS[hlColor]
          if (hexColor) {
            highlightColor = hexColor
          }
        }
      }

      // Shading (w:shd) as alternative background color
      if (!highlightEl) {
        const shdEl = rPr.getElementsByTagNameNS(ns, "shd")[0]
        if (shdEl) {
          const fill = shdEl.getAttributeNS(ns, "fill") || shdEl.getAttribute("w:fill")
          if (fill && fill !== "auto" && fill.toUpperCase() !== "FFFFFF") {
            highlightColor = `#${fill}`
          }
        }
      }
    }

    formattedRuns.push({ text, fontColor, highlightColor, fontFamily, fontSize })
  }

  // Extract table cell shading (background colors) from <w:tc> → <w:tcPr> → <w:shd>
  // Stored as a flat array of colors in document order, matching the order cells appear in the HTML.
  const cellColors = []
  const tcs = doc.getElementsByTagNameNS(ns, "tc")
  for (const tc of tcs) {
    const tcPr = tc.getElementsByTagNameNS(ns, "tcPr")[0]
    let fill = null
    if (tcPr) {
      const shdEl = tcPr.getElementsByTagNameNS(ns, "shd")[0]
      if (shdEl) {
        const f = shdEl.getAttributeNS(ns, "fill") || shdEl.getAttribute("w:fill")
        if (f && f !== "auto" && f.toUpperCase() !== "FFFFFF" && f.toUpperCase() !== "000000") {
          fill = `#${f}`
        }
      }
    }
    cellColors.push(fill)
  }

  // Extract table grid column widths from <w:tblGrid> → <w:gridCol w:w="...">
  // Each table has a tblGrid that defines column widths in twips (DXA).
  // We store as an array of arrays: one per table, each containing px widths per column.
  const tableGrids = []
  const tblEls = doc.getElementsByTagNameNS(ns, "tbl")
  for (const tbl of tblEls) {
    const grid = tbl.getElementsByTagNameNS(ns, "tblGrid")[0]
    if (!grid) { tableGrids.push(null); continue }
    const gridCols = grid.getElementsByTagNameNS(ns, "gridCol")
    const colWidths = []
    let totalTwips = 0
    for (const col of gridCols) {
      const w = parseInt(col.getAttributeNS(ns, "w") || col.getAttribute("w:w") || "0", 10)
      colWidths.push(w)
      totalTwips += w
    }
    // Scale to editor reference width (700px)
    const EDITOR_WIDTH = 700
    const scale = totalTwips > 0 ? EDITOR_WIDTH / totalTwips : 1
    tableGrids.push(colWidths.map(w => Math.round(w * scale)))
  }

  return { formattedRuns, cellColors, tableGrids }
}

/**
 * Injects font colors and highlight marks into mammoth's HTML output.
 * Uses a DOM-based sequential approach: walks text nodes in document order
 * and matches them against the sequential run data from the XML,
 * avoiding the fragile text-matching regex that misapplied colors on repeated text.
 */
function injectFormatting(html, formattedRuns) {
  const hasFormatting = formattedRuns.some((r) => r.fontColor || r.highlightColor || r.fontFamily || r.fontSize)
  if (!hasFormatting) return html

  const container = new DOMParser().parseFromString(html, "text/html").body

  // Build a flat string from all XML runs to create a "source of truth" text stream
  const xmlFullText = formattedRuns.map((r) => r.text).join("")

  // Build a character-level formatting map from the sequential runs
  const charFormatting = []
  for (const run of formattedRuns) {
    for (let i = 0; i < run.text.length; i++) {
      charFormatting.push({
        fontColor: run.fontColor,
        highlightColor: run.highlightColor,
        fontFamily: run.fontFamily,
        fontSize: run.fontSize,
      })
    }
  }

  // Collect all text nodes from the HTML DOM in document order
  const textNodes = []
  function walkTextNodes(node) {
    if (node.nodeType === 3) {
      textNodes.push(node)
    } else {
      for (const child of node.childNodes) {
        walkTextNodes(child)
      }
    }
  }
  walkTextNodes(container)

  // Align the two text streams — find the offset mapping
  // Both should contain the same text (mammoth preserves text content),
  // but HTML may have extra whitespace or tab replacements.
  // We use a simple sequential pointer approach.
  let xmlIdx = 0

  for (const textNode of textNodes) {
    const nodeText = textNode.textContent
    if (!nodeText) continue

    // For each character in this text node, find its corresponding XML position
    const nodeFormats = []
    for (let i = 0; i < nodeText.length; i++) {
      const ch = nodeText[i]
      // Skip whitespace-only characters that don't appear in XML (mammoth may add them)
      if (xmlIdx < xmlFullText.length && xmlFullText[xmlIdx] === ch) {
        nodeFormats.push(charFormatting[xmlIdx])
        xmlIdx++
      } else if (ch === "\u2003") {
        // Em-space from tab conversion — no XML counterpart
        nodeFormats.push({ fontColor: null, highlightColor: null, fontFamily: null, fontSize: null })
      } else {
        // Try to find the character ahead (mammoth may skip or reorder slightly)
        let found = false
        for (let lookahead = 1; lookahead <= 5 && xmlIdx + lookahead < xmlFullText.length; lookahead++) {
          if (xmlFullText[xmlIdx + lookahead] === ch) {
            // Fill skipped positions
            xmlIdx += lookahead
            nodeFormats.push(charFormatting[xmlIdx])
            xmlIdx++
            found = true
            break
          }
        }
        if (!found) {
          nodeFormats.push({ fontColor: null, highlightColor: null, fontFamily: null, fontSize: null })
        }
      }
    }

    // Group consecutive characters with the same formatting
    const segments = []
    let seg = { start: 0, fontColor: nodeFormats[0]?.fontColor, highlightColor: nodeFormats[0]?.highlightColor, fontFamily: nodeFormats[0]?.fontFamily, fontSize: nodeFormats[0]?.fontSize }
    for (let i = 1; i < nodeFormats.length; i++) {
      const fmt = nodeFormats[i]
      if (fmt.fontColor !== seg.fontColor || fmt.highlightColor !== seg.highlightColor || fmt.fontFamily !== seg.fontFamily || fmt.fontSize !== seg.fontSize) {
        segments.push({ ...seg, end: i })
        seg = { start: i, fontColor: fmt.fontColor, highlightColor: fmt.highlightColor, fontFamily: fmt.fontFamily, fontSize: fmt.fontSize }
      }
    }
    segments.push({ ...seg, end: nodeFormats.length })

    // If the entire node has no formatting, skip it
    if (segments.length === 1 && !segments[0].fontColor && !segments[0].highlightColor && !segments[0].fontFamily && !segments[0].fontSize) {
      continue
    }

    // Replace the text node with formatted spans
    const parent = textNode.parentNode
    const doc = textNode.ownerDocument
    const frag = doc.createDocumentFragment()

    for (const s of segments) {
      const text = nodeText.substring(s.start, s.end)
      let node = doc.createTextNode(text)

      if (s.highlightColor) {
        const mark = doc.createElement("mark")
        mark.setAttribute("data-color", s.highlightColor)
        mark.style.backgroundColor = s.highlightColor
        mark.appendChild(node)
        node = mark
      }

      if (s.fontColor || s.fontFamily || s.fontSize) {
        const span = doc.createElement("span")
        if (s.fontColor) span.style.color = `#${s.fontColor}`
        if (s.fontFamily) span.style.fontFamily = `"${s.fontFamily}"`
        if (s.fontSize) span.style.fontSize = `${s.fontSize}pt`
        span.appendChild(node)
        node = span
      }

      frag.appendChild(node)
    }

    parent.replaceChild(frag, textNode)
  }

  return container.innerHTML
}

/**
 * Applies table cell background colors extracted from the DOCX XML.
 * Mammoth doesn't preserve cell shading, so we inject it as inline styles.
 */
function injectCellColors(html, cellColors) {
  if (!cellColors || !cellColors.some(c => c)) return html
  const doc = new DOMParser().parseFromString(html, "text/html")
  const cells = doc.body.querySelectorAll("td, th")
  for (let i = 0; i < Math.min(cells.length, cellColors.length); i++) {
    if (cellColors[i]) {
      cells[i].style.backgroundColor = cellColors[i]
    }
  }
  return doc.body.innerHTML
}

/**
 * Applies table column widths from DOCX tblGrid as colwidth attributes on cells.
 * tableGrids is an array of arrays: one per table, each containing px widths per column.
 */
function injectCellWidths(html, tableGrids) {
  if (!tableGrids || tableGrids.length === 0) return html
  const doc = new DOMParser().parseFromString(html, "text/html")
  // Only select top-level tables (not nested) to match Word's table order
  const tables = doc.body.querySelectorAll("table")
  let gridIdx = 0
  for (const table of tables) {
    // Skip nested tables — they get their own grid entry
    if (table.closest("td, th")) continue
    const colWidths = tableGrids[gridIdx++]
    if (!colWidths || colWidths.length === 0) continue
    // Set colwidth on all cells, tracking rowspans for correct column position
    const rows = table.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr")
    const activeRowSpans = []
    for (const row of rows) {
      const cells = row.querySelectorAll(":scope > td, :scope > th")
      let colPos = 0
      for (const cell of cells) {
        while (colPos < activeRowSpans.length && activeRowSpans[colPos] > 0) {
          activeRowSpans[colPos]--
          colPos++
        }
        const colspan = parseInt(cell.getAttribute("colspan") || "1", 10)
        const rowspan = parseInt(cell.getAttribute("rowspan") || "1", 10)
        const widths = []
        for (let c = 0; c < colspan && colPos + c < colWidths.length; c++) {
          widths.push(colWidths[colPos + c])
        }
        if (widths.length > 0) cell.setAttribute("colwidth", widths.join(","))
        for (let c = 0; c < colspan; c++) {
          while (activeRowSpans.length <= colPos + c) activeRowSpans.push(0)
          activeRowSpans[colPos + c] = rowspan - 1
        }
        colPos += colspan
      }
      for (let c = colPos; c < activeRowSpans.length; c++) {
        if (activeRowSpans[c] > 0) activeRowSpans[c]--
      }
    }
  }
  return doc.body.innerHTML
}

/**
 * Converts tab characters to visible em-space characters.
 * Mammoth converts Word tabs to \t which HTML collapses to a single space.
 */
function convertTabs(html) {
  return html.replace(/\t/g, "\u2003\u2003")
}

export async function convertDocxToHtml(file) {
  validateDocxFile(file)

  const arrayBuffer = await file.arrayBuffer()

  let formattedRuns = []
  let cellColors = []
  let tableGrids = []
  try {
    const extracted = await extractFormattingFromXml(arrayBuffer)
    formattedRuns = extracted.formattedRuns
    cellColors = extracted.cellColors || []
    tableGrids = extracted.tableGrids || []
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[DOCX Import] XML formatting extraction failed:", e.message)
  }

  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        "r[style-name='Strong'] => strong",
        "r[style-name='Emphasis'] => em",
        ...highlightStyleMap,
      ],
      convertImage: mammoth.images.imgElement(async (image) => {
        const imageBuffer = await image.read("base64")
        return {
          src: `data:${image.contentType};base64,${imageBuffer}`,
        }
      }),
    }
  )

  let html = result.value
  html = convertTabs(html)
  html = injectFormatting(html, formattedRuns)
  html = injectCellColors(html, cellColors)
  html = injectCellWidths(html, tableGrids)

  const warnings = result.messages
    .filter((msg) => msg.type === "warning")
    .map((msg) => msg.message)

  return { html, warnings }
}

export { MAX_DOCX_SIZE }
