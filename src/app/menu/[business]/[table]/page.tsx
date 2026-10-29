import type { Metadata } from "next";
import { MenuStateScreen, type MenuProblem } from "@/components/menu/MenuStateScreen";
import { MenuView } from "@/components/menu/MenuView";
import { menuService } from "@/service/MenuService";
import type { PublicMenu } from "@/types/Menu";
import { HttpException } from "@/utils/exceptions/http/HttpException";
import { publicMenuQuerySchema, type PublicMenuQuery } from "@/validation/menuSchemas";

export const metadata: Metadata = { title: "Menu · Tawilati" };

type LoadResult = { menu: PublicMenu; query: PublicMenuQuery } | { problem: MenuProblem };

async function loadMenu(business: string, table: string, token: unknown): Promise<LoadResult> {
  const parsed = publicMenuQuerySchema.safeParse({ b: business, t: token });
  if (!parsed.success) return { problem: "invalid_qr" };

  try {
    const menu = await menuService.getPublicMenu(parsed.data);
    // The token decides the table; a table name in the address that doesn't match it means the link was edited.
    if (menu.table.slug !== table) return { problem: "invalid_qr" };
    return { menu, query: parsed.data };
  } catch (error) {
    if (error instanceof HttpException && (error.message === "invalid_qr" || error.message === "table_disabled")) {
      return { problem: error.message };
    }
    throw error;
  }
}

// The page a guest opens by scanning the table's QR code: /menu/{business slug}/{table slug}?t={qrToken}.
// The first menu is loaded here on the server; MenuView then keeps it fresh from /api/menu.
export default async function MenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ business: string; table: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { business, table } = await params;
  const { t } = await searchParams;

  const result = await loadMenu(business, table, t);
  if ("problem" in result) return <MenuStateScreen problem={result.problem} />;

  return (
    <MenuView initialMenu={result.menu} businessSlug={result.query.businessSlug} qrToken={result.query.qrToken} />
  );
}
