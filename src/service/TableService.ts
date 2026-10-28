
import { randomBytes } from "node:crypto";
import { tableRepo } from "@/repository/TableRepo";
import { slugService } from "@/service/SlugService";
import { makeSlug } from "@/utils/slug";
import type {
  CreateTableInput,
  UpdateTableInput,
} from "@/validation/tableSchemas";

import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

export class TableService {
  private static instance: TableService;

  static getInstance(): TableService {
    if (!TableService.instance) {
      TableService.instance = new TableService();
    }
    return TableService.instance;
  }

  async listTables(businessId: string) {
    return tableRepo.listByBusiness(businessId);
  }
async updateTable(
  businessId: string,
  id: string,
  patch: UpdateTableInput,
) {
  const table = await tableRepo.findInBusiness(id, businessId);

  if (!table) {
    throw new NotFoundException("not_found");
  }

  return tableRepo.update(id, businessId, patch);
}

async disableTable(businessId: string, id: string) {
  const table = await tableRepo.findInBusiness(id, businessId);

  if (!table) {
    throw new NotFoundException("not_found");
  }

  return tableRepo.update(id, businessId, {
    isDisabled: true,
  });
}

async enableTable(businessId: string, id: string) {
  const table = await tableRepo.findInBusiness(id, businessId);

  if (!table) {
    throw new NotFoundException("not_found");
  }

  return tableRepo.update(id, businessId, {
    isDisabled: false,
  });
}

  async createTable(businessId: string, input: CreateTableInput) {
    const baseSlug = makeSlug(input.label, "table");

    const slug = await slugService.uniqueTableSlug(
      businessId,
      baseSlug,
    );

    // 32 random bytes encoded as 64 lowercase hexadecimal characters.
    const qrToken = randomBytes(32).toString("hex");

    return tableRepo.create({
      businessId,
      label: input.label,
      slug,
      qrToken,
    });
  }
}

export const tableService = TableService.getInstance();
