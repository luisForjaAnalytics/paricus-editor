"use client";
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Icons ---
import { ListIcon } from "@/components/tiptap-icons/list-icon"
import { ListOrderedIcon } from "@/components/tiptap-icons/list-ordered-icon"
import { ListTodoIcon } from "@/components/tiptap-icons/list-todo-icon"

// --- Lib ---
import { isNodeInSchema } from "@/lib/tiptap-utils"

// --- Tiptap UI ---
import { canToggleList, isListActive, listIcons } from "@/components/tiptap-ui/list-button";

export const listOptions = [
  {
    labelKey: "toolbar.bulletList",
    type: "bulletList",
    icon: ListIcon,
  },
  {
    labelKey: "toolbar.orderedList",
    type: "orderedList",
    icon: ListOrderedIcon,
  },
  {
    labelKey: "toolbar.taskList",
    type: "taskList",
    icon: ListTodoIcon,
  },
]

export function canToggleAnyList(editor, listTypes) {
  if (!editor || !editor.isEditable) return false
  return listTypes.some((type) => canToggleList(editor, type));
}

export function isAnyListActive(editor, listTypes) {
  if (!editor || !editor.isEditable) return false
  return listTypes.some((type) => isListActive(editor, type));
}

export function getFilteredListOptions(availableTypes) {
  return listOptions.filter((option) => !option.type || availableTypes.includes(option.type));
}

export function shouldShowListDropdown(params) {
  const { editor, hideWhenUnavailable, listInSchema, canToggleAny } = params

  if (!editor) return false

  if (!hideWhenUnavailable) {
    return true
  }

  if (!listInSchema) return false

  if (!editor.isActive("code")) {
    return canToggleAny
  }

  return true
}

/**
 * Gets the currently active list type from the available types
 */
export function getActiveListType(editor, availableTypes) {
  if (!editor || !editor.isEditable) return undefined
  return availableTypes.find((type) => isListActive(editor, type));
}

/**
 * Custom hook that provides list dropdown menu functionality for Tiptap editor
 *
 * @example
 * ```tsx
 * // Simple usage
 * function MyListDropdown() {
 *   const {
 *     isVisible,
 *     activeType,
 *     isAnyActive,
 *     canToggleAny,
 *     filteredLists,
 *   } = useListDropdownMenu()
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
 * function MyAdvancedListDropdown() {
 *   const {
 *     isVisible,
 *     activeType,
 *   } = useListDropdownMenu({
 *     editor: myEditor,
 *     types: ["bulletList", "orderedList"],
 *     hideWhenUnavailable: true,
 *   })
 *
 *   // component implementation
 * }
 * ```
 */
export function useListDropdownMenu(config) {
  const {
    editor: providedEditor,
    types = ["bulletList", "orderedList", "taskList"],
    hideWhenUnavailable = false,
  } = config || {}

  const { t } = useTranslation()
  const { editor } = useTiptapEditor(providedEditor)
  const [isVisible, setIsVisible] = useState(true)

  const listInSchema = types.some((type) => isNodeInSchema(type, editor))

  const filteredLists = useMemo(
    () => getFilteredListOptions(types).map((option) => ({
      ...option,
      label: t(option.labelKey),
    })),
    [types, t]
  )

  const [activeType, setActiveType] = useState(undefined)
  const [canToggleAny, setCanToggleAny] = useState(false)

  const activeList = filteredLists.find((option) => option.type === activeType)
  const isAnyActive = !!activeType

  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      setActiveType(getActiveListType(editor, types))
      setCanToggleAny(canToggleAnyList(editor, types))
      setIsVisible(shouldShowListDropdown({
        editor,
        listTypes: types,
        hideWhenUnavailable,
        listInSchema,
        canToggleAny: canToggleAnyList(editor, types),
      }))
    }

    handleUpdate()

    editor.on("selectionUpdate", handleUpdate)
    editor.on("transaction", handleUpdate)

    return () => {
      editor.off("selectionUpdate", handleUpdate)
      editor.off("transaction", handleUpdate)
    };
  }, [editor, hideWhenUnavailable, listInSchema, types])

  return {
    isVisible,
    activeType,
    isActive: isAnyActive,
    canToggle: canToggleAny,
    types,
    filteredLists,
    label: t("toolbar.list"),
    Icon: activeList ? listIcons[activeList.type] : ListIcon,
  }
}
