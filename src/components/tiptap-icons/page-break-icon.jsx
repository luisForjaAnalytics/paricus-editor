export function PageBreakIcon({ className, ...props }) {
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
      <path d="M4 18V6a2 2 0 0 1 2-2h8.5L20 9.5V18" />
      <path d="M20 18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2" />
      <path d="M2 12h6" />
      <path d="M16 12h6" />
    </svg>
  )
}
