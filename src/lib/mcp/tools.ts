// The tools an AI assistant can call. Each one calls the same service as the matching HTTP route,
// with the same permission, so the business rules live in one place.
// Left out on purpose: staff accounts, payments and closing tabs, order status changes, QR stickers.
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { registerTool } from "@/lib/mcp/tool";
import { businessService } from "@/service/BusinessService";
import { categoryService } from "@/service/CategoryService";
import { kitchenService } from "@/service/KitchenService";
import { menuItemService } from "@/service/MenuItemsService";
import { reportService } from "@/service/ReportService";
import { tableService } from "@/service/TableService";
import { waiterService } from "@/service/WaiterService";
import { PERMISSION } from "@/types/Roles";
import { isCalendarDate } from "@/utils/timezone";
import { updateBusinessSchema } from "@/validation/businessSchemas";
import { createCategorySchema } from "@/validation/categorySchemas";
import { createMenuItemSchema, updateMenuItemSchema } from "@/validation/menuItemsSchemas";
import { createTableSchema } from "@/validation/tableSchemas";

const noInput = z.object({});
const id = (what: string) => z.string().uuid().describe(`The ${what}'s id`);

export function registerTawilatiTools(server: McpServer): void {
  // ── Read ──────────────────────────────────────────────

  registerTool(server, "get_business", {
    title: "Business settings",
    description: "The café's name, exchange rate (LBP per USD) and timezone.",
    inputSchema: noInput,
    permission: PERMISSION.BUSINESS_READ,
    readOnly: true,
  }, (_input, { businessId }) => businessService.getById(businessId));

  registerTool(server, "list_categories", {
    title: "List menu categories",
    description: "Every menu category with its id and how many items it holds.",
    inputSchema: noInput,
    permission: PERMISSION.CATEGORY_READ,
    readOnly: true,
  }, (_input, { businessId }) => categoryService.listCategories(businessId));

  registerTool(server, "list_menu_items", {
    title: "List menu items",
    description:
      "Every menu item, archived ones included, with its id, category, prices (USD and LBP, as strings) and sold-out flag.",
    inputSchema: noInput,
    permission: PERMISSION.MENU_ITEM_READ,
    readOnly: true,
  }, (_input, { businessId }) => menuItemService.getAll(businessId));

  registerTool(server, "list_tables", {
    title: "List tables",
    description: "Every dining table with its id, label and whether it is disabled.",
    inputSchema: noInput,
    permission: PERMISSION.TABLE_READ,
    readOnly: true,
  }, (_input, { businessId }) => tableService.listTables(businessId));

  registerTool(server, "get_kitchen_orders", {
    title: "Kitchen orders",
    description: "The orders the kitchen is working on right now, with their lines and status.",
    inputSchema: noInput,
    permission: PERMISSION.KITCHEN_QUEUE_READ,
    readOnly: true,
  }, (_input, { businessId }) => kitchenService.getKitchenOrders(businessId));

  registerTool(server, "list_active_tables", {
    title: "Tables with an open tab",
    description: "The tables that have an open tab, as the waiter sees them.",
    inputSchema: noInput,
    permission: PERMISSION.WAITER_TABLES_READ,
    readOnly: true,
  }, (_input, { businessId }) => waiterService.getActiveTables(businessId));

  registerTool(server, "get_daily_report", {
    title: "Daily sales report",
    description:
      "One day's sales: totals in USD and LBP, what was received per currency, bills closed, orders, items sold, top items, cash vs card and sales by waiter. The day runs midnight to midnight on the café's clock. Leave date out for today.",
    inputSchema: z.object({
      date: z.string().refine(isCalendarDate, "Use a real date as YYYY-MM-DD").optional()
        .describe("The day as YYYY-MM-DD. Defaults to today in the café's timezone."),
    }),
    permission: PERMISSION.REPORT_DAILY_READ,
    readOnly: true,
  }, ({ date }, { businessId }) => reportService.getDailyReport(businessId, date));

  // ── Write ─────────────────────────────────────────────

  registerTool(server, "create_category", {
    title: "Add a menu category",
    description: "Adds a menu category. The name must be unique in the café.",
    inputSchema: createCategorySchema,
    permission: PERMISSION.CATEGORY_WRITE,
    readOnly: false,
  }, ({ name }, { businessId }) => categoryService.createCategory(businessId, name));

  registerTool(server, "create_menu_item", {
    title: "Add a menu item",
    description:
      "Adds a menu item to a category (get the categoryId from list_categories). The LBP price is worked out from the exchange rate.",
    inputSchema: createMenuItemSchema,
    permission: PERMISSION.MENU_ITEM_WRITE,
    readOnly: false,
  }, (input, { businessId }) => menuItemService.create(businessId, input));

  registerTool(server, "update_menu_item", {
    title: "Edit a menu item",
    description: "Changes a menu item's name, category, USD price or sold-out flag. Send only the fields to change.",
    inputSchema: z.object({ id: id("menu item"), changes: updateMenuItemSchema }).strict(),
    permission: PERMISSION.MENU_ITEM_WRITE,
    readOnly: false,
  }, ({ id: itemId, changes }, { businessId }) => menuItemService.update(businessId, itemId, changes));

  registerTool(server, "set_menu_item_sold_out", {
    title: "Mark sold out or back in stock",
    description: "Marks a menu item sold out (guests can't order it) or back in stock.",
    inputSchema: z.object({ id: id("menu item"), soldOut: z.boolean() }).strict(),
    permission: PERMISSION.SOLD_OUT_TOGGLE,
    readOnly: false,
  }, ({ id: itemId, soldOut }, { businessId }) => menuItemService.update(businessId, itemId, { soldOut }));

  registerTool(server, "archive_menu_item", {
    title: "Archive a menu item",
    description: "Takes a menu item off the menu. It can be restored with unarchive_menu_item.",
    inputSchema: z.object({ id: id("menu item") }).strict(),
    permission: PERMISSION.MENU_ITEM_ARCHIVE,
    readOnly: false,
  }, ({ id: itemId }, { businessId }) => menuItemService.archive(businessId, itemId));

  registerTool(server, "unarchive_menu_item", {
    title: "Restore a menu item",
    description: "Puts an archived menu item back on the menu.",
    inputSchema: z.object({ id: id("menu item") }).strict(),
    permission: PERMISSION.MENU_ITEM_ARCHIVE,
    readOnly: false,
  }, ({ id: itemId }, { businessId }) => menuItemService.unarchive(businessId, itemId));

  registerTool(server, "create_table", {
    title: "Add a table",
    description: "Adds a dining table. The label must be unique in the café. Print its QR code from the dashboard.",
    inputSchema: createTableSchema,
    permission: PERMISSION.TABLE_WRITE,
    readOnly: false,
  }, (input, { businessId }) => tableService.createTable(businessId, input));

  registerTool(server, "set_table_disabled", {
    title: "Disable or enable a table",
    description: "A disabled table's QR code stops taking new orders until it is enabled again.",
    inputSchema: z.object({ id: id("table"), disabled: z.boolean() }).strict(),
    permission: PERMISSION.TABLE_UPDATE,
    readOnly: false,
  }, ({ id: tableId, disabled }, { businessId }) =>
    disabled ? tableService.disableTable(businessId, tableId) : tableService.enableTable(businessId, tableId));

  registerTool(server, "update_business_settings", {
    title: "Change the exchange rate or timezone",
    description:
      "Changes the exchange rate (LBP per USD) and/or the timezone. A new rate reprices every menu item's LBP price; past orders keep theirs.",
    inputSchema: updateBusinessSchema,
    permission: PERMISSION.BUSINESS_UPDATE,
    readOnly: false,
  }, (input, { businessId }) => businessService.updateSettings(businessId, input));
}
