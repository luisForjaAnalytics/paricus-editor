export function RemoveFormattingIcon({ className, ...props }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 7V4h16v3" />
      <path d="M10 20h4" />
      <path d="M12 20v-7" />
      <path d="M5 19L19 5" />
    </svg>
  )
}
