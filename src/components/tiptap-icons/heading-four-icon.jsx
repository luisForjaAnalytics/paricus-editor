import { memo } from "react"

export const HeadingFourIcon = memo(({
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
        d="M3 6C3 5.44772 3.44772 5 4 5H12C12.5523 5 13 5.44772 13 6C13 6.55228 12.5523 7 12 7H9V18C9 18.5523 8.55228 19 8 19C7.44772 19 7 18.5523 7 18V7H4C3.44772 7 3 6.55228 3 6Z"
        fill="currentColor" />
      <path
        d="M17 9C17.5523 9 18 9.44772 18 10V13H20V10C20 9.44772 20.4477 9 21 9C21.5523 9 22 9.44772 22 10V18C22 18.5523 21.5523 19 21 19C20.4477 19 20 18.5523 20 18V15H17C16.4477 15 16 14.5523 16 14V10C16 9.44772 16.4477 9 17 9Z"
        fill="currentColor" />
    </svg>
  );
})

HeadingFourIcon.displayName = "HeadingFourIcon"
