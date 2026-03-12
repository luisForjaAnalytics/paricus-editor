import { forwardRef } from "react"
import { useTranslation } from "react-i18next"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/tiptap-ui-primitive/popover"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { ChevronDownIcon } from "@/components/tiptap-icons/chevron-down-icon"

import "./toolbar-panel.scss"

export const ToolbarPanel = forwardRef(
  ({ icon, label, open, onOpenChange, children }, ref) => {
    const { t } = useTranslation()

    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            tooltip={label}
            data-active-state={open ? "on" : "off"}
            ref={ref}
          >
            {icon}
            <ChevronDownIcon className="tiptap-button-dropdown-small" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="center" sideOffset={6}>
          <div className="toolbar-panel-content">
            {children}
          </div>
        </PopoverContent>
      </Popover>
    )
  },
)

ToolbarPanel.displayName = "ToolbarPanel"
