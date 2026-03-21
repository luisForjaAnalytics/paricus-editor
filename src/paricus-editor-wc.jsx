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

function ParicusEditorWrapper({ lang, responsive }) {
  const { i18n } = useTranslation()

  useEffect(() => {
    if (lang && lang !== i18n.language) {
      i18n.changeLanguage(lang)
    }
  }, [lang, i18n])

  return (
    <SimpleEditor
      responsive={responsive !== false && responsive !== "false"}
    />
  )
}

const ParicusEditorElement = r2wc(ParicusEditorWrapper, {
  props: {
    lang: "string",
    responsive: "string",
  },
})

if (!customElements.get("paricus-editor")) {
  customElements.define("paricus-editor", ParicusEditorElement)
}

export { ParicusEditorElement }
