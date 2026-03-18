import { forwardRef, useCallback, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/tiptap-ui-primitive/button";
import { useTiptapEditor } from "@/hooks/use-tiptap-editor";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { getProxyUrl } from "@/lib/editor-config";

import "./html-import-button.scss";

/**
 * Inlines CSS from <style> blocks into each element's style attribute.
 * This preserves class-based styling (fonts, borders, colors) that would
 * otherwise be lost when DOMPurify strips <style> tags.
 */
function inlineStyleBlocks(doc) {
  const styleEls = doc.querySelectorAll("style")
  if (styleEls.length === 0) return

  // Build a temporary iframe so we can use getComputedStyle with the source CSS
  const iframe = document.createElement("iframe")
  iframe.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden;"
  document.body.appendChild(iframe)

  try {
    const iframeDoc = iframe.contentDocument
    iframeDoc.open()
    iframeDoc.write(`<!DOCTYPE html><html><head>${
      Array.from(styleEls).map((s) => s.outerHTML).join("")
    }</head><body>${doc.body.innerHTML}</body></html>`)
    iframeDoc.close()

    // Properties worth inlining from stylesheets
    const PROPS = [
      "font-family", "font-size", "font-weight", "font-style",
      "color", "background-color",
      "border", "border-top", "border-right", "border-bottom", "border-left",
      "border-collapse", "border-spacing",
      "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
      "text-align", "vertical-align", "line-height", "text-decoration",
    ]

    // For each element in the iframe, read computed styles and apply as inline
    const allEls = iframeDoc.body.querySelectorAll("*")
    const origEls = doc.body.querySelectorAll("*")

    // Both trees have the same structure, so we can iterate in parallel
    if (allEls.length === origEls.length) {
      for (let i = 0; i < allEls.length; i++) {
        const computed = iframe.contentWindow.getComputedStyle(allEls[i])
        const orig = origEls[i]
        for (const prop of PROPS) {
          const val = computed.getPropertyValue(prop)
          // Only set if not already inline and value is non-default
          if (val && !orig.style.getPropertyValue(prop)) {
            orig.style.setProperty(prop, val)
          }
        }
      }
    }
  } catch {
    // Style inlining failed — content will still render, just without class-based styles
  } finally {
    document.body.removeChild(iframe)
  }

  // Remove <style> blocks since they've been inlined
  styleEls.forEach((s) => s.remove())
}

/**
 * Normalizes imported HTML tables so they render properly in the editor.
 * Removes fixed pixel widths, colgroups, and min-width styles that cause
 * narrow/broken table layouts.
 */
function normalizeImportedHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Inline <style> block rules before they get stripped by sanitization
  inlineStyleBlocks(doc);

  // Convert legacy HTML attributes to inline styles (bgcolor, align, valign, border)
  doc.querySelectorAll("[bgcolor]").forEach((el) => {
    if (!el.style.backgroundColor) {
      el.style.backgroundColor = el.getAttribute("bgcolor")
    }
    el.removeAttribute("bgcolor")
  })
  doc.querySelectorAll("[align]").forEach((el) => {
    if (!el.style.textAlign) {
      el.style.textAlign = el.getAttribute("align")
    }
    el.removeAttribute("align")
  })
  doc.querySelectorAll("[valign]").forEach((el) => {
    if (!el.style.verticalAlign) {
      el.style.verticalAlign = el.getAttribute("valign")
    }
    el.removeAttribute("valign")
  })
  doc.querySelectorAll("table[border]").forEach((table) => {
    const borderVal = table.getAttribute("border")
    if (borderVal && borderVal !== "0") {
      table.querySelectorAll("td, th").forEach((cell) => {
        if (!cell.style.border) {
          cell.style.border = `${borderVal}px solid #000`
        }
      })
    }
    table.removeAttribute("border")
  })
  doc.querySelectorAll("table[cellpadding]").forEach((table) => {
    const pad = table.getAttribute("cellpadding")
    if (pad && pad !== "0") {
      table.querySelectorAll("td, th").forEach((cell) => {
        if (!cell.style.padding) {
          cell.style.padding = `${pad}px`
        }
      })
    }
    table.removeAttribute("cellpadding")
  })

  // Remove all colgroup elements (fixed column widths)
  doc.querySelectorAll("colgroup").forEach((el) => el.remove());

  // Clean table/cell pixel widths (from TipTap resizable), but keep percentages
  doc.querySelectorAll("table, td, th").forEach((el) => {
    for (const prop of ["width", "min-width", "max-width"]) {
      const val = el.style.getPropertyValue(prop)
      // Only remove pixel values, keep percentages and other units
      if (val && /^\s*[\d.]+px\s*$/.test(val)) {
        el.style.removeProperty(prop)
      }
    }
    // Remove HTML width attribute only if it's a pixel value (not percentage)
    const attrWidth = el.getAttribute("width")
    if (attrWidth && !attrWidth.includes("%")) {
      el.removeAttribute("width")
    }
    if (!el.getAttribute("style")?.trim()) {
      el.removeAttribute("style")
    }
  });

  return doc.body.innerHTML;
}

/**
 * After content is set in the editor, asynchronously converts external images
 * to data URIs so they are embedded and don't need CORS/proxy at export time.
 */
