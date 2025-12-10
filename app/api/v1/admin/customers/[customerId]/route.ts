

import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../../functions/db";
import { hasPermission, getUserData, hasTenantAccess } from "../../../functions/permissions";
import { validateFields } from "../../../functions/validation";

const errorMessages = {
  en: {
    serverError: "Internal server error.",
    unauthorized: "Unauthorized access.",
    missingCustomerId: "Customer ID is missing",
    customerNotFound: "Customer not found",
    updatedSuccess: "Customer updated successfully",
    deletedSuccess: "Customer deleted successfully",
    branchNotFoundFortenant: "Branch not found For this tenant",

  },
  ar: {
    serverError: "خطأ في الخادم الداخلي.",
    unauthorized: "دخول غير مصرح به.",
    missingCustomerId: "معرّف العميل مفقود",
    customerNotFound: "العميل غير موجود",
    branchNotFoundFortenant: "الفرع غير موجود لهذه الشركة.",
    updatedSuccess: "تم تحديث بيانات العميل بنجاح",
    deletedSuccess: "تم حذف بيانات العميل بنجاح"
  },
};

function getErrorMessage(key: keyof typeof errorMessages["en"], lang: "en" | "ar" = "en") {
  return errorMessages[lang][key] || errorMessages["en"][key];
}
/**
 * PUT /api/v1/admin/customers/[customerId]
 *
 * Updates a customer for a tenant. Only supplied fields are updated.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar"
 *
 * Path Parameters:
 *   - customerId (number, required)
 *
 * Request Body:
 *   - tenant_id (number, required)
 *   - branch_id (number, optional)
 *   - full_name (string, required)
 *   - full_name_ar (string, optional)
 *   - phone (string, optional)
 *   - email (string, optional)
 *   - address (string, optional)
 *   - address_ar (string, optional)
 *   - credit_limit (number, optional)
 *
 * Responses:
 *   - 200: { message }
 *   - 400: { error }
 *   - 401: { error }
 *   - 404: { error }
 *   - 500: { error }
 */
export async function PUT(req: NextRequest, { params }: any) {
  const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
  try {
    const pool = await dbConnection();
    const customerId = params.customerId;
    if (!customerId) return NextResponse.json({ error: getErrorMessage("missingCustomerId", lang) }, { status: 400 });

    const payload = await req.json();
    const { tenant_id, branch_id, full_name, full_name_ar, phone, email, address, address_ar, credit_limit } = payload;

    if (!tenant_id) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });

    const user: any = await getUserData(req);
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "edit_customer");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Validation rules
    const rules: any = {
      full_name: [{ required: true, minLength: 3, maxLength: 200, label: lang === "ar" ? "الاسم الكامل" : "Full Name" }],
      full_name_ar: [{ required: false, minLength: 3, maxLength: 200, label: "Arabic Name" }],
      email: [{ required: false, type: "email", label: "Email" }],
      phone: [{ required: false, phone: false, label: "Phone" }],
      branch_id: [{ required: false, type: "number", label: "Branch ID" }],
      credit_limit: [{ required: false, type: "number", label: "Credit Limit" }],
      tenant_id: [{ required: true, type: "number", label: "Tenant ID" }],
    };

    const { valid, errors } = validateFields(payload, rules, lang);
    if (!valid) return NextResponse.json({ error: errors }, { status: 400 });
