import QRCode from "qrcode";

// A real, scannable QR code drawn as one SVG path in the text colour (no hard-coded colours, no HTML injection).
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { size, data } = QRCode.create(value, { errorCorrectionLevel: "M" }).modules;
  let path = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y * size + x]) path += `M${x} ${y}h1v1h-1z`;
    }
  }
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={`text-ink ${className ?? ""}`}
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
