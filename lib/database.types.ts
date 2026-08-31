export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          can_issue_certificates: boolean
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          can_issue_certificates?: boolean
          created_at?: string
          id: string
          updated_at?: string
        }
        Update: {
          can_issue_certificates?: boolean
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admins_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_cases: {
        Row: {
          created_at: string
          escenario: string
          generated_by: string | null
          id: string
          module_id: string
          preguntas: Json
          referencia: Json
          reflexion: string
          titulo: string
          weekday: number
        }
        Insert: {
          created_at?: string
          escenario: string
          generated_by?: string | null
          id?: string
          module_id: string
          preguntas: Json
          referencia: Json
          reflexion: string
          titulo: string
          weekday: number
        }
        Update: {
          created_at?: string
          escenario?: string
          generated_by?: string | null
          id?: string
          module_id?: string
          preguntas?: Json
          referencia?: Json
          reflexion?: string
          titulo?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_cases_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_cases_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_events: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          manual_reason: string | null
          method: Database["public"]["Enums"]["attendance_method"]
          scanned_at: string
          scanned_by: string | null
          session_id: string
          snack_claimed_at: string | null
          snack_claimed_by: string | null
          student_id: string
          synced_at: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          manual_reason?: string | null
          method?: Database["public"]["Enums"]["attendance_method"]
          scanned_at?: string
          scanned_by?: string | null
          session_id: string
          snack_claimed_at?: string | null
          snack_claimed_by?: string | null
          student_id: string
          synced_at?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          manual_reason?: string | null
          method?: Database["public"]["Enums"]["attendance_method"]
          scanned_at?: string
          scanned_by?: string | null
          session_id?: string
          snack_claimed_at?: string | null
          snack_claimed_by?: string | null
          student_id?: string
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_events_scanned_by_fkey"
            columns: ["scanned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "attendance_events_snack_claimed_by_fkey"
            columns: ["snack_claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_mi_dominio"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "attendance_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "attendance_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students_blocked"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_profile_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: number
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: number
        }
        Relationships: []
      }
      case_completions: {
        Row: {
          case_date: string
          created_at: string
          id: string
          student_id: string
          weekday: number
        }
        Insert: {
          case_date: string
          created_at?: string
          id?: string
          student_id: string
          weekday: number
        }
        Update: {
          case_date?: string
          created_at?: string
          id?: string
          student_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "case_completions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_completions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_mi_dominio"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "case_completions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "case_completions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_completions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students_blocked"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          closed_at: string | null
          cohort_id: string
          created_at: string
          id: string
          module_id: string
          notes: string | null
          opened_at: string | null
          rescheduled_from: string | null
          session_date: string
          status: Database["public"]["Enums"]["session_status"]
          teacher_id: string | null
          updated_at: string
          week_number: number
        }
        Insert: {
          closed_at?: string | null
          cohort_id: string
          created_at?: string
          id?: string
          module_id: string
          notes?: string | null
          opened_at?: string | null
          rescheduled_from?: string | null
          session_date: string
          status?: Database["public"]["Enums"]["session_status"]
          teacher_id?: string | null
          updated_at?: string
          week_number: number
        }
        Update: {
          closed_at?: string | null
          cohort_id?: string
          created_at?: string
          id?: string
          module_id?: string
          notes?: string | null
          opened_at?: string | null
          rescheduled_from?: string | null
          session_date?: string
          status?: Database["public"]["Enums"]["session_status"]
          teacher_id?: string | null
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_rescheduled_from_fkey"
            columns: ["rescheduled_from"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_rescheduled_from_fkey"
            columns: ["rescheduled_from"]
            isOneToOne: false
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "class_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          code_number: number | null
          created_at: string
          current_module_id: string | null
          id: string
          location: string | null
          name: string
          program_id: string
          sede: string | null
          start_date: string
          status: Database["public"]["Enums"]["cohort_status"]
          teacher_id: string | null
          turno: string | null
          updated_at: string
        }
        Insert: {
          code_number?: number | null
          created_at?: string
          current_module_id?: string | null
          id?: string
          location?: string | null
          name: string
          program_id: string
          sede?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["cohort_status"]
          teacher_id?: string | null
          turno?: string | null
          updated_at?: string
        }
        Update: {
          code_number?: number | null
          created_at?: string
          current_module_id?: string | null
          id?: string
          location?: string | null
          name?: string
          program_id?: string
          sede?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["cohort_status"]
          teacher_id?: string | null
          turno?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_current_module_id_fkey"
            columns: ["current_module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohorts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohorts_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          approval_status: Database["public"]["Enums"]["content_approval_status"]
          created_at: string
          description: string | null
          external_url: string | null
          id: string
          is_published: boolean
          learning_guide_id: string | null
          module_id: string
          review_message: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          size_bytes: number | null
          storage_path: string | null
          title: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at: string
          uploaded_by: string | null
          visible_from: string | null
          week_number: number | null
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["content_approval_status"]
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          is_published?: boolean
          learning_guide_id?: string | null
          module_id: string
          review_message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          title: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at?: string
          uploaded_by?: string | null
          visible_from?: string | null
          week_number?: number | null
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["content_approval_status"]
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          is_published?: boolean
          learning_guide_id?: string | null
          module_id?: string
          review_message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          title?: string
          type?: Database["public"]["Enums"]["content_type"]
          updated_at?: string
          uploaded_by?: string | null
          visible_from?: string | null
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_items_learning_guide_id_fkey"
            columns: ["learning_guide_id"]
            isOneToOne: false
            referencedRelation: "learning_guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_learning_guide_id_fkey"
            columns: ["learning_guide_id"]
            isOneToOne: false
            referencedRelation: "v_mi_dominio"
            referencedColumns: ["learning_guide_id"]
          },
          {
            foreignKeyName: "content_items_learning_guide_id_fkey"
            columns: ["learning_guide_id"]
            isOneToOne: false
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["learning_guide_id"]
          },
          {
            foreignKeyName: "content_items_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_views: {
        Row: {
          content_item_id: string
          id: string
          student_id: string
          viewed_at: string
        }
        Insert: {
          content_item_id: string
          id?: string
          student_id: string
          viewed_at?: string
        }
        Update: {
          content_item_id?: string
          id?: string
          student_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_views_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_views_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_views_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_mi_dominio"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "content_views_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "content_views_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_views_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students_blocked"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_checkin_codes: {
        Row: {
          checkin_date: string
          code: string
          rotated_at: string
        }
        Insert: {
          checkin_date: string
          code: string
          rotated_at?: string
        }
        Update: {
          checkin_date?: string
          code?: string
          rotated_at?: string
        }
        Relationships: []
      }
      doubts: {
        Row: {
          body: string
          created_at: string
          id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doubts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doubts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_mi_dominio"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "doubts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "doubts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doubts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students_blocked"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_answers: {
        Row: {
          answer: Json | null
          attempt_id: string
          auto_graded: boolean
          awarded_points: number | null
          created_at: string
          graded_at: string | null
          graded_by: string | null
          id: string
          question_id: string
          teacher_feedback: string | null
          updated_at: string
        }
        Insert: {
          answer?: Json | null
          attempt_id: string
          auto_graded?: boolean
          awarded_points?: number | null
          created_at?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          question_id: string
          teacher_feedback?: string | null
          updated_at?: string
        }
        Update: {
          answer?: Json | null
          attempt_id?: string
          auto_graded?: boolean
          awarded_points?: number | null
          created_at?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          question_id?: string
          teacher_feedback?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_answers_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "exam_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "v_exam_questions_student"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          created_at: string
          exam_id: string
          graded_at: string | null
          id: string
          started_at: string
          status: Database["public"]["Enums"]["attempt_status"]
          student_id: string
          submitted_at: string | null
          total_score: number | null
        }
        Insert: {
          created_at?: string
          exam_id: string
          graded_at?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          student_id: string
          submitted_at?: string | null
          total_score?: number | null
        }
        Update: {
          created_at?: string
          exam_id?: string
          graded_at?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          student_id?: string
          submitted_at?: string | null
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_mi_dominio"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "exam_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "exam_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students_blocked"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          correct_answer: Json | null
          created_at: string
          exam_id: string
          id: string
          learning_guide_id: string | null
          options: Json | null
          order_index: number
          points: number
          rubric: string | null
          statement: string
          type: Database["public"]["Enums"]["question_type"]
        }
        Insert: {
          correct_answer?: Json | null
          created_at?: string
          exam_id: string
          id?: string
          learning_guide_id?: string | null
          options?: Json | null
          order_index: number
          points: number
          rubric?: string | null
          statement: string
          type: Database["public"]["Enums"]["question_type"]
        }
        Update: {
          correct_answer?: Json | null
          created_at?: string
          exam_id?: string
          id?: string
          learning_guide_id?: string | null
          options?: Json | null
          order_index?: number
          points?: number
          rubric?: string | null
          statement?: string
          type?: Database["public"]["Enums"]["question_type"]
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_learning_guide_id_fkey"
            columns: ["learning_guide_id"]
            isOneToOne: false
            referencedRelation: "learning_guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_learning_guide_id_fkey"
            columns: ["learning_guide_id"]
            isOneToOne: false
            referencedRelation: "v_mi_dominio"
            referencedColumns: ["learning_guide_id"]
          },
          {
            foreignKeyName: "exam_questions_learning_guide_id_fkey"
            columns: ["learning_guide_id"]
            isOneToOne: false
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["learning_guide_id"]
          },
        ]
      }
      exam_rehabilitation_requests: {
        Row: {
          attempt_id: string
          created_at: string
          exam_id: string
          id: string
          reason: string
          requested_at: string
          responded_at: string | null
          responded_by: string | null
          response_note: string | null
          status: Database["public"]["Enums"]["rehabilitation_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          exam_id: string
          id?: string
          reason: string
          requested_at?: string
          responded_at?: string | null
          responded_by?: string | null
          response_note?: string | null
          status?: Database["public"]["Enums"]["rehabilitation_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          exam_id?: string
          id?: string
          reason?: string
          requested_at?: string
          responded_at?: string | null
          responded_by?: string | null
          response_note?: string | null
          status?: Database["public"]["Enums"]["rehabilitation_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_rehabilitation_requests_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_rehabilitation_requests_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_rehabilitation_requests_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_rehabilitation_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_rehabilitation_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_mi_dominio"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "exam_rehabilitation_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "exam_rehabilitation_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_rehabilitation_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students_blocked"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          closes_at: string | null
          cohort_id: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          instructions: string | null
          max_score: number
          module_id: string
          opens_at: string | null
          passing_score: number
          published_at: string | null
          published_by: string | null
          status: Database["public"]["Enums"]["exam_status"]
          teacher_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          cohort_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          instructions?: string | null
          max_score?: number
          module_id: string
          opens_at?: string | null
          passing_score?: number
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          teacher_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          cohort_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          instructions?: string | null
          max_score?: number
          module_id?: string
          opens_at?: string | null
          passing_score?: number
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          teacher_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_macro: {
        Row: {
          badge_issued: boolean
          badge_url: string | null
          id: string
          module_id: string
          open_text: string | null
          student_id: string
          submitted_at: string
        }
        Insert: {
          badge_issued?: boolean
          badge_url?: string | null
          id?: string
          module_id: string
          open_text?: string | null
          student_id: string
          submitted_at?: string
        }
        Update: {
          badge_issued?: boolean
          badge_url?: string | null
          id?: string
          module_id?: string
          open_text?: string | null
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_macro_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_macro_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_macro_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_mi_dominio"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "feedback_macro_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "feedback_macro_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_macro_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students_blocked"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_micro: {
        Row: {
          answers: Json
          id: string
          session_id: string
          student_id: string
          submitted_at: string
        }
        Insert: {
          answers: Json
          id?: string
          session_id: string
          student_id: string
          submitted_at?: string
        }
        Update: {
          answers?: Json
          id?: string
          session_id?: string
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_micro_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_micro_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "feedback_micro_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_micro_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_mi_dominio"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "feedback_micro_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "feedback_micro_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_micro_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students_blocked"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_guides: {
        Row: {
          created_at: string
          digitized: boolean
          id: string
          module_id: string
          order_in_week: number
          practice_description: string | null
          pre_practice_description: string | null
          source_document_url: string | null
          sub_competency_name: string
          week_number: number
        }
        Insert: {
          created_at?: string
          digitized?: boolean
          id?: string
          module_id: string
          order_in_week?: number
          practice_description?: string | null
          pre_practice_description?: string | null
          source_document_url?: string | null
          sub_competency_name: string
          week_number: number
        }
        Update: {
          created_at?: string
          digitized?: boolean
          id?: string
          module_id?: string
          order_in_week?: number
          practice_description?: string | null
          pre_practice_description?: string | null
          source_document_url?: string | null
          sub_competency_name?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "learning_guides_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      mastery_map: {
        Row: {
          created_at: string
          dominated_via: Database["public"]["Enums"]["mastery_source"] | null
          id: string
          learning_guide_id: string
          marked_at: string | null
          marked_by: string | null
          notes: string | null
          status: Database["public"]["Enums"]["mastery_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dominated_via?: Database["public"]["Enums"]["mastery_source"] | null
          id?: string
          learning_guide_id: string
          marked_at?: string | null
          marked_by?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["mastery_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dominated_via?: Database["public"]["Enums"]["mastery_source"] | null
          id?: string
          learning_guide_id?: string
          marked_at?: string | null
          marked_by?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["mastery_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mastery_map_learning_guide_id_fkey"
            columns: ["learning_guide_id"]
            isOneToOne: false
            referencedRelation: "learning_guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mastery_map_learning_guide_id_fkey"
            columns: ["learning_guide_id"]
            isOneToOne: false
            referencedRelation: "v_mi_dominio"
            referencedColumns: ["learning_guide_id"]
          },
          {
            foreignKeyName: "mastery_map_learning_guide_id_fkey"
            columns: ["learning_guide_id"]
            isOneToOne: false
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["learning_guide_id"]
          },
          {
            foreignKeyName: "mastery_map_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mastery_map_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mastery_map_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_mi_dominio"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "mastery_map_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "mastery_map_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mastery_map_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students_blocked"
            referencedColumns: ["id"]
          },
        ]
      }
      module_enrollments: {
        Row: {
          approved_at: string | null
          cohort_id: string
          created_at: string
          final_score: number | null
          id: string
          module_id: string
          participation_score: number | null
          participation_weight: number
          passing_threshold: number
          practice_score: number | null
          status: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
          theory_score: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          cohort_id: string
          created_at?: string
          final_score?: number | null
          id?: string
          module_id: string
          participation_score?: number | null
          participation_weight?: number
          passing_threshold: number
          practice_score?: number | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
          theory_score?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          cohort_id?: string
          created_at?: string
          final_score?: number | null
          id?: string
          module_id?: string
          participation_score?: number | null
          participation_weight?: number
          passing_threshold?: number
          practice_score?: number | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id?: string
          theory_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_enrollments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_enrollments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_mi_dominio"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "module_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "module_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students_blocked"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string
          description: string | null
          duration_weeks: number
          id: string
          inces_homologado: boolean
          is_complementario: boolean
          name: string
          order_index: number
          program_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_weeks?: number
          id?: string
          inces_homologado?: boolean
          is_complementario?: boolean
          name: string
          order_index: number
          program_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_weeks?: number
          id?: string
          inces_homologado?: boolean
          is_complementario?: boolean
          name?: string
          order_index?: number
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          payload: Json | null
          profile_id: string
          read_at: string | null
          sent_at: string | null
          title: string
          type: string
        }
        Insert: {
          body: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          payload?: Json | null
          profile_id: string
          read_at?: string | null
          sent_at?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          payload?: Json | null
          profile_id?: string
          read_at?: string | null
          sent_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parental_consents: {
        Row: {
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at: string
          document_url: string | null
          id: string
          method: Database["public"]["Enums"]["consent_method"]
          representative_cedula: string
          representative_email: string
          representative_id_document_url: string | null
          representative_name: string
          representative_phone: string | null
          signed_at: string
          student_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at?: string
          document_url?: string | null
          id?: string
          method: Database["public"]["Enums"]["consent_method"]
          representative_cedula: string
          representative_email: string
          representative_id_document_url?: string | null
          representative_name: string
          representative_phone?: string | null
          signed_at?: string
          student_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          consent_type?: Database["public"]["Enums"]["consent_type"]
          created_at?: string
          document_url?: string | null
          id?: string
          method?: Database["public"]["Enums"]["consent_method"]
          representative_cedula?: string
          representative_email?: string
          representative_id_document_url?: string | null
          representative_name?: string
          representative_phone?: string | null
          signed_at?: string
          student_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parental_consents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_mi_dominio"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "parental_consents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "parental_consents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_students_blocked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      professor_applications: {
        Row: {
          cedula: string
          cohort_id: string | null
          contact_email: string
          created_at: string
          full_name: string
          id: string
          phone: string | null
          profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          cedula: string
          cohort_id?: string | null
          contact_email: string
          created_at?: string
          full_name: string
          id?: string
          phone?: string | null
          profile_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          cedula?: string
          cohort_id?: string | null
          contact_email?: string
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          profile_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "professor_applications_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professor_applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professor_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cedula: string
          contact_email: string
          created_at: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cedula: string
          contact_email: string
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cedula?: string
          contact_email?: string
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          created_at: string
          id: string
          name: string
          total_duration_months: number
          total_modules: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          total_duration_months?: number
          total_modules?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          total_duration_months?: number
          total_modules?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          profile_id: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          profile_id: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          profile_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_checkin_codes: {
        Row: {
          code: string
          issued_by: string | null
          rotated_at: string
          session_id: string
        }
        Insert: {
          code: string
          issued_by?: string | null
          rotated_at?: string
          session_id: string
        }
        Update: {
          code?: string
          issued_by?: string | null
          rotated_at?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_checkin_codes_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_checkin_codes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_checkin_codes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["session_id"]
          },
        ]
      }
      student_profile_details: {
        Row: {
          completed_at: string
          current_school_grade: string | null
          currently_studying: boolean
          education_level: string
          education_status: string
          employment_status: string
          ethnicity: string
          gender: string
          has_teaching_experience: boolean
          health_conditions: string[]
          id: string
          marital_status: string
          nationality: string
          student_id: string
          teaching_area: string | null
          years_of_experience: number | null
        }
        Insert: {
          completed_at?: string
          current_school_grade?: string | null
          currently_studying: boolean
          education_level: string
          education_status: string
          employment_status: string
          ethnicity: string
          gender: string
          has_teaching_experience: boolean
          health_conditions?: string[]
          id?: string
          marital_status: string
          nationality: string
          student_id: string
          teaching_area?: string | null
          years_of_experience?: number | null
        }
        Update: {
          completed_at?: string
          current_school_grade?: string | null
          currently_studying?: boolean
          education_level?: string
          education_status?: string
          employment_status?: string
          ethnicity?: string
          gender?: string
          has_teaching_experience?: boolean
          health_conditions?: string[]
          id?: string
          marital_status?: string
          nationality?: string
          student_id?: string
          teaching_area?: string | null
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_profile_details_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profile_details_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "v_mi_dominio"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_profile_details_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_profile_details_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "v_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profile_details_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "v_students_blocked"
            referencedColumns: ["id"]
          },
        ]
      }
      student_qr_secrets: {
        Row: {
          created_at: string
          rotated_at: string
          secret: string
          student_id: string
        }
        Insert: {
          created_at?: string
          rotated_at?: string
          secret: string
          student_id: string
        }
        Update: {
          created_at?: string
          rotated_at?: string
          secret?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_qr_secrets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_qr_secrets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "v_mi_dominio"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_qr_secrets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_qr_secrets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "v_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_qr_secrets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "v_students_blocked"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          birth_date: string
          cohort_id: string | null
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          enrolled_by: string | null
          enrollment_date: string
          id: string
          onboarding_status: Database["public"]["Enums"]["onboarding_status"]
          student_code: string | null
          trust_level: number | null
          updated_at: string
        }
        Insert: {
          birth_date: string
          cohort_id?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          enrolled_by?: string | null
          enrollment_date?: string
          id: string
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          student_code?: string | null
          trust_level?: number | null
          updated_at?: string
        }
        Update: {
          birth_date?: string
          cohort_id?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          enrolled_by?: string | null
          enrollment_date?: string
          id?: string
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          student_code?: string | null
          trust_level?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_students_cohort"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_enrolled_by_fkey"
            columns: ["enrolled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          description: string
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description: string
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      system_config_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: number
          key: string
          new_value: Json
          old_value: Json | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: number
          key: string
          new_value: Json
          old_value?: Json | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: number
          key?: string
          new_value?: Json
          old_value?: Json | null
        }
        Relationships: []
      }
      teachers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          specialties: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          is_active?: boolean
          specialties?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          specialties?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teachers_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_exam_questions_student: {
        Row: {
          exam_id: string | null
          id: string | null
          options: Json | null
          order_index: number | null
          points: number | null
          statement: string | null
          type: Database["public"]["Enums"]["question_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      v_feedback_session_summary: {
        Row: {
          avg_score: number | null
          question: string | null
          response_count: number | null
          session_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_micro_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_micro_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_proximo_sabado"
            referencedColumns: ["session_id"]
          },
        ]
      }
      v_mi_dominio: {
        Row: {
          dominated_via: Database["public"]["Enums"]["mastery_source"] | null
          learning_guide_id: string | null
          marked_at: string | null
          module_id: string | null
          module_name: string | null
          order_in_week: number | null
          status: Database["public"]["Enums"]["mastery_status"] | null
          student_id: string | null
          sub_competency_name: string | null
          week_number: number | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_guides_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_proximo_sabado: {
        Row: {
          learning_guide_id: string | null
          module_name: string | null
          practice_description: string | null
          pre_practice_description: string | null
          session_date: string | null
          session_id: string | null
          student_id: string | null
          sub_competency_name: string | null
          week_number: number | null
        }
        Relationships: [
          {
            foreignKeyName: "students_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_students: {
        Row: {
          age_years: number | null
          avatar_url: string | null
          birth_date: string | null
          cedula: string | null
          cohort_id: string | null
          contact_email: string | null
          created_at: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          enrollment_date: string | null
          full_name: string | null
          id: string | null
          is_minor: boolean | null
          onboarding_status:
            | Database["public"]["Enums"]["onboarding_status"]
            | null
          phone: string | null
          status: Database["public"]["Enums"]["profile_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_students_cohort"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_students_blocked: {
        Row: {
          age_years: number | null
          cedula: string | null
          cohort_id: string | null
          consent_unverified: boolean | null
          contact_email: string | null
          full_name: string | null
          id: string | null
          missing_consent: boolean | null
          onboarding_status:
            | Database["public"]["Enums"]["onboarding_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_students_cohort"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      age_years: { Args: { p_birth_date: string }; Returns: number }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      calc_final_score: {
        Args: {
          p_participation: number
          p_practice: number
          p_theory: number
          p_weight: number
        }
        Returns: number
      }
      can_see_student: { Args: { p_student: string }; Returns: boolean }
      cfg: { Args: { p_key: string }; Returns: Json }
      cfg_int: { Args: { p_default: number; p_key: string }; Returns: number }
      cfg_num: { Args: { p_default: number; p_key: string }; Returns: number }
      fn_generar_caso_del_dia: { Args: never; Returns: undefined }
      is_admin_up: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_student: { Args: never; Returns: boolean }
      is_super: { Args: never; Returns: boolean }
      is_vendedor: { Args: never; Returns: boolean }
      my_cohort_id: { Args: never; Returns: string }
      my_module_id: { Args: never; Returns: string }
      seed_user: {
        Args: {
          p_cedula: string
          p_email: string
          p_full_name: string
          p_id: string
          p_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: string
      }
      set_student_code_calc: {
        Args: { p_cohort_id: string; p_enrollment_date: string; p_id: string }
        Returns: string
      }
      teaches_cohort: { Args: { p_cohort: string }; Returns: boolean }
    }
    Enums: {
      attempt_status: "en_progreso" | "entregado" | "calificado" | "abandonado"
      attendance_method: "qr" | "manual"
      cohort_status: "activa" | "finalizada" | "suspendida"
      consent_method: "fisico" | "digital"
      consent_type: "account_creation" | "ugc_publication"
      content_approval_status: "aprobado" | "pendiente" | "rechazado"
      content_type: "pdf" | "presentacion" | "imagen" | "enlace" | "documento"
      enrollment_status: "en_curso" | "aprobado" | "reprobado" | "retirado"
      exam_status: "oculto" | "habilitado" | "cerrado" | "calificado"
      mastery_source:
        | "evaluacion_practica"
        | "evaluacion_teorica"
        | "micro_learning"
      mastery_status: "no_iniciado" | "en_progreso" | "dominado"
      notification_channel: "push" | "email" | "in_app"
      onboarding_status: "en_curso" | "completo"
      profile_status: "activo" | "suspendido" | "egresado" | "retirado"
      question_type: "opcion_multiple" | "verdadero_falso" | "redaccion_abierta"
      rehabilitation_status: "pendiente" | "aprobada" | "rechazada"
      session_status:
        | "programada"
        | "abierta"
        | "cerrada"
        | "reprogramada"
        | "cancelada"
      user_role:
        | "estudiante"
        | "profesor"
        | "admin"
        | "super_admin"
        | "direccion_academica"
        | "vendedor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      attempt_status: ["en_progreso", "entregado", "calificado", "abandonado"],
      attendance_method: ["qr", "manual"],
      cohort_status: ["activa", "finalizada", "suspendida"],
      consent_method: ["fisico", "digital"],
      consent_type: ["account_creation", "ugc_publication"],
      content_approval_status: ["aprobado", "pendiente", "rechazado"],
      content_type: ["pdf", "presentacion", "imagen", "enlace", "documento"],
      enrollment_status: ["en_curso", "aprobado", "reprobado", "retirado"],
      exam_status: ["oculto", "habilitado", "cerrado", "calificado"],
      mastery_source: [
        "evaluacion_practica",
        "evaluacion_teorica",
        "micro_learning",
      ],
      mastery_status: ["no_iniciado", "en_progreso", "dominado"],
      notification_channel: ["push", "email", "in_app"],
      onboarding_status: ["en_curso", "completo"],
      profile_status: ["activo", "suspendido", "egresado", "retirado"],
      question_type: [
        "opcion_multiple",
        "verdadero_falso",
        "redaccion_abierta",
      ],
      rehabilitation_status: ["pendiente", "aprobada", "rechazada"],
      session_status: [
        "programada",
        "abierta",
        "cerrada",
        "reprogramada",
        "cancelada",
      ],
      user_role: [
        "estudiante",
        "profesor",
        "admin",
        "super_admin",
        "direccion_academica",
        "vendedor",
      ],
    },
  },
} as const
