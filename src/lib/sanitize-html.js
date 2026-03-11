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
  // Custom data attributes used by the editor
  "data-type", "data-color", "data-bookmark-id", "data-bookmark-label",
  "data-text-align", "data-checked",
  // Input (task lists)
  "type", "checked", "disabled",
]

export function sanitizeHtml(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["contenteditable"],
  })
}
