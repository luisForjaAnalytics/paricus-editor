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
  BookmarkStart,
  BookmarkEnd,
} from "docx"
import { saveAs } from "file-saver"

const HEADING_MAP = {
  H1: HeadingLevel.HEADING_1,
  H2: HeadingLevel.HEADING_2,
  H3: HeadingLevel.HEADING_3,
  H4: HeadingLevel.HEADING_4,
}

const ALIGN_MAP = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
}

function getAlignment(element) {
  const style = element.getAttribute("style") || ""
  const match = style.match(/text-align:\s*(left|center|right|justify)/)
  return match ? ALIGN_MAP[match[1]] : undefined
}

function resolveHighlightColor(element) {
  const bgColor =
    element.getAttribute("data-color") ||
    element.style?.backgroundColor ||
    ""
  if (!bgColor) return "yellow"
  if (bgColor.startsWith("var(")) {
    const varName = bgColor.match(/var\(--([^)]+)\)/)?.[1]
    if (varName) {
      try {
        // Try element first (works inside Shadow DOM), fall back to documentElement
        const root = element.getRootNode?.()?.host || document.documentElement
        const resolved = getComputedStyle(root)
          .getPropertyValue(`--${varName}`)
          .trim()
        if (resolved) return resolved
      } catch {
        // Silently fall back to the raw value
      }
    }
  }
  return bgColor || "yellow"
}

async function imageToBase64(src) {
  if (src.startsWith("data:")) {
    const [meta, data] = src.split(",")
    const mime = meta.match(/data:([^;]+)/)?.[1] || "image/png"
    // Decode dimensions from the data URI by loading into an Image
    const dims = await new Promise((resolve) => {
      const img = new window.Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => resolve({ width: 300, height: 200 })
      img.src = src
    })
    return { base64: data, mime, ...dims }
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    const timeout = setTimeout(() => {
      img.src = ""
      reject(new Error("Image load timeout"))
    }, 10000)
    img.onload = () => {
      clearTimeout(timeout)
      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext("2d").drawImage(img, 0, 0)
      const dataUrl = canvas.toDataURL("image/png")
      const base64 = dataUrl.split(",")[1]
      resolve({ base64, mime: "image/png", width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      clearTimeout(timeout)
      reject(new Error("Image load failed"))
    }
    img.src = src
  })
}

function colorToHex(color) {
  if (!color) return undefined
  if (color.startsWith("#")) return color.slice(1)
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (match) {
    const r = parseInt(match[1], 10).toString(16).padStart(2, "0")
    const g = parseInt(match[2], 10).toString(16).padStart(2, "0")
    const b = parseInt(match[3], 10).toString(16).padStart(2, "0")
    return `${r}${g}${b}`
  }
  return color
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
    else if (tag === "MARK") next.highlight = resolveHighlightColor(child)
    else if (tag === "SPAN") {
      const color = child.style?.color
      if (color) next.color = colorToHex(color)
      const fontFamily = child.style?.fontFamily
      if (fontFamily) next.fontFamily = fontFamily.replace(/['"]/g, "")
      const fs = child.style?.fontSize
      if (fs) {
        // Convert pt to half-points for docx (e.g. "12pt" → 24)
        const pt = parseFloat(fs)
        if (pt) next.fontSize = pt * 2
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
      // Images in inline context are collected as placeholders — handled at block level
      runs.push({ __image: child.getAttribute("src") })
      continue
    }

    runs.push(...collectTextRuns(child, next))
  }

  return runs
}

let bookmarkCounter = 0

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
        const { base64, width, height } = await imageToBase64(run.__image)
        const maxWidth = 600
        const scale = width > maxWidth ? maxWidth / width : 1
        processed.push(
          new ImageRun({
            data: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
            transformation: {
              width: Math.round(width * scale),
              height: Math.round(height * scale),
            },
            type: "png",
          })
        )
      } catch {
        // Skip broken images
      }
    } else {
      processed.push(run)
    }
  }
  return processed
}

