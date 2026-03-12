import { memo } from "react"

export const HeadingOneIcon = memo(({
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
        d="M21.0001 10C21.0001 9.63121 20.7971 9.29235 20.472 9.11833C20.1468 8.94431 19.7523 8.96338 19.4454 9.16795L16.4454 11.168C15.9859 11.4743 15.8617 12.0952 16.1681 12.5547C16.4744 13.0142 17.0953 13.1384 17.5548 12.8321L19.0001 11.8685V18C19.0001 18.5523 19.4478 19 20.0001 19C20.5524 19 21.0001 18.5523 21.0001 18V10Z"
        fill="currentColor" />
    </svg>
  );
})

HeadingOneIcon.displayName = "HeadingOneIcon"
