import { Node, mergeAttributes } from "@tiptap/react"
import i18next from "i18next"

function collectHeadings(doc) {
  const headings = []
  doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      headings.push({
        level: node.attrs.level,
        text: node.textContent,
        pos,
      })
    }
  })
  return headings
}

export const TableOfContents = Node.create({
  name: "tableOfContents",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() {
    return [{ tag: 'div[data-type="table-of-contents"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "table-of-contents",
        class: "table-of-contents",
      }),
    ]
  },

  addCommands() {
    return {
      setTableOfContents:
        () =>
        ({ chain }) =>
          chain()
            .insertContent([
              { type: this.name },
              { type: "paragraph" },
            ])
            .run(),
    }
  },

  addNodeView() {
    return ({ editor }) => {
      const dom = document.createElement("div")
      dom.classList.add("table-of-contents")
      dom.contentEditable = "false"

      function render() {
        const headings = collectHeadings(editor.state.doc)
        dom.innerHTML = ""

        const title = document.createElement("p")
        title.className = "toc-title"
        title.textContent = i18next.t("toolbar.tableOfContents")
        dom.appendChild(title)

        if (headings.length === 0) {
          const empty = document.createElement("p")
          empty.className = "toc-empty"
          empty.textContent = i18next.t("toolbar.tocEmpty")
          dom.appendChild(empty)
          return
        }

        const list = document.createElement("ul")
        list.className = "toc-list"

        for (const heading of headings) {
          const li = document.createElement("li")
          li.className = `toc-item toc-level-${heading.level}`

          const link = document.createElement("a")
          link.textContent = heading.text
          link.addEventListener("click", (e) => {
            e.preventDefault()
            editor
              .chain()
              .focus()
              .setTextSelection(heading.pos + 1)
              .scrollIntoView()
              .run()
          })

          li.appendChild(link)
          list.appendChild(li)
        }

        dom.appendChild(list)
      }

      render()

      const updateHandler = () => render()
      editor.on("update", updateHandler)

      return {
        dom,
        ignoreMutation() {
          return true
        },
        stopEvent() {
          return false
        },
        destroy() {
          editor.off("update", updateHandler)
        },
      }
    }
  },
})
