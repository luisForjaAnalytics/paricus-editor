/**
 * ResizableImage — TipTap extension for images with resize, drag & clipboard paste support.
 *
 * Features:
 *   1. RESIZE   – Click an image to select it; four corner handles appear.
 *                  Drag any handle to resize while keeping the aspect ratio.
 *   2. DRAG     – Images are block-level draggable nodes.
 *                  Grab the image and drop it at a new position in the document.
 *   3. PASTE    – Ctrl+V (or Cmd+V) inserts images directly from the clipboard
 *                  (screenshots, copied images, etc.). Also handles drag-and-drop
 *                  of image files from the OS file explorer.
 *
 * How it works:
 *   - Registers a custom TipTap Node called "image" that replaces the default Image extension.
 *   - Uses a React NodeView (ResizableImageView) to render each image inside the editor.
 *   - A ProseMirror plugin intercepts paste and drop events to convert image files
 *     to base64 data-URLs and insert them as image nodes.
 *
 * Settings (node attributes):
 *   - src       : Image source URL or base64 data-URL (required)
 *   - alt       : Alt text for accessibility
 *   - title     : Tooltip text
 *   - width     : Width in pixels (null = auto / natural size)
 *   - height    : Height in pixels (null = auto / natural size)
 *   - alignment : "left" | "center" | "right" (null = default left)
 *
 * Minimum resize width: 50px (prevents images from becoming too small).
 */

import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react"
import { useCallback, useRef, useState } from "react"
import { Plugin, PluginKey } from "@tiptap/pm/state"

// Minimum width (in px) the image can be resized to
const MIN_IMAGE_WIDTH = 50

/* ------------------------------------------------------------------ */
/*  ResizableImageView                                                 */
/*  React component rendered inside the editor for every image node.   */
/*  Shows the image + corner resize handles when the node is selected. */
/* ------------------------------------------------------------------ */
function ResizableImageView({ node, updateAttributes, selected }) {
  const imgRef = useRef(null)
  const [resizing, setResizing] = useState(false)

  // Read current attributes from the ProseMirror node
  const { src, alt, title, width, height, alignment } = node.attrs

  /**
   * Start a resize drag from one of the four corners.
   *
   * How resizing works:
   *   1. Record the mouse start position and the image's current pixel size.
   *   2. On every mousemove, compute the delta (dx, dy) from the start.
   *   3. Flip the delta sign for left-side / top-side handles so dragging
   *      outward always means "bigger".
   *   4. Use the dominant axis (larger absolute delta) to compute the new
   *      width or height, then derive the other dimension from the original
   *      aspect ratio to keep proportions locked.
   *   5. Call updateAttributes() to persist the new size into the ProseMirror
   *      node — this triggers a re-render automatically.
   */
  const handleMouseDown = useCallback(
    (corner, e) => {
      e.preventDefault()
      e.stopPropagation()
      setResizing(true)

      const startX = e.clientX
      const startY = e.clientY
      const startWidth = imgRef.current?.offsetWidth || 200
      const startHeight = imgRef.current?.offsetHeight || 200
      const aspectRatio = startWidth / startHeight

      const onMouseMove = (moveEvent) => {
        let dx = moveEvent.clientX - startX
        let dy = moveEvent.clientY - startY

        // Invert delta for handles on the left / top side
        if (corner === "top-left" || corner === "bottom-left") dx = -dx
        if (corner === "top-left" || corner === "top-right") dy = -dy

        // Determine new dimensions using the dominant drag axis
        let newWidth, newHeight
        if (Math.abs(dx) > Math.abs(dy)) {
          newWidth = Math.max(MIN_IMAGE_WIDTH, startWidth + dx)
          newHeight = newWidth / aspectRatio
        } else {
          newHeight = Math.max(MIN_IMAGE_WIDTH, startHeight + dy)
          newWidth = newHeight * aspectRatio
        }

        // Persist new size to the node attributes
        updateAttributes({
          width: Math.round(newWidth),
          height: Math.round(newHeight),
        })
      }

      const onMouseUp = () => {
        setResizing(false)
        document.removeEventListener("mousemove", onMouseMove)
        document.removeEventListener("mouseup", onMouseUp)
      }

      // Listen on document so the drag continues even if the cursor leaves the handle
      document.addEventListener("mousemove", onMouseMove)
      document.addEventListener("mouseup", onMouseUp)
    },
    [updateAttributes],
  )

  // Inline styles applied directly to the <img> element
  const style = {
    width: width ? `${width}px` : undefined,
    height: height ? `${height}px` : undefined,
    maxWidth: "100%",
  }

  // Wrapper styles — handles alignment (left/center/right)
  const wrapperStyle = {
    display: "inline-block",
    position: "relative",
    lineHeight: 0,
    margin:
      alignment === "center"
        ? "0 auto"
        : alignment === "right"
          ? "0 0 0 auto"
          : undefined,
  }

  return (
    <NodeViewWrapper
      className={`resizable-image-wrapper${selected ? " selected" : ""}${resizing ? " resizing" : ""}`}
      style={wrapperStyle}
      data-drag-handle // Makes the entire wrapper a drag handle for repositioning
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt || ""}
        title={title || ""}
        style={style}
        draggable={false} // Prevent native browser drag — TipTap handles it via data-drag-handle
      />

      {/* Render resize handles only when the image is selected */}
      {selected && (
        <>
          <div className="resize-handle top-left" onMouseDown={(e) => handleMouseDown("top-left", e)} />
          <div className="resize-handle top-right" onMouseDown={(e) => handleMouseDown("top-right", e)} />
          <div className="resize-handle bottom-left" onMouseDown={(e) => handleMouseDown("bottom-left", e)} />
          <div className="resize-handle bottom-right" onMouseDown={(e) => handleMouseDown("bottom-right", e)} />
        </>
      )}
    </NodeViewWrapper>
  )
}

