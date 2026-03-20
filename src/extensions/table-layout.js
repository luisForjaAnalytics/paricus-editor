import { Extension } from "@tiptap/react"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { columnResizingPluginKey, TableMap } from "prosemirror-tables"

const tableLayoutKey = new PluginKey("tableLayout")

function findTableNode(state) {
  const { $from } = state.selection
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name === "table") {
      return { node, pos: $from.before(depth) }
    }
  }
  return null
}

function applyTableStyles(view) {
  view.state.doc.descendants((node, pos) => {
    if (node.type.name !== "table") return
    const dom = view.nodeDOM(pos)
    if (!dom) return

    // The NodeView wraps the table in a div; find the actual <table>
    const tableEl = dom.tagName === "TABLE" ? dom : dom.querySelector("table")
    if (!tableEl) return

    // Apply alignment
    const align = node.attrs.tableAlignment
    if (align === "center") {
      tableEl.style.marginLeft = "auto"
      tableEl.style.marginRight = "auto"
    } else if (align === "right") {
      tableEl.style.marginLeft = "auto"
      tableEl.style.marginRight = "0"
    } else {
      tableEl.style.marginLeft = ""
      tableEl.style.marginRight = ""
    }

    // Detect if any cell has colwidth (set by column resize)
    let hasColwidth = false
    node.descendants((child) => {
      if (!hasColwidth && (child.type.name === "tableCell" || child.type.name === "tableHeader") && child.attrs.colwidth) {
        hasColwidth = true
      }
    })

    if (!hasColwidth) {
      // Tables without colwidth (e.g. imported HTML) use auto layout so the
      // browser respects percentage widths on cells.
      tableEl.style.tableLayout = "auto"
    } else {
      // Tables with colwidth: TipTap sets a pixel width that may overflow.
      // Override to 100% so the table fits its container. Keep table-layout
      // as-is (prosemirror-tables manages colgroup for column proportions).
      tableEl.style.width = "100%"
      tableEl.style.maxWidth = "100%"
      tableEl.style.minWidth = ""
    }

    // Apply compact class (new tables start with zero padding)
    tableEl.classList.toggle("compact-table", !!node.attrs.compact)

    // Apply width
    const w = node.attrs.tableWidth
    if (w) {
      tableEl.style.width = w
      tableEl.style.tableLayout = w === "auto" ? "auto" : "fixed"
    }
  })
}

/**
 * Measure actual column widths from the DOM table.
 * Tries to find a row whose cell count (accounting for colspan) matches
 * the expected number of columns, preferring rows with fewer colspans.
 */
function measureDomColumnWidths(tableEl, numCols) {
  const rows = tableEl.querySelectorAll("tr")
  let bestRow = null
  let bestScore = -1

  for (const row of rows) {
    const cells = row.querySelectorAll(":scope > td, :scope > th")
    let totalCols = 0
    for (const cell of cells) {
      totalCols += parseInt(cell.getAttribute("colspan") || "1", 10)
    }
    // Row must span the correct number of columns
    if (totalCols !== numCols) continue
    // Prefer rows with more individual cells (less colspan usage)
    if (cells.length > bestScore) {
      bestScore = cells.length
      bestRow = row
    }
  }

  if (!bestRow) {
    // Fallback: use first row
    bestRow = tableEl.querySelector("tr")
    if (!bestRow) return null
  }

  const widths = []
  const cells = bestRow.querySelectorAll(":scope > td, :scope > th")
  for (const cell of cells) {
    const colspan = parseInt(cell.getAttribute("colspan") || "1", 10)
    const w = Math.round(cell.offsetWidth / colspan)
    for (let i = 0; i < colspan; i++) {
      widths.push(w || 100)
    }
  }

  return widths.length === numCols ? widths : null
}

