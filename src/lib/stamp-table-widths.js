/**
 * Stamps actual column width ratios from the live editor DOM onto
 * a target container's tables. This ensures exports (DOCX, PDF)
 * reflect any column resizes the user made in the editor.
 *
 * @param {HTMLElement} editorEl - The live editor DOM element (.tiptap.ProseMirror)
 * @param {HTMLElement|Document} targetRoot - Container or document whose tables should be stamped
 * @param {object} [options]
 * @param {"ratio"|"style"} [options.mode="ratio"] - "ratio" stamps data-editor-ratio attribute,
 *   "style" applies inline CSS width + table-layout:fixed (for PDF/print)
 */
export function stampTableWidths(editorEl, targetRoot, { mode = "ratio" } = {}) {
  if (!editorEl || !targetRoot) return

  const editorTables = editorEl.querySelectorAll("table")
  const targetTables = targetRoot.querySelectorAll("table")

  for (let t = 0; t < Math.min(editorTables.length, targetTables.length); t++) {
    const eRows = getDirectRows(editorTables[t])
    const tRows = getDirectRows(targetTables[t])
    if (eRows.length === 0 || tRows.length === 0) continue

    // Find the row with the most individual cells to measure column widths
    let bestRowIdx = 0
    let bestCellCount = 0
    for (let r = 0; r < eRows.length; r++) {
      const cells = eRows[r].querySelectorAll(":scope > th, :scope > td")
      if (cells.length > bestCellCount) {
        bestCellCount = cells.length
        bestRowIdx = r
      }
    }

    const eCells = eRows[bestRowIdx].querySelectorAll(":scope > th, :scope > td")
    let totalW = 0
    for (const c of eCells) totalW += c.offsetWidth
    if (totalW <= 0) continue

    // Build per-column ratios from the best row
    const colRatios = []
    for (let i = 0; i < eCells.length; i++) {
      const cell = eCells[i]
      const colspan = parseInt(cell.getAttribute("colspan") || "1", 10)
      const ratio = eCells[i].offsetWidth / totalW
      if (colspan === 1) {
        colRatios.push(ratio)
      } else {
        // Distribute evenly across spanned columns
        for (let c = 0; c < colspan; c++) {
          colRatios.push(ratio / colspan)
        }
      }
    }

    if (mode === "style") {
      // Apply inline CSS widths + table-layout:fixed for PDF/print
      const table = targetTables[t]
      table.style.tableLayout = "fixed"

      let colgroup = table.querySelector(":scope > colgroup")
      if (!colgroup) {
        colgroup = (targetRoot.createElement || document.createElement).call(
          targetRoot.createElement ? targetRoot : document,
          "colgroup"
        )
        table.insertBefore(colgroup, table.firstChild)
      }
      colgroup.innerHTML = ""

      for (const ratio of colRatios) {
        const col = colgroup.ownerDocument.createElement("col")
        col.style.width = (ratio * 100).toFixed(2) + "%"
        colgroup.appendChild(col)
      }
    } else {
      // Stamp data-editor-ratio on ALL rows' cells (not just the best row)
      // so the DOCX converter finds ratios regardless of which row it picks
      for (let r = 0; r < Math.min(eRows.length, tRows.length); r++) {
        const tCells = tRows[r].querySelectorAll(":scope > th, :scope > td")

        let colIdx = 0
        for (let i = 0; i < tCells.length; i++) {
          const colspan = parseInt(tCells[i].getAttribute("colspan") || "1", 10)
          // Sum the ratios for all columns this cell spans
          let cellRatio = 0
          for (let c = 0; c < colspan && colIdx + c < colRatios.length; c++) {
            cellRatio += colRatios[colIdx + c]
          }
          if (cellRatio > 0) {
            tCells[i].setAttribute("data-editor-ratio", cellRatio.toFixed(4))
          }
          colIdx += colspan
        }
      }
    }
  }
}

function getDirectRows(table) {
  return table.querySelectorAll(
    ":scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr"
  )
}
