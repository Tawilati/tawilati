import { menuRepo } from "@/repository/MenuRepo";
import { mapToPublicMenu, type PublicMenu } from "@/types/Menu";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";
import type { PublicMenuQuery } from "@/validation/menuSchemas";

export class MenuService {
  private static instance: MenuService;

  //Prevents other files from creating instances with `new`.
  private constructor() {}

  static getInstance(): MenuService {
    if (!MenuService.instance) {
      MenuService.instance = new MenuService();
    }
    return MenuService.instance;
  }

  // The menu a guest sees after scanning the QR code on a table.
  async getPublicMenu({ businessSlug, qrToken }: PublicMenuQuery): Promise<PublicMenu> {
    const table = await menuRepo.findTableByQrToken(qrToken);
    // A token from another business gets the same answer as an unknown one.
    if (!table || table.business.slug !== businessSlug) throw new NotFoundException("invalid_qr");
    
    if (table.isDisabled) throw new ConflictException("table_disabled");

    const categories = await menuRepo.findMenuCategories(table.business.id);

    return mapToPublicMenu(table, categories);
  }
}

export const menuService = MenuService.getInstance();
