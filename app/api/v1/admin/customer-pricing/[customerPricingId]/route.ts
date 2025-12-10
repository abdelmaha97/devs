import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../../functions/db";
import { validateFields } from "../../../functions/validation";
import { hasPermission, getUserData, hasTenantAccess } from "../../../functions/permissions";


const errorMessages = {
  en: {
    unauthorized: "Unauthorized access.",
    serverError: "Internal server error.",
    customerNotFoundForTenant: "Customer not found for this tenant.",
    productNotFoundForTenant: "Product not found for this tenant.",
    missingCustomerPricingIds: "Customer Pricing IDs are required",
    noCustomerPricingFound:"No customer pricing entries found for the given criteria.",
    customerPricingExists: "Customer pricing already exists for this customer and product.",
    updatedSuccess:"Customer Pricing updated successfully",
    deletedSuccess:"Customer Pricing deleted successfully",
     invalidCustomerPricingId: "Customer Pricing ID are invalid ",
  },
  ar: {
    unauthorized: "دخول غير مصرح به.",
    serverError: "خطأ في الخادم الداخلي.",
    customerNotFoundForTenant: "الزبون غير موجود ضمن هذه المنظمة.",
    productNotFoundForTenant: "المنتج غير موجود ضمن هذه المنظمة.",
    missingCustomerPricingIds: "معرفات اسعار العملاء مطلوبة.",
    noCustomerPricingFound:"لم يتم العثور على أي إدخالات لتسعير العملاء للمعايير المحددة.",
    customerPricingExists: "تسعير العميل موجود مسبقًا لهذا العميل والمنتج.",
    updatedSuccess:"تم تعديل التسعيرة بنجاح",
     invalidCustomerPricingId: "المعرف  غير صالح .",
    deletedSuccess:"تم حذف التسعيرة بنجاح"
  },
};

function getErrorMessage(
  key: keyof typeof errorMessages["en"],
  lang: "en" | "ar" = "en"
) {
  return errorMessages[lang][key] || errorMessages["en"][key];
}

const requiredFieldLabels = {
  tenant_id: { en: "Tenant", ar: "المنظمة" },
  customer_id: { en: "Customer", ar: "الزبون" },
  product_id: { en: "Product", ar: "المنتج" },
  special_price: { en: "Special Price", ar: "السعر الخاص" },
};
/**
 * PUT /api/v1/admin/customer-pricing/[customerPricingId]
 *
 * Updates an existing customer pricing entry for a tenant.
 * Validates ownership, prevents duplicates, and ensures referenced entities exist.
 * Requires `edit_product` permission and tenant access in production mode.
 *
 * Request Body:
 *   - tenant_id (number, required)      : Tenant ownership validation
 *   - customer_id (number, required)    : The customer receiving the special price
 *   - product_id (number, required)     : The product being priced
 *   - special_price (number, required)  : Updated custom price value
 *
 * Validation:
 *   - Ensures required values exist and are numeric
 *   - Verifies pricing record exists and belongs to the tenant
 *   - Confirms customer exists under the same tenant
 *   - Confirms product exists under the same tenant
 *   - Prevents inserting duplicate pricing records for same customer/product
 *
 * Responses:
 *   - 200: { message } : Pricing updated successfully
 *   - 400: { error }   : Missing/invalid fields or tenant mismatch
 *   - 401: { error }   : Unauthorized (permission or tenant access failure)
 *   - 404: { error }   : Customer, product, or pricing record not found
 *   - 409: { error }   : Duplicate pricing exists
 *   - 500: { error }   : Internal server error
 */


export async function PUT(req: NextRequest, { params }: { params: any }) {
  const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";

  try {
    const customerPricingId = params.customerPricingId; // customer_pricing id
    const payload = await req.json();
    const { tenant_id, customer_id, product_id, special_price } = payload;

    // Authenticated user
    const user: any = await getUserData(req);

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "edit_product");
      if (!hasAccess)
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed)
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Validation rules
    const rules: any = {
      tenant_id: [
        { required: true, label: requiredFieldLabels.tenant_id[lang] },
        { type: "number", label: requiredFieldLabels.tenant_id[lang] },
      ],
      customer_id: [
        { required: true, label: requiredFieldLabels.customer_id[lang] },
        { type: "number", label: requiredFieldLabels.customer_id[lang] },
      ],
      product_id: [
        { required: true, label: requiredFieldLabels.product_id[lang] },
        { type: "number", label: requiredFieldLabels.product_id[lang] },
      ],
      special_price: [
        { required: true, label: requiredFieldLabels.special_price[lang] },
        { type: "number", label: requiredFieldLabels.special_price[lang] },
      ],
    };

    const { valid, errors } = validateFields(payload, rules, lang);
    if (!valid) {
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const pool = await dbConnection();

    // Check existing pricing record
    const [existing]: any = await pool.query(
      `SELECT id FROM customer_pricing WHERE id = ? AND tenant_id = ?`,
      [customerPricingId,tenant_id]
    );

    if (!existing.length) {
      return NextResponse.json(
        { error: getErrorMessage("noCustomerPricingFound", lang) },
        { status: 404 }
      );
    }


    // Check duplicate
    const [duplicate] = await pool.query(
      `SELECT id FROM customer_pricing 
       WHERE tenant_id=? AND customer_id=? AND product_id=? AND id != ?`,
      [tenant_id, customer_id, product_id, customerPricingId]
    );
    if ((duplicate as any[]).length > 0) {
      return NextResponse.json(
        { error: getErrorMessage("customerPricingExists", lang) },
        { status: 409 }
      );
    }

    // Check customer exists
    const [customer] = await pool.query(
      `SELECT id FROM customers WHERE id = ? AND tenant_id = ?`,
      [customer_id, tenant_id]
    );
    if (!(customer as any[]).length) {
      return NextResponse.json(
        { error: getErrorMessage("customerNotFoundForTenant", lang) },
        { status: 404 }
      );
    }

    // Check product exists
    const [product] = await pool.query(
      `SELECT id FROM products WHERE id = ? AND tenant_id = ?`,
      [product_id, tenant_id]
    );
    if (!(product as any[]).length) {
      return NextResponse.json(
        { error: getErrorMessage("productNotFoundForTenant", lang) },
        { status: 404 }
      );
    }

    // Update record
    await pool.query(
      `UPDATE customer_pricing 
       SET customer_id=?, product_id=?, special_price=?
       WHERE id=?`,
      [customer_id, product_id, special_price, customerPricingId]
    );

    return NextResponse.json(
      { message: getErrorMessage("updatedSuccess", lang) },
      { status: 200 }
    );

  } catch (error) {
    console.error("PUT customer_pricing error:", error);
    return NextResponse.json(
      { error: getErrorMessage("serverError", lang) },
      { status: 500 }
    );
  }
}


