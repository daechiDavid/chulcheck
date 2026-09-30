type BrandLogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeStyles = {
  sm: { mark: "h-9 w-9", wordmark: "text-xl" },
  md: { mark: "h-11 w-11", wordmark: "text-2xl" },
  lg: { mark: "h-14 w-14", wordmark: "text-4xl" },
};

export function BrandLogo({ className = "", size = "md" }: BrandLogoProps) {
  const styles = sizeStyles[size];

  return (
    <span className={`inline-flex items-center gap-2.5 whitespace-nowrap ${className}`}>
      <svg
        aria-hidden="true"
        className={`${styles.mark} shrink-0`}
        fill="none"
        viewBox="0 0 40 40"
      >
        <rect x="1" y="1" width="38" height="38" rx="11" fill="var(--color-ink)" />
        <path
          d="M13 7.5h9l6.5 6.5V30a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2Z"
          stroke="var(--color-paper)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M22 8v6.5h6.5M15 18h9.5M15 22h5.5"
          stroke="var(--color-paper)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="m15.5 27 3 3 6.5-7"
          stroke="var(--color-seal)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.8"
        />
      </svg>
      <span className={`font-display font-bold leading-none tracking-tight text-ink ${styles.wordmark}`}>
        출석<span className="text-seal">ON</span>
      </span>
    </span>
  );
}
