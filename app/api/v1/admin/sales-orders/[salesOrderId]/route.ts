
import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../../functions/db";
import { validateFields } from "../../../functions/validation";
import { hasPermission, getUserData, hasTenantAccess } from "../../../functions/permissions";

const salesOrderFieldLabels = {
  tenant_id: { en: "Tenant", ar: "المنظمة" },
  customer_id: { en: "Customer", ar: "الزبون" },
  user_id: { en: "User", ar: "المستخدم" },
  branch_id: { en: "Branch", ar: "الفرع" },
  order_status: { en: "Order Status", ar: "حالة الطلب" },
  total_amount: { en: "Total Amount", ar: "المبلغ الإجمالي" },
};

const errorMessages = {
  en: {
    unauthorized: "Unauthorized access.",
    serverError: "Internal server error.",
    customerNotFound: "Customer not found for this tenant.",
    userNotFound: "User not found for this tenant.",
    branchNotFound: "Branch not found for this tenant.",
    updateSuccess: "Sales order updated successfully",
    deletedSuccess:"Sales order deleted successfully",
    missingOrderIds: "Sales order IDs are required",
    salesOrderNotFound:"sales Order Not Found",
    noDataToUpdate:"no Data To Update",
    missingOrderId:"Order Id is required"
  },
  ar: {
    unauthorized: "دخول غير مصرح به.",
    serverError: "خطأ في الخادم الداخلي.",
    customerNotFound: "الزبون غير موجود ضمن هذه المنظمة.",
    userNotFound: "المستخدم غير موجود ضمن هذه المنظمة.",
    branchNotFound: "الفرع غير موجود ضمن هذه المنظمة.",
    updateSuccess: "تم تعديل طلب المبيعات بنجاح",
    deletedSuccess:"تم حذف طلب المبيعات بنجاح",
     missingOrderIds: "معرفات طلبات المبيعات مطلوبة",
     salesOrderNotFound:"طلب المبيعات هذا غير موجود",
     noDataToUpdate:"لا يوجد داتا للتعديل",
     missingOrderId:"معرف الطلب مطلوب "
  },
};

function getErrorMessage(key: keyof typeof errorMessages["en"], lang: "en" | "ar" = "en") {
  return errorMessages[lang][key] || errorMessages["en"][key];
}

/**
 * PUT /api/v1/admin/sales-orders/[salesOrderId]
 *
 * Updates an existing sales order belonging to a tenant.
 * Validates tenant ownership, verifies referenced entities (customer, user, branch),
 * checks permissions in production mode, and only updates provided fields.
 *
 * Path Params:
 *   - salesOrderId (number, required)
 *       → The sales order identifier to update
 *
 * Request Body (JSON):
 *   - tenant_id (number, required)
 *       → The tenant owning the order (used for validation and access control)
 *   - customer_id (number, optional)
 *       → Updated customer ID (must belong to the same tenant)
 *   - user_id (number, optional)
 *       → Updated assigned user (must belong to same tenant)
 *   - branch_id (number, optional)
 *       → Updated branch ID (validated if provided)
 *   - order_status (string, optional)
 *       → Updated order status (draft, submitted, approved, invoiced)
 *   - total_amount (number, optional)
 *       → Updated total cost of the order
 *
 * Validation:
 *   ✔ Ensures order exists under the tenant
 *   ✔ Ensures optional related entities (customer/user/branch) exist within same tenant
 *   ✔ Validates provided fields only — supports partial update
 *
 * Responses:
 *   - 200: { message }
 *       → Order updated successfully
 *   - 400: { error }
 *       → Missing tenant_id, invalid fields, or nothing to update
 *   - 401: { error }
 *       → Unauthorized access or insufficient permissions
 *   - 404: { error }
 *       → Order, customer, user, or branch not found
 *   - 500: { error }
 *       → Internal server error
 */

