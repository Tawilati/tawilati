import { createHash } from "node:crypto";

// The link the hero QR code opens: table T1 of the demo café from `npm run db:seed`.
// The token is the seed's own (sha256 of "tawilati-demo-T1"), see src/prisma/seed.ts.
// Set NEXT_PUBLIC_APP_URL to the public address so the code works from a phone.
export function demoMenuUrl() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const token = createHash("sha256").update("tawilati-demo-T1").digest("hex");
  return `${base.replace(/\/$/, "")}/menu/tawilati-demo-cafe/t1?t=${token}`;
}
