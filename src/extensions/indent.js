import { Extension } from "@tiptap/react"

const MAX_INDENT = 10
const INDENT_STEP = 40 // px per level

export const Indent = Extension.create({
  name: "indent",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "bulletList", "orderedList"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const ml = parseInt(element.style.marginLeft, 10)
              return ml ? Math.round(ml / INDENT_STEP) : 0
            },
            renderHTML: (attributes) => {
              if (!attributes.indent || attributes.indent <= 0) return {}
              return { style: `margin-left: ${attributes.indent * INDENT_STEP}px` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    const isTarget = (node) => node.type.name === "paragraph" || node.type.name === "heading"

    function collectTargets(state) {
      const { from, to } = state.selection
      const positions = []
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (isTarget(node)) {
          positions.push({ node, pos })
          return false
        }
      })
      if (positions.length === 0) {
        const { $from } = state.selection
        for (let d = $from.depth; d >= 0; d--) {
          const node = $from.node(d)
          if (isTarget(node)) {
            positions.push({ node, pos: $from.before(d) })
            break
          }
        }
      }
      return positions
    }

    function applyIndentChange(positions, tr, dispatch, check) {
      let changed = false
      for (const { node, pos } of positions) {
        const current = node.attrs.indent || 0
        const next = check(current)
        if (next !== null) {
          if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next })
          changed = true
        }
      }
      return changed
    }

    return {
      indent:
        () =>
        ({ tr, state, dispatch }) =>
          applyIndentChange(collectTargets(state), tr, dispatch, (cur) =>
            cur < MAX_INDENT ? cur + 1 : null
          ),
      outdent:
        () =>
        ({ tr, state, dispatch }) =>
          applyIndentChange(collectTargets(state), tr, dispatch, (cur) =>
            cur > 0 ? cur - 1 : null
          ),
    }
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.indent(),
      "Shift-Tab": () => this.editor.commands.outdent(),
    }
  },
})
