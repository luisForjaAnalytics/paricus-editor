import { Extension } from "@tiptap/react"
import { Plugin, PluginKey } from "@tiptap/pm/state"

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

    // Tables without colwidth (e.g. imported HTML) use auto layout so the
    // browser respects percentage widths on cells. Once the user resizes a
    // column (which sets colwidth), switch to fixed layout for precise control.
    if (!hasColwidth) {
      tableEl.style.tableLayout = "auto"
    }

    // Apply width
    const w = node.attrs.tableWidth
    if (w) {
      tableEl.style.width = w
      tableEl.style.tableLayout = w === "auto" ? "auto" : "fixed"
    }
  })
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
    ]
  },
})
