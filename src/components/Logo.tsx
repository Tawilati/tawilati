import Image from "next/image";

// The approved logo files from brand/logo/, served from public/brand/. Never redraw the logo.
const LOGOS = {
  horizontal: { src: "/brand/tawilati-horizontal.svg", width: 496, height: 108 },
  icon: { src: "/brand/tawilati-icon.svg", width: 85, height: 89 },
} as const;

export function Logo({
  variant = "horizontal",
  className,
  priority = false,
}: {
  variant?: keyof typeof LOGOS;
  className?: string;
  // Set it when the logo is above the fold: the browser fetches it first.
  priority?: boolean;
}) {
  const { src, width, height } = LOGOS[variant];
  // Every copy loads eagerly: the file is tiny, and Next.js tracks images by src, so one lazy copy lower on the page
  // (footer, table stand) would make the above-the-fold nav logo report as a lazy LCP image.
  return (
    <Image
      src={src}
      width={width}
      height={height}
      alt="tawilati."
      className={className}
      unoptimized
      {...(priority ? { priority } : { loading: "eager" })}
    />
  );
}
