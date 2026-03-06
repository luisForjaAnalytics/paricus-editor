import { Node, mergeAttributes } from "@tiptap/react"

function sanitizeId(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64)
}

export const Bookmark = Node.create({
  name: "bookmark",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-bookmark-id"),
        renderHTML: (attributes) => {
          if (!attributes.id) return {}
          return { "data-bookmark-id": attributes.id }
        },
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-bookmark-label"),
        renderHTML: (attributes) => {
          if (!attributes.label) return {}
          return { "data-bookmark-label": attributes.label }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-bookmark-id]" }]
  },

  renderHTML({ HTMLAttributes }) {
    const label = HTMLAttributes["data-bookmark-label"] || HTMLAttributes["data-bookmark-id"] || ""
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "bookmark-anchor",
        id: HTMLAttributes["data-bookmark-id"],
        contenteditable: "false",
      }),
      label,
    ]
  },

  addCommands() {
    return {
      setBookmark:
        (attrs) =>
        ({ chain, state }) => {
          const id = sanitizeId(attrs.id || attrs.label || "")
          if (!id) return false

          let duplicate = false
          state.doc.descendants((node) => {
            if (node.type.name === "bookmark" && node.attrs.id === id) {
              duplicate = true
              return false
            }
          })
          if (duplicate) return false

          return chain()
            .insertContent({
              type: this.name,
              attrs: { ...attrs, id },
            })
            .run()
        },

      removeBookmark:
        (id) =>
        ({ tr, state, dispatch }) => {
          if (!id) return false
          const { doc } = state
          let found = false
          doc.descendants((node, pos) => {
            if (node.type.name === "bookmark" && node.attrs.id === id) {
              if (dispatch) {
                tr.delete(pos, pos + node.nodeSize)
              }
              found = true
              return false
            }
          })
          return found
        },
    }
  },
})
