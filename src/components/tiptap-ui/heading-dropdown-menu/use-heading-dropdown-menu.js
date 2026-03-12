"use client";
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Icons ---
import { HeadingIcon } from "@/components/tiptap-icons/heading-icon"

// --- Tiptap UI ---
import { headingIcons, isHeadingActive, canToggle, shouldShowButton } from "@/components/tiptap-ui/heading-button";

/**
 * Gets the currently active heading level from the available levels
 */
export function getActiveHeadingLevel(editor, levels = [1, 2, 3, 4, 5, 6]) {
  if (!editor || !editor.isEditable) return undefined
  return levels.find((level) => isHeadingActive(editor, level));
}

/**
 * Custom hook that provides heading dropdown menu functionality for Tiptap editor
 *
 * @example
 * ```tsx
 * // Simple usage
 * function MyHeadingDropdown() {
 *   const {
 *     isVisible,
 *     activeLevel,
 *     isAnyHeadingActive,
 *     canToggle,
 *     levels,
 *   } = useHeadingDropdownMenu()
 *
 *   if (!isVisible) return null
 *
 *   return (
 *     <DropdownMenu>
 *       // dropdown content
 *     </DropdownMenu>
 *   )
 * }
 *
 * // Advanced usage with configuration
 * function MyAdvancedHeadingDropdown() {
 *   const {
 *     isVisible,
 *     activeLevel,
 *   } = useHeadingDropdownMenu({
 *     editor: myEditor,
 *     levels: [1, 2, 3],
 *     hideWhenUnavailable: true,
 *   })
 *
 *   // component implementation
 * }
 * ```
 */
export function useHeadingDropdownMenu(config) {
  const {
    editor: providedEditor,
    levels = [1, 2, 3, 4, 5, 6],
    hideWhenUnavailable = false,
  } = config || {}

  const { t } = useTranslation()
  const { editor } = useTiptapEditor(providedEditor)
  const [isVisible, setIsVisible] = useState(true)
  const [activeLevel, setActiveLevel] = useState(undefined)
  const [isActive, setIsActive] = useState(false)
  const [canToggleState, setCanToggleState] = useState(false)

  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      setIsVisible(shouldShowButton({ editor, hideWhenUnavailable, level: levels }))
      setActiveLevel(getActiveHeadingLevel(editor, levels))
      setIsActive(isHeadingActive(editor))
      setCanToggleState(canToggle(editor))
    }

    handleUpdate()

    editor.on("selectionUpdate", handleUpdate)
    editor.on("transaction", handleUpdate)

    return () => {
      editor.off("selectionUpdate", handleUpdate)
      editor.off("transaction", handleUpdate)
    };
  }, [editor, hideWhenUnavailable, levels])

  return {
    isVisible,
    activeLevel,
    isActive,
    canToggle: canToggleState,
    levels,
    label: t("toolbar.heading"),
    Icon: activeLevel ? headingIcons[activeLevel] : HeadingIcon,
  }
}
