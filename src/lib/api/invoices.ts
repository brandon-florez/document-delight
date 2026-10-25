import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

import { PAGE_SIZE, errorMessage, sanitizeSearch } from "./utils";

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

export function useInvoicePage(filters: {
  status: "all" | InvoiceStatus;
  search: string;
  page: number;
}) {
  return useQuery({
    queryKey: ["invoices", "page", filters],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const search = sanitizeSearch(filters.search);
      let query = supabase
        .from("invoices")
        .select(search ? "*, clients!inner(name, currency, tax_id, billing_email)" : INVOICE_SELECT, {
          count: "exact",
        })
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .order("created_at", { ascending: false });
      if (filters.status !== "all") query = query.eq("status", filters.status);
      if (search) {
        query = query.or(`name.ilike.%${search}%,tax_id.ilike.%${search}%`, {
          referencedTable: "clients",
        });
      }
      const from = filters.page * PAGE_SIZE;
      const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
  });
}

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

/** Returns a Sent or Paid invoice to Draft so the month can take new hours and be issued again. */
export function useReopenInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase
        .from("invoices")
        .update({
          status: "Draft",
          paid_at: null,
          sent_at: null,
          issuing_started_at: null,
          external_id: null,
          payment_url: null,
          xml_path: null,
          pdf_path: null,
        })
        .eq("id", invoiceId)
        .in("status", ["Sent", "Paid"])
        .select("id")
        .maybeSingle();
      if (error) throw new Error(await errorMessage(error));
      if (!data) throw new Error("La factura ya está en borrador.");
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