export const TableLayout = Extension.create({
  name: "tableLayout",

  addGlobalAttributes() {
    return [
      {
        types: ["table"],
        attributes: {
          tableAlignment: {
            default: null,
            parseHTML: (element) => {
              const ml = element.style.marginLeft
              const mr = element.style.marginRight
              if (ml === "auto" && mr === "auto") return "center"
              if (ml === "auto") return "right"
              return null
            },
            renderHTML: (attributes) => {
              const a = attributes.tableAlignment
              if (!a || a === "left") return {}
              if (a === "center") return { style: "margin-left: auto; margin-right: auto" }
              if (a === "right") return { style: "margin-left: auto; margin-right: 0" }
              return {}
            },
          },
          tableWidth: {
            default: null,
            parseHTML: (element) => {
              const w = element.style.width
              return w && w !== "100%" ? w : null
            },
            renderHTML: (attributes) => {
              const w = attributes.tableWidth
              if (!w) return {}
              return { style: `width: ${w}; table-layout: ${w === "auto" ? "auto" : "fixed"}` }
            },
          },
          compact: {
            default: false,
            parseHTML: (element) => element.getAttribute("data-compact") === "true",
            renderHTML: (attributes) => {
              if (!attributes.compact) return {}
              return { "data-compact": "true" }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setTableAlignment:
        (alignment) =>
        ({ tr, state, dispatch }) => {
          const found = findTableNode(state)
          if (!found) return false
          if (dispatch) {
            tr.setNodeMarkup(found.pos, undefined, {
              ...found.node.attrs,
              tableAlignment: alignment === "left" ? null : alignment,
            })
          }
          return true
        },
      setTableWidth:
        (width) =>
        ({ tr, state, dispatch }) => {
          const found = findTableNode(state)
          if (!found) return false
          if (dispatch) {
            tr.setNodeMarkup(found.pos, undefined, {
              ...found.node.attrs,
              tableWidth: width === "100%" ? null : width,
            })
          }
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: tableLayoutKey,
        view() {
          return {
            update(view) {
              applyTableStyles(view)
            },
          }
        },
      }),

      // When a column resize starts on a table without colwidth (imported HTML),
      // initialize colwidth on ALL cells using current DOM widths. This ensures
      // undo properly restores column proportions after a resize.
      new Plugin({
        key: new PluginKey("colResizeInit"),
        view() {
          return {
            update(view, prevState) {
              try {
                const prev = columnResizingPluginKey.getState(prevState)
                const curr = columnResizingPluginKey.getState(view.state)

                // Only act when a drag just started
                if (prev?.dragging || !curr?.dragging) return

                const activeHandle = curr.activeHandle
                if (activeHandle == null || activeHandle < 0) return

                let $cell
                try {
                  $cell = view.state.doc.resolve(activeHandle)
                } catch {
                  return
                }

                // Walk up from $cell to find the table node
                let table, tableStart
                for (let d = $cell.depth; d >= 0; d--) {
                  const node = $cell.node(d)
                  if (node.type.name === "table") {
                    table = node
                    tableStart = $cell.start(d)
                    break
                  }
                }
                if (!table) return
                const tablePos = tableStart - 1

                // Check if any cell lacks colwidth
                let needsInit = false
                table.descendants((cell) => {
                  if (
                    (cell.type.name === "tableCell" || cell.type.name === "tableHeader") &&
                    !cell.attrs.colwidth
                  ) {
                    needsInit = true
                  }
                })
                if (!needsInit) return

                // Read column widths from the DOM (synchronously, before any drag)
                const dom = view.nodeDOM(tablePos)
                if (!dom) return
                const tableEl = dom.tagName === "TABLE" ? dom : dom.querySelector("table")
                if (!tableEl) return

                const map = TableMap.get(table)
                const colWidths = measureDomColumnWidths(tableEl, map.width)
                if (!colWidths) return

                // Store doc reference to verify state hasn't changed
                const savedDoc = view.state.doc

                // Defer dispatch to avoid re-entrancy issues during view update
                setTimeout(() => {
                  if (view.state.doc !== savedDoc) return

                  const tr = view.state.tr
                  const seen = new Set()

                  for (let row = 0; row < map.height; row++) {
                    for (let col = 0; col < map.width; col++) {
                      const cellPos = map.map[row * map.width + col]
                      if (seen.has(cellPos)) continue
                      seen.add(cellPos)

                      const cell = table.nodeAt(cellPos)
                      if (!cell) continue
                      if (cell.attrs.colwidth) continue

                      const colspan = cell.attrs.colspan || 1
                      const widths = []
                      for (let c = 0; c < colspan; c++) {
                        widths.push(colWidths[col + c] || colWidths[0] || 100)
                      }

                      tr.setNodeMarkup(tableStart + cellPos, undefined, {
                        ...cell.attrs,
                        colwidth: widths,
                      })
                    }
                  }

                  // Don't add to history — this is a setup step so that undo
                  // restores the initialized widths (matching the original visual)
                  tr.setMeta("addToHistory", false)

                  if (tr.docChanged) {
                    view.dispatch(tr)
                  }
                }, 0)
              } catch (e) {
                if (import.meta.env.DEV) console.warn("[TableLayout] colResizeInit error:", e.message)
              }
            },
          }
        },
      }),
    ]
  },
})
