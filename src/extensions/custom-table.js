import { Table } from "@tiptap/extension-table"
import { TextSelection } from "@tiptap/pm/state"
import { createTable } from "@tiptap/extension-table"

// Table layout attributes (tableAlignment, tableWidth) are defined
// in table-layout.js as global attributes to avoid duplication.
export const CustomTable = Table.extend({
  addCommands() {
    return {
      ...this.parent?.(),
      insertTable:
        ({ rows = 3, cols = 3, withHeaderRow = true } = {}) =>
        ({ tr, dispatch, editor }) => {
          const node = createTable(editor.schema, rows, cols, withHeaderRow)

          if (dispatch) {
            // Get the actual content width (clientWidth minus padding)
            const editorEl = editor.view.dom
            let availableWidth = 700
            if (editorEl) {
              const cs = getComputedStyle(editorEl)
              availableWidth = editorEl.clientWidth
                - (parseFloat(cs.paddingLeft) || 0)
                - (parseFloat(cs.paddingRight) || 0)
            }
            const colWidth = Math.floor(availableWidth / cols)

            // Set colwidth on every cell in the new table so it uses
            // table-layout: fixed and columns don't shift when typing
            const mapped = setColwidthOnTable(node, colWidth, editor.schema)

            const offset = tr.selection.from + 1
            tr.replaceSelectionWith(mapped)
              .scrollIntoView()
              .setSelection(TextSelection.near(tr.doc.resolve(offset)))
          }

          return true
        },
    }
  },
})

function setColwidthOnTable(tableNode, colWidth, schema) {
  const newRows = []
  tableNode.forEach((row) => {
    const newCells = []
    row.forEach((cell) => {
      const colspan = cell.attrs.colspan || 1
      const widths = Array(colspan).fill(colWidth)
      newCells.push(cell.type.create({ ...cell.attrs, colwidth: widths }, cell.content, cell.marks))
    })
    newRows.push(row.type.create(row.attrs, newCells, row.marks))
  })
  return tableNode.type.create(tableNode.attrs, newRows, tableNode.marks)
}
