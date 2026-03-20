import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ExternalHyperlink,
  ImageRun,
  Packer,
  LevelFormat,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  BookmarkStart,
  BookmarkEnd,
  VerticalAlign,
  LineRuleType,
  TableLayoutType,
  PageOrientation,
  convertMillimetersToTwip,
} from "docx"
import { saveAs } from "file-saver"
import { getProxyUrl } from "@/lib/editor-config"

const HEADING_MAP = {
  H1: HeadingLevel.HEADING_1,
  H2: HeadingLevel.HEADING_2,
  H3: HeadingLevel.HEADING_3,
  H4: HeadingLevel.HEADING_4,
}

const ALIGN_MAP = {
  left: AlignmentType.LEFT,
  start: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  end: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
}

const NONE_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
const NO_BORDERS = {
  top: NONE_BORDER,
  bottom: NONE_BORDER,
  left: NONE_BORDER,
  right: NONE_BORDER,
  insideHorizontal: NONE_BORDER,
  insideVertical: NONE_BORDER,
}

/**
 * Detects if a table should be rendered WITHOUT borders.
 * Tables have borders by default (matching the editor view).
 * Only removes borders if explicitly set to none/0 in the HTML.
 */
function tableHasNoBorders(tableEl) {
  const borderAttr = tableEl.getAttribute("border")
  if (borderAttr === "0") return true

  const tableStyle = tableEl.getAttribute("style") || ""
  if (/border\s*:\s*(none|0)/i.test(tableStyle)) return true

  return false
}

// px to twips (1px ≈ 15 twips at 96 DPI: 1440 twips/inch ÷ 96 px/inch)
const pxToTwip = (px) => Math.round(px * 15)
// px to half-points (Word font sizes: 1pt = 0.75px, half-point = pt * 2)
const pxToHalfPt = (px) => Math.round(px * 0.75 * 2)
// Scale image dimensions: apply proportional sizing and cap at max width
function scaleImageDims(specW, specH, naturalW, naturalH, maxWidth = 600) {
  let w = specW || naturalW || 300
  let h = specH || naturalH || 200
  if (specW && !specH && naturalW > 0) h = Math.round(naturalH * (specW / naturalW))
  else if (specH && !specW && naturalH > 0) w = Math.round(naturalW * (specH / naturalH))
  if (w > maxWidth) { h = Math.round(h * (maxWidth / w)); w = maxWidth }
  return { w, h }
}
// Extract base64 data from a data URL
const extractBase64 = (dataUrl) => (dataUrl || "").split(",")[1] || ""

/**
 * Returns the element's line-height in px ONLY if it comes from an inline style
 * (set by the source HTML or by the editor's line-height button), NOT from the
 * editor's CSS rules (like `li p { line-height: 1.6 }`).
 * Walks up to 5 ancestors to find inherited inline line-height.
 */
function getExplicitLineHeightPx(el) {
  // Check if this element or a close ancestor has line-height in its inline style
  let node = el
  for (let depth = 0; node && node !== document.body && depth < 5; depth++, node = node.parentElement) {
    if (node.style && node.style.lineHeight) {
      const lhPx = parseFloat(getComputedStyle(el).lineHeight)
      return (lhPx && lhPx > 0) ? lhPx : null
    }
  }
  return null
}

function getAlignment(element) {
  // 1) Check inline style attribute (fastest)
  const style = element.getAttribute("style") || ""
  const match = style.match(/text-align:\s*(left|center|right|justify|start|end)/)
  if (match) return ALIGN_MAP[match[1]] || ALIGN_MAP[match[1] === "start" ? "left" : match[1] === "end" ? "right" : match[1]]
  // 2) Check element.style property (set programmatically by TipTap)
  if (element.style?.textAlign) {
    return ALIGN_MAP[element.style.textAlign] || undefined
  }
  // 3) Check computed style as last resort (inherits from parent)
  try {
    const computed = getComputedStyle(element).textAlign
    if (computed && computed !== "start") return ALIGN_MAP[computed] || undefined
  } catch { /* off-screen element may not have computed styles */ }
  return undefined
}

// Word only accepts these named highlight colors
const WORD_HIGHLIGHTS = {
  yellow: "yellow", cyan: "cyan", green: "green", magenta: "magenta",
  red: "red", blue: "blue", darkYellow: "darkYellow", darkGreen: "darkGreen",
  darkCyan: "darkCyan", darkBlue: "darkBlue", darkMagenta: "darkMagenta",
  darkRed: "darkRed", lightGray: "lightGray", darkGray: "darkGray",
}

// Map common highlight hex values to Word highlight names
const HEX_TO_WORD_HIGHLIGHT = {
  "ffff00": "yellow", "fef9c3": "yellow", "fde68a": "yellow",
  "00ffff": "cyan", "e0f2fe": "cyan", "bae6fd": "cyan", "dbeafe": "cyan",
  "00ff00": "green", "dcfce7": "green", "bbf7d0": "green",
  "ff00ff": "magenta", "f3e8ff": "magenta", "e9d5ff": "magenta",
  "ff0000": "red", "ffe4e6": "red", "fecdd3": "red", "fee2e2": "red",
  "f3f4f6": "lightGray", "f8f8f7": "lightGray", "e5e7eb": "lightGray",
  "ffedd5": "darkYellow", "fdba74": "darkYellow", "fbecdd": "darkYellow",
  "fce7f3": "magenta", "f9a8d4": "magenta", "fcf1f6": "magenta",
  "f4eeee": "darkRed",
}

function resolveHighlightColor(element) {
  const bgColor =
    element.getAttribute("data-color") ||
    element.style?.backgroundColor ||
    ""
  if (!bgColor) return { shading: { fill: "FFFF00" } }

  let resolved = bgColor
  if (bgColor.startsWith("var(")) {
    const varName = bgColor.match(/var\(--([^)]+)\)/)?.[1]
    if (varName) {
      try {
        const root = element.getRootNode?.()?.host || document.documentElement
        const val = getComputedStyle(root).getPropertyValue(`--${varName}`).trim()
        if (val) resolved = val
      } catch { /* fallback */ }
    }
  }

  // Always use shading with exact hex color to preserve the editor's pastel tones.
  // Word's named highlights (yellow, cyan, etc.) are too intense and don't match.
  const hex = colorToHex(resolved)
  if (hex) {
    return { shading: { fill: hex.replace("#", "").toUpperCase() } }
  }

  return { highlight: "yellow" }
}

