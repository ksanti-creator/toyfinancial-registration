import { boolean, integer, pgTable, serial, text } from "drizzle-orm/pg-core";

export const toyAdminsTable = pgTable("toy_admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const toyDealersTable = pgTable("toy_dealers", {
  id: serial("id").primaryKey(),
  dealerName: text("dealer_name").notNull(),
  contactName: text("contact_name").notNull(),
  title: text("title").notNull().default(""),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  city: text("city").notNull(),
  province: text("province").notNull(),
  website: text("website").notNull().default(""),
  locations: text("locations").notNull().default(""),
  products: text("products").notNull(),
  categories: text("categories").notNull().default("[]"),
  launchTiming: text("launch_timing").notNull().default(""),
  currentProvider: text("current_provider").notNull().default(""),
  valueNotes: text("value_notes").notNull().default(""),
  followUpMethod: text("follow_up_method").notNull().default(""),
  meetingInterest: text("meeting_interest").notNull().default(""),
  consentAt: text("consent_at").notNull(),
  leadStatus: text("lead_status").notNull().default("New"),
  assignedTo: text("assigned_to").notNull().default(""),
  lastContactedAt: text("last_contacted_at"),
  notes: text("notes").notNull().default(""),
  fulfillmentStatus: text("fulfillment_status").notNull().default("Not requested"),
  fulfillmentNotes: text("fulfillment_notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const toyDocumentsTable = pgTable("toy_documents", {
  id: serial("id").primaryKey(),
  product: text("product").notNull(),
  province: text("province").notNull().default("All"),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const toyOutboxTable = pgTable("toy_outbox", {
  id: serial("id").primaryKey(),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  type: text("type").notNull(),
  deliveryStatus: text("delivery_status").notNull(),
  createdAt: text("created_at").notNull(),
});

export type ToyAdmin = typeof toyAdminsTable.$inferSelect;
export type ToyDealer = typeof toyDealersTable.$inferSelect;
export type ToyDocument = typeof toyDocumentsTable.$inferSelect;
export type ToyOutbox = typeof toyOutboxTable.$inferSelect;