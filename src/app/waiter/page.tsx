import type { Metadata } from "next";
import { WaiterFloor } from "@/components/waiter/WaiterFloor";

export const metadata: Metadata = { title: "Tables · Tawilati" };

export default function WaiterHomePage() {
  return <WaiterFloor />;
}
