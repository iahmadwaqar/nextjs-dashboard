"use server";

// Server actions for managing invoices in the dashboard application.
// This file contains functions for creating, updating, and deleting invoices,
// using Next.js server actions with database operations via Postgres.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import postgres from "postgres";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
// Establish database connection using environment variable for Postgres URL
const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

// Zod schema for validating invoice form data
const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});

// Schema for creating invoices, omitting id (auto-generated) and date (current date)
const CreateInvoice = FormSchema.omit({ id: true, date: true });


export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};
/**
 * Creates a new invoice in the database.
 * Parses form data, converts amount to cents, inserts into invoices table,
 * revalidates the invoices page, and redirects back to it.
 * @param formData - The form data from the create invoice form
 */
export async function createInvoice(prevState: State, formData: FormData) {
  // Parse and validate the form data using CreateInvoice schema
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }
  // Prepare data for insertion into the database
  const { customerId, amount, status } = validatedFields.data;
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
 * @param prevState - The previous state
 * @param formData - The form data from the edit invoice form
 */
export async function updateInvoice(prevState: State, formData: FormData) {
  const id = formData.get("id") as string;
  // Parse and validate the form data using UpdateInvoice schema
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  if(!validatedFields.success){
    return {
      errors : validatedFields.error.flatten().fieldErrors,
      message : "Failed to update invoice"
    }
  }
  const {customerId, amount, status } = validatedFields.data;
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


export async function deleteAllInvoices() {
  // Delete all invoices from the database
  await sql`DELETE FROM invoices`;
  // Revalidate the invoices dashboard page to reflect changes
  revalidatePath('/dashboard/invoices');
}

/**
 * Authenticates a user using credentials.
 * @param prevState - The previous state
 * @param formData - The form data from the login form
 */
export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}