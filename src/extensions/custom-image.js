import { Image } from "@tiptap/extension-image"

/**
 * Extends TipTap's Image extension to preserve width and height attributes
 * from imported HTML (e.g., inline styles like style="width: 83px").
 */
export const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          // Check inline style first, then attribute
          const styleWidth = element.style.width
          if (styleWidth) return styleWidth
          const attrWidth = element.getAttribute("width")
          if (attrWidth) return attrWidth + (attrWidth.match(/\D/) ? "" : "px")
          return null
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {}
          return { style: `width: ${attributes.width}` }
        },
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const styleHeight = element.style.height
          if (styleHeight) return styleHeight
          const attrHeight = element.getAttribute("height")
          if (attrHeight) return attrHeight + (attrHeight.match(/\D/) ? "" : "px")
          return null
        },
        renderHTML: (attributes) => {
          if (!attributes.height) return {}
          return { style: `height: ${attributes.height}` }
        },
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    // Merge width and height into a single style string
    const styles = []
    if (HTMLAttributes.style) {
      // Collect existing style parts
      const parts = HTMLAttributes.style.split(";").map((s) => s.trim()).filter(Boolean)
      styles.push(...parts)
    }

    const { style, ...rest } = HTMLAttributes
    const finalStyle = styles.length > 0 ? styles.join("; ") : undefined

    return ["img", { ...rest, ...(finalStyle ? { style: finalStyle } : {}) }]
  },
})
