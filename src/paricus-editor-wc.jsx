/**
 * Web Component entry point for Paricus Editor.
 *
 * Wraps the React-based SimpleEditor as a Custom Element (<paricus-editor>)
 * that can be used in any framework: Angular, Vue, Svelte, vanilla HTML, etc.
 *
 * Usage:
 *   <script src="paricus-editor.umd.js"></script>
 *   <paricus-editor lang="es" responsive="true"></paricus-editor>
 */
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import r2wc from "@r2wc/react-to-web-component"
import { SimpleEditor } from "./SimpleEditor"
import "./i18n"
import "./editor.scss"

// Wrapper component that bridges web component attributes to SimpleEditor props
function ParicusEditorWrapper({ lang, responsive }) {
  const { i18n } = useTranslation()

  // Sync lang attribute with i18n
  useEffect(() => {
    if (lang && lang !== i18n.language) {
      i18n.changeLanguage(lang)
    }
  }, [lang, i18n])

  return <SimpleEditor responsive={responsive !== false && responsive !== "false"} />
}

// Convert React component to Custom Element
const ParicusEditorElement = r2wc(ParicusEditorWrapper, {
  props: {
    lang: "string",
    responsive: "string",
    content: "string",
    readonly: "string",
  },
})

// Register the custom element
if (!customElements.get("paricus-editor")) {
  customElements.define("paricus-editor", ParicusEditorElement)
}

export { ParicusEditorElement }
