import { Router, type IRouter, type Request, type Response } from "express";
import cookieSession from "cookie-session";
import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";
import {
  AdminLoginBody,
  CreateDocumentBody,
  CreateRegistrationBody,
  DeleteDocumentParams,
  GetDealerParams,
  ListDealersQueryParams,
  UpdateDealerBody,
  UpdateDealerParams,
  UpdateDocumentBody,
  UpdateDocumentParams,
} from "@workspace/api-zod";

export const sessionMiddleware = cookieSession({
  name: "toyfinancial_session",
  secret: process.env.SESSION_SECRET || "development-only-change-me",
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 1000 * 60 * 60 * 12,
});

const router: IRouter = Router();
const products = ["ToyArmour", "Toysurance", "ToyProtection Plan"] as const;
const provinces = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Nova Scotia",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
];
const leadStatuses = [
  "New",
  "Contacted",
  "Qualified",
  "Agreement Sent",
  "Approved",
  "Live",
  "Closed Lost",
];
const fulfillmentStatuses = [
  "Not requested",
  "Requested",
  "Picking",
  "Shipped",
  "Delivered",
];

type SessionRequest = Request & {
  session?: { adminId?: number; email?: string } | null;
};

function now() {
  return new Date().toISOString();
}

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function isAdmin(req: SessionRequest) {
  return Boolean(req.session?.adminId);
}

function requireAdmin(req: SessionRequest, res: Response, next: () => void) {
  if (isAdmin(req)) {
    next();
    return;
  }
  res.status(401).json({ error: "Admin sign-in required." });
}

