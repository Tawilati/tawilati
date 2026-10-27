//this role+perm file for RABC where i assign each permission to a specific role
export enum ROLE{
    OWNER= "OWNER",
    KITCHEN= "KITCHEN",
    WAITER= "WAITER"
}
export enum PERMISSION{
      // Auth & staff
  STAFF_CREATE = "STAFF_CREATE",
  STAFF_LIST = "STAFF_LIST",
  STAFF_UPDATE = "STAFF_UPDATE",

  // Business settings
  BUSINESS_READ = "BUSINESS_READ",
  BUSINESS_UPDATE = "BUSINESS_UPDATE",

  // Menu
  CATEGORY_READ = "CATEGORY_READ",
  CATEGORY_WRITE = "CATEGORY_WRITE",
  MENU_ITEM_READ = "MENU_ITEM_READ",
  MENU_ITEM_WRITE = "MENU_ITEM_WRITE",
  MENU_ITEM_ARCHIVE = "MENU_ITEM_ARCHIVE",
  SOLD_OUT_TOGGLE = "SOLD_OUT_TOGGLE",

  // Tables & QR
  TABLE_READ = "TABLE_READ",
  TABLE_WRITE = "TABLE_WRITE",
  TABLE_QR_READ = "TABLE_QR_READ",

  // Kitchen
  KITCHEN_QUEUE_READ = "KITCHEN_QUEUE_READ",
  ORDER_STATUS_PREPARING = "ORDER_STATUS_PREPARING",
  ORDER_STATUS_READY = "ORDER_STATUS_READY",

  // Waiter
  WAITER_TABLES_READ = "WAITER_TABLES_READ",
  ORDER_STATUS_SERVED = "ORDER_STATUS_SERVED",
  BILL_READ = "BILL_READ",
  PAYMENT_RECORD = "PAYMENT_RECORD",
  TAB_CLOSE = "TAB_CLOSE",

  // Reports
  REPORT_DAILY_READ = "REPORT_DAILY_READ",

}
// ============================================
// ROLE PERMISSIONS MAPPING
// ============================================

type RolePermissions = {
  [key in ROLE]: PERMISSION[];
};
export const ROLE_PERMISSIONS: RolePermissions ={
    //owner has all permissions
    [ROLE.OWNER]: Object.values(PERMISSION),
    // ==========================================
  // WAITER - Limited Access(READ MAINLY  )
  // ==========================================
    [ROLE.WAITER]: [
       // Read-only business info
    PERMISSION.BUSINESS_READ,

    // Read-only menu
    PERMISSION.CATEGORY_READ,
    PERMISSION.MENU_ITEM_READ,

    // Read-only tables
    PERMISSION.TABLE_READ,

    // Waiter operations
    PERMISSION.WAITER_TABLES_READ,
    PERMISSION.ORDER_STATUS_SERVED,
    PERMISSION.BILL_READ,
    PERMISSION.PAYMENT_RECORD,
    PERMISSION.TAB_CLOSE,
     
    ],
    [ROLE.KITCHEN]: [
         // Read-only business info
    PERMISSION.BUSINESS_READ,

    // Read-only menu
    PERMISSION.CATEGORY_READ,
    PERMISSION.MENU_ITEM_READ,

    // Sold-out toggle
    PERMISSION.SOLD_OUT_TOGGLE,

    // Kitchen operations
    PERMISSION.KITCHEN_QUEUE_READ,
    PERMISSION.ORDER_STATUS_PREPARING,
    PERMISSION.ORDER_STATUS_READY,
    ]
}
// ============================================
// HELPER FUNCTIONS
// ============================================
//THEY HELP TO CHECK IF A USER HAS A SPECIFIC PERMISSION OR NOT INSIDE THE AUTHGAURD    

//this is used to convert the strinf role in request to the enum ROLE type
  export function toRole(role: string): ROLE  {
  const roleMap: Record<string, ROLE> = {
    owner:   ROLE.OWNER,
    kitchen: ROLE.KITCHEN,
    waiter:  ROLE.WAITER,
  };
  return roleMap[role.trim().toLowerCase()] 
}

export function hasPermission(
  userRole: ROLE,
  permission: PERMISSION
): boolean {
  const permissions = ROLE_PERMISSIONS[userRole];
  return permissions.includes(permission);
}

export function hasAnyPermission(
  userRole: ROLE,
  permissions: PERMISSION[]
): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

export function hasAllPermissions(
  userRole: ROLE,
  permissions: PERMISSION[]
): boolean {
  return permissions.every(permission => hasPermission(userRole, permission));
}

export function getPermissionsForRole(role: ROLE): PERMISSION[] {
  return ROLE_PERMISSIONS[role] || [];
}