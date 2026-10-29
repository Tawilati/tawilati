import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import type { TableSticker } from "@/types/Table";

// The printed QR sticker for one table, as a PNG: the landing page's table card with the business name added.
// 3:4, 900 x 1200 px, so it prints sharp at about 7.5 x 10 cm.
export const STICKER_WIDTH = 900;
export const STICKER_HEIGHT = 1200;

// ImageResponse can't read CSS variables; these are the values of the brand tokens in brand/tokens.css.
const BRAND = {
  primary: "#254D3B", // --brand-primary
  accent: "#E5A45B", // --brand-accent
  text: "#202B26", // --text-primary
  muted: "#5B6660", // --text-muted
  border: "#E4DED0", // --border-subtle
  surface: "#FFFFFF", // --surface-primary
};

type Assets = { fonts: { name: string; data: Buffer; weight: 400 | 600 | 700 }[]; logo: string };
let assets: Promise<Assets> | undefined;

// Read once per server process: Inter (the app's UI font) and the approved logo from public/brand/.
function loadAssets(): Promise<Assets> {
  assets ??= (async () => {
    const root = process.cwd();
    const font = (weight: 400 | 600 | 700) => readFile(join(root, "src/assets/fonts", `Inter-${weight}.ttf`));
    const [regular, semibold, bold, logoSvg] = await Promise.all([
      font(400),
      font(600),
      font(700),
      readFile(join(root, "public/brand/tawilati-horizontal.svg")),
    ]);
    return {
      fonts: [
        { name: "Inter", data: regular, weight: 400 },
        { name: "Inter", data: semibold, weight: 600 },
        { name: "Inter", data: bold, weight: 700 },
      ],
      logo: `data:image/svg+xml;base64,${logoSvg.toString("base64")}`,
    };
  })();
  // A failed read (file missing) is retried on the next request instead of being cached.
  assets.catch(() => (assets = undefined));
  return assets;
}

// A short code ("T1", "12", "A3") reads better as "Table T1"; a name that is already words ("Terrace 2", "VIP",
// "Table 4") is shown as it is, so the sticker never says "Table Terrace 2".
export function tableLine(label: string): string {
  return /^[a-z]{0,2}-?\d+$/i.test(label) ? `Table ${label}` : label;
}

// `menuUrl` is the full address the code opens, e.g. https://…/menu/tawilati-demo-cafe/t1?t=1e64…
export async function renderTableSticker(sticker: TableSticker, menuUrl: string): Promise<ImageResponse> {
  const [{ fonts, logo }, qrSvg] = await Promise.all([
    loadAssets(),
    QRCode.toString(menuUrl, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: BRAND.text, light: BRAND.surface },
    }),
  ]);
  const qr = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          padding: "70px 80px",
          background: BRAND.surface,
          border: `4px solid ${BRAND.border}`,
          borderRadius: 60,
          fontFamily: "Inter",
          color: BRAND.text,
          textAlign: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -4,
            left: (STICKER_WIDTH - 240) / 2,
            width: 240,
            height: 26,
            borderRadius: "0 0 999px 999px",
            background: BRAND.accent,
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse draws plain <img>, not next/image */}
        <img src={logo} alt="" width={356} height={78} />
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse draws plain <img>, not next/image */}
        <img src={qr} alt="" width={544} height={544} style={{ marginTop: 60 }} />
        <div style={{ marginTop: 52, fontSize: 49, fontWeight: 700, letterSpacing: -0.5 }}>Scan to view the menu.</div>
        <div style={{ marginTop: 26, fontSize: 36, fontWeight: 600, color: BRAND.primary, maxWidth: 740 }}>
          {sticker.businessName}
        </div>
        <div style={{ marginTop: 6, fontSize: 36, fontWeight: 400, color: BRAND.muted, maxWidth: 740 }}>
          {tableLine(sticker.label)}
        </div>
      </div>
    ),
    { width: STICKER_WIDTH, height: STICKER_HEIGHT, fonts },
  );
}