/**
 * GET /api/v1/admin/customer-pricing/[customerPricingId]
 *
 * Retrieves pricing details for a customer including localized customer and product names.
 * Requires `view_customer_pricing` permission and valid tenant access.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar"
 *
 * Path Parameters:
 *   - customerPricingId (number, required)               : Customer Pricing ID
 *
 * Query Parameters:
 *   - tenant_id (number, required)        : Tenant to which the record belongs
 *
 * Responses:
 *   - 200: customer pricing details      : Includes localized fields
 *   - 400: { error }                     : Missing ID or tenant ID
 *   - 401: { error }                     : Unauthorized or tenant mismatch
 *   - 404: { error }                     : Record not found
 *   - 500: { error }                     : Internal server error
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
      const hasAccess = await hasPermission(user, "view_product");
      if (!hasAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }

    const customerPricingId = params.customerPricingId;
    if (!customerPricingId) {
      return NextResponse.json({ error: getErrorMessage("missingCustomerPricingIds", lang) }, { status: 400 });
    }

    const pool = await dbConnection();
const customerNameField = lang === "ar" ? "full_name_ar" : "full_name";
const productNameField  = lang === "ar" ? "product_name_ar" : "product_name";

  const [rows] = await pool.query(
  `
  SELECT 
      cp.*, 
      c.${customerNameField} AS customer_name, 
      p.${productNameField} AS product_name
  FROM customer_pricing cp
  JOIN customers c ON cp.customer_id = c.id
  JOIN products p ON cp.product_id = p.id
  WHERE cp.id = ? AND cp.tenant_id = ?
  `,
  [customerPricingId, tenant_id]
);


    const record = (rows as any[])[0];
    if (!record) {
      return NextResponse.json({ error: getErrorMessage("noCustomerPricingFound", lang) }, { status: 404 });
    }

    return NextResponse.json(record, { status: 200 });

  } catch (error) {
    console.error("GET customer pricing by ID error:", error);
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/admin/customer-pricing/[customerPricingId]
 *
 * Deletes a single customer pricing entry for a tenant.
 * Production requests must pass `delete_customer_pricing` permission and confirm tenant access.
 *
 * Path Parameters:
 *   - customerPricingId (number, required)                : Customer pricing ID to delete
 *
 * Query Parameters:
 *   - tenant_id (number, required)         : Tenant to which the record belongs
 *
 * Responses:
 *   - 200: { message }                     : Deletion success message
 *   - 400: { error }                       : Missing or invalid ID or tenant_id
 *   - 401: { error }                       : Permission or tenant access denied
 *   - 404: { error }                       : Customer pricing not found
 *   - 500: { error }                       : Internal server error
 */
export async function DELETE(req: NextRequest, { params }:any) {
  const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";

  try {
    const pool = await dbConnection();
    const customerPricingId = params.customerPricingId;

    const { tenant_id } = Object.fromEntries(req.nextUrl.searchParams);

    if (!customerPricingId || Number.isNaN(customerPricingId)) {
      return NextResponse.json({ error: getErrorMessage("invalidCustomerPricingId", lang) }, { status: 400 });
    }

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    const user: any = await getUserData(req);

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "delete_customer_pricing");
      if (!hasAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }

    // Check record exists
    const [target] = await pool.query(
      `SELECT id FROM customer_pricing WHERE id = ? AND tenant_id = ?`,
      [customerPricingId, tenant_id]
    );

    if (!(target as any[]).length) {
      return NextResponse.json({ error: getErrorMessage("noCustomerPricingFound", lang) }, { status: 404 });
    }

    // Delete entry
    await pool.query(
      `DELETE FROM customer_pricing WHERE id = ? AND tenant_id = ?`,
      [customerPricingId, tenant_id]
    );
   return NextResponse.json(
      { message: getErrorMessage("deletedSuccess", lang) },
      { status: 200 }
    );

  } catch (error) {
    console.error("DELETE customer pricing error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