function parseJsonArray(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDealer(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    dealerName: String(row.dealer_name),
    contactName: String(row.contact_name),
    title: String(row.title || ""),
    email: String(row.email),
    phone: String(row.phone),
    city: String(row.city),
    province: String(row.province),
    website: String(row.website || ""),
    locations: String(row.locations || ""),
    products: parseJsonArray(String(row.products || "[]")),
    categories: parseJsonArray(String(row.categories || "[]")),
    launchTiming: String(row.launch_timing || ""),
    currentProvider: String(row.current_provider || ""),
    valueNotes: String(row.value_notes || ""),
    followUpMethod: String(row.follow_up_method || ""),
    meetingInterest: String(row.meeting_interest || ""),
    consentAt: String(row.consent_at),
    leadStatus: String(row.lead_status),
    assignedTo: String(row.assigned_to || ""),
    lastContactedAt: row.last_contacted_at ? String(row.last_contacted_at) : null,
    notes: String(row.notes || ""),
    fulfillmentStatus: String(row.fulfillment_status),
    fulfillmentNotes: String(row.fulfillment_notes || ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function formatDocument(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    product: String(row.product),
    province: String(row.province),
    kind: String(row.kind),
    title: String(row.title),
    url: String(row.url),
    active: Boolean(row.active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function escapeHtml(value: unknown) {
  return clean(value, 2000)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function ensureAdmin() {
  const email = clean(process.env.ADMIN_EMAIL || "admin@toyfinancial.ca").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "change-this-before-deploying";
  const existing = await pool.query<{ id: number }>(
    "SELECT id FROM toy_admins WHERE email = $1 LIMIT 1",
    [email],
  );
  if (existing.rows.length === 0) {
    await pool.query(
      "INSERT INTO toy_admins (email, password_hash, created_at) VALUES ($1, $2, $3)",
      [email, bcrypt.hashSync(password, 12), now()],
    );
  }
  return { email, password };
}

async function getDocuments(selectedProducts: string[], province: string) {
  const result = await pool.query(
    `SELECT * FROM toy_documents
     WHERE active = TRUE AND product = ANY($1::text[]) AND province = ANY($2::text[])
     ORDER BY product, province DESC, kind, title`,
    [selectedProducts, ["All", province]],
  );
  return result.rows.map(formatDocument);
}

router.get("/products", (_req, res) => {
  res.json({ products, provinces });
});

router.post("/registrations", async (req, res) => {
  const parsed = CreateRegistrationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please complete the required registration fields." });
    return;
  }

  const input = parsed.data;
  const selectedProducts = input.products.filter((product): product is (typeof products)[number] =>
    products.includes(product as (typeof products)[number]),
  );
  if (selectedProducts.length === 0 || !provinces.includes(input.province)) {
    res.status(400).json({ error: "Choose at least one program and a valid province." });
    return;
  }

  const stamp = now();
  const inserted = await pool.query<{ id: number }>(
    `INSERT INTO toy_dealers (
      dealer_name, contact_name, title, email, phone, city, province, website, locations,
      products, categories, launch_timing, current_provider, value_notes, follow_up_method,
      meeting_interest, consent_at, lead_status, assigned_to, last_contacted_at, notes,
      fulfillment_status, fulfillment_notes, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'New','',NULL,'','Not requested','',$18,$18)
    RETURNING id`,
    [
      clean(input.dealerName, 200),
      clean(input.contactName, 200),
      clean(input.title, 200),
      input.email.toLowerCase(),
      clean(input.phone, 50),
      clean(input.city, 100),
      clean(input.province, 100),
      clean(input.website, 500),
      clean(input.locations, 500),
      JSON.stringify(selectedProducts),
      JSON.stringify(input.categories || []),
      clean(input.launchTiming, 100),
      clean(input.currentProvider, 200),
      clean(input.valueNotes, 2000),
      clean(input.followUpMethod, 100),
      clean(input.meetingInterest, 100),
      stamp,
      stamp,
    ],
  );
  const id = inserted.rows[0].id;
  const docs = input.materialsRequested
    ? await getDocuments(selectedProducts, input.province)
    : [];
  const docLinks = docs.length
    ? `<ul>${docs.map((doc) => `<li><a href="${escapeHtml(doc.url)}">${escapeHtml(doc.title)}</a></li>`).join("")}</ul>`
    : "<p>Your team will share the current starter materials during follow-up.</p>";
  const ackHtml = `<h1>Thanks, ${escapeHtml(input.contactName)}.</h1><p>We received ${escapeHtml(input.dealerName)}'s request to explore ${selectedProducts.map(escapeHtml).join(", ")}.</p>${docLinks}<p>A ToyFinancial team member will follow up using your preferred method.</p>`;
  const internalHtml = `<h1>New ToyFinancial dealer registration</h1><p><strong>${escapeHtml(input.dealerName)}</strong> · ${escapeHtml(input.city)}, ${escapeHtml(input.province)}</p><p>Contact: ${escapeHtml(input.contactName)} (${escapeHtml(input.email)}, ${escapeHtml(input.phone)})</p><p>Programs: ${selectedProducts.map(escapeHtml).join(", ")}</p>`;
  const internalRecipient = clean(process.env.ADMIN_EMAIL || "admin@toyfinancial.ca").toLowerCase();
  await pool.query(
    "INSERT INTO toy_outbox (recipient, subject, html, type, delivery_status, created_at) VALUES ($1,$2,$3,$4,$5,$6),($7,$8,$9,$10,$11,$12)",
    [
      input.email,
      "Your ToyFinancial dealer partnership starter pack",
      ackHtml,
      "dealer_acknowledgement",
      "queued",
      stamp,
      internalRecipient,
      `New dealer registration: ${clean(input.dealerName, 200)}`,
      internalHtml,
      "internal_alert",
      "queued",
      stamp,
    ],
  );
  res.status(201).json({
    id,
    message: "Thanks — your partnership request is in. We’ll follow up shortly.",
  });
});

router.post("/admin/login", async (req, res) => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }
  const { email } = await ensureAdmin();
  const result = await pool.query<{ id: number; email: string; password_hash: string }>(
    "SELECT id, email, password_hash FROM toy_admins WHERE email = $1 LIMIT 1",
    [parsed.data.email.toLowerCase()],
  );
  const admin = result.rows[0];
  if (!admin || admin.email !== email || !bcrypt.compareSync(parsed.data.password, admin.password_hash)) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }
  req.session = { adminId: admin.id, email: admin.email };
  res.json({ authenticated: true, email: admin.email });
});

router.post("/admin/logout", (req, res) => {
  req.session = null;
  res.status(204).end();
});

router.get("/admin/session", (req, res) => {
  if (!isAdmin(req)) {
    res.status(401).json({ error: "Admin sign-in required." });
    return;
  }
  res.json({ authenticated: true, email: req.session?.email });
});

router.get("/admin/metrics", requireAdmin, async (_req, res) => {
  const result = await pool.query<{ total: string; new_leads: string; live: string; fulfillment_open: string }>(
    `SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE lead_status = 'New')::text AS new_leads,
      COUNT(*) FILTER (WHERE lead_status = 'Live')::text AS live,
      COUNT(*) FILTER (WHERE fulfillment_status IN ('Requested','Picking','Shipped'))::text AS fulfillment_open
     FROM toy_dealers`,
  );
  const row = result.rows[0];
  res.json({
    total: Number(row.total),
    newLeads: Number(row.new_leads),
    live: Number(row.live),
    fulfillmentOpen: Number(row.fulfillment_open),
  });
});

router.get("/admin/dealers", requireAdmin, async (req, res) => {
  const parsed = ListDealersQueryParams.safeParse(req.query);
  const search = parsed.success ? clean(parsed.data.search, 100) : "";
  const status = parsed.success ? clean(parsed.data.status, 100) : "";
  const result = await pool.query(
    `SELECT * FROM toy_dealers
     WHERE ($1 = '' OR dealer_name ILIKE '%' || $1 || '%' OR contact_name ILIKE '%' || $1 || '%' OR city ILIKE '%' || $1 || '%')
       AND ($2 = '' OR lead_status = $2)
     ORDER BY created_at DESC`,
    [search, status],
  );
  res.json(result.rows.map(formatDealer));
});

router.get("/admin/dealers/:id", requireAdmin, async (req, res) => {
  const parsed = GetDealerParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(404).json({ error: "Dealer not found." });
    return;
  }
  const result = await pool.query("SELECT * FROM toy_dealers WHERE id = $1 LIMIT 1", [parsed.data.id]);
  if (!result.rows[0]) {
    res.status(404).json({ error: "Dealer not found." });
    return;
  }
  res.json(formatDealer(result.rows[0]));
});

router.patch("/admin/dealers/:id", requireAdmin, async (req, res) => {
  const params = UpdateDealerParams.safeParse({ id: Number(req.params.id) });
  const parsed = UpdateDealerBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Please check the dealer details and try again." });
    return;
  }
  const existing = await pool.query("SELECT * FROM toy_dealers WHERE id = $1 LIMIT 1", [params.data.id]);
  if (!existing.rows[0]) {
    res.status(404).json({ error: "Dealer not found." });
    return;
  }
  const current = formatDealer(existing.rows[0]);
  const input = parsed.data;
  const productsValue = input.products || current.products;
  const categoriesValue = input.categories || current.categories;
  if (input.leadStatus && !leadStatuses.includes(input.leadStatus)) {
    res.status(400).json({ error: "Choose a valid lead status." });
    return;
  }
  if (input.fulfillmentStatus && !fulfillmentStatuses.includes(input.fulfillmentStatus)) {
    res.status(400).json({ error: "Choose a valid fulfillment status." });
    return;
  }
  const values = {
    dealerName: input.dealerName ?? current.dealerName,
    contactName: input.contactName ?? current.contactName,
    title: input.title ?? current.title,
    email: input.email ?? current.email,
    phone: input.phone ?? current.phone,
    city: input.city ?? current.city,
    province: input.province ?? current.province,
    website: input.website ?? current.website,
    locations: input.locations ?? current.locations,
    products: JSON.stringify(productsValue),
    categories: JSON.stringify(categoriesValue),
    launchTiming: input.launchTiming ?? current.launchTiming,
    currentProvider: input.currentProvider ?? current.currentProvider,
    valueNotes: input.valueNotes ?? current.valueNotes,
    followUpMethod: input.followUpMethod ?? current.followUpMethod,
    meetingInterest: input.meetingInterest ?? current.meetingInterest,
    leadStatus: input.leadStatus ?? current.leadStatus,
    assignedTo: input.assignedTo ?? current.assignedTo,
    lastContactedAt: input.lastContactedAt === undefined ? current.lastContactedAt : input.lastContactedAt,
    notes: input.notes ?? current.notes,
    fulfillmentStatus: input.fulfillmentStatus ?? current.fulfillmentStatus,
    fulfillmentNotes: input.fulfillmentNotes ?? current.fulfillmentNotes,
    updatedAt: now(),
  };
  const updated = await pool.query(
    `UPDATE toy_dealers SET
      dealer_name=$1, contact_name=$2, title=$3, email=$4, phone=$5, city=$6, province=$7,
      website=$8, locations=$9, products=$10, categories=$11, launch_timing=$12,
      current_provider=$13, value_notes=$14, follow_up_method=$15, meeting_interest=$16,
      lead_status=$17, assigned_to=$18, last_contacted_at=$19, notes=$20,
      fulfillment_status=$21, fulfillment_notes=$22, updated_at=$23
     WHERE id=$24 RETURNING *`,
    [
      values.dealerName,
      values.contactName,
      values.title,
      values.email,
      values.phone,
      values.city,
      values.province,
      values.website,
      values.locations,
      values.products,
      values.categories,
      values.launchTiming,
      values.currentProvider,
      values.valueNotes,
      values.followUpMethod,
      values.meetingInterest,
      values.leadStatus,
      values.assignedTo,
      values.lastContactedAt,
      values.notes,
      values.fulfillmentStatus,
      values.fulfillmentNotes,
      values.updatedAt,
      params.data.id,
    ],
  );
  res.json(formatDealer(updated.rows[0]));
});

