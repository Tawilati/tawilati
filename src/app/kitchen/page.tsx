import type { Metadata } from "next";
import { KitchenQueue } from "@/components/kitchen/KitchenQueue";

export const metadata: Metadata = { title: "Kitchen · Tawilati" };

export default function KitchenHomePage() {
  return <KitchenQueue />;
}
