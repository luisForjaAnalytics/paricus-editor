import { memo } from "react"

export const HeadingIcon = memo(({
  className,
  ...props
}) => {
  return (
    <svg
      width="24"
      height="24"
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}>
      <path
        d="M5 4C5 3.44772 5.44772 3 6 3H18C18.5523 3 19 3.44772 19 4C19 4.55228 18.5523 5 18 5H13V20C13 20.5523 12.5523 21 12 21C11.4477 21 11 20.5523 11 20V5H6C5.44772 5 5 4.55228 5 4Z"
        fill="currentColor" />
    </svg>
  );
})

HeadingIcon.displayName = "HeadingIcon"
