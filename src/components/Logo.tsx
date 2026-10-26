import Image from "next/image";

// The approved logo files from brand/logo/, served from public/brand/. Never redraw the logo.
const LOGOS = {
  horizontal: { src: "/brand/tawilati-horizontal.svg", width: 496, height: 108 },
  icon: { src: "/brand/tawilati-icon.svg", width: 85, height: 89 },
} as const;

export function Logo({
  variant = "horizontal",
  className,
}: {
  variant?: keyof typeof LOGOS;
  className?: string;
}) {
  const { src, width, height } = LOGOS[variant];
  return <Image src={src} width={width} height={height} alt="tawilati." className={className} unoptimized />;
}
