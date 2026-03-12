import DOMPurify from "dompurify"

const ALLOWED_TAGS = [
  // Block elements
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "pre", "code", "hr", "br", "div",
  // Lists
  "ul", "ol", "li",
  // Tables
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col",
  // Inline formatting
  "strong", "b", "em", "i", "u", "s", "strike", "del",
  "sub", "sup", "mark", "span", "a",
  // Media
  "img",
  // Task lists
  "input",
]

const ALLOWED_ATTR = [
  // General
  "class", "style", "id", "title",
  // Links
  "href", "target", "rel",
  // Images
  "src", "alt", "width", "height",
  // Tables
  "colspan", "rowspan", "data-colwidth",
  "bgcolor", "border", "cellpadding", "cellspacing", "align", "valign",
  // Custom data attributes used by the editor
  "data-type", "data-color", "data-bookmark-id", "data-bookmark-label",
  "data-text-align", "data-checked",
  // Input (task lists)
  "type", "checked", "disabled",
]

// Safe CSS properties that the editor uses — block everything else
const SAFE_CSS_PROPERTIES = new Set([
  "color", "background-color", "background",
  "font-family", "font-size", "font-weight", "font-style",
  "text-align", "text-decoration", "text-indent",
  "line-height", "letter-spacing", "word-spacing",
  "vertical-align",
  "border", "border-top", "border-right", "border-bottom", "border-left",
  "border-collapse", "border-spacing",
  "border-color", "border-style", "border-width",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "width", "min-width", "max-width", "height", "min-height", "max-height",
  "display", "white-space", "overflow-wrap", "word-wrap",
  "list-style-type", "table-layout",
])

// Dangerous patterns in CSS values (url(), expression(), etc.)
const DANGEROUS_CSS_VALUE = /url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:/i

function sanitizeStyleAttribute(style) {
  if (!style) return ""
  const parts = style.split(";")
  const safe = []
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const colonIdx = trimmed.indexOf(":")
    if (colonIdx === -1) continue
    const prop = trimmed.slice(0, colonIdx).trim().toLowerCase()
    const value = trimmed.slice(colonIdx + 1).trim()
    if (!SAFE_CSS_PROPERTIES.has(prop)) continue
    if (DANGEROUS_CSS_VALUE.test(value)) continue
    safe.push(`${prop}: ${value}`)
  }
  return safe.join("; ")
}

// Configure DOMPurify hooks (once)
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  // Sanitize style attributes — strip dangerous CSS
  if (node.hasAttribute("style")) {
    const cleaned = sanitizeStyleAttribute(node.getAttribute("style"))
    if (cleaned) {
      node.setAttribute("style", cleaned)
    } else {
      node.removeAttribute("style")
    }
  }

  // Force links to be safe
  if (node.tagName === "A") {
    // Ensure rel="noopener noreferrer" on links with target
    if (node.getAttribute("target") === "_blank") {
      node.setAttribute("rel", "noopener noreferrer")
    }
    // Block javascript: and data: URLs in href
    const href = (node.getAttribute("href") || "").trim().toLowerCase()
    if (href.startsWith("javascript:") || href.startsWith("data:") || href.startsWith("vbscript:")) {
      node.removeAttribute("href")
      node.setAttribute("href", "#")
    }
  }

  // Block dangerous img src
  if (node.tagName === "IMG") {
    const src = (node.getAttribute("src") || "").trim().toLowerCase()
    if (src.startsWith("javascript:") || src.startsWith("vbscript:")) {
      node.removeAttribute("src")
    }
  }
})

export function sanitizeHtml(html) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  })

  // Restrict input[type] to checkbox only (used by task lists)
  const container = document.createElement("div")
  container.innerHTML = clean
  container.querySelectorAll("input").forEach((input) => {
    if (input.getAttribute("type") !== "checkbox") {
      input.remove()
    }
  })
  return container.innerHTML
}
