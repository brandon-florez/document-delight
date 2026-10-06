import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

import { errorMessage } from "./utils";

export type InvoiceStatus = Enums<"invoice_status">;

const INVOICE_SELECT = "*, clients(name, currency, tax_id, billing_email)";

export function useInvoices(status: "all" | InvoiceStatus, limit?: number) {
  return useQuery({
    queryKey: ["invoices", status, limit],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select(INVOICE_SELECT)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .order("created_at", { ascending: false });
      if (status !== "all") query = query.eq("status", status);
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export type InvoiceWithClient = NonNullable<ReturnType<typeof useInvoices>["data"]>[number];

export function useInvoiceLines(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["invoices", "lines", invoiceId],
    enabled: Boolean(invoiceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_lines")
        .select("id, hours, hourly_rate, subtotal, projects(name)")
        .eq("invoice_id", invoiceId!)
        .order("subtotal", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

function invalidateBilling(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["invoices"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useGenerateInvoices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ year, month }: { year: number; month: number }) => {
      const { data, error } = await supabase.rpc("generate_invoices", {
        p_month: month,
        p_year: year,
      });
      if (error) throw new Error(await errorMessage(error));
      return data;
    },
    onSuccess: () => invalidateBilling(queryClient),
  });
}

export function useIssueInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase.functions.invoke("issue-invoice", { body: { invoiceId } });
      if (error) throw new Error(await errorMessage(error));
    },
    onSettled: () => invalidateBilling(queryClient),
  });
}

export function useMarkInvoicePaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "Paid", paid_at: new Date().toISOString() })
        .eq("id", invoiceId)
        .eq("status", "Sent");
      if (error) throw new Error(await errorMessage(error));
    },
    onSuccess: () => invalidateBilling(queryClient),
  });
}

/** Opens a stored XML/PDF through a short-lived signed URL. */
export async function openInvoiceFile(path: string) {
  const { data, error } = await supabase.storage.from("invoices").createSignedUrl(path, 60);
  if (error) throw new Error(await errorMessage(error));
  window.open(data.signedUrl, "_blank", "noopener");
}