async function embedExternalImages(editor) {
  const { state } = editor
  const imageNodes = []

  state.doc.descendants((node, pos) => {
    if (node.type.name === "image" && node.attrs.src && !node.attrs.src.startsWith("data:")) {
      imageNodes.push({ pos, attrs: { ...node.attrs } })
    }
  })

  if (imageNodes.length === 0) return

  for (const { attrs } of imageNodes) {
    const dataUri = await tryConvertToDataUri(attrs.src)
    if (dataUri) {
      // Find the current position of this node (may have shifted)
      let currentPos = null
      editor.state.doc.descendants((node, p) => {
        if (node.type.name === "image" && node.attrs.src === attrs.src && currentPos === null) {
          currentPos = p
        }
      })
      if (currentPos !== null) {
        const { tr } = editor.state
        tr.setNodeMarkup(currentPos, undefined, { ...attrs, src: dataUri })
        editor.view.dispatch(tr)
      }
    }
  }
}

async function tryConvertToDataUri(src) {
  // Strategy 1: fetch directly
  try {
    const resp = await fetch(src)
    if (resp.ok) return await blobToDataUri(await resp.blob())
  } catch { /* CORS or network error */ }

  // Strategy 2: fetch via proxy
  const proxyUrl = getProxyUrl(src)
  if (proxyUrl) {
    try {
      const resp = await fetch(proxyUrl)
      if (resp.ok) return await blobToDataUri(await resp.blob())
    } catch { /* proxy unavailable */ }
  }

  // Strategy 3: crossOrigin img + canvas
  try {
    return await new Promise((resolve, reject) => {
      const img = new window.Image()
      img.crossOrigin = "anonymous"
      const timeout = setTimeout(() => {
        img.src = ""
        reject(new Error("Image load timeout"))
      }, 5000)
      img.onload = () => {
        clearTimeout(timeout)
        try {
          const c = document.createElement("canvas")
          c.width = img.naturalWidth
          c.height = img.naturalHeight
          c.getContext("2d").drawImage(img, 0, 0)
          resolve(c.toDataURL("image/png"))
        } catch { reject(new Error("Canvas tainted")) }
      }
      img.onerror = () => {
        clearTimeout(timeout)
        reject(new Error("Image load failed"))
      }
      img.src = src
    })
  } catch { /* tainted canvas or timeout */ }

  return null
}

function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onloadend = () => resolve(r.result)
    r.onerror = () => reject(new Error("FileReader failed"))
    r.readAsDataURL(blob)
  })
}

function HtmlImportModal({ isOpen, onClose, onAccept }) {
  const { t } = useTranslation();
  const [html, setHtml] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setHtml("");
      const timer = setTimeout(() => textareaRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && html.trim()) {
        onAccept(html);
      }
    },
    [html, onClose, onAccept],
  );

  if (!isOpen) return null;

  return createPortal(
    <div
      className="html-import-overlay"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div className="html-import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="html-import-header">
          <div className="html-import-title">
            {/* Code icon */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1CAD5D"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            {t("toolbar.importHtml")}
          </div>
          <button
            type="button"
            className="html-import-close"
            onClick={onClose}
            aria-label={t("toolbar.close")}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="html-import-body">
          <div className="html-import-hint">{t("toolbar.importHtmlHint")}</div>
          <textarea
            ref={textareaRef}
            className="html-import-textarea"
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder={t("toolbar.htmlPlaceholder")}
            spellCheck={false}
          />
        </div>

        <div className="html-import-footer">
          <div className="html-import-actions">
            <button
              type="button"
              className="html-import-btn html-import-btn--accept"
              disabled={!html.trim()}
              onClick={() => onAccept(html)}
            >
              {t("toolbar.importHtmlAccept")}
            </button>
            <button
              type="button"
              className="html-import-btn html-import-btn--cancel"
              onClick={onClose}
            >
              {t("toolbar.importHtmlCancel")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export const HtmlImportButton = forwardRef(
  ({ editor: providedEditor, text, ...buttonProps }, ref) => {
    const { t } = useTranslation();
    const { editor } = useTiptapEditor(providedEditor);
    const [isOpen, setIsOpen] = useState(false);

    const handleAccept = useCallback(
      (rawHtml) => {
        if (!editor || !rawHtml.trim()) return;
        const normalized = normalizeImportedHtml(rawHtml);
        const clean = sanitizeHtml(normalized);
        editor.commands.clearContent();
        editor.commands.setContent(clean);
        setIsOpen(false);
        // Convert external images to data URIs in background
        embedExternalImages(editor).catch(() => {
          // Image embedding is best-effort — external images will remain as URLs
        })
      },
      [editor],
    );

    return (
      <>
        <Button
          type="button"
          variant="ghost"
          tooltip={t("toolbar.importHtml")}
          onClick={() => setIsOpen(true)}
          disabled={!editor}
          ref={ref}
          {...buttonProps}
        >
          {/* Code bracket icon */}
          <svg
            className="tiptap-button-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          {text && <span className="tiptap-button-text">{text}</span>}
        </Button>
        <HtmlImportModal
          isOpen={isOpen}
          onClose={() => { setIsOpen(false) }}
          onAccept={handleAccept}
        />
      </>
    );
  },
);

HtmlImportButton.displayName = "HtmlImportButton";
