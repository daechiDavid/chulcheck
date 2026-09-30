export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      teachers: {
        Row: { id: string; name: string; school_name: string };
        Insert: { id: string; name: string; school_name: string };
        Update: { name?: string; school_name?: string };
      };
      classrooms: {
        Row: { id: string; teacher_id: string; school_year: number; grade: number; class_no: number };
        Insert: { id?: string; teacher_id: string; school_year: number; grade: number; class_no: number };
        Update: { teacher_id?: string; school_year?: number; grade?: number; class_no?: number };
      };
      students: {
        Row: {
          id: string;
          classroom_id: string;
          number: number;
          name: string;
          gender: "남" | "여";
          father_name: string | null;
          mother_name: string | null;
          father_phone_hmac: string | null;
          mother_phone_hmac: string | null;
          father_phone_last4: string | null;
          mother_phone_last4: string | null;
          active: boolean;
        };
        Insert: {
          id?: string;
          classroom_id: string;
          number: number;
          name: string;
          gender: "남" | "여";
          father_name?: string | null;
          mother_name?: string | null;
          father_phone_hmac?: string | null;
          mother_phone_hmac?: string | null;
          father_phone_last4?: string | null;
          mother_phone_last4?: string | null;
          active?: boolean;
        };
        Update: {
          number?: number;
          name?: string;
          gender?: "남" | "여";
          father_name?: string | null;
          mother_name?: string | null;
          father_phone_hmac?: string | null;
          mother_phone_hmac?: string | null;
          father_phone_last4?: string | null;
          mother_phone_last4?: string | null;
          active?: boolean;
        };
      };
      off_days: {
        Row: { date: string; kind: "holiday" | "school_off"; label: string };
        Insert: { date: string; kind: "holiday" | "school_off"; label: string };
        Update: { kind?: "holiday" | "school_off"; label?: string };
      };
      requests: {
        Row: {
          id: string;
          student_id: string;
          classroom_id: string;
          doc_type: "type1" | "type2";
          category: number | null;
          start_date: string;
          end_date: string;
          period_days: number;
          submitted_on: string;
          guardian_name: string;
          guardian_relation: "father" | "mother";
          fields: Json;
          signature_path: string;
          report_submitted_on: string | null;
          report_signature_path: string | null;
          report_content: string;
          report_evidence_paths: string[];
          status: "submitted" | "reviewed" | "rejected" | "cancelled";
          reject_reason: string | null;
          reviewed_at: string | null;
          printed_at: string | null;
          report_printed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          classroom_id: string;
          doc_type: "type1" | "type2";
          category?: number | null;
          start_date: string;
          end_date: string;
          period_days: number;
          submitted_on: string;
          guardian_name: string;
          guardian_relation: "father" | "mother";
          fields: Json;
          signature_path: string;
          status?: "submitted" | "reviewed" | "rejected" | "cancelled";
        };
        Update: {
          status?: "submitted" | "reviewed" | "rejected" | "cancelled";
          reject_reason?: string | null;
          reviewed_at?: string | null;
          printed_at?: string | null;
          report_printed_at?: string | null;
          report_submitted_on?: string | null;
          report_signature_path?: string | null;
          report_content?: string;
          report_evidence_paths?: string[];
          start_date?: string;
          end_date?: string;
          period_days?: number;
          category?: number | null;
          fields?: Json;
          guardian_name?: string;
        };
      };
      login_attempts: {
        Row: { id: number; key: string; success: boolean; attempted_at: string };
        Insert: { key: string; success: boolean; attempted_at?: string };
        Update: { success?: boolean };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
