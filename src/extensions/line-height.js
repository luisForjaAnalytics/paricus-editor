import { Extension } from "@tiptap/react"

export const LineHeight = Extension.create({
  name: "lineHeight",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) return {}
              return { style: `line-height: ${attributes.lineHeight}` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setLineHeight:
        (height) =>
        ({ commands }) => {
          const parsed = parseFloat(height)
          if (isNaN(parsed) || parsed < 0.5 || parsed > 10) return false
          const value = String(parsed)
          return (
            commands.updateAttributes("paragraph", { lineHeight: value }) &&
            commands.updateAttributes("heading", { lineHeight: value })
          )
        },
      unsetLineHeight:
        () =>
        ({ commands }) => {
          return (
            commands.resetAttributes("paragraph", "lineHeight") &&
            commands.resetAttributes("heading", "lineHeight")
          )
        },
    }
  },
})
