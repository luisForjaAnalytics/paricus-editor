import { Extension } from "@tiptap/react"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import { cellAround, TableMap } from "@tiptap/pm/tables"

const rowResizePluginKey = new PluginKey("rowResize")
const HANDLE_WIDTH = 8

// --- State class (mirrors ResizeState from columnResizing) ---
class RowResizeState {
  constructor(activeHandle, dragging) {
    this.activeHandle = activeHandle // ProseMirror pos of cell near border, or -1
    this.dragging = dragging // { startY, startHeight } or false
  }

  apply(tr) {
    const action = tr.getMeta(rowResizePluginKey)
    if (action && action.setHandle != null) {
      return new RowResizeState(action.setHandle, false)
    }
    if (action && action.setDragging !== void 0) {
      return new RowResizeState(this.activeHandle, action.setDragging)
    }
    if (this.activeHandle > -1 && tr.docChanged) {
      let handle = tr.mapping.map(this.activeHandle, -1)
      try {
        const $cell = cellAround(tr.doc.resolve(handle))
        if (!$cell) handle = -1
      } catch {
        handle = -1
      }
      return new RowResizeState(handle, this.dragging)
    }
    return this
  }
}

// Walk up to find nearest TD/TH (same as domCellAround in prosemirror-tables)
function domCellAround(target) {
  while (
    target &&
    target.nodeName !== "TD" &&
    target.nodeName !== "TH"
  ) {
    target =
      target.classList && target.classList.contains("ProseMirror")
        ? null
        : target.parentNode
  }
  return target
}

// Find the cell at the bottom edge — equivalent to edgeCell but for Y axis
function edgeCellBottom(view, event) {
  const found = view.posAtCoords({
    left: event.clientX,
    top: event.clientY - HANDLE_WIDTH,
  })
  if (!found) return -1
  const { pos } = found
  try {
    const $cell = cellAround(view.state.doc.resolve(pos))
    if (!$cell) return -1
    return $cell.pos
  } catch {
    return -1
  }
}

// Get all DOM cells in the same row as the cell at `cellPos`
function getRowCells(view, cellPos) {
  const dom = view.domAtPos(cellPos + 1)
  let cellDom = dom.node
  if (cellDom.nodeType === 3) cellDom = cellDom.parentNode
  while (cellDom && cellDom.nodeName !== "TD" && cellDom.nodeName !== "TH") {
    cellDom = cellDom.parentNode
  }
  if (!cellDom) return []
  const tr = cellDom.parentNode
  if (!tr || tr.nodeName !== "TR") return []
  return Array.from(tr.querySelectorAll(":scope > td, :scope > th"))
}

// Get current row height from DOM
function currentRowHeight(view, cellPos) {
  const cells = getRowCells(view, cellPos)
  if (!cells.length) return 30
  return cells[0].parentNode.getBoundingClientRect().height
}

// Get all ProseMirror positions of cells in the same table row
function getRowCellPositions(view, cellPos) {
  try {
    const $cell = view.state.doc.resolve(cellPos)
    const table = $cell.node(-1)
    const map = TableMap.get(table)
    const start = $cell.start(-1)
    const cellIndex = map.map.indexOf(cellPos - start)
    if (cellIndex === -1) return []

    const row = Math.floor(cellIndex / map.width)
    const positions = []
    for (let col = 0; col < map.width; col++) {
      const pos = start + map.map[row * map.width + col]
      // Avoid duplicates (merged cells)
      if (!positions.includes(pos)) {
        positions.push(pos)
      }
    }
    return positions
  } catch {
    return []
  }
}

// --- Event handlers (mirror columnResizing exactly) ---

function handleMouseMove(view, event) {
  if (!view.editable) return
  const pluginState = rowResizePluginKey.getState(view.state)
  if (!pluginState) return

  if (!pluginState.dragging) {
    const target = domCellAround(event.target)
    let cell = -1

    if (target) {
      const { bottom } = target.getBoundingClientRect()
      if (bottom - event.clientY <= HANDLE_WIDTH) {
        cell = edgeCellBottom(view, event)
      }
    }

    if (cell !== pluginState.activeHandle) {
      updateHandle(view, cell)
    }
  }
}

function handleMouseLeave(view) {
  if (!view.editable) return
  const pluginState = rowResizePluginKey.getState(view.state)
  if (pluginState && pluginState.activeHandle > -1 && !pluginState.dragging) {
    updateHandle(view, -1)
  }
}