async function imageToBase64(src) {
  if (src.startsWith("data:")) {
    const [meta, data] = src.split(",")
    const mime = meta.match(/data:([^;]+)/)?.[1] || "image/png"
    const dims = await new Promise((resolve) => {
      const img = new window.Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => resolve({ width: 300, height: 200 })
      img.src = src
    })
    return { base64: data, mime, ...dims }
  }

  // Strategy 1: Try to find the image already loaded in the editor DOM
  // (avoids CORS issues since the browser already loaded it)
  try {
    const existingImg = document.querySelector(`img[src="${CSS.escape(src)}"]`)
    if (existingImg && existingImg.complete && existingImg.naturalWidth > 0) {
      const canvas = document.createElement("canvas")
      canvas.width = existingImg.naturalWidth
      canvas.height = existingImg.naturalHeight
      canvas.getContext("2d").drawImage(existingImg, 0, 0)
      const dataUrl = canvas.toDataURL("image/png")
      const base64 = extractBase64(dataUrl)
      return { base64, mime: "image/png", width: existingImg.naturalWidth, height: existingImg.naturalHeight }
    }
  } catch (e) {
    // DOM capture failed — try fetch strategies
  }

  // Strategy 2: Fetch the image (direct, then via proxy to bypass CORS)
  const urls = [src]
  const proxyUrl = getProxyUrl(src)
  if (proxyUrl) urls.push(proxyUrl)
  for (const url of urls) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Fetch status ${response.status}`)
      const blob = await response.blob()
      const mime = blob.type || "image/png"
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(extractBase64(reader.result))
        reader.readAsDataURL(blob)
      })
      const objectUrl = URL.createObjectURL(blob)
      const dims = await new Promise((resolve) => {
        const img = new window.Image()
        img.onload = () => {
          URL.revokeObjectURL(objectUrl)
          resolve({ width: img.naturalWidth, height: img.naturalHeight })
        }
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl)
          resolve({ width: 300, height: 200 })
        }
        img.src = objectUrl
      })
      return { base64, mime, ...dims }
    } catch (e) {
      // Fetch failed for this URL — try next strategy
    }
  }

  // Strategy 3: Load with crossOrigin + canvas
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    const timeout = setTimeout(() => {
      img.src = ""
      reject(new Error("Image load timeout"))
    }, 10000)
    img.onload = () => {
      clearTimeout(timeout)
      try {
        const canvas = document.createElement("canvas")
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        canvas.getContext("2d").drawImage(img, 0, 0)
        const dataUrl = canvas.toDataURL("image/png")
        const base64 = extractBase64(dataUrl)
        resolve({ base64, mime: "image/png", width: img.naturalWidth, height: img.naturalHeight })
      } catch (e) {
        reject(new Error("Canvas tainted: " + e.message))
      }
    }
    img.onerror = () => {
      clearTimeout(timeout)
      reject(new Error("Image load failed with crossOrigin"))
    }
    img.src = src
  })
}

/**
 * Gets background color from a table cell, checking inline style,
 * computed style, and first child wrapper elements.
 */
function getCellBackground(cell) {
  // 1. Check inline style
  const inline = cell.style?.backgroundColor
  if (inline && inline !== "transparent" && inline !== "rgba(0, 0, 0, 0)") return inline

  // 2. Try computed style (catches CSS-applied backgrounds)
  try {
    const computed = getComputedStyle(cell).backgroundColor
    if (computed && computed !== "transparent" && computed !== "rgba(0, 0, 0, 0)") return computed
  } catch { /* not in DOM */ }

  // 3. Check first child element (Freshdesk wraps content in colored divs)
  const firstChild = cell.querySelector(":scope > div, :scope > p, :scope > span")
  if (firstChild) {
    const childBg = firstChild.style?.backgroundColor
    if (childBg && childBg !== "transparent" && childBg !== "rgba(0, 0, 0, 0)") return childBg
  }

  return null
}

/**
 * Gets text color from a table cell or wrapper element.
 */
function getCellTextColor(cell) {
  const inline = cell.style?.color
  if (inline && inline !== "inherit") return colorToHex(inline)

  try {
    const computed = getComputedStyle(cell).color
    if (computed) {
      const hex = colorToHex(computed)
      // Skip default black
      if (hex && hex !== "000000") return hex
    }
  } catch { /* not in DOM */ }

  const firstChild = cell.querySelector(":scope > div, :scope > p, :scope > span")
  if (firstChild) {
    const childColor = firstChild.style?.color
    if (childColor && childColor !== "inherit") return colorToHex(childColor)
  }

  return null
}

function colorToHex(color) {
  if (!color || color === "inherit" || color === "transparent" || color === "initial" || color === "unset" || color === "currentcolor" || color === "currentColor") {
    return undefined
  }
  if (color.startsWith("#")) return color.slice(1).replace(/^([0-9a-f]{3})$/i, "$1$1").slice(0, 6)
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (match) {
    let r = parseInt(match[1], 10)
    let g = parseInt(match[2], 10)
    let b = parseInt(match[3], 10)
    const a = match[4] !== undefined ? parseFloat(match[4]) : 1
    // Blend alpha with white background to get the visible color
    if (a < 1) {
      r = Math.round(r * a + 255 * (1 - a))
      g = Math.round(g * a + 255 * (1 - a))
      b = Math.round(b * a + 255 * (1 - a))
    }
    return r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0")
  }
  // Unknown format — return undefined instead of invalid value
  return undefined
}

function collectTextRuns(node, inherited = {}) {
  const runs = []

  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent
      if (!text) continue
      const runOpts = {
          text,
          bold: inherited.bold,
          italics: inherited.italics,
          underline: inherited.underline ? {} : undefined,
          strike: inherited.strike,
          superScript: inherited.superScript,
          subScript: inherited.subScript,
          highlight: inherited.highlight,
          shading: inherited.highlightShading,
          font: inherited.code ? "Courier New" : inherited.fontFamily || undefined,
          size: inherited.code ? 20 : inherited.fontSize || undefined,
        }
      if (inherited.color) runOpts.color = inherited.color
      runs.push(new TextRun(runOpts))
      continue
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue

    const tag = child.tagName
    const next = { ...inherited }

    if (tag === "STRONG" || tag === "B") next.bold = true
    else if (tag === "EM" || tag === "I") next.italics = true
    else if (tag === "U") next.underline = true
    else if (tag === "S" || tag === "DEL") next.strike = true
    else if (tag === "SUP") next.superScript = true
    else if (tag === "SUB") next.subScript = true
    else if (tag === "CODE") next.code = true
    else if (tag === "MARK") {
      const hl = resolveHighlightColor(child)
      if (hl.highlight) next.highlight = hl.highlight
      if (hl.shading) next.highlightShading = hl.shading
    }
    // Check for inline color, font, and size on any element (not just SPAN)
    const elColor = child.style?.color
    const elColorHex = elColor ? colorToHex(elColor) : undefined
    if (elColorHex) next.color = elColorHex
    const elFont = child.style?.fontFamily
    if (elFont) next.fontFamily = elFont.replace(/['";<>{}()]/g, "").trim()
    const elFs = child.style?.fontSize
    if (elFs) {
      const val = parseFloat(elFs)
      if (val) {
        // px needs conversion, pt is direct (half-points)
        next.fontSize = elFs.includes("px") ? pxToHalfPt(val) : Math.round(val * 2)
      }
    }

    if (child.hasAttribute("data-bookmark-id")) {
      const bookmarkId = child.getAttribute("data-bookmark-id")
      runs.push({ __bookmark: bookmarkId })
      continue
    }

    if (tag === "A") {
      const href = child.getAttribute("href") || ""
      const linkRuns = collectTextRuns(child, { ...next })
      runs.push(
        new ExternalHyperlink({
          children: linkRuns.length
            ? linkRuns
            : [new TextRun({ text: href, style: "Hyperlink" })],
          link: href,
        })
      )
      continue
    }

    if (tag === "BR") {
      runs.push(new TextRun({ break: 1 }))
      continue
    }

    if (tag === "IMG") {
      // Use rendered size (reflects user resizes), fall back to style/attribute, then natural
      const imgWidth = child.offsetWidth
        || parseInt(child.style.width, 10)
        || parseInt(child.getAttribute("width"), 10)
        || null
      const imgHeight = child.offsetHeight
        || parseInt(child.style.height, 10)
        || parseInt(child.getAttribute("height"), 10)
        || null
      runs.push({ __image: child.getAttribute("src"), __imgWidth: imgWidth, __imgHeight: imgHeight })
      continue
    }

    runs.push(...collectTextRuns(child, next))
  }

  return runs
}

let bookmarkCounter = 0
let _defaultFont = "Inter"
let _listLineSpacing = 384   // auto-detected from li p line-height (twips, exact)
let _listParaAfter = 0       // auto-detected from li p margin
let _tableCellLineSpacing = 240 // auto-detected from td line-height (twips, exact)
let _useExactLineSpacing = false // true when we measure exact px values

async function processImageRuns(runs) {
  const processed = []
  for (const run of runs) {
    if (run.__bookmark) {
      const id = ++bookmarkCounter
      processed.push(new BookmarkStart({ id: String(id), name: run.__bookmark }))
      processed.push(new BookmarkEnd({ id: String(id) }))
      continue
    }
    if (run.__image) {
      try {
        const { base64, width: naturalW, height: naturalH } = await imageToBase64(run.__image)
        const { w: finalW, h: finalH } = scaleImageDims(run.__imgWidth, run.__imgHeight, naturalW, naturalH)
        processed.push(
          new ImageRun({
            data: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
            transformation: { width: finalW, height: finalH },
            type: "png",
          })
        )
      } catch (err) {
        if (import.meta.env.DEV) console.warn("[DOCX] Image run skipped:", err.message)
      }
    } else {
      processed.push(run)
    }
  }
  return processed
}

function parseBlockElements(container, inherited = {}) {
  const blocks = []

  for (const node of container.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim()
      if (text) {
        const runOpts = { text }
        if (inherited.fontFamily) runOpts.font = inherited.fontFamily
        if (inherited.fontSize) runOpts.size = inherited.fontSize
        if (inherited.color) runOpts.color = inherited.color
        if (inherited.bold) runOpts.bold = true
        const block = { type: "paragraph", runs: [new TextRun(runOpts)], alignment: inherited._cellAlignment }
        if (inherited._insideTable) block._insideTable = true
        blocks.push(block)
      }
      continue
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue

    const tag = node.tagName
    const alignment = getAlignment(node)

    // Headings
    if (HEADING_MAP[tag]) {
      const hBlock = {
        type: "heading",
        level: HEADING_MAP[tag],
        runs: collectTextRuns(node, inherited),
        alignment,
      }
      if (inherited._insideTable) {
        hBlock._insideTable = true
        const hLhPx = getExplicitLineHeightPx(node)
        if (hLhPx) hBlock._lineHeightPx = hLhPx
      }
      blocks.push(hBlock)
      continue
    }

    // Paragraphs
    if (tag === "P") {
      // Inside table cells: use cell alignment as fallback, reduce spacing
      const paraAlignment = alignment || inherited._cellAlignment
      const block = { type: "paragraph", runs: collectTextRuns(node, inherited), alignment: paraAlignment }
      if (inherited._insideTable) block._insideTable = true
      // Read per-element line-height — only when explicitly set in CSS
      const elLhPx = getExplicitLineHeightPx(node)
      if (elLhPx) block._lineHeightPx = elLhPx
      blocks.push(block)
      continue
    }

    // Lists
    if (tag === "UL" || tag === "OL") {
      const listType = tag === "OL" ? "ordered" : "unordered"
      collectListItems(node, blocks, listType, 0, inherited)
      continue
    }

    // Blockquote
    if (tag === "BLOCKQUOTE") {
      const inner = parseBlockElements(node, inherited)
      for (const block of inner) {
        block.indent = (block.indent || 0) + 720
        block.border = true
      }
      blocks.push(...inner)
      continue
    }

    // Code block
    if (tag === "PRE") {
      const codeEl = node.querySelector("code")
      const text = (codeEl || node).textContent || ""
      const lines = text.split("\n")
      for (const line of lines) {
        blocks.push({
          type: "paragraph",
          runs: [new TextRun({ text: line || " ", font: "Courier New", size: 20 })],
          shading: { fill: "F0F0F0" },
        })
      }
      continue
    }

    // Horizontal rule
    if (tag === "HR") {
      blocks.push({
        type: "paragraph",
        runs: [new TextRun({ text: "─".repeat(50) })],
        alignment: AlignmentType.CENTER,
      })
      continue
    }

    // Images at block level — use rendered size (reflects user resizes)
    if (tag === "IMG") {
      const imgW = node.offsetWidth
        || parseInt(node.style.width, 10)
        || parseInt(node.getAttribute("width"), 10)
        || null
      const imgH = node.offsetHeight
        || parseInt(node.style.height, 10)
        || parseInt(node.getAttribute("height"), 10)
        || null
      blocks.push({ type: "image", src: node.getAttribute("src"), imgWidth: imgW, imgHeight: imgH })
      continue
    }

    // Tables
    if (tag === "TABLE") {
      blocks.push({ type: "table", element: node })
      continue
    }

    // Page break
    if (tag === "DIV" && node.getAttribute("data-type") === "page-break") {
      blocks.push({ type: "pageBreak", orientation: node.getAttribute("data-orientation") || null })
      continue
    }

    // Task list or any div/wrapper
    if (tag === "DIV" || tag === "SECTION") {
      blocks.push(...parseBlockElements(node, inherited))
      continue
    }

    // Fallback: treat as paragraph
    blocks.push({ type: "paragraph", runs: collectTextRuns(node, inherited), alignment })
  }

  return blocks
}

function collectListItems(listNode, blocks, listType, level, inherited = {}) {
  for (const li of listNode.children) {
    if (li.tagName !== "LI") continue

    // Check for task list item
    const isTask = li.hasAttribute("data-type") && li.getAttribute("data-type") === "taskItem"
    const checked = li.hasAttribute("data-checked") && li.getAttribute("data-checked") === "true"

    // Collect direct text content (not from nested lists)
    // When task is checked, pass strike:true so all text runs get strikethrough
    const taskInherited = (isTask && checked) ? { ...inherited, strike: true } : inherited
    const textNodes = []
    const nestedLists = []

    for (const child of li.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE && (child.tagName === "UL" || child.tagName === "OL")) {
        nestedLists.push(child)
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "LABEL") {
        // Task list label — skip the checkbox input, collect text from the label content
        continue
      } else if (child.nodeType === Node.ELEMENT_NODE && (child.tagName === "DIV" || child.tagName === "P")) {
        textNodes.push(...collectTextRuns(child, taskInherited))
      } else if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent
        if (text) {
          const runOpts = { text }
          if (taskInherited.fontFamily) runOpts.font = taskInherited.fontFamily
          if (taskInherited.fontSize) runOpts.size = taskInherited.fontSize
          if (taskInherited.color) runOpts.color = taskInherited.color
          if (taskInherited.bold) runOpts.bold = true
          if (taskInherited.strike) runOpts.strike = true
          textNodes.push(new TextRun(runOpts))
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        textNodes.push(...collectTextRuns(child, taskInherited))
      }
    }

    // Read per-element line-height from the li (or its inner p) — only if explicitly set
    const liLhSource = li.querySelector("p") || li
    const liLhPx = getExplicitLineHeightPx(liLhSource)

    if (isTask) {
      const prefix = checked ? "☑ " : "☐ "
      const taskBlock = {
        type: "paragraph",
        runs: [new TextRun({ text: prefix }), ...textNodes],
        indent: level * 360 + 360,
      }
      if (inherited._insideTable) taskBlock._insideTable = true
      if (liLhPx) taskBlock._lineHeightPx = liLhPx
      blocks.push(taskBlock)
    } else {
      const listBlock = {
        type: "list",
        listType,
        level,
        runs: textNodes.length ? textNodes : [new TextRun({ text: " " })],
      }
      if (inherited._insideTable) listBlock._insideTable = true
      if (liLhPx) listBlock._lineHeightPx = liLhPx
      blocks.push(listBlock)
    }

    for (const nested of nestedLists) {
      const nestedType = nested.tagName === "OL" ? "ordered" : "unordered"
      collectListItems(nested, blocks, nestedType, level + 1, inherited)
    }
  }
}

// Available table width in twips (set by convertHtmlToDocx based on page size and margins)
let _tableAvailWidthTwips = 9360 // default: Letter page 12240tw - 2*1440tw margins
// Array of per-column ratio arrays, indexed by table order in the document.
// Built from the live editor DOM in convertHtmlToDocx, consumed in blocksToDocxChildren.
let _tableRatiosArray = []
let _tableConvertIndex = 0
let _tableNestingDepth = 0

async function blocksToDocxChildren(blocks, inheritedColor) {
  const children = []

  for (const block of blocks) {
    if (block.type === "pageBreak") {
      const pbParagraph = new Paragraph({
        children: [],
        pageBreakBefore: true,
      })
      pbParagraph._pageBreak = true
      pbParagraph._orientation = block.orientation || null
      children.push(pbParagraph)
      continue
    }

    if (block.type === "table") {
      try {
        _tableNestingDepth++
        const isNested = _tableNestingDepth > 1
        const tableEl = block.element
        const noBorders = tableHasNoBorders(tableEl)
        const tableRows = []
        // Only select direct child rows (not from nested tables)
        const rows = tableEl.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr")

        // Read column widths: prefer live editor DOM ratios (by table index),
        // then data-colwidth, then rendered widths. Use DXA (twips) for precise control.
        const colRatios = _tableRatiosArray[_tableConvertIndex] || null
        _tableConvertIndex++
        const colWidthMap = []
        if (rows.length > 0) {
          // Find the row with the most individual cells (skip header rows with colspan)
          let bestRow = rows[0], bestCount = 0
          for (const r of rows) {
            const cells = r.querySelectorAll(":scope > th, :scope > td")
            if (cells.length > bestCount) { bestCount = cells.length; bestRow = r }
          }
          const refCells = bestRow.querySelectorAll(":scope > th, :scope > td")

          // Priority: 1) data-colwidth (exact resize values from ProseMirror)
          //           2) live editor DOM offsetWidth ratios
          //           3) rendered widths from off-screen container
          for (const c of refCells) {
            const cs = parseInt(c.getAttribute("colspan") || "1", 10)
            colWidthMap.push({ ratio: 0, colspan: cs })
          }

          // 1) Try data-colwidth (TipTap serializes colwidth from ProseMirror model)
          let totalColwidth = 0
          for (let i = 0; i < refCells.length; i++) {
            const cw = refCells[i].getAttribute("data-colwidth")
            const widths = cw ? cw.split(",").map(Number) : []
            const cellTotal = widths.length > 0 ? widths.reduce((a, b) => a + b, 0) : 0
            colWidthMap[i].px = cellTotal
            totalColwidth += cellTotal
          }

          if (totalColwidth > 0) {
            for (const entry of colWidthMap) {
              entry.ratio = entry.px / totalColwidth
            }
          } else if (colRatios && colRatios.length > 0) {
            // 2) Use live editor DOM ratios
            let colIdx = 0
            for (let i = 0; i < refCells.length; i++) {
              const cs = colWidthMap[i].colspan
              let cellRatio = 0
              for (let c = 0; c < cs && colIdx + c < colRatios.length; c++) {
                cellRatio += colRatios[colIdx + c]
              }
              colWidthMap[i].ratio = cellRatio
              colIdx += cs
            }
          } else {
            // 3) Fallback: read rendered widths from the off-screen container
            let totalRendered = 0
            for (const c of refCells) totalRendered += c.offsetWidth
            if (totalRendered > 0) {
              for (let i = 0; i < colWidthMap.length; i++) {
                colWidthMap[i].ratio = refCells[i].offsetWidth / totalRendered
              }
            }
          }
        }

        // Build per-column ratios from colWidthMap for rowspan-aware width assignment
        const perColRatio = []
        for (const entry of colWidthMap) {
          const cs = entry.colspan || 1
          if (cs > 1) {
            for (let i = 0; i < cs; i++) perColRatio.push(entry.ratio / cs)
          } else {
            perColRatio.push(entry.ratio)
          }
        }

        // Track active rowspans per column so we can compute correct column position
        const activeRowSpans = [] // activeRowSpans[col] = remaining rows to span

        for (const row of rows) {
          // Only direct child cells of this row
          const cells = row.querySelectorAll(":scope > th, :scope > td")
          const tableCells = []
          let colPos = 0
          for (const cell of cells) {
            const colspan = parseInt(cell.getAttribute("colspan") || "1", 10)
            const rowspan = parseInt(cell.getAttribute("rowspan") || "1", 10)

            // Skip columns occupied by rowspans from previous rows
            while (colPos < activeRowSpans.length && activeRowSpans[colPos] > 0) {
              activeRowSpans[colPos]--
              colPos++
            }

            // Cell width: sum ratios for all columns this cell spans
            let cellWidth
            if (perColRatio.length > 0) {
              let cellRatio = 0
              for (let c = 0; c < colspan && colPos + c < perColRatio.length; c++) {
                cellRatio += perColRatio[colPos + c]
              }
              if (cellRatio > 0) {
                if (isNested) {
                  const pct = Math.round(cellRatio * 100)
                  cellWidth = { size: pct, type: WidthType.PERCENTAGE }
                } else {
                  const twips = Math.round(cellRatio * _tableAvailWidthTwips)
                  cellWidth = { size: twips, type: WidthType.DXA }
                }
              }
            }

            // Register rowspan for occupied columns
            for (let c = 0; c < colspan; c++) {
              while (activeRowSpans.length <= colPos + c) activeRowSpans.push(0)
              activeRowSpans[colPos + c] = rowspan - 1
            }
            colPos += colspan

            // Read all computed styles once for this cell
            let computedCell
            try { computedCell = getComputedStyle(cell) } catch { /* not in DOM */ }

            // Cell background color — check inline style, computed style, and inner wrappers
            let cellShading
            const cellBg = getCellBackground(cell)
            if (cellBg && cellBg !== "rgba(0, 0, 0, 0)" && cellBg !== "transparent") {
              const hex = colorToHex(cellBg)
              if (hex) cellShading = { fill: hex.replace("#", "") }
            }

            // Cell borders: read color and width from computed style
            let cellBorderConfig
            if (noBorders) {
              cellBorderConfig = { top: NONE_BORDER, bottom: NONE_BORDER, left: NONE_BORDER, right: NONE_BORDER }
            } else if (computedCell) {
              const bColor = colorToHex(computedCell.borderTopColor) || "D1D5DB"
              const bWidthPx = parseFloat(computedCell.borderTopWidth) || 1
              const bSize = Math.max(4, Math.round(bWidthPx * 6))
              const border = { style: BorderStyle.SINGLE, size: bSize, color: bColor }
              cellBorderConfig = { top: border, bottom: border, left: border, right: border }
            }

            // Vertical alignment — check inline style first, then computed
            let cellVertAlign = VerticalAlign.TOP
            const vAlign = cell.style?.verticalAlign || (computedCell && computedCell.verticalAlign)
            if (vAlign === "middle" || vAlign === "center") cellVertAlign = VerticalAlign.CENTER
            else if (vAlign === "bottom") cellVertAlign = VerticalAlign.BOTTOM

            // Text alignment — read from cell itself
            const cellAlignment = getAlignment(cell) ||
              (computedCell && ALIGN_MAP[computedCell.textAlign]) || undefined

            // Collect inherited styles from the cell (inline first, then computed)
            const cellInherited = { _insideTable: true }
            if (cellAlignment) cellInherited._cellAlignment = cellAlignment
            const cellTextColor = getCellTextColor(cell)
            if (cellTextColor) cellInherited.color = cellTextColor

            // Font: only set if explicitly different from document default
            const inlineFont = cell.style?.fontFamily
            if (inlineFont) {
              const firstFont = inlineFont.split(",")[0].replace(/['";<>{}()]/g, "").trim()
              if (firstFont && firstFont !== _defaultFont) cellInherited.fontFamily = firstFont
            }
            // Font size: only set if explicitly specified inline (not from computed/default)
            const inlineFontSize = cell.style?.fontSize
            if (inlineFontSize) {
              const px = parseFloat(inlineFontSize)
              if (px) cellInherited.fontSize = pxToHalfPt(px)
            }
            // Bold: read from computed to detect TH font-weight
            const cellFontWeight = computedCell && computedCell.fontWeight
            if (cellFontWeight && (cellFontWeight === "bold" || parseInt(cellFontWeight, 10) >= 700)) {
              cellInherited.bold = true
            }

            // Parse cell content as block elements to preserve lists, paragraphs, etc.
            const cellBlocks = parseBlockElements(cell, cellInherited)
            let cellChildren
            if (cellBlocks.length > 0) {
              cellChildren = await blocksToDocxChildren(cellBlocks, cellInherited)
            } else {
              // Fallback: treat as single paragraph with inline runs
              const cellRuns = collectTextRuns(cell, cellInherited)
              const processedRuns = await processImageRuns(cellRuns)
              cellChildren = [new Paragraph({ children: processedRuns })]
            }
            // Ensure at least one paragraph (Word requires it)
            if (cellChildren.length === 0) {
              cellChildren = [new Paragraph({ children: [] })]
            }

            // Cell padding: read from computed style (editor uses CSS padding on td/th)
            let cellMargins
            if (computedCell) {
              const padTop = pxToTwip(parseFloat(computedCell.paddingTop) || 0)
              const padBottom = pxToTwip(parseFloat(computedCell.paddingBottom) || 0)
              const padLeft = pxToTwip(parseFloat(computedCell.paddingLeft) || 0)
              const padRight = pxToTwip(parseFloat(computedCell.paddingRight) || 0)
              if (padTop || padBottom || padLeft || padRight) {
                cellMargins = {
                  top: padTop, bottom: padBottom,
                  left: padLeft, right: padRight,
                }
              }
            }

            tableCells.push(
              new TableCell({
                children: cellChildren,
                columnSpan: colspan > 1 ? colspan : undefined,
                rowSpan: rowspan > 1 ? rowspan : undefined,
                shading: cellShading,
                borders: cellBorderConfig,
                verticalAlign: cellVertAlign,
                width: cellWidth,
                margins: cellMargins,
              })
            )
          }
          if (tableCells.length > 0) {
            tableRows.push(new TableRow({ children: tableCells }))
          }
        }
        if (tableRows.length > 0) {
          // Table alignment
          const tableStyle = tableEl.getAttribute("style") || ""
          let tableAlignment = AlignmentType.LEFT
          if (tableStyle.includes("margin-left: auto") && tableStyle.includes("margin-right: auto")) {
            tableAlignment = AlignmentType.CENTER
          } else if (tableStyle.includes("margin-left: auto")) {
            tableAlignment = AlignmentType.RIGHT
          }

          // Table width — match "width:" but NOT "min-width:"
          const widthMatch = tableStyle.match(/(?<![-\w])width:\s*([^;]+)/)
          const widthStr = widthMatch ? widthMatch[1].trim() : "100%"
          const widthSize = parseInt(widthStr, 10) || 100
          const widthType = widthStr === "auto" ? WidthType.AUTO : WidthType.PERCENTAGE

          // Table-level borders: read from the first cell's computed border
          let tableBorders
          if (noBorders) {
            tableBorders = NO_BORDERS
          } else {
            try {
              const firstCell = tableEl.querySelector("td, th")
              if (firstCell) {
                const cs = getComputedStyle(firstCell)
                const tblBColor = colorToHex(cs.borderTopColor) || "D1D5DB"
                const tblBWidthPx = parseFloat(cs.borderTopWidth) || 1
                const tblBSize = Math.max(4, Math.round(tblBWidthPx * 6))
                const tblBorder = { style: BorderStyle.SINGLE, size: tblBSize, color: tblBColor }
                tableBorders = {
                  top: tblBorder, bottom: tblBorder, left: tblBorder, right: tblBorder,
                  insideHorizontal: tblBorder, insideVertical: tblBorder,
                }
              }
            } catch { /* fallback to default */ }
          }

          const hasRatios = colWidthMap.length > 0 && colWidthMap.some(e => e.ratio > 0)
          const useFixed = hasRatios && !isNested

          children.push(
            new Table({
              rows: tableRows,
              width: useFixed
                ? { size: _tableAvailWidthTwips, type: WidthType.DXA }
                : { size: widthSize, type: widthType },
              layout: useFixed ? TableLayoutType.FIXED : undefined,
              alignment: tableAlignment,
              borders: tableBorders,
            })
          )
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error("[DOCX] Table export error:", e)
      } finally {
        _tableNestingDepth--
      }
      continue
    }

    if (block.type === "image") {
      try {
        const { base64, width: naturalW, height: naturalH } = await imageToBase64(block.src)
        const { w: finalW, h: finalH } = scaleImageDims(block.imgWidth, block.imgHeight, naturalW, naturalH)
        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
                transformation: { width: finalW, height: finalH },
                type: "png",
              }),
            ],
          })
        )
      } catch (err) {
        if (import.meta.env.DEV) console.warn("[DOCX] Image block skipped:", err.message)
      }
      continue
    }

    const runs = block.runs ? await processImageRuns(block.runs) : []

    // Spacing logic:
    // - Inline line-height found → use that exact value (converted to twips)
    // - Inside table, no inline lh → compact (before:0, after:0), let Word handle line spacing
    // - Outside table, no inline lh → use global editor spacing (auto-detected from CSS)
    const elementSpacing = (() => {
      if (block._lineHeightPx > 0) {
        const twips = Math.round(pxToTwip(block._lineHeightPx))
        if (block._insideTable) {
          return { before: 0, after: 0, line: twips, lineRule: LineRuleType.EXACTLY }
        }
        return { line: twips, lineRule: LineRuleType.EXACTLY }
      }
      if (block._insideTable) {
        return { before: 0, after: 0 }
      }
      return undefined
    })()

    if (block.type === "heading") {
      children.push(
        new Paragraph({
          children: runs,
          heading: block.level,
          alignment: block.alignment,
          spacing: elementSpacing,
        })
      )
      continue
    }

    if (block.type === "list") {
      // Inline lh → exact value; inside table no lh → no spacing; outside table → global editor spacing
      const listSpacing = block._lineHeightPx > 0
        ? { line: Math.round(pxToTwip(block._lineHeightPx)), lineRule: LineRuleType.EXACTLY, after: _listParaAfter }
        : block._insideTable
          ? { before: 0, after: 0 }
          : { line: _listLineSpacing, after: _listParaAfter }
      const listOpts = {
        children: runs,
        numbering: {
          reference: block.listType === "ordered" ? "ordered-list" : "unordered-list",
          level: block.level,
        },
      }
      if (listSpacing) listOpts.spacing = listSpacing
      children.push(new Paragraph(listOpts))
      continue
    }

    // Regular paragraph
    const paragraphOptions = {
      children: runs,
      alignment: block.alignment,
    }

    if (elementSpacing) {
      paragraphOptions.spacing = elementSpacing
    }

    if (block.indent) {
      paragraphOptions.indent = { left: block.indent }
    }

    if (block.border) {
      paragraphOptions.border = {
        left: { style: "single", size: 6, color: "CCCCCC", space: 8 },
      }
    }

    if (block.shading) {
      paragraphOptions.shading = block.shading
    }

    children.push(new Paragraph(paragraphOptions))
  }

  return children
}

// A4 dimensions in twips
const A4_WIDTH_TWIPS = convertMillimetersToTwip(210)  // 11906
const A4_HEIGHT_TWIPS = convertMillimetersToTwip(297) // 16838

function buildSections(children, pageMargins, orientationData) {
  const globalO = orientationData?.global || "portrait"
  const perPage = orientationData?.perPage || []
  const hasMixed = perPage.length > 0 && perPage.some((p) => p.orientation !== globalO)

  function makeSectionProps(orientation) {
    const isLandscape = orientation === "landscape"
    return {
      page: {
        ...(pageMargins ? { margin: pageMargins } : {}),
        size: {
          width: isLandscape ? A4_HEIGHT_TWIPS : A4_WIDTH_TWIPS,
          height: isLandscape ? A4_WIDTH_TWIPS : A4_HEIGHT_TWIPS,
          orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
        },
      },
    }
  }

  if (!hasMixed) {
    // Single section with uniform orientation
    return [
      {
        children,
        properties: makeSectionProps(globalO),
      },
    ]
  }

  // Split children at page breaks into multiple sections
  const sections = []
  let currentChildren = []
  let pageBreakIdx = 0

  for (const child of children) {
    // Detect page break paragraphs (they have pageBreakBefore and empty content)
    if (child._pageBreak) {
      // End current section
      if (currentChildren.length > 0) {
        const orientation = pageBreakIdx === 0 ? globalO : (perPage[pageBreakIdx - 1]?.orientation || globalO)
        sections.push({
          children: currentChildren,
          properties: makeSectionProps(orientation),
        })
      }
      currentChildren = []
      pageBreakIdx++
    } else {
      currentChildren.push(child)
    }
  }

  // Last section
  if (currentChildren.length > 0) {
    const orientation = pageBreakIdx === 0 ? globalO : (perPage[pageBreakIdx - 1]?.orientation || globalO)
    sections.push({
      children: currentChildren,
      properties: makeSectionProps(orientation),
    })
  }

  return sections.length > 0 ? sections : [{ children, properties: makeSectionProps(globalO) }]
}

export async function convertHtmlToDocx(html, orientationData = null) {
  bookmarkCounter = 0
  const container = document.createElement("div")
  // Apply editor classes so CSS rules (fonts, colors, backgrounds) cascade properly
  container.className = "tiptap ProseMirror"
  container.innerHTML = html
  // Temporarily add to DOM so getComputedStyle works for colors
  // Match editor width so table auto-layout produces the same column proportions
  const editorEl0 = document.querySelector(".tiptap.ProseMirror")
  const editorWidth = editorEl0 ? editorEl0.offsetWidth : 900
  container.style.cssText = `position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none;width:${editorWidth}px;`
  document.body.appendChild(container)

  // Build array of column ratios from the live editor DOM (reflects column resizes).
  // Index matches the order tables appear in the HTML — consumed by blocksToDocxChildren.
  _tableRatiosArray = []
  _tableConvertIndex = 0
  if (editorEl0) {
    const editorTables = editorEl0.querySelectorAll("table")
    for (let t = 0; t < editorTables.length; t++) {
      const eRows = editorTables[t].querySelectorAll(
        ":scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr"
      )
      if (eRows.length === 0) { _tableRatiosArray.push(null); continue }
      let bestIdx = 0, bestN = 0
      for (let r = 0; r < eRows.length; r++) {
        const n = eRows[r].querySelectorAll(":scope > th, :scope > td").length
        if (n > bestN) { bestN = n; bestIdx = r }
      }
      const eCells = eRows[bestIdx].querySelectorAll(":scope > th, :scope > td")
      let totalW = 0
      for (const c of eCells) totalW += c.offsetWidth
      if (totalW <= 0) { _tableRatiosArray.push(null); continue }
      const ratios = []
      for (const c of eCells) {
        const cs = parseInt(c.getAttribute("colspan") || "1", 10)
        const ratio = c.offsetWidth / totalW
        for (let i = 0; i < cs; i++) ratios.push(ratio / cs)
      }
      _tableRatiosArray.push(ratios)
    }
  }

  // Read all styles from the editor's actual CSS (computed styles)
  let defaultFont = "Inter"
  let defaultSize = 22 // fallback: 11pt in half-points
  let defaultHeadingSizes = { h1: 52, h2: 40, h3: 32, h4: 28 }
  let defaultLineSpacing = 276 // fallback: ~1.15x (proportional, or twips if exact)
  _useExactLineSpacing = false
  let defaultParaAfter = 120
  let listIndentPerLevel = 400 // fallback in twips
  let listHanging = 200
  let pageMargins = null // auto-detected from editor padding

  // Track probe elements created for style detection so we can remove them before parsing
  const probeElements = []

  try {
    const editorEl = document.querySelector(".tiptap.ProseMirror")
    const styleSource = editorEl || container

    // --- Font & size from <p> ---
    // Use a non-first-child <p> for accurate line-height (CSS: p:not(:first-child) { line-height: 1.6 })
    let probe = null
    // Try to find a non-first-child, non-table paragraph in the editor
    const editorPs = styleSource.querySelectorAll(":scope > p")
    for (const p of editorPs) {
      if (p !== p.parentElement?.firstElementChild) { probe = p; break }
    }
    // Fallback: any <p> from editor or container
    if (!probe) probe = styleSource.querySelector("p") || container.querySelector("p")
    // Last resort: create two probe <p> so the second gets p:not(:first-child) styles
    if (!probe) {
      const dummy = document.createElement("p")
      dummy.textContent = "\u00A0"
      container.appendChild(dummy)
      probeElements.push(dummy)
      probe = document.createElement("p")
      probe.textContent = "\u00A0"
      container.appendChild(probe)
      probeElements.push(probe)
    }
    const cs = getComputedStyle(probe)
    if (cs.fontFamily) {
      // Parse font-family chain and pick the best one available as a system font
      // Web fonts (Google Fonts, etc.) aren't available in Word, so we need a system font
      const fontChain = cs.fontFamily.split(",").map(f => f.replace(/['"]/g, "").trim())
      defaultFont = fontChain[0] // start with first choice
      // Detect if primary font is a web font (loaded via @font-face / Google Fonts).
      // Web fonts work in the browser but NOT in Word, so we must substitute with
      // a system font and scale sizes to match the visual appearance.
      // Use document.fonts API: if any FontFace entries match the name, it's a web font.
      const primaryName = fontChain[0]
      // Detect web font using two methods:
      // 1) Check document.fonts for @font-face entries (Google Fonts, etc.)
      // 2) Check against known system fonts list as fallback
      const SYSTEM_FONTS = new Set([
        "arial", "calibri", "cambria", "comic sans ms", "consolas", "courier new",
        "georgia", "helvetica", "impact", "lucida console", "lucida sans", "palatino",
        "segoe ui", "tahoma", "times new roman", "trebuchet ms", "verdana",
        "arial black", "book antiqua", "garamond", "century gothic",
        "franklin gothic", "candara", "corbel", "constantia",
        // macOS
        "san francisco", "helvetica neue", "avenir", "futura", "gill sans",
        "optima", "baskerville", "didot", "menlo", "monaco",
      ])
      let isWebFont = false
      // Method 1: check document.fonts API
      if (document.fonts) {
        try {
          for (const face of document.fonts) {
            const faceName = face.family.replace(/['"]/g, "").trim()
            if (faceName.toLowerCase() === primaryName.toLowerCase() && face.status === "loaded") {
              isWebFont = true
              break
            }
          }
        } catch (e) { /* iteration not supported */ }
      }
      // Method 2: if not found in document.fonts at all, check system fonts list
      if (!isWebFont && !SYSTEM_FONTS.has(primaryName.toLowerCase())) {
        isWebFont = true // not a known system font → likely a web font
      }
      // Font detection complete
      if (isWebFont) {
        // Find the best system font substitute from the font-family chain
        const GENERIC_TO_SYSTEM = {
          "sans-serif": "Calibri", "serif": "Times New Roman",
          "system-ui": "Segoe UI", "cursive": "Comic Sans MS",
        }
        const generic = new Set(Object.keys(GENERIC_TO_SYSTEM).concat(["monospace", "fantasy"]))
        let foundFallback = false
        for (let i = 1; i < fontChain.length; i++) {
          const name = fontChain[i]
          if (generic.has(name)) {
            const mapped = GENERIC_TO_SYSTEM[name]
            if (mapped) { defaultFont = mapped; foundFallback = true; break }
            continue
          }
          // Named font in chain — check if it's NOT a web font (i.e. system font)
          let alsoWeb = false
          for (const face of document.fonts) {
            if (face.family.replace(/['"]/g, "").trim().toLowerCase() === name.toLowerCase()) {
              alsoWeb = true; break
            }
          }
          if (!alsoWeb) { defaultFont = name; foundFallback = true; break }
        }
        if (!foundFallback) defaultFont = "Calibri"
        // Web font mapped to system fallback
      }
      _defaultFont = defaultFont
    }
    const computedFontSize = parseFloat(cs.fontSize)
    if (computedFontSize) {
      defaultSize = pxToHalfPt(computedFontSize)
    }

    // --- Line height from <p> ---
    // Measure the web font's natural "normal" line-height. Word's line:240 = single spacing
    // corresponds to CSS line-height:normal. So we divide CSS lhPx by the font's natural
    // height and multiply by 240 to get the correct Word proportional value.
    // This works well because Word now uses Calibri (system font) and handles its own metrics.
    let webNormalLhPx = computedFontSize * 1.2
    {
      const nlhProbe = document.createElement("p")
      nlhProbe.textContent = "Xpg"
      nlhProbe.style.cssText = `margin:0;padding:0;border:0;line-height:normal;font-size:${computedFontSize}px;font-family:${cs.fontFamily};`
      container.appendChild(nlhProbe)
      const nlh = nlhProbe.getBoundingClientRect().height
      nlhProbe.remove()
      if (nlh > 0) webNormalLhPx = nlh
    }
    const computedLineHeight = cs.lineHeight
    const lhPx = parseFloat(computedLineHeight)
    if (lhPx && webNormalLhPx > 0) {
      // Proportional: CSS line-height / web font's normal × 240
      defaultLineSpacing = Math.round((lhPx / webNormalLhPx) * 240)
      _useExactLineSpacing = false // proportional for body/list
      // Line spacing calculated from CSS
    } else if (computedLineHeight === "normal") {
      defaultLineSpacing = 240
      _useExactLineSpacing = false
    }

    // --- Paragraph spacing (margin-top of paragraphs) ---
    const pMarginBottom = parseFloat(cs.marginBottom) || 0
    const pMarginTop = parseFloat(cs.marginTop) || 0
    if (pMarginTop > 0 || pMarginBottom > 0) {
      defaultParaAfter = pxToTwip(Math.max(pMarginTop, pMarginBottom) * 0.5)
    }

    // --- Heading sizes ---
    for (const [hTag, hpKey] of [["h1", "h1"], ["h2", "h2"], ["h3", "h3"], ["h4", "h4"]]) {
      let hProbe = styleSource.querySelector(hTag) || container.querySelector(hTag)
      if (!hProbe) {
        hProbe = document.createElement(hTag)
        hProbe.textContent = "\u00A0"
        container.appendChild(hProbe)
        probeElements.push(hProbe)
      }
      const hCs = getComputedStyle(hProbe)
      const hSize = parseFloat(hCs.fontSize)
      if (hSize) {
        defaultHeadingSizes[hpKey] = Math.round(pxToHalfPt(hSize) )
      }
    }

    // --- List indentation from <ul> ---
    let ulProbe = styleSource.querySelector("ul") || container.querySelector("ul")
    if (!ulProbe) {
      ulProbe = document.createElement("ul")
      const li = document.createElement("li")
      li.textContent = "\u00A0"
      ulProbe.appendChild(li)
      container.appendChild(ulProbe)
      probeElements.push(ulProbe)
    }
    const ulCs = getComputedStyle(ulProbe)
    const ulPadLeft = parseFloat(ulCs.paddingLeft) || 0
    if (ulPadLeft > 0) {
      listIndentPerLevel = pxToTwip(ulPadLeft)
      listHanging = Math.round(listIndentPerLevel * 0.5)
    }

    // --- List item paragraph spacing (li p has margin-top:0 and its own line-height) ---
    let liPProbe = styleSource.querySelector("li p") || container.querySelector("li p")
    if (!liPProbe && ulProbe) {
      const liEl = ulProbe.querySelector("li")
      if (liEl) {
        liPProbe = document.createElement("p")
        liPProbe.textContent = "\u00A0"
        liEl.appendChild(liPProbe)
        probeElements.push(liPProbe)
      }
    }
    if (liPProbe) {
      const liPCs = getComputedStyle(liPProbe)
      // Only use margin if it's from our CSS (not browser default 1em)
      // Compare with default <p> margin to filter out browser defaults
      const liMarginTop = parseFloat(liPCs.marginTop) || 0
      const liMarginBottom = parseFloat(liPCs.marginBottom) || 0
      // In our CSS, li p { margin-top: 0 } — use whichever is explicitly smaller
      _listParaAfter = pxToTwip(Math.min(liMarginTop, liMarginBottom))
      const liLhPx = parseFloat(liPCs.lineHeight)
      if (liLhPx && webNormalLhPx > 0) {
        // Same proportional formula as body text
        _listLineSpacing = Math.round((liLhPx / webNormalLhPx) * 240)
      } else if (liPCs.lineHeight === "normal") {
        _listLineSpacing = 240
      }
    }

    // --- Table cell paragraph spacing (td p has different line-height) ---
    // Table cells often have line-height: normal (no explicit value), so we must
    // measure the actual rendered line height using a probe element.
    let tdProbe = styleSource.querySelector("td p") || styleSource.querySelector("td") ||
                  container.querySelector("td p") || container.querySelector("td")
    if (tdProbe) {
      const tdCs = getComputedStyle(tdProbe)
      const tdLhPx = parseFloat(tdCs.lineHeight)
      if (tdLhPx && tdLhPx > 0) {
        _tableCellLineSpacing = Math.round(pxToTwip(tdLhPx) )
      } else {
        // line-height: "normal" — measure actual rendered height via probe
        const tdLhProbe = document.createElement("div")
        tdLhProbe.textContent = "Xpg"
        tdLhProbe.style.cssText = "margin:0;padding:0;border:0;line-height:normal;font-size:" + (tdCs.fontSize || cs.fontSize) + ";font-family:" + (tdCs.fontFamily || cs.fontFamily) + ";"
        container.appendChild(tdLhProbe)
        const tdLhMeasured = tdLhProbe.getBoundingClientRect().height
        tdLhProbe.remove()
        if (tdLhMeasured > 0) {
          _tableCellLineSpacing = Math.round(pxToTwip(tdLhMeasured) )
        } else {
          // Fallback: use font-size * 1.15 (Word's "single" default)
          const tdFontPx = parseFloat(tdCs.fontSize) || computedFontSize || 16
          _tableCellLineSpacing = Math.round(pxToTwip(tdFontPx * 1.15) )
        }
      }
      // Ensure table cell spacing is never less than the font size (prevents text overlap)
      const tdFontTwips = pxToTwip(parseFloat(tdCs.fontSize) || computedFontSize || 16)
      if (_tableCellLineSpacing < tdFontTwips * 1.1) {
        _tableCellLineSpacing = Math.round(tdFontTwips * 1.15 )
      }
    }

    // --- Page margins from editor padding ---
    // Read the editor's actual padding to set proportional Word page margins
    const editorCs = editorEl ? getComputedStyle(editorEl) : null
    if (editorCs) {
      const padTop = parseFloat(editorCs.paddingTop) || 0
      const padBottom = parseFloat(editorCs.paddingBottom) || 0
      const padLeft = parseFloat(editorCs.paddingLeft) || 0
      const padRight = parseFloat(editorCs.paddingRight) || 0
      // Convert px to twips for Word page margins
      pageMargins = {
        top: pxToTwip(padTop),
        bottom: pxToTwip(padBottom),
        left: pxToTwip(padLeft),
        right: pxToTwip(padRight),
      }
    }

    // Calculate available table width in twips (Letter page = 12240tw)
    const pageWidthTwips = 12240
    const marginLeft = pageMargins ? pageMargins.left : 1440
    const marginRight = pageMargins ? pageMargins.right : 1440
    _tableAvailWidthTwips = pageWidthTwips - marginLeft - marginRight

    // Style auto-detection complete
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[DOCX] Style detection failed, using defaults:", e.message)
  }

  // Remove probe elements so they don't get exported as content
  for (const el of probeElements) {
    el.remove()
  }

  let blocks, children
  try {
    blocks = parseBlockElements(container)
    children = await blocksToDocxChildren(blocks)
  } finally {
    document.body.removeChild(container)
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: defaultFont,
            size: defaultSize,
          },
          paragraph: {
            // Exact twips from CSS line-height — matches editor rendering
            spacing: { after: defaultParaAfter, line: defaultLineSpacing },
          },
        },
        heading1: {
          run: { font: defaultFont, size: defaultHeadingSizes.h1, bold: true, color: "1a1a1a" },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        heading2: {
          run: { font: defaultFont, size: defaultHeadingSizes.h2, bold: true, color: "1a1a1a" },
          paragraph: { spacing: { before: 200, after: 100 } },
        },
        heading3: {
          run: { font: defaultFont, size: defaultHeadingSizes.h3, bold: true, color: "1a1a1a" },
          paragraph: { spacing: { before: 160, after: 80 } },
        },
        heading4: {
          run: { font: defaultFont, size: defaultHeadingSizes.h4, bold: true, color: "333333" },
          paragraph: { spacing: { before: 120, after: 60 } },
        },
        hyperlink: {
          run: { color: "1a56db", underline: {} },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "unordered-list",
          levels: Array.from({ length: 9 }, (_, i) => ({
            level: i,
            format: LevelFormat.BULLET,
            text: i % 3 === 0 ? "\u2022" : i % 3 === 1 ? "\u25E6" : "\u2013",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: listIndentPerLevel * (i + 1), hanging: listHanging } } },
          })),
        },
        {
          reference: "ordered-list",
          levels: Array.from({ length: 9 }, (_, i) => ({
            level: i,
            format: LevelFormat.DECIMAL,
            text: `%${i + 1}.`,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: listIndentPerLevel * (i + 1), hanging: listHanging } } },
          })),
        },
      ],
    },
    sections: buildSections(children, pageMargins, orientationData),
  })

  const blob = await Packer.toBlob(doc)
  return blob
}

export function downloadDocx(blob, filename = "document.docx") {
  saveAs(blob, filename)
}