// Check if branch exists and belongs to same tenant
    if(branch_id!=null){
      const [Branches] = await pool.query(
      `SELECT id FROM branches WHERE id = ? AND tenant_id= ? LIMIT 1`,
      [branch_id, tenant_id]
    );
    const Branch = (Branches as any[])[0];
    if (!Branch) return NextResponse.json({ error: getErrorMessage("branchNotFoundFortenant", lang) }, { status: 404 });
  }
    // Check if customer exists
    const [existingCustomer] = await pool.query(
      `SELECT * FROM customers WHERE id = ? AND tenant_id = ?`,
      [customerId, tenant_id]
    );
    if (!(existingCustomer as any[]).length) {
      return NextResponse.json({ error: getErrorMessage("customerNotFound", lang) }, { status: 404 });
    }

    // Build update query dynamically
    const fields: string[] = [];
    const values: any[] = [];
    if (full_name) { fields.push("full_name = ?"); values.push(full_name); }
    if (full_name_ar) { fields.push("full_name_ar = ?"); values.push(full_name_ar); }
    if (email) { fields.push("email = ?"); values.push(email); }
    if (phone) { fields.push("phone = ?"); values.push(phone); }
    if (address) { fields.push("address = ?"); values.push(address); }
    if (address_ar) { fields.push("address_ar = ?"); values.push(address_ar); }
    if (branch_id) { fields.push("branch_id = ?"); values.push(branch_id); }
    if (typeof credit_limit === "number") { fields.push("credit_limit = ?"); values.push(credit_limit); }

    if (fields.length > 0) {
      await pool.query(
        `UPDATE customers SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`,
        [...values, customerId, tenant_id]
      );
    }

    return NextResponse.json({ message: getErrorMessage("updatedSuccess", lang) }, { status: 200 });

  } catch (error) {
    console.error("Edit customer error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}



/**
 * GET /api/v1/admin/customers/[customerId]
 *
 * Returns a single customer by ID for a given tenant. Production requests require
 * `view_customers` permission and tenant access verification.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar"
 *
 * Path Parameters:
 *   - customerId (number, required)           : Customer ID to fetch
 *
 * Query Parameters:
 *   - tenant_id (number, required)    : Tenant to which the customer belongs
 *
 * Responses:
 *   - 200: customer object             : All fields of the selected customer
 *   - 400: { error }                   : Missing customer ID or tenant ID
 *   - 401: { error }                   : Unauthorized access or tenant permission denied
 *   - 404: { error }                   : Customer not found
 *   - 500: { error }                   : Internal server error
 */

export async function GET(req: NextRequest, { params }: any) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const user: any = await getUserData(req);

    const { searchParams } = new URL(req.url);
    const tenant_id = searchParams.get("tenant_id");

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "view_customers");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    const customerId = params.customerId;
    if (!customerId) {
      return NextResponse.json({ error: getErrorMessage("missingCustomerId", lang) }, { status: 400 });
    }

    const pool = await dbConnection();

    const [rows] = await pool.query(
      `SELECT *
       FROM customers
       WHERE id = ? AND tenant_id = ? `,
      [customerId, tenant_id]
    );

    const foundUser = (rows as any[])[0];
    if (!foundUser) {
      return NextResponse.json({ error: getErrorMessage("customerNotFound", lang) }, { status: 404 });
    }

    return NextResponse.json(foundUser, { status: 200 });
  } catch (error) {
    console.error("GET user by ID error:", error);
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}



/**
 * DELETE /api/v1/admin/customers/[customerId]
 *
 * Deletes a single customer from the database. Production requests require
 * `delete_customers` permission and tenant access verification.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar"
 *
 * Path Parameters:
 *   - customerId (number, required)           : Customer ID to delete
 *
 * Request Body:
 *   - tenant_id (number, required)    : Tenant to which the customer belongs
 *
 * Responses:
 *   - 200: { message }                 : Indicates customer was successfully deleted
 *   - 400: { error }                   : Missing customer ID or tenant ID
 *   - 401: { error }                   : Unauthorized access or tenant permission denied
 *   - 404: { error }                   : Customer not found
 *   - 500: { error }                   : Internal server error
 */


export async function DELETE(req: NextRequest, { params }: any) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();
    const { tenant_id } = await req.json();
    const customer_id = params.customerId;


    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    if (!customer_id) {
      return NextResponse.json(
        { error: getErrorMessage("missingCustomerId", lang) },
        { status: 400 }
      );
    }

    const user: any = await getUserData(req);
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "delete_customers");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Ensure target user exists and belongs to tenant
    const [targetUsers] = await pool.query(
      `SELECT id, tenant_id
         FROM customers
         WHERE id = ? AND tenant_id = ? 
         LIMIT 1`,
      [customer_id, tenant_id]
    );

    const usersArr = targetUsers as any[];
    if (!usersArr.length) {
      return NextResponse.json({ error: getErrorMessage("customerNotFound", lang) }, { status: 404 });
    }

    await pool.query(
      `DELETE FROM customers WHERE id =? AND tenant_id = ?`,
      [customer_id, tenant_id]
    );

    return NextResponse.json(
      { message: getErrorMessage("deletedSuccess", lang) },
      { status: 200 }
    );
  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json(
      { error: getErrorMessage("serverError", lang) },
      { status: 500 }
    );
  }
}