function parseBlockElements(container) {
  const blocks = []

  for (const node of container.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim()
      if (text) {
        blocks.push({ type: "paragraph", runs: [new TextRun({ text })], alignment: undefined })
      }
      continue
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue

    const tag = node.tagName
    const alignment = getAlignment(node)

    // Headings
    if (HEADING_MAP[tag]) {
      blocks.push({
        type: "heading",
        level: HEADING_MAP[tag],
        runs: collectTextRuns(node),
        alignment,
      })
      continue
    }

    // Paragraphs
    if (tag === "P") {
      blocks.push({ type: "paragraph", runs: collectTextRuns(node), alignment })
      continue
    }

    // Lists
    if (tag === "UL" || tag === "OL") {
      const listType = tag === "OL" ? "ordered" : "unordered"
      collectListItems(node, blocks, listType, 0)
      continue
    }

    // Blockquote
    if (tag === "BLOCKQUOTE") {
      const inner = parseBlockElements(node)
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

    // Images at block level
    if (tag === "IMG") {
      blocks.push({ type: "image", src: node.getAttribute("src") })
      continue
    }

    // Tables
    if (tag === "TABLE") {
      blocks.push({ type: "table", element: node })
      continue
    }

    // Page break
    if (tag === "DIV" && node.getAttribute("data-type") === "page-break") {
      blocks.push({ type: "pageBreak" })
      continue
    }

    // Task list or any div/wrapper
    if (tag === "DIV" || tag === "SECTION") {
      blocks.push(...parseBlockElements(node))
      continue
    }

    // Fallback: treat as paragraph
    blocks.push({ type: "paragraph", runs: collectTextRuns(node), alignment })
  }

  return blocks
}

function collectListItems(listNode, blocks, listType, level) {
  for (const li of listNode.children) {
    if (li.tagName !== "LI") continue

    // Check for task list item
    const isTask = li.hasAttribute("data-type") && li.getAttribute("data-type") === "taskItem"
    const checked = li.hasAttribute("data-checked") && li.getAttribute("data-checked") === "true"

    // Collect direct text content (not from nested lists)
    const textNodes = []
    const nestedLists = []

    for (const child of li.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE && (child.tagName === "UL" || child.tagName === "OL")) {
        nestedLists.push(child)
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "LABEL") {
        // Task list label — skip the checkbox input, collect text from the label content
        continue
      } else if (child.nodeType === Node.ELEMENT_NODE && (child.tagName === "DIV" || child.tagName === "P")) {
        textNodes.push(...collectTextRuns(child))
      } else if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent
        if (text) textNodes.push(new TextRun({ text }))
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        textNodes.push(...collectTextRuns(child))
      }
    }

    if (isTask) {
      const prefix = checked ? "☑ " : "☐ "
      blocks.push({
        type: "paragraph",
        runs: [new TextRun({ text: prefix }), ...textNodes],
        indent: level * 360 + 360,
      })
    } else {
      blocks.push({
        type: "list",
        listType,
        level,
        runs: textNodes.length ? textNodes : [new TextRun({ text: " " })],
      })
    }

    for (const nested of nestedLists) {
      const nestedType = nested.tagName === "OL" ? "ordered" : "unordered"
      collectListItems(nested, blocks, nestedType, level + 1)
    }
  }
}

async function blocksToDocxChildren(blocks) {
  const children = []

  for (const block of blocks) {
    if (block.type === "pageBreak") {
      children.push(
        new Paragraph({
          children: [],
          pageBreakBefore: true,
        })
      )
      continue
    }

    if (block.type === "table") {
      try {
        const tableEl = block.element
        const tableRows = []
        const rows = tableEl.querySelectorAll("tr")
        for (const row of rows) {
          const cells = row.querySelectorAll("th, td")
          const tableCells = []
          for (const cell of cells) {
            const cellRuns = collectTextRuns(cell)
            const processedRuns = await processImageRuns(cellRuns)
            const colspan = parseInt(cell.getAttribute("colspan") || "1", 10)
            const rowspan = parseInt(cell.getAttribute("rowspan") || "1", 10)
            tableCells.push(
              new TableCell({
                children: [new Paragraph({ children: processedRuns })],
                columnSpan: colspan > 1 ? colspan : undefined,
                rowSpan: rowspan > 1 ? rowspan : undefined,
                shading: cell.tagName === "TH" ? { fill: "F0F0F0" } : undefined,
              })
            )
          }
          if (tableCells.length > 0) {
            tableRows.push(new TableRow({ children: tableCells }))
          }
        }
        if (tableRows.length > 0) {
          children.push(
            new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            })
          )
        }
      } catch {
        // Skip broken tables
      }
      continue
    }

    if (block.type === "image") {
      try {
        const { base64, width, height } = await imageToBase64(block.src)
        const maxWidth = 600
        const scale = width > maxWidth ? maxWidth / width : 1
        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
                transformation: {
                  width: Math.round(width * scale),
                  height: Math.round(height * scale),
                },
                type: "png",
              }),
            ],
          })
        )
      } catch {
        // Skip broken images
      }
      continue
    }

    const runs = block.runs ? await processImageRuns(block.runs) : []

    if (block.type === "heading") {
      children.push(
        new Paragraph({
          children: runs,
          heading: block.level,
          alignment: block.alignment,
        })
      )
      continue
    }

    if (block.type === "list") {
      children.push(
        new Paragraph({
          children: runs,
          numbering: {
            reference: block.listType === "ordered" ? "ordered-list" : "unordered-list",
            level: block.level,
          },
        })
      )
      continue
    }

    // Regular paragraph
    const paragraphOptions = {
      children: runs,
      alignment: block.alignment,
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

export async function convertHtmlToDocx(html) {
  const container = document.createElement("div")
  container.innerHTML = html

  const blocks = parseBlockElements(container)
  const children = await blocksToDocxChildren(blocks)

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "unordered-list",
          levels: Array.from({ length: 9 }, (_, i) => ({
            level: i,
            format: LevelFormat.BULLET,
            text: i % 3 === 0 ? "\u2022" : i % 3 === 1 ? "\u25E6" : "\u2013",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720 * (i + 1), hanging: 360 } } },
          })),
        },
        {
          reference: "ordered-list",
          levels: Array.from({ length: 9 }, (_, i) => ({
            level: i,
            format: LevelFormat.DECIMAL,
            text: `%${i + 1}.`,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720 * (i + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [
      {
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  return blob
}

export function downloadDocx(blob, filename = "document.docx") {
  saveAs(blob, filename)
}