function handleMouseDown(view, event) {
  if (!view.editable) return false
  const win =
    view.dom.ownerDocument.defaultView ?? window

  const pluginState = rowResizePluginKey.getState(view.state)
  if (!pluginState || pluginState.activeHandle === -1 || pluginState.dragging)
    return false

  const height = currentRowHeight(view, pluginState.activeHandle)

  view.dispatch(
    view.state.tr.setMeta(rowResizePluginKey, {
      setDragging: { startY: event.clientY, startHeight: height },
    })
  )

  const cellPos = pluginState.activeHandle

  function finish(event) {
    win.removeEventListener("mouseup", finish)
    win.removeEventListener("mousemove", move)

    const pluginState = rowResizePluginKey.getState(view.state)
    if (pluginState?.dragging) {
      // Persist height to ProseMirror attributes
      updateRowHeight(view, cellPos, draggedHeight(pluginState.dragging, event))
      view.dispatch(
        view.state.tr.setMeta(rowResizePluginKey, { setDragging: null })
      )
    }
  }

  function move(event) {
    if (!event.which) return finish(event)

    const pluginState = rowResizePluginKey.getState(view.state)
    if (!pluginState) return

    if (pluginState.dragging) {
      const dragged = draggedHeight(pluginState.dragging, event)
      displayRowHeight(view, cellPos, dragged)
    }
  }

  // Show initial state
  displayRowHeight(view, cellPos, height)

  win.addEventListener("mouseup", finish)
  win.addEventListener("mousemove", move)

  event.preventDefault()
  return true
}

function updateHandle(view, value) {
  view.dispatch(view.state.tr.setMeta(rowResizePluginKey, { setHandle: value }))
}

function draggedHeight(dragging, event) {
  const offset = event.clientY - dragging.startY
  return Math.max(24, dragging.startHeight + offset)
}

// Visual update during drag (DOM only, no ProseMirror transaction)
function displayRowHeight(view, cellPos, height) {
  const cells = getRowCells(view, cellPos)
  for (const cell of cells) {
    cell.style.height = height + "px"
  }
}

// Persist height to ProseMirror document
function updateRowHeight(view, cellPos, height) {
  const positions = getRowCellPositions(view, cellPos)
  if (!positions.length) return

  const tr = view.state.tr
  const roundedHeight = Math.round(height)

  for (const pos of positions) {
    const node = view.state.doc.nodeAt(pos)
    if (node && node.attrs.rowHeight !== roundedHeight) {
      tr.setNodeMarkup(pos, null, {
        ...node.attrs,
        rowHeight: roundedHeight,
      })
    }
  }

  if (tr.docChanged) view.dispatch(tr)
}

// --- Decoration: show handle line when active ---
function handleDecorations(state, cellPos) {
  const decorations = []
  try {
    const $cell = state.doc.resolve(cellPos)
    const node = $cell.nodeAfter
    if (node) {
      decorations.push(
        Decoration.node(cellPos, cellPos + node.nodeSize, {
          class: "row-resize-active",
        })
      )
    }
  } catch {
    // ignore
  }
  return DecorationSet.create(state.doc, decorations)
}

// --- Plugin creation ---
function createRowResizePlugin() {
  const plugin = new Plugin({
    key: rowResizePluginKey,

    state: {
      init() {
        return new RowResizeState(-1, false)
      },
      apply(tr, prev) {
        return prev.apply(tr)
      },
    },

    props: {
      attributes(state) {
        const pluginState = rowResizePluginKey.getState(state)
        return pluginState && pluginState.activeHandle > -1
          ? { class: "row-resize-cursor" }
          : {}
      },

      handleDOMEvents: {
        mousemove(view, event) {
          handleMouseMove(view, event)
        },
        mouseleave(view) {
          handleMouseLeave(view)
        },
        mousedown(view, event) {
          return handleMouseDown(view, event)
        },
      },

      decorations(state) {
        const pluginState = rowResizePluginKey.getState(state)
        if (pluginState && pluginState.activeHandle > -1) {
          return handleDecorations(state, pluginState.activeHandle)
        }
      },
    },
  })
  return plugin
}

// --- TipTap Extension ---
export const RowResize = Extension.create({
  name: "rowResize",

  addGlobalAttributes() {
    return [
      {
        types: ["tableCell", "tableHeader"],
        attributes: {
          rowHeight: {
            default: null,
            parseHTML: (el) => {
              const h = el.style.height || el.getAttribute("data-row-height")
              return h ? parseInt(h, 10) || null : null
            },
            renderHTML: (attrs) => {
              if (!attrs.rowHeight) return {}
              return { style: `height: ${attrs.rowHeight}px` }
            },
          },
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    return [createRowResizePlugin()]
  },
})
