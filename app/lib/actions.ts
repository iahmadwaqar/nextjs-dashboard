"use server";

// Server actions for managing invoices in the dashboard application.
// This file contains functions for creating, updating, and deleting invoices,
// using Next.js server actions with database operations via Postgres.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import postgres from "postgres";

// Establish database connection using environment variable for Postgres URL
const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

// Zod schema for validating invoice form data
const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(["pending", "paid"]),
  date: z.string(),
});

// Schema for creating invoices, omitting id (auto-generated) and date (current date)
const CreateInvoice = FormSchema.omit({ id: true, date: true });

/**
 * Creates a new invoice in the database.
 * Parses form data, converts amount to cents, inserts into invoices table,
 * revalidates the invoices page, and redirects back to it.
 * @param formData - The form data from the create invoice form
 */
export async function createInvoice(formData: FormData) {
  // Parse and validate the form data using CreateInvoice schema
  const { customerId, amount, status } = CreateInvoice.parse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });
  // Convert amount to cents for storage
  const amountInCents = amount * 100;
  // Get current date in YYYY-MM-DD format
  const date = new Date().toISOString().split("T")[0];
  try {
    // Insert new invoice into the database
    await sql`INSERT INTO invoices (customer_id, amount, status, date) VALUES (${customerId}, ${amountInCents}, ${status}, ${date})`;
  } catch (error) {
    // Log and re-throw any database errors
    console.error("Error creating invoice:", error);
    throw error;
  }
  // Revalidate the invoices dashboard page to reflect changes
  revalidatePath("/dashboard/invoices");
  // Redirect to the invoices page
  redirect("/dashboard/invoices");
}

// Schema for updating invoices, omitting id (provided as parameter) and date (not updated)
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

/**
 * Updates an existing invoice in the database.
 * Parses form data, converts amount to cents, updates the invoice record,
 * revalidates the invoices page, and redirects back to it.
 * @param id - The ID of the invoice to update
 * @param formData - The form data from the edit invoice form
 */
export async function updateInvoice(id: string, formData: FormData) {
  // Parse and validate the form data using UpdateInvoice schema
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });
  // Convert amount to cents for storage
  const amountInCents = amount * 100;
  try {
    // Update the invoice in the database
    await sql`UPDATE invoices SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status} WHERE id = ${id}`;
  } catch (error) {
    // Log and re-throw any database errors
    console.error("Error updating invoice:", error);
    throw error;
  }
  // Revalidate the invoices dashboard page to reflect changes
  revalidatePath("/dashboard/invoices");
  // Redirect to the invoices page
  redirect("/dashboard/invoices");
}

/**
 * Deletes an invoice from the database by its ID.
 * Revalidates the invoices page to reflect the deletion.
 * @param id - The ID of the invoice to delete
 */
export async function deleteInvoice(id: string) {
  throw new Error('Failed to Delete Invoice');
  // Delete the invoice from the database
  await sql`DELETE FROM invoices WHERE id = ${id}`;
  // Revalidate the invoices dashboard page to reflect changes
  revalidatePath('/dashboard/invoices');
}