import type { Metadata } from "next";
import { PrintStickers } from "@/components/dashboard/tables/PrintStickers";

export const metadata: Metadata = { title: "Print table stickers · Tawilati" };

export default function PrintTableStickersPage() {
  return <PrintStickers />;
}