/* ------------------------------------------------------------------ */
/*  ResizableImage — TipTap Node Extension                             */
/*                                                                     */
/*  Configuration:                                                     */
/*    name      : "image"  (replaces the default @tiptap/extension-image) */
/*    group     : "block"  (rendered as a block-level element)         */
/*    atom      : true     (cannot place the cursor inside it)         */
/*    draggable : true     (can be dragged to reposition in the doc)   */
/* ------------------------------------------------------------------ */
export const ResizableImage = Node.create({
  name: "image",
  group: "block",
  atom: true,     // Atomic node — the editor treats it as a single unit
  draggable: true, // Enables drag-and-drop repositioning within the editor

  /**
   * Node attributes — these are persisted in the ProseMirror document
   * and serialized to/from HTML.
   */
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: {
        default: null,
        // Parse width from inline styles (e.g. style="width:300px") or HTML attribute
        parseHTML: (el) => {
          const sw = el.style.width
          if (sw) return parseInt(sw, 10) || null
          const aw = el.getAttribute("width")
          if (aw) return parseInt(aw, 10) || null
          return null
        },
      },
      height: {
        default: null,
        // Parse height from inline styles or HTML attribute
        parseHTML: (el) => {
          const sh = el.style.height
          if (sh) return parseInt(sh, 10) || null
          const ah = el.getAttribute("height")
          if (ah) return parseInt(ah, 10) || null
          return null
        },
      },
      alignment: { default: null },
    }
  },

  // Which HTML elements map to this node when pasting/importing HTML
  parseHTML() {
    return [{ tag: "img[src]" }]
  },

  // How this node is serialized back to HTML (for copy, export, getHTML())
  renderHTML({ HTMLAttributes }) {
    const { width, height, alignment, ...rest } = HTMLAttributes
    const styles = []
    if (width) styles.push(`width: ${width}px`)
    if (height) styles.push(`height: ${height}px`)
    const style = styles.length ? styles.join("; ") : undefined
    return ["img", mergeAttributes(rest, style ? { style } : {})]
  },

  // Use our React component (ResizableImageView) to render inside the editor
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView)
  },

  /**
   * ProseMirror plugins for handling clipboard paste and file drop.
   *
   * handlePaste:
   *   - Intercepts Ctrl+V / Cmd+V events.
   *   - Checks clipboardData for image items (e.g., screenshots).
   *   - Converts the image to a base64 data-URL via FileReader.
   *   - Inserts it as an image node at the current cursor position.
   *
   * handleDrop:
   *   - Intercepts drag-and-drop of files from the OS.
   *   - Finds the first image file in the dropped items.
   *   - Converts to base64 and inserts at the drop coordinates.
   */
  addProseMirrorPlugins() {
    const { editor } = this

    return [
      new Plugin({
        key: new PluginKey("imagePaste"),
        props: {
          // Handle Ctrl+V / Cmd+V paste from clipboard
          handlePaste(view, event) {
            const items = Array.from(event.clipboardData?.items || [])
            const imageItem = items.find((item) => item.type.startsWith("image/"))

            // If no image in clipboard, let other handlers process the paste
            if (!imageItem) return false

            event.preventDefault()
            const file = imageItem.getAsFile()
            if (!file) return false

            // Read file as base64 data-URL and insert into the editor
            const reader = new FileReader()
            reader.onload = () => {
              editor
                .chain()
                .focus()
                .insertContent({ type: "image", attrs: { src: reader.result } })
                .run()
            }
            reader.readAsDataURL(file)
            return true // Signal that we handled this paste event
          },

          // Handle drag-and-drop of image files from the OS file explorer
          handleDrop(view, event) {
            const files = Array.from(event.dataTransfer?.files || [])
            const imageFile = files.find((f) => f.type.startsWith("image/"))

            if (!imageFile) return false

            event.preventDefault()
            const reader = new FileReader()
            reader.onload = () => {
              // Determine the document position from the drop coordinates
              const coords = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              })
              if (coords) {
                editor
                  .chain()
                  .focus()
                  .insertContentAt(coords.pos, { type: "image", attrs: { src: reader.result } })
                  .run()
              }
            }
            reader.readAsDataURL(imageFile)
            return true
          },
        },
      }),
    ]
  },
})