router.get("/admin/documents", requireAdmin, async (_req, res) => {
  const result = await pool.query("SELECT * FROM toy_documents ORDER BY product, province, kind, title");
  res.json(result.rows.map(formatDocument));
});

router.post("/admin/documents", requireAdmin, async (req, res) => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success || !products.includes(parsed.data.product as (typeof products)[number])) {
    res.status(400).json({ error: "Product, title, document type, and a valid URL are required." });
    return;
  }
  const stamp = now();
  const result = await pool.query(
    `INSERT INTO toy_documents (product, province, kind, title, url, active, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *`,
    [
      parsed.data.product,
      clean(parsed.data.province || "All", 100),
      clean(parsed.data.kind, 100),
      clean(parsed.data.title, 200),
      parsed.data.url,
      parsed.data.active,
      stamp,
    ],
  );
  res.status(201).json(formatDocument(result.rows[0]));
});

router.patch("/admin/documents/:id", requireAdmin, async (req, res) => {
  const params = UpdateDocumentParams.safeParse({ id: Number(req.params.id) });
  const parsed = UpdateDocumentBody.safeParse(req.body);
  if (!params.success || !parsed.success || !products.includes(parsed.data.product as (typeof products)[number])) {
    res.status(400).json({ error: "Product, title, document type, and a valid URL are required." });
    return;
  }
  const stamp = now();
  const result = await pool.query(
    `UPDATE toy_documents SET product=$1, province=$2, kind=$3, title=$4, url=$5, active=$6, updated_at=$7
     WHERE id=$8 RETURNING *`,
    [
      parsed.data.product,
      clean(parsed.data.province || "All", 100),
      clean(parsed.data.kind, 100),
      clean(parsed.data.title, 200),
      parsed.data.url,
      parsed.data.active,
      stamp,
      params.data.id,
    ],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: "Document not found." });
    return;
  }
  res.json(formatDocument(result.rows[0]));
});

router.delete("/admin/documents/:id", requireAdmin, async (req, res) => {
  const parsed = DeleteDocumentParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(404).json({ error: "Document not found." });
    return;
  }
  const result = await pool.query("DELETE FROM toy_documents WHERE id = $1", [parsed.data.id]);
  if (result.rowCount === 0) {
    res.status(404).json({ error: "Document not found." });
    return;
  }
  res.status(204).end();
});

router.get("/admin/outbox", requireAdmin, async (_req, res) => {
  const result = await pool.query(
    `SELECT id, recipient, subject, type, delivery_status, created_at
     FROM toy_outbox ORDER BY created_at DESC LIMIT 100`,
  );
  res.json(
    result.rows.map((row) => ({
      id: Number(row.id),
      recipient: String(row.recipient),
      subject: String(row.subject),
      type: String(row.type),
      deliveryStatus: String(row.delivery_status),
      createdAt: String(row.created_at),
    })),
  );
});

export default router;