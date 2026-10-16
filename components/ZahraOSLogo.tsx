export function ZahraOSLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="ZahraOS Logo"
    >
      <rect width="64" height="64" rx="16" fill="#18181b" />
      {/* Consortium OS Command Nodes */}
      <path d="M32 16L46 24V40L32 48L18 40V24L32 16Z" stroke="#818cf8" strokeWidth="2" strokeLinejoin="round" />
      <path d="M32 16V32M46 24L32 32M18 24L32 32M32 32V48" stroke="#6366f1" strokeWidth="1.75" />
      {/* Central command core */}
      <circle cx="32" cy="32" r="3.5" fill="#f5c518" />
      <circle cx="32" cy="16" r="2" fill="#818cf8" />
      <circle cx="46" cy="24" r="2" fill="#818cf8" />
      <circle cx="46" cy="40" r="2" fill="#818cf8" />
      <circle cx="32" cy="48" r="2" fill="#818cf8" />
      <circle cx="18" cy="40" r="2" fill="#818cf8" />
      <circle cx="18" cy="24" r="2" fill="#818cf8" />
    </svg>
  );
}
