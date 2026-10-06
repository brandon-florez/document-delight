// Mirrors `supabase gen types typescript` for supabase/migrations.
// Regenerate with: npx supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type UserRole = "Admin" | "Developer" | "Finance";
type CurrencyCode = "USD" | "MXN";
type ProjectStatus = "Active" | "Inactive";
type InvoiceStatus = "Draft" | "Sent" | "Paid";

type InvoiceRow = {
  client_id: string;
  created_at: string;
  currency: CurrencyCode;
  external_id: string | null;
  id: string;
  issuing_started_at: string | null;
  month: number;
  paid_at: string | null;
  payment_url: string | null;
  pdf_path: string | null;
  sent_at: string | null;
  status: InvoiceStatus;
  total_amount: number;
  total_hours: number;
  updated_at: string;
  xml_path: string | null;
  year: number;
};

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          billing_email: string;
          cfdi_use: string | null;
          created_at: string;
          currency: CurrencyCode;
          fiscal_postal_code: string | null;
          id: string;
          is_active: boolean;
          name: string;
          tax_id: string;
          tax_regime: string | null;
          updated_at: string;
        };
        Insert: {
          billing_email: string;
          cfdi_use?: string | null;
          created_at?: string;
          currency: CurrencyCode;
          fiscal_postal_code?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          tax_id: string;
          tax_regime?: string | null;
          updated_at?: string;
        };
        Update: {
          billing_email?: string;
          cfdi_use?: string | null;
          created_at?: string;
          currency?: CurrencyCode;
          fiscal_postal_code?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          tax_id?: string;
          tax_regime?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_settings: {
        Row: {
          id: boolean;
          legal_name: string;
          postal_code: string;
          rfc: string;
          tax_regime: string;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          legal_name: string;
          postal_code: string;
          rfc: string;
          tax_regime: string;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          legal_name?: string;
          postal_code?: string;
          rfc?: string;
          tax_regime?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      developer_tokens: {
        Row: {
          created_at: string;
          id: string;
          last_used_at: string | null;
          name: string;
          revoked_at: string | null;
          token_hash: string;
          token_prefix: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_used_at?: string | null;
          name: string;
          revoked_at?: string | null;
          token_hash: string;
          token_prefix: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_used_at?: string | null;
          name?: string;
          revoked_at?: string | null;
          token_hash?: string;
          token_prefix?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "developer_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_lines: {
        Row: {
          created_at: string;
          hourly_rate: number;
          hours: number;
          id: string;
          invoice_id: string;
          project_id: string;
          subtotal: number | null;
        };
        Insert: {
          created_at?: string;
          hourly_rate: number;
          hours: number;
          id?: string;
          invoice_id: string;
          project_id: string;
        };
        Update: {
          created_at?: string;
          hourly_rate?: number;
          hours?: number;
          id?: string;
          invoice_id?: string;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_lines_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: InvoiceRow;
        Insert: {
          client_id: string;
          created_at?: string;
          currency?: CurrencyCode;
          external_id?: string | null;
          id?: string;
          issuing_started_at?: string | null;
          month: number;
          paid_at?: string | null;
          payment_url?: string | null;
          pdf_path?: string | null;
          sent_at?: string | null;
          status?: InvoiceStatus;
          total_amount?: number;
          total_hours?: number;
          updated_at?: string;
          xml_path?: string | null;
          year: number;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          currency?: CurrencyCode;
          external_id?: string | null;
          id?: string;
          issuing_started_at?: string | null;
          month?: number;
          paid_at?: string | null;
          payment_url?: string | null;
          pdf_path?: string | null;
          sent_at?: string | null;
          status?: InvoiceStatus;
          total_amount?: number;
          total_hours?: number;
          updated_at?: string;
          xml_path?: string | null;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          hourly_cost: number;
          id: string;
          name: string;
          role: UserRole;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          hourly_cost?: number;
          id: string;
          name: string;
          role?: UserRole;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          hourly_cost?: number;
          id?: string;
          name?: string;
          role?: UserRole;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          client_id: string;
          created_at: string;
          hourly_rate: number;
          id: string;
          name: string;
          repository_key: string | null;
          repository_url: string;
          status: ProjectStatus;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          hourly_rate: number;
          id?: string;
          name: string;
          repository_url: string;
          status?: ProjectStatus;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          hourly_rate?: number;
          id?: string;
          name?: string;
          repository_url?: string;
          status?: ProjectStatus;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      time_entries: {
        Row: {
          activity_score: number;
          created_at: string;
          end_time: string;
          entry_date: string;
          heartbeat_count: number;
          id: string;
          invoice_id: string | null;
          project_id: string;
          start_time: string;
          total_minutes: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          activity_score?: number;
          created_at?: string;
          end_time: string;
          entry_date: string;
          heartbeat_count?: number;
          id?: string;
          invoice_id?: string | null;
          project_id: string;
          start_time: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          activity_score?: number;
          created_at?: string;
          end_time?: string;
          entry_date?: string;
          heartbeat_count?: number;
          id?: string;
          invoice_id?: string | null;
          project_id?: string;
          start_time?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "time_entries_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_entries_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      v_dashboard_kpis: {
        Row: {
          active_clients: number | null;
          billed_mxn: number | null;
          billed_usd: number | null;
          draft_invoices: number | null;
          month: number | null;
          paid_invoices: number | null;
          sent_invoices: number | null;
          unbilled_hours: number | null;
          unbilled_projects: number | null;
          year: number | null;
        };
        Relationships: [];
      };
      v_hours_by_repository: {
        Row: {
          entry_date: string | null;
          project_id: string | null;
          project_name: string | null;
          repository_url: string | null;
          total_hours: number | null;
          total_minutes: number | null;
        };
        Relationships: [];
      };
      v_my_week: {
        Row: {
          entry_date: string | null;
          iso_day: number | null;
          total_hours: number | null;
        };
        Relationships: [];
      };
      v_unbilled_by_project: {
        Row: {
          client_id: string | null;
          client_name: string | null;
          currency: CurrencyCode | null;
          month: number | null;
          project_id: string | null;
          project_name: string | null;
          repository_url: string | null;
          unbilled_amount: number | null;
          unbilled_hours: number | null;
          unbilled_minutes: number | null;
          year: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_developer_token: {
        Args: { p_name: string };
        Returns: { id: string; token: string; token_prefix: string }[];
      };
      current_app_role: {
        Args: Record<PropertyKey, never>;
        Returns: UserRole;
      };
      generate_invoices: {
        Args: { p_month: number; p_year: number; p_client_id?: string | null };
        Returns: InvoiceRow[];
      };
      normalize_repo_url: {
        Args: { p_url: string };
        Returns: string;
      };
      revoke_developer_token: {
        Args: { p_token_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      currency_code: CurrencyCode;
      invoice_status: InvoiceStatus;
      project_status: ProjectStatus;
      user_role: UserRole;
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
