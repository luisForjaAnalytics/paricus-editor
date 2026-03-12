/**
 * Configuración del editor — ajustes que el consumidor del web component
 * puede personalizar antes de usar el editor.
 *
 * Uso:
 *   import { editorConfig } from "@/lib/editor-config"
 *   editorConfig.imageProxyUrl = "https://mi-api.com/proxy?url={url}"
 */
export const editorConfig = {
  /**
   * URL del proxy de imágenes. Usa `{url}` como placeholder.
   * - Dev: "/api/image-proxy?url={url}" (Vite proxy)
   * - Prod: "https://tu-backend.com/proxy?url={url}"
   * - null: desactivar proxy (solo DOM capture + fetch directo)
   */
  imageProxyUrl: "/api/image-proxy?url={url}",
}

/**
 * Construye la URL completa del proxy para una imagen dada.
 * Retorna null si el proxy está desactivado.
 */
export function getProxyUrl(src) {
  if (!editorConfig.imageProxyUrl) return null
  return editorConfig.imageProxyUrl.replace("{url}", encodeURIComponent(src))
}

/**
 * Shared style tokens for active/hover dropdown items (green accent).
 * Used by heading, font-size, line-height, list, and font-family dropdowns.
 */
export const GREEN_ITEM_STYLE = {
  "--tt-button-hover-bg-color": "rgba(28, 173, 93, 0.12)",
  "--tt-button-hover-text-color": "#1CAD5D",
  "--tt-button-hover-icon-color": "#1CAD5D",
  "--tt-button-active-bg-color": "rgba(28, 173, 93, 0.12)",
  "--tt-button-active-text-color": "#1CAD5D",
  "--tt-button-active-icon-color": "#1CAD5D",
  "--tt-button-active-hover-bg-color": "rgba(28, 173, 93, 0.2)",
}
