# Paricus Editor — Architecture & Documentation

## Overview

**Paricus Editor** is a rich text editor built with [Tiptap v3](https://tiptap.dev/) (on top of ProseMirror), React 19, and Vite. It provides advanced features such as resizable tables, document import/export (DOCX, PDF, HTML), bookmarks, table of contents, special characters, and an adaptive toolbar with compact mode.

---

## Tech Stack

| Technology | Version | Role |
|---|---|---|
| React | 19 | UI Framework |
| Tiptap | 3.20 | Editing engine (on top of ProseMirror) |
| Vite | 7.3 | Build tool + dev server |
| i18next | — | Internationalization (EN, ES) |
| Radix UI | — | UI primitives (Popover, DropdownMenu) |
| MUI Material | 7.x | Additional UI components |
| DOMPurify | — | HTML sanitization |
| docx | — | DOCX export |
| mammoth | — | DOCX import |
| tesseract.js | — | OCR for PDF import |

---

## Component Props

### `<SimpleEditor />`

| Prop | Type | Default | Description |
|---|---|---|---|
| `responsive` | `boolean` | `true` | Controls the responsive behavior of the editor. |

#### `responsive` Behavior

| `responsive` | Screen ≥ 1025px | Screen ≤ 1024px |
|---|---|---|
| `true` | Full toolbar (desktop) | Compact toolbar with 4 collapsible menus |
| `false` | Full toolbar (desktop) | **Editor hidden**. Displays message: *"This editor is not available on small screens"* |

**Usage example:**

```jsx
import { SimpleEditor } from "./SimpleEditor"

// With responsive toolbar (default)
<SimpleEditor />

// Without responsive version — hides the editor on screens < 1024px
<SimpleEditor responsive={false} />
```

---

## Folder Structure

```
src/
├── App.jsx                            # Wrapper with ErrorBoundary
├── SimpleEditor.jsx                   # Main editor component
├── main.jsx                           # Entry point (React createRoot)
├── editor.scss                        # Global editor styles
│
├── i18n/
│   ├── index.js                       # i18next configuration (en, es)
│   └── locales/
│       ├── en.json                    # English translations
│       └── es.json                    # Spanish translations
│
├── lib/
│   ├── editor-config.js               # Image proxy configuration
│   ├── tiptap-utils.js                # Utilities: upload, shortcuts, selection
│   ├── sanitize-html.js               # HTML sanitization (DOMPurify)
│   ├── docx-exporter.js               # HTML → DOCX conversion
│   ├── docx-converter.js              # DOCX → HTML conversion (mammoth + XML extraction)
│   ├── pdf-converter.js               # PDF → HTML conversion (OCR via tesseract.js)
│   └── stamp-table-widths.js          # Table width stamping for PDF export
│
├── hooks/
│   ├── use-is-breakpoint.js           # Breakpoint detection (media query)
│   ├── use-tiptap-editor.js           # Access editor via context or props
│   ├── use-cursor-visibility.js       # Cursor position for mobile toolbar
│   ├── use-window-size.js             # Window dimensions
│   ├── use-table-detection.js         # Table context detection
│   ├── use-menu-navigation.js         # Keyboard navigation for menus
│   └── ...                            # Other utility hooks
│
├── extensions/
│   ├── bookmark.js                    # Document bookmarks/anchors
│   ├── custom-image.js                # Image with preserved width/height
│   ├── custom-table-cell.js           # Table cell with extended attributes
│   ├── custom-table.js                # Table with extended attributes
│   ├── font-size.js                   # Font size (1–200px)
│   ├── indent.js                      # Indentation (0–10 levels, 40px/level)
│   ├── line-height.js                 # Line height
│   ├── page-break.js                  # Page break (Mod+Enter)
│   ├── row-resize.js                  # Table row resizing
│   ├── table-layout.js                # Table layout attributes
│   └── table-of-contents.js           # Table of contents (auto-collects H1–H6)
│
├── components/
│   ├── ErrorBoundary.jsx              # Error boundary with i18n fallback
│   │
│   ├── tiptap-icons/                  # ~30 SVG icons as React components
│   │
│   ├── tiptap-node/                   # Custom nodes (render + styles)
│   │   ├── blockquote-node/
│   │   ├── code-block-node/
│   │   ├── heading-node/
│   │   ├── horizontal-rule-node/
│   │   ├── image-node/
│   │   ├── image-upload-node/
│   │   ├── list-node/
│   │   ├── page-break-node/
│   │   ├── paragraph-node/
│   │   ├── table-node/
│   │   └── table-of-contents-node/
│   │
│   ├── tiptap-ui-primitive/           # Base components (no editor logic)
│   │   ├── button/                    # Button with variants, tooltip, icons
│   │   ├── dropdown-menu/             # Radix DropdownMenu wrapper
│   │   ├── popover/                   # Radix Popover wrapper
│   │   ├── toolbar/                   # Toolbar with keyboard navigation
│   │   ├── spacer/
│   │   └── ...
│   │
│   ├── tiptap-ui/                     # Editor UI components
│   │   ├── blockquote-button/
│   │   ├── bookmark-button/
│   │   ├── code-block-button/
│   │   ├── color-highlight-popover/   # Color picker with palette
│   │   ├── docx-export-button/        # Export to DOCX (lazy-loaded)
│   │   ├── docx-import-button/        # Import DOCX (lazy-loaded)
│   │   ├── font-family-dropdown/
│   │   ├── font-size-dropdown/
│   │   ├── heading-dropdown-menu/     # Levels H1–H4
│   │   ├── html-import-button/        # Import HTML with sanitization
│   │   ├── image-upload-button/
│   │   ├── indent-button/
│   │   ├── language-switcher/         # EN/ES toggle
│   │   ├── line-height-dropdown/
│   │   ├── link-popover/              # Create/edit/remove links
│   │   ├── list-dropdown-menu/        # Bullet, ordered, task lists
│   │   ├── mark-button/               # Generic mark toggle
│   │   ├── page-break-button/
│   │   ├── pdf-export-button/         # Export to PDF (print iframe)
│   │   ├── pdf-import-button/         # Import PDF (OCR tesseract.js)
│   │   ├── remove-formatting-button/
│   │   ├── special-chars-button/      # Special characters
│   │   ├── new-document-button/        # New document with confirmation modal
│   │   ├── page-orientation-dropdown/  # Page orientation (portrait/landscape)
│   │   ├── table-dropdown-menu/       # Insert/configure table
│   │   ├── table-floating-toolbar/    # Contextual table toolbar
│   │   ├── text-align-button/         # Alignment: left, center, right, justify
│   │   ├── toc-button/                # Insert table of contents
│   │   ├── toolbar-panel/             # Collapsible panel for compact toolbar
│   │   └── undo-redo-button/
│   │
│   └── tiptap-templates/
│       └── simple/
│           └── simple-editor.scss     # Template styles
│
└── styles/
    ├── variables.scss                 # CSS theme variables
    └── keyframe-animations.scss       # Animations
```

---

## Registered Tiptap Extensions

### StarterKit Extensions (configured)

| Extension | Configuration |
|---|---|
| Link | `openOnClick: false`, `enableClickSelection: true` |
| HorizontalRule | **Disabled** (custom version used instead) |
| Underline | **Disabled** (registered separately to avoid duplicate) |

### Individual Extensions

| Extension | Source | Description |
|---|---|---|
| HorizontalRule | `tiptap-node/` | Custom horizontal rule |
| TextAlign | `@tiptap` | Alignment for `heading` and `paragraph` |
| TaskList + TaskItem | `@tiptap` | Nested task lists |
| Highlight | `@tiptap` | Multicolor highlighting |
| CustomImage | `extensions/` | Image with preserved `width`/`height` |
| Typography | `@tiptap` | Smart typography (quotes, dashes) |
| Superscript | `@tiptap` | Superscript |
| Subscript | `@tiptap` | Subscript |
| Underline | `@tiptap` | Underline |
| TextStyle | `@tiptap` | Base mark for text styles |
| Color | `@tiptap` | Text color |
| FontFamily | `@tiptap` | Font family |
| FontSize | `extensions/` | Font size (1–200px) |
| LineHeight | `extensions/` | Line height |
| Indent | `extensions/` | Indentation (0–10 levels, 40px per level) |
| Table | `@tiptap` | Resizable table (`resizable: true`) |
| TableRow | `@tiptap` | Table row |
| CustomTableCell | `extensions/` | Cell with extended attributes (color, height) |
| CustomTableHeader | `extensions/` | Table header with extended attributes |
| TableLayout | `extensions/` | Table layout |
| RowResize | `extensions/` | Vertical row resizing (min 1rem/16px) |
| PageBreak | `extensions/` | Page break (shortcut: `Mod+Enter`) |
| Bookmark | `extensions/` | Document bookmarks/anchors |
| TableOfContents | `extensions/` | Auto-generated table of contents (H1–H6) |
| Selection | `@tiptap` | Visual selection |
| ImageUploadNode | `tiptap-node/` | Drag-drop image upload (max 5MB, 3 files) |

---

## Toolbar — Structure & Grouping

### Desktop (screen ≥ 1025px)

Flat toolbar with all buttons visible, organized in groups:

```
[ Undo | Redo ] | [ FontFamily | FontSize | LineHeight | Lists | Indent ↑↓ |
  Table | TableEdit | Blockquote | CodeBlock ] | [ Bold | Italic | Strike |
  Code | Underline | ColorHighlight | Link | RemoveFormatting ] |
  [ Superscript | Subscript ] | [ Align ← ↔ → ⟷ ] |
  [ Image | PageBreak | Bookmark | Headings | TOC | SpecialChars ] |
  [ DocxImport | HtmlImport | DocxExport | PdfExport | LanguageSwitcher ]
```

### Compact (screen ≤ 1024px)

Collapsed toolbar with 4 Popover menus + Undo/Redo always visible:

| Menu | Icon | Contents |
|---|---|---|
| **Text** | `A` with brush | FontFamily, FontSize, LineHeight, Bold, Italic, Strike, Underline, Code, Superscript, Subscript, ColorHighlight, RemoveFormatting |
| **Paragraph** | Text lines | Headings, Lists, Indent/Outdent, TextAlign (x4), Blockquote, CodeBlock |
| **Insert** | `+` | Image, Table, TableEdit, Link, PageBreak, Bookmark, TOC, SpecialChars |
| **Import/Export** | Arrows ↑↓ | DocxImport, HtmlImport, DocxExport, PdfExport |

The `LanguageSwitcher` remains visible outside of the menus.

### Mobile (screen ≤ 768px)

Same compact toolbar, with additional adaptations:
- `ColorHighlightPopoverButton` replaces the full popover
- `LinkButton` replaces `LinkPopover`
- Toolbar dynamically positioned with cursor visibility
- Swappable views: main → highlighter/link → back

---

## Import / Export

### Export to PDF
- **Method:** Print-to-PDF via hidden iframe
- **Process:** Collect stylesheets → resolve CSS variables → create iframe → apply print overrides (A4, 10mm margins) → `window.print()`
- **Component:** `PdfExportButton`

### Export to DOCX
- **Method:** HTML → DOCX binary conversion via `docx` library
- **Lazy-loaded:** Loaded on demand to reduce bundle size
- **Component:** `DocxExportButton`
- **Library:** `src/lib/docx-exporter.js`

### Import DOCX
- **Method:** DOCX → HTML conversion via `mammoth` + XML extraction via `JSZip`
- **XML extraction:** Cell colors (`<w:shd>`), column widths (`<w:tblGrid>`), text formatting
- **Column widths:** Extracted from `<w:tblGrid>` and scaled proportionally to editor width
- **Limit:** 10MB maximum
- **Sanitization:** DOMPurify before inserting
- **Lazy-loaded:** Loaded on demand
- **Component:** `DocxImportButton`
- **Library:** `src/lib/docx-converter.js`

### Import PDF
- **Method:** OCR via `tesseract.js`
- **Progress:** Page by page
- **Lazy-loaded:** Heavy library, loaded on demand
- **Component:** `PdfImportButton`

### Import HTML
- **Method:** Modal with textarea to paste HTML
- **Normalization:** `normalizeImportedHtml()` — inlines `<style>` blocks, converts legacy attrs, converts `%` widths → `colwidth`, handles rowspans
- **Sanitization:** DOMPurify with allowed `colwidth` + `data-*` attributes
- **External images:** Converted to data URIs in background (best-effort)
- **Content replacement:** `clearContent()` before `setContent()` ensures clean import
- **Component:** `HtmlImportButton`

---

## HTML Sanitization

Implemented in `src/lib/sanitize-html.js` with DOMPurify:

- **Allowed tags:** `p`, `h1`–`h6`, `table`, `img`, `a`, `ul`, `ol`, `li`, `strong`, `em`, `mark`, `span`, etc.
- **Allowed attributes:** `class`, `style`, `href`, `src`, `colspan`, `rowspan`, `colwidth`, `data-colwidth`, `data-bookmark-id`, etc.
- **Data attributes:** `ALLOW_DATA_ATTR: true` — allows `data-*` attributes for TipTap compatibility
- **Allowed CSS:** `color`, `background-color`, `font-family`, `font-size`, `border`, `padding`, `text-align`, etc.
- **Blocked:** `javascript:`, `data:`, `vbscript:`, `url()`, `expression()`, `@import`
- **Links:** Forces `rel="noopener noreferrer"` on `target="_blank"`
- **Inputs:** Only allows `<input type="checkbox">` (for task lists)

---

## Internationalization (i18n)

- **Library:** i18next + react-i18next
- **Languages:** English (`en`), Spanish (`es`)
- **Default:** `en`
- **Language switching:** `LanguageSwitcher` component in the toolbar

Translation categories:
- `editor.*` — Editor labels (aria, messages)
- `toolbar.*` — ~90 keys for buttons, menus, placeholders
- `cellColors.*` — 8 colors for table cells
- `colors.*` — 10 background colors for highlighting
- `link.*` — Link popover labels
- `upload.*` — File upload messages
- `errors.*` — ~20 error messages

---

## RowResize Extension — Row Resizing

Custom implementation that replicates the `columnResizing` behavior from prosemirror-tables but for the vertical axis.

### Minimum height: 1rem (16px)

**Problem:** `overflow: hidden` and `height` on `<td>` are ignored by browsers (`display: table-cell` behavior). The `height` property on cells acts as `min-height`.

**Solution:** CSS custom property `--row-h` on cells + `max-height` + `overflow: hidden` on **children** (`> *`), which are block elements and do respect overflow.

```scss
// table-node.scss
td[style*="--row-h"] > * {
  max-height: calc(var(--row-h) - 1em - 2px); // subtract padding + border
  overflow: hidden;
}
```

### Resize flow

1. **Detection:** `mousemove` detects proximity to the bottom edge of the cell (8px)
2. **Drag:** `mousedown` starts dragging, storing `startY` and `startHeight`
3. **Visual:** `displayRowHeight()` updates `height` and `--row-h` in DOM during drag
4. **Persistence:** `updateRowHeight()` saves the height in ProseMirror attributes on release
5. **Enforcement:** `enforceMinRowHeights()` runs on every render to guarantee the minimum

---

## Table Layout — Column Width Management

Tables use `table-layout: fixed` to prevent text from pushing columns. Column widths are managed differently based on table origin:

| Origin | `table-layout` | `width` | Column widths |
|--------|---------------|---------|---------------|
| **New (compact)** | `fixed` | `100%` | Equal colwidths from `custom-table.js` |
| **Imported (HTML)** | `fixed` | `100%` | Converted from `%` widths → `colwidth` attr |
| **Imported (Word)** | `fixed` | `100%` | Extracted from `<w:tblGrid>` XML → `colwidth` attr |
| **User-resized** | `fixed` | prosemirror-tables | Updated by prosemirror-tables column resize |

### Import pipeline for column widths

1. **HTML import:** `normalizeImportedHtml()` reads `style="width: X%"` on cells → converts to `colwidth="Npx"` attribute → TipTap v3 parses `colwidth` into ProseMirror model → prosemirror-tables creates `<colgroup>` with those widths
2. **Word import:** `extractFormattingFromXml()` reads `<w:tblGrid><w:gridCol w:w="...">` → scales twips proportionally to 700px → `injectCellWidths()` sets `colwidth` on HTML cells → same TipTap parsing pipeline

### Rowspan-aware colwidth assignment

Both import paths track active rowspans to correctly assign column widths when cells span multiple rows.

---

## Page Orientation & Pagination

- **A4 dimensions:** 794px × 1123px (portrait), 1123px × 794px (landscape)
- **Orientation dropdown:** Portrait (default) or Landscape
- **Page count:** Calculated from `scrollHeight / pageHeight`, shown in status bar
- **Canvas height:** Dynamically adjusts as content grows, resets on new import
- **Page boundaries:** Dashed lines at page height intervals (visual-only, no content splitting)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                      App.jsx                         │
│  ┌─────────────────────────────────────────────────┐ │
│  │               ErrorBoundary                      │ │
│  │  ┌───────────────────────────────────────────┐  │ │
│  │  │           SimpleEditor                     │  │ │
│  │  │  ┌─────────────────────────────────────┐  │  │ │
│  │  │  │  EditorContext.Provider              │  │  │ │
│  │  │  │                                      │  │  │ │
│  │  │  │  ┌──────────────────────────────┐   │  │  │ │
│  │  │  │  │        Toolbar               │   │  │  │ │
│  │  │  │  │  ┌────────────────────────┐  │   │  │  │ │
│  │  │  │  │  │ MainToolbarContent     │  │   │  │  │ │
│  │  │  │  │  │  (desktop / compact)   │  │   │  │  │ │
│  │  │  │  │  └────────────────────────┘  │   │  │  │ │
│  │  │  │  │  ┌────────────────────────┐  │   │  │  │ │
│  │  │  │  │  │ MobileToolbarContent   │  │   │  │  │ │
│  │  │  │  │  │  (highlighter / link)  │  │   │  │  │ │
│  │  │  │  │  └────────────────────────┘  │   │  │  │ │
│  │  │  │  └──────────────────────────────┘   │  │  │ │
│  │  │  │                                      │  │  │ │
│  │  │  │  ┌──────────────────────────────┐   │  │  │ │
│  │  │  │  │     EditorContent            │   │  │  │ │
│  │  │  │  │  (Tiptap + ProseMirror)      │   │  │  │ │
│  │  │  │  └──────────────────────────────┘   │  │  │ │
│  │  │  └─────────────────────────────────────┘  │  │ │
│  │  └───────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│          Extension Layers                │
│                                          │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │  StarterKit  │  │ Custom Extensions│  │
│  │  (base)      │  │ (11 extensions)  │  │
│  └─────────────┘  └─────────────────┘  │
│                                          │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │  @tiptap/*   │  │  ProseMirror     │  │
│  │  extensions  │  │  plugins          │  │
│  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│          Support Libraries               │
│                                          │
│  sanitize-html.js    DOMPurify           │
│  docx-exporter.js    docx library        │
│  editor-config.js    Image proxy         │
│  tiptap-utils.js     Shortcuts/Upload    │
└─────────────────────────────────────────┘
```

---

## Breakpoints & Display Modes

```
  0px          768px        1024px        ∞
  ├─────────────┼─────────────┼────────────┤
  │   MOBILE    │   COMPACT   │  DESKTOP   │
  │             │             │            │
  │ Compact     │ Compact     │ Full       │
  │ toolbar +   │ toolbar     │ toolbar    │
  │ mobile      │ (4 menus)   │ (all       │
  │ adaptations │             │  buttons)  │
  │ (swappable  │             │            │
  │  views)     │             │            │
  └─────────────┴─────────────┴────────────┘

  With responsive={false}:
  ├─────────────┼─────────────┼────────────┤
  │  HIDDEN     │   HIDDEN    │  DESKTOP   │
  │  (message)  │  (message)  │  (normal)  │
  └─────────────┴─────────────┴────────────┘
```

---

## Development Scripts

```bash
# Development server (port 5174)
npm run dev

# Production build
npm run build

# Preview build
npm run preview

# Linting
npm run lint
```

---

## File Limits

| Type | Limit |
|---|---|
| Image (upload) | 5 MB |
| DOCX (import) | 10 MB |
| Simultaneous images | 3 |
| Indentation levels | 10 (40px/level) |
| Font size | 1–200px |
| Minimum row height | 16px (1rem) |
| Image max width (DOCX) | 600px |
| Editor reference width | 700px (A4 portrait minus margins/borders) |
