import type { ReactNode, SVGProps } from "react";

type IconName = "book" | "film" | "music" | "arrow" | "reset" | "check" | "sliders";

const paths: Record<IconName, ReactNode> = {
  book: (
    <>
      <path d="M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z" />
      <path d="M12 6v15" />
    </>
  ),
  film: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4" />
    </>
  ),
  music: (
    <>
      <path d="M9 17V5l11-2v12M9 8l11-2" />
      <ellipse cx="6" cy="18" rx="3" ry="3" />
      <ellipse cx="17" cy="16" rx="3" ry="3" />
    </>
  ),
  arrow: (
    <>
      <path d="M4 12h16M14 6l6 6-6 6" />
    </>
  ),
  reset: (
    <>
      <path d="M3 10a9 9 0 1 1 1 7M3 4v6h6" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  sliders: (
    <>
      <path d="M4 7h7M15 7h5M4 17h3M11 17h9" />
      <circle cx="13" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
};

export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
