import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import { errorMessage } from "./utils";

export type CompanySettings = {
  rfc: string;
  legal_name: string;
  tax_regime: string;
  postal_code: string;
  updated_at?: string;
};

export function useCompanySettings() {
  return useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveCompanySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: Omit<CompanySettings, "updated_at">) => {
      const { data: existing, error: readError } = await supabase
        .from("company_settings")
        .select("id")
        .maybeSingle();
      if (readError) throw new Error(await errorMessage(readError));

      const { error } = existing
        ? await supabase.from("company_settings").update(values).eq("id", true)
        : await supabase.from("company_settings").insert({ id: true, ...values });
      if (error) throw new Error(await errorMessage(error));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-settings"] }),
  });
}
