import { redirect } from "next/navigation";

// There is no overview screen: /dashboard opens the owner's first screen, the menu.
export default function OwnerHomePage() {
  redirect("/dashboard/menu");
}
