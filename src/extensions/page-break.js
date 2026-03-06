import { Node, mergeAttributes } from "@tiptap/react"

export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() {
    return [{ tag: 'div[data-type="page-break"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "page-break", class: "page-break" })]
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
    }
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Enter": () => this.editor.commands.setPageBreak(),
    }
  },
})
