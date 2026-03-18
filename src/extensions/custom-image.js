import { Node, mergeAttributes } from "@tiptap/react"
import { Plugin, PluginKey } from "@tiptap/pm/state"

/**
 * Custom Image extension with inline resize handles.
 * Drag corner handles to resize. Preserves aspect ratio by default.
 * Width/height are stored as node attributes and rendered as inline styles.
 */
export const CustomImage = Node.create({
  name: "image",
  group: "inline",
  inline: true,
  draggable: true,
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: {
        default: null,
        parseHTML: (el) => {
          const sw = el.style.width
          if (sw) return sw
          const aw = el.getAttribute("width")
          if (aw) return aw + (aw.match(/\D/) ? "" : "px")
          return null
        },
      },
      height: {
        default: null,
        parseHTML: (el) => {
          const sh = el.style.height
          if (sh) return sh
          const ah = el.getAttribute("height")
          if (ah) return ah + (ah.match(/\D/) ? "" : "px")
          return null
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: "img[src]" }]
  },

  renderHTML({ HTMLAttributes }) {
    const styles = []
    if (HTMLAttributes.width) styles.push(`width: ${HTMLAttributes.width}`)
    if (HTMLAttributes.height) styles.push(`height: ${HTMLAttributes.height}`)
    styles.push("max-width: 100%")

    const { width, height, ...rest } = HTMLAttributes
    return ["img", mergeAttributes(rest, { style: styles.join("; ") })]
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey("imageResize")

    return [
      new Plugin({
        key: pluginKey,
        props: {
          handleDOMEvents: {
            mousedown: (view, event) => {
              const target = event.target
              if (!target.classList?.contains("image-resize-handle")) return false

              event.preventDefault()
              event.stopPropagation()

              const imgWrapper = target.closest(".image-resize-wrapper")
              const img = imgWrapper?.querySelector("img")
              if (!img) return false

              const startX = event.clientX
              const startY = event.clientY
              const startW = img.offsetWidth
              const startH = img.offsetHeight
              const aspect = startW / startH
              const handle = target.dataset.handle

              const onMouseMove = (e) => {
                const dx = e.clientX - startX
                const dy = e.clientY - startY

                let newW = startW, newH = startH

                if (handle === "ml" || handle === "mr") {
                  // Horizontal edge: only width changes
                  newW = Math.max(50, handle === "mr" ? startW + dx : startW - dx)
                  newH = startH
                } else if (handle === "tm" || handle === "bm") {
                  // Vertical edge: only height changes
                  newW = startW
                  newH = Math.max(30, handle === "bm" ? startH + dy : startH - dy)
                } else {
                  // Corner: proportional resize
                  if (handle === "br" || handle === "tr") {
                    newW = Math.max(50, startW + dx)
                  } else {
                    newW = Math.max(50, startW - dx)
                  }
                  newH = Math.round(newW / aspect)
                }

                img.style.width = newW + "px"
                img.style.height = newH + "px"
              }

              const onMouseUp = () => {
                document.removeEventListener("mousemove", onMouseMove)
                document.removeEventListener("mouseup", onMouseUp)

                // Find the node position and update attributes
                const pos = view.posAtDOM(img, 0)
                if (pos != null) {
                  const tr = view.state.tr.setNodeMarkup(pos, undefined, {
                    ...view.state.doc.nodeAt(pos)?.attrs,
                    width: img.style.width,
                    height: img.style.height,
                  })
                  view.dispatch(tr)
                }
              }

              document.addEventListener("mousemove", onMouseMove)
              document.addEventListener("mouseup", onMouseUp, { once: true })
              return true
            },
          },
        },
      }),
    ]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const wrapper = document.createElement("span")
      wrapper.classList.add("image-resize-wrapper")
      wrapper.style.display = "inline-block"
      wrapper.style.position = "relative"
      wrapper.style.lineHeight = "0"

      const img = document.createElement("img")
      img.src = node.attrs.src
      if (node.attrs.alt) img.alt = node.attrs.alt
      if (node.attrs.title) img.title = node.attrs.title
      img.style.maxWidth = "100%"
      img.style.display = "block"
      if (node.attrs.width) img.style.width = node.attrs.width
      if (node.attrs.height) img.style.height = node.attrs.height

      wrapper.appendChild(img)

      // Create resize handles (corners + edges)
      const handles = ["tl", "tr", "bl", "br", "ml", "mr", "tm", "bm"]
      const handleEls = []
      for (const h of handles) {
        const handle = document.createElement("span")
        handle.classList.add("image-resize-handle")
        handle.dataset.handle = h
        const isCorner = ["tl", "tr", "bl", "br"].includes(h)
        const isHoriz = h === "ml" || h === "mr"
        const isVert = h === "tm" || h === "bm"

        let cursor = "nwse-resize"
        if (h === "tl" || h === "br") cursor = "nwse-resize"
        else if (h === "tr" || h === "bl") cursor = "nesw-resize"
        else if (isHoriz) cursor = "ew-resize"
        else if (isVert) cursor = "ns-resize"

        let posStyle = ""
        if (h === "tl") posStyle = "top:-5px;left:-5px;"
        else if (h === "tr") posStyle = "top:-5px;right:-5px;"
        else if (h === "bl") posStyle = "bottom:-5px;left:-5px;"
        else if (h === "br") posStyle = "bottom:-5px;right:-5px;"
        else if (h === "ml") posStyle = "top:50%;left:-5px;transform:translateY(-50%);"
        else if (h === "mr") posStyle = "top:50%;right:-5px;transform:translateY(-50%);"
        else if (h === "tm") posStyle = "top:-5px;left:50%;transform:translateX(-50%);"
        else if (h === "bm") posStyle = "bottom:-5px;left:50%;transform:translateX(-50%);"

        handle.style.cssText = `
          position:absolute;background:#2563eb;border:1px solid #fff;
          border-radius:2px;cursor:${cursor};display:none;z-index:5;
          ${isCorner ? "width:10px;height:10px;" : ""}
          ${isHoriz ? "width:8px;height:14px;" : ""}
          ${isVert ? "width:14px;height:8px;" : ""}
          ${posStyle}
        `
        wrapper.appendChild(handle)
        handleEls.push(handle)
      }

      // Show/hide handles on selection
      const showHandles = () => handleEls.forEach((h) => (h.style.display = "block"))
      const hideHandles = () => handleEls.forEach((h) => (h.style.display = "none"))

      // Check selection on updates
      const checkSelection = () => {
        const pos = typeof getPos === "function" ? getPos() : null
        if (pos == null) { hideHandles(); return }
        const { from, to } = editor.state.selection
        if (from <= pos && to >= pos + 1) {
          showHandles()
        } else {
          hideHandles()
        }
      }

      editor.on("selectionUpdate", checkSelection)
      editor.on("transaction", checkSelection)

      return {
        dom: wrapper,
        update: (updatedNode) => {
          if (updatedNode.type.name !== "image") return false
          img.src = updatedNode.attrs.src
          if (updatedNode.attrs.alt) img.alt = updatedNode.attrs.alt
          if (updatedNode.attrs.width) img.style.width = updatedNode.attrs.width
          if (updatedNode.attrs.height) img.style.height = updatedNode.attrs.height
          return true
        },
        selectNode: showHandles,
        deselectNode: hideHandles,
        destroy: () => {
          editor.off("selectionUpdate", checkSelection)
          editor.off("transaction", checkSelection)
        },
      }
    }
  },
})