export async function PUT(req: NextRequest, { params }: any) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();
    const payload = await req.json();
    const orderId = params.salesOrderId;

    if (!orderId) {
      return NextResponse.json({ error: getErrorMessage("missingOrderId", lang) }, { status: 400 });
    }

    const { tenant_id, customer_id, user_id, branch_id, order_status, total_amount } = payload;

    const user: any = await getUserData(req);

    // Permission + tenant access check
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "edit_sales_orders");
      if (!hasAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }

    // Validate tenant
    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    // Check sales order existence
    const [currentOrder] = await pool.query(
      `SELECT id FROM sales_orders WHERE id = ? AND tenant_id = ?`,
      [orderId, tenant_id]
    );

    if (!(currentOrder as any[]).length) {
      return NextResponse.json({ error: getErrorMessage("salesOrderNotFound", lang) }, { status: 404 });
    }

    // Dynamic field validation
    const rules: any = {
      tenant_id: [{ required: true, label: salesOrderFieldLabels.tenant_id[lang] }, { type: "number" }],
      customer_id: [{ required: false, label: salesOrderFieldLabels.customer_id[lang] }, { type: "number" }],
      user_id: [{ required: false, label: salesOrderFieldLabels.user_id[lang] }, { type: "number" }],
      branch_id: [{ required: false, label: salesOrderFieldLabels.branch_id[lang] }, { type: "number" }],
      total_amount: [{ required: false, label: salesOrderFieldLabels.total_amount[lang] }, { type: "number" }],
    };

    const { valid, errors } = validateFields(payload, rules, lang);
    if (!valid) {
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    // Optional foreign key validations
    if (customer_id) {
      const [customers] = await pool.query(
        `SELECT id FROM customers WHERE id = ? AND tenant_id = ?`,
        [customer_id, tenant_id]
      );
      if (!(customers as any[]).length) {
        return NextResponse.json({ error: getErrorMessage("customerNotFound", lang) }, { status: 404 });
      }
    }

    if (user_id) {
      const [users] = await pool.query(
        `SELECT id FROM users WHERE id = ? AND tenant_id = ?`,
        [user_id, tenant_id]
      );
      if (!(users as any[]).length) {
        return NextResponse.json({ error: getErrorMessage("userNotFound", lang) }, { status: 404 });
      }
    }

    if (branch_id) {
      const [branches] = await pool.query(
        `SELECT id FROM branches WHERE id = ? AND tenant_id = ?`,
        [branch_id, tenant_id]
      );
      if (!(branches as any[]).length) {
        return NextResponse.json({ error: getErrorMessage("branchNotFound", lang) }, { status: 404 });
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    if (customer_id) { updateFields.push("customer_id = ?"); updateValues.push(customer_id); }
    if (user_id) { updateFields.push("user_id = ?"); updateValues.push(user_id); }
    if (branch_id) { updateFields.push("branch_id = ?"); updateValues.push(branch_id); }
    if (order_status) { updateFields.push("order_status = ?"); updateValues.push(order_status); }
    if (total_amount != null) { updateFields.push("total_amount = ?"); updateValues.push(total_amount); }

    if (!updateFields.length) {
      return NextResponse.json({ error: getErrorMessage("noDataToUpdate", lang) }, { status: 400 });
    }

    await pool.query(
      `UPDATE sales_orders SET ${updateFields.join(", ")} WHERE id = ? AND tenant_id = ?`,
      [...updateValues, orderId, tenant_id]
    );

    return NextResponse.json({ message: getErrorMessage("updateSuccess", lang) }, { status: 200 });

  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    console.error("PUT sales order error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
/**
 * GET /api/v1/admin/sales-orders/[salesOrderId]
 *
 * Retrieves detailed information for a specific sales order.
 * Validates tenant access and ensures the order exists.
 *
 * Request Headers:
 *   accept-language (optional) : "en" or "ar"
 *
 * Path Parameters:
 *   salesOrderId (number, required) : Sales order identifier
 *
 * Query Parameters:
 *   tenant_id (number, required)
 *
 * Responses:
 *   200 : returns order details including customer info and order items
 *   400 : returns error for missing required parameters
 *   404 : returns error if the sales order is not found
 *   500 : returns error for internal server errors
 */
export async function GET(req: NextRequest, { params }: any) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const user: any = await getUserData(req);
    const { searchParams } = new URL(req.url);
    const tenant_id = searchParams.get("tenant_id");
    const salesOrderId = params.salesOrderId;

    if (!tenant_id) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    if (!salesOrderId) return NextResponse.json({ error: getErrorMessage("missingOrderId", lang) }, { status: 400 });

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "view_sales_orders");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    const pool = await dbConnection();
    const [rows] = await pool.query(
      `SELECT 
          so.id,
          so.tenant_id,
          so.customer_id,
          so.user_id,
          so.branch_id,
          so.order_status,
          so.total_amount,
          so.created_at,
          ${lang === "ar" ? "c.full_name_ar" : "c.full_name"} AS customer_name,
          ${lang === "ar" ? "b.name_ar" : "b.name"} AS branch_name,
          ${lang === "ar" ? "u.full_name_ar" : "u.full_name"} AS user_name
       FROM sales_orders so
       LEFT JOIN customers c ON c.id = so.customer_id
       LEFT JOIN branches b ON b.id = so.branch_id
       LEFT JOIN users u ON u.id = so.user_id
       WHERE so.id = ? AND so.tenant_id = ?
       LIMIT 1`,
      [salesOrderId, tenant_id]
    );

    const salesOrder = (rows as any[])[0];
    if (!salesOrder) return NextResponse.json({ error: getErrorMessage("salesOrderNotFound", lang) }, { status: 404 });

    return NextResponse.json(salesOrder, { status: 200 });

  } catch (error) {
    console.error("GET sales order by ID error:", error);
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/admin/sales-orders/[salesOrderId]
 *
 * Deletes a single sales order for a specific tenant.
 * Requires `delete_sales_orders` permission and valid tenant access in production.
 *
 * Path Parameters:
 *   - salesOrderId (number, required) : ID of the sales order to delete
 *
 * Request Body:
 *   - tenant_id (number, required) : ID of the tenant to which the order belongs
 *
 * Responses:
 *   - 200: { message } : Sales order deleted successfully
 *   - 400: { error }   : Missing required parameters
 *   - 401: { error }   : Unauthorized (permission or tenant access failure)
 *   - 404: { error }   : Sales order not found
 *   - 500: { error }   : Internal server error
 */

export async function DELETE(req: NextRequest, { params }: any) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();
    const user: any = await getUserData(req);
    const salesOrderId = params.salesOrderId;
    const payload = await req.json();
    const { tenant_id } = payload;

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }
    if (!salesOrderId) {
      return NextResponse.json({ error: getErrorMessage("missingOrderIds", lang) }, { status: 400 });
    }

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "delete_sales_orders");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    const [existing] = await pool.query(
      `SELECT id FROM sales_orders WHERE id = ? AND tenant_id = ?`,
      [salesOrderId, tenant_id]
    );
    const existingOrder = (existing as any[])[0];

    if (!existingOrder) {
 return NextResponse.json({ error: getErrorMessage("salesOrderNotFound", lang) }, { status: 404 });
    }

    // حذف الطلب
    await pool.query(
      `DELETE FROM sales_orders WHERE id = ? AND tenant_id = ?`,
      [salesOrderId, tenant_id]
    );

    return NextResponse.json({ message: getErrorMessage("deletedSuccess", lang) }, { status: 200 });

  } catch (error) {
    console.error("DELETE sales order error:", error);
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
