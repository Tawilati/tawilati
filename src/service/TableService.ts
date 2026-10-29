
import { maptoTableResponse } from "../types/tableMapper";
import { mapToTableSticker, type TableResponse, type TableSticker } from "@/types/Table";
import { randomBytes } from "node:crypto";
import { Prisma } from "@/app/generated/prisma/client";
import { tableRepo } from "@/repository/TableRepo";
import { slugService } from "@/service/SlugService";
import { makeSlug } from "@/utils/slug";
import type {
  CreateTableInput,
  UpdateTableInput,
} from "@/validation/tableSchemas";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";

function isTableSlugConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  // Prisma's pg adapter reports the index name instead of meta.target.
  const meta = error.meta as {
    target?: unknown;
    driverAdapterError?: { cause?: { constraint?: { index?: string } } };
  } | undefined;
  const constraint = meta?.driverAdapterError?.cause?.constraint?.index ?? meta?.target;
  return constraint === "DiningTable_businessId_slug_key" || (
    Array.isArray(constraint) && constraint.length === 2 &&
    constraint.includes("businessId") && constraint.includes("slug")
  );
}
export class TableService {
  private static instance: TableService;

  // Prevents other files from creating instances with `new`.
  private constructor() {}

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
    // createTableSchema has already trimmed the label and refused an empty one.
    const { label } = input;

    const existingTable = await tableRepo.findByLabelInBusiness(label, businessId);

    if (existingTable) {
      throw new ConflictException("table_label_exists");
    }

    const baseSlug = makeSlug(label, "table");
    const qrToken = randomBytes(32).toString("hex");

    // Another request can claim the slug between allocation and insertion.
    // Recheck availability after that specific conflict; never retry label or infrastructure errors.
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = await slugService.uniqueTableSlug(businessId, baseSlug);
      try {
        const table = await tableRepo.create({ businessId, label, slug, qrToken });
        return maptoTableResponse(table);
      } catch (error) {
        if (!isTableSlugConflict(error)) throw error;
      }
    }

    throw new ConflictException("slug_already_taken");
  }
}

export const tableService = TableService.getInstance();
