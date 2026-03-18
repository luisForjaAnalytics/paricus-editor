import { Node, mergeAttributes } from "@tiptap/react"

export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      orientation: {
        default: null, // null = use global default
        parseHTML: (el) => el.getAttribute("data-orientation") || null,
        renderHTML: (attrs) =>
          attrs.orientation ? { "data-orientation": attrs.orientation } : {},
      },
    }
  },

  addStorage() {
    return {
      globalOrientation: "portrait",
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="page-break"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "page-break",
        class: "page-break",
      }),
    ]
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name })
            .createParagraphNear()
            .run(),

      setGlobalOrientation:
        (orientation) =>
        ({ editor }) => {
          editor.storage.pageBreak.globalOrientation = orientation
          // Trigger a re-render so React picks up the storage change
          editor.view.dispatch(editor.state.tr.setMeta("globalOrientation", orientation))
          return true
        },

      setPageOrientation:
        (pos, orientation) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setNodeMarkup(pos, undefined, { orientation })
          }
          return true
        },

      getPageOrientations:
        () =>
        ({ editor }) => {
          const pages = []
          const globalO = editor.storage.pageBreak.globalOrientation
          let currentOrientation = globalO

          editor.state.doc.descendants((node, pos) => {
            if (node.type.name === "pageBreak") {
              pages.push({
                pos,
                orientation: node.attrs.orientation || globalO,
              })
              currentOrientation = node.attrs.orientation || globalO
            }
          })

          return { global: globalO, pages }
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Enter": () => this.editor.commands.setPageBreak(),
    }
  },
})
