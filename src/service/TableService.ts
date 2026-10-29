
import { maptoTableResponse } from "../types/tableMapper";
import { mapToTableSticker, type TableResponse, type TableSticker } from "@/types/Table";
import { randomBytes } from "node:crypto";
import { tableRepo } from "@/repository/TableRepo";
import { slugService } from "@/service/SlugService";
import { makeSlug } from "@/utils/slug";
import type {
  CreateTableInput,
  UpdateTableInput,
} from "@/validation/tableSchemas";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
export class TableService {
  private static instance: TableService;

  static getInstance(): TableService {
    if (!TableService.instance) {
      TableService.instance = new TableService();
    }
    return TableService.instance;
  }

  async listTables(
    businessId: string,
  ): Promise<TableResponse[]> {
    const tables = await tableRepo.listByBusiness(businessId);

    return tables.map(maptoTableResponse);
  }

  async updateTable(
    businessId: string,
    id: string,
    patch: UpdateTableInput,
  ): Promise<TableResponse> {
    const table = await tableRepo.findInBusiness(id, businessId);

    if (!table) {
      throw new NotFoundException("not_found");
    }

    const updatedTable = await tableRepo.update(
      id,
      businessId,
      patch,
    );

    return maptoTableResponse(updatedTable);
  }

  // For the QR sticker (owner only): the table's name, the business's name and the menu link the code opens.
  async getSticker(businessId: string, id: string): Promise<TableSticker> {
    const table = await tableRepo.findStickerInBusiness(id, businessId);

    if (!table) {
      throw new NotFoundException("not_found");
    }

    return mapToTableSticker(table);
  }

  async disableTable(
    businessId: string,
    id: string,
  ): Promise<TableResponse> {
    const table = await tableRepo.findInBusiness(id, businessId);

    if (!table) {
      throw new NotFoundException("not_found");
    }

    const updatedTable = await tableRepo.update(id, businessId, {
      isDisabled: true,
    });

    return maptoTableResponse(updatedTable);
  }

  async enableTable(
    businessId: string,
    id: string,
  ): Promise<TableResponse> {
    const table = await tableRepo.findInBusiness(id, businessId);

    if (!table) {
      throw new NotFoundException("not_found");
    }

    const updatedTable = await tableRepo.update(id, businessId, {
      isDisabled: false,
    });

    return maptoTableResponse(updatedTable);
  }

  async createTable(
  businessId: string,
  input: CreateTableInput,
): Promise<TableResponse> {
  const label = input.label.trim();

  if (!label) {
    throw new Error("Table label cannot be empty");
  }

  const existingTable = await tableRepo.findByLabelInBusiness(
    label,
    businessId,
  );

  if (existingTable) {
    // Replace with your project's existing conflict exception.
    throw new ConflictException("table_label_exists");
  }

  const baseSlug = makeSlug(label, "table");

  const slug = await slugService.uniqueTableSlug(
    businessId,
    baseSlug,
  );

  const qrToken = randomBytes(32).toString("hex");

  const table = await tableRepo.create({
    businessId,
    label,
    slug,
    qrToken,
  });

  return maptoTableResponse(table);
}
}

export const tableService = TableService.getInstance();
