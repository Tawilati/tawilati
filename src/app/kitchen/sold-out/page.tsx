import type { Metadata } from "next";
import { SoldOutBoard } from "@/components/kitchen/SoldOutBoard";

export const metadata: Metadata = { title: "Sold out · Tawilati" };

export default function KitchenSoldOutPage() {
  return <SoldOutBoard />;
}
