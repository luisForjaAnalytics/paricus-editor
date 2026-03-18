import { memo } from "react"

export const PageMixedIcon = memo(({ className, ...props }) => {
  return (
    <svg
      width="24"
      height="24"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Portrait page (left) */}
      <rect x="2" y="3" width="9" height="13" rx="1.5" />
      {/* Landscape page (right, overlapping) */}
      <rect x="10" y="8" width="12" height="9" rx="1.5" />
    </svg>
  )
})

PageMixedIcon.displayName = "PageMixedIcon"
