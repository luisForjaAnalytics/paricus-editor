import { forwardRef, useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { PagePortraitIcon } from "@/components/tiptap-icons/page-portrait-icon"
import { PageLandscapeIcon } from "@/components/tiptap-icons/page-landscape-icon"
import { PageMixedIcon } from "@/components/tiptap-icons/page-mixed-icon"
import { ChevronDownIcon } from "@/components/tiptap-icons/chevron-down-icon"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

import { Button } from "@/components/tiptap-ui-primitive/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/tiptap-ui-primitive/dropdown-menu"
import { Card, CardBody } from "@/components/tiptap-ui-primitive/card"
import { GREEN_ITEM_STYLE } from "@/lib/editor-config"

import { PageOrientationModal } from "./page-orientation-modal"

const OPTIONS = [
  { key: "portrait", icon: PagePortraitIcon },
  { key: "landscape", icon: PageLandscapeIcon },
]

export const PageOrientationDropdown = forwardRef(
  ({ editor: providedEditor, portal = false, onOpenChange, totalPages = 1, ...buttonProps }, ref) => {
    const { t } = useTranslation()
    const { editor } = useTiptapEditor(providedEditor)
    const [isOpen, setIsOpen] = useState(false)
    const [activeOrientation, setActiveOrientation] = useState("portrait")
    const [showModal, setShowModal] = useState(false)

    useEffect(() => {
      if (!editor) return

      const handleUpdate = () => {
        setActiveOrientation(editor.storage.pageBreak?.globalOrientation || "portrait")
      }

      handleUpdate()
      editor.on("transaction", handleUpdate)

      return () => {
        editor.off("transaction", handleUpdate)
      }
    }, [editor])

    const handleOpenChange = useCallback(
      (open) => {
        if (!editor) return
        setIsOpen(open)
        onOpenChange?.(open)
      },
      [editor, onOpenChange]
    )

    const handleSelect = useCallback(
      (key) => {
        if (!editor) return
        if (key === "perPage") {
          setIsOpen(false)
          setShowModal(true)
          return
        }
        editor.commands.setGlobalOrientation(key)
        setIsOpen(false)
      },
      [editor]
    )

    if (!editor) return null

    const ActiveIcon =
      activeOrientation === "landscape" ? PageLandscapeIcon : PagePortraitIcon

    return (
      <>
        <DropdownMenu modal open={isOpen} onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              role="button"
              tabIndex={-1}
              aria-label={t("toolbar.orientation")}
              tooltip={t("toolbar.orientation")}
              {...buttonProps}
              ref={ref}
            >
              <ActiveIcon className="tiptap-button-icon" />
              <ChevronDownIcon className="tiptap-button-dropdown-small" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" portal={portal}>
            <Card>
              <CardBody>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {OPTIONS.map(({ key, icon: Icon }) => (
                    <DropdownMenuItem key={key} asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        data-active-state={activeOrientation === key ? "on" : "off"}
                        onClick={() => handleSelect(key)}
                        style={{
                          justifyContent: "flex-start",
                          gap: "8px",
                          width: "100%",
                          ...GREEN_ITEM_STYLE,
                        }}
                      >
                        <Icon className="tiptap-button-icon" />
                        <span style={{ fontSize: "13px" }}>
                          {t(`toolbar.${key}`)}
                        </span>
                      </Button>
                    </DropdownMenuItem>
                  ))}
                </div>
              </CardBody>
            </Card>
          </DropdownMenuContent>
        </DropdownMenu>

        {showModal && (
          <PageOrientationModal
            editor={editor}
            totalPages={totalPages}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    )
  }
)

PageOrientationDropdown.displayName = "PageOrientationDropdown"

export default PageOrientationDropdown
