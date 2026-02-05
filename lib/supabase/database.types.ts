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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      automation_enrollments: {
        Row: {
          automation_id: string
          completed_at: string | null
          current_step_id: string | null
          deal_id: string
          enrolled_at: string
          id: string
          next_step_at: string | null
          status: string
          stopped_reason: string | null
        }
        Insert: {
          automation_id: string
          completed_at?: string | null
          current_step_id?: string | null
          deal_id: string
          enrolled_at?: string
          id?: string
          next_step_at?: string | null
          status?: string
          stopped_reason?: string | null
        }
        Update: {
          automation_id?: string
          completed_at?: string | null
          current_step_id?: string | null
          deal_id?: string
          enrolled_at?: string
          id?: string
          next_step_at?: string | null
          status?: string
          stopped_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_enrollments_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_enrollments_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "automation_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_enrollments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          deal_id: string
          email_message_id: string | null
          enrollment_id: string
          error_message: string | null
          id: string
          log_type: string | null
          sent_at: string
          status: string
          step_id: string
        }
        Insert: {
          deal_id: string
          email_message_id?: string | null
          enrollment_id: string
          error_message?: string | null
          id?: string
          log_type?: string | null
          sent_at?: string
          status: string
          step_id: string
        }
        Update: {
          deal_id?: string
          email_message_id?: string | null
          enrollment_id?: string
          error_message?: string | null
          id?: string
          log_type?: string | null
          sent_at?: string
          status?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "automation_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "pending_reply_stops"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "automation_logs_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "automation_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_steps: {
        Row: {
          automation_id: string
          conditions: Json | null
          created_at: string
          delay_days: number
          delay_hours: number
          email_template_id: string | null
          id: string
          sms_content: string | null
          stats: Json | null
          step_order: number
          step_type: string
          target_stage_id: string | null
        }
        Insert: {
          automation_id: string
          conditions?: Json | null
          created_at?: string
          delay_days?: number
          delay_hours?: number
          email_template_id?: string | null
          id?: string
          sms_content?: string | null
          stats?: Json | null
          step_order: number
          step_type: string
          target_stage_id?: string | null
        }
        Update: {
          automation_id?: string
          conditions?: Json | null
          created_at?: string
          delay_days?: number
          delay_hours?: number
          email_template_id?: string | null
          id?: string
          sms_content?: string | null
          stats?: Json | null
          step_order?: number
          step_type?: string
          target_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_steps_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_steps_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_steps_target_stage_id_fkey"
            columns: ["target_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          automation_type: string | null
          config: Json | null
          created_at: string
          description: string | null
          exit_on_reply: boolean | null
          id: string
          is_active: boolean
          name: string
          pipeline_id: string | null
          status: string | null
          stop_on_stage_ids: string[] | null
          trigger_stage_id: string | null
          trigger_type: string | null
          updated_at: string
        }
        Insert: {
          automation_type?: string | null
          config?: Json | null
          created_at?: string
          description?: string | null
          exit_on_reply?: boolean | null
          id?: string
          is_active?: boolean
          name: string
          pipeline_id?: string | null
          status?: string | null
          stop_on_stage_ids?: string[] | null
          trigger_stage_id?: string | null
          trigger_type?: string | null
          updated_at?: string
        }
        Update: {
          automation_type?: string | null
          config?: Json | null
          created_at?: string
          description?: string | null
          exit_on_reply?: boolean | null
          id?: string
          is_active?: boolean
          name?: string
          pipeline_id?: string | null
          status?: string | null
          stop_on_stage_ids?: string[] | null
          trigger_stage_id?: string | null
          trigger_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_trigger_stage_id_fkey"
            columns: ["trigger_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      calendly_events: {
        Row: {
          calendly_event_id: string | null
          contact_id: string | null
          created_at: string | null
          deal_id: string | null
          end_time: string | null
          event_name: string | null
          event_type: string | null
          id: string
          join_url: string | null
          location: string | null
          start_time: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          calendly_event_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          end_time?: string | null
          event_name?: string | null
          event_type?: string | null
          id?: string
          join_url?: string | null
          location?: string | null
          start_time: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          calendly_event_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          end_time?: string | null
          event_name?: string | null
          event_type?: string | null
          id?: string
          join_url?: string | null
          location?: string | null
          start_time?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendly_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendly_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendly_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_lists: {
        Row: {
          campaign_id: string
          list_id: string
        }
        Insert: {
          campaign_id: string
          list_id: string
        }
        Update: {
          campaign_id?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_lists_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_lists_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          clicked_at: string | null
          contact_id: string
          delivered_at: string | null
          error_message: string | null
          id: string
          opened_at: string | null
          resend_message_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          clicked_at?: string | null
          contact_id: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          opened_at?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          clicked_at?: string | null
          contact_id?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          opened_at?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          body_html: string | null
          body_text: string | null
          created_at: string
          created_by_id: string
          email_template_id: string | null
          error_message: string | null
          from_email: string | null
          from_name: string | null
          from_user_id: string
          id: string
          last_processed_at: string | null
          name: string
          pipeline_id: string | null
          preview_text: string | null
          processed_recipients: number | null
          recipient_list_ids: string[] | null
          reply_to: string | null
          scheduled_at: string | null
          sent_at: string | null
          sms_content: string | null
          status: string
          subject: string | null
          thumbnail_url: string | null
          total_recipients: number | null
          type: string
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          created_by_id: string
          email_template_id?: string | null
          error_message?: string | null
          from_email?: string | null
          from_name?: string | null
          from_user_id: string
          id?: string
          last_processed_at?: string | null
          name: string
          pipeline_id?: string | null
          preview_text?: string | null
          processed_recipients?: number | null
          recipient_list_ids?: string[] | null
          reply_to?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          sms_content?: string | null
          status?: string
          subject?: string | null
          thumbnail_url?: string | null
          total_recipients?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          created_by_id?: string
          email_template_id?: string | null
          error_message?: string | null
          from_email?: string | null
          from_name?: string | null
          from_user_id?: string
          id?: string
          last_processed_at?: string | null
          name?: string
          pipeline_id?: string | null
          preview_text?: string | null
          processed_recipients?: number | null
          recipient_list_ids?: string[] | null
          reply_to?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          sms_content?: string | null
          status?: string
          subject?: string | null
          thumbnail_url?: string | null
          total_recipients?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_lists: {
        Row: {
          added_at: string
          contact_id: string
          list_id: string
        }
        Insert: {
          added_at?: string
          contact_id: string
          list_id: string
        }
        Update: {
          added_at?: string
          contact_id?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_lists_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_lists_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_notes: {
        Row: {
          contact_id: string
          content: string
          created_at: string
          created_by_id: string | null
          id: string
        }
        Insert: {
          contact_id: string
          content: string
          created_at?: string
          created_by_id?: string | null
          id?: string
        }
        Update: {
          contact_id?: string
          content?: string
          created_at?: string
          created_by_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_payment_plans: {
        Row: {
          contact_id: string
          created_at: string
          deal_id: string | null
          id: string
          payment_plan_id: string
          start_date: string
          status: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          deal_id?: string | null
          id?: string
          payment_plan_id: string
          start_date: string
          status?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          deal_id?: string | null
          id?: string
          payment_plan_id?: string
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_payment_plans_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_payment_plans_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_payment_plans_payment_plan_id_fkey"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          added_at: string
          contact_id: string
          tag_id: string
        }
        Insert: {
          added_at?: string
          contact_id: string
          tag_id: string
        }
        Update: {
          added_at?: string
          contact_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          city: string | null
          club_name: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          email_subscribed: boolean
          first_name: string
          gender: string | null
          gpa: number | null
          graduation_year: number | null
          id: string
          last_activity_at: string | null
          last_name: string
          notes: string | null
          owner_id: string | null
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          phone: string | null
          position: string | null
          sms_subscribed: boolean
          source: string | null
          source_detail: string | null
          sport: string
          state: string | null
          subscription_status: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          club_name?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          email_subscribed?: boolean
          first_name: string
          gender?: string | null
          gpa?: number | null
          graduation_year?: number | null
          id?: string
          last_activity_at?: string | null
          last_name: string
          notes?: string | null
          owner_id?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          phone?: string | null
          position?: string | null
          sms_subscribed?: boolean
          source?: string | null
          source_detail?: string | null
          sport?: string
          state?: string | null
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          club_name?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          email_subscribed?: boolean
          first_name?: string
          gender?: string | null
          gpa?: number | null
          graduation_year?: number | null
          id?: string
          last_activity_at?: string | null
          last_name?: string
          notes?: string | null
          owner_id?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          phone?: string | null
          position?: string | null
          sms_subscribed?: boolean
          source?: string | null
          source_detail?: string | null
          sport?: string
          state?: string | null
          subscription_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_activities: {
        Row: {
          activity_type: string
          created_at: string
          deal_id: string
          description: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          performed_by_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string
          deal_id: string
          description?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_by_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          deal_id?: string
          description?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_by_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_performed_by_id_fkey"
            columns: ["performed_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          contact_id: string
          created_at: string
          current_stage_id: string | null
          deal_owner_id: string
          deal_value: number
          description: string | null
          expected_close_date: string | null
          forecasted_close_date: string | null
          id: string
          last_activity_at: string | null
          lost_at: string | null
          lost_reason: string | null
          notes: string | null
          owner_id: string | null
          pipeline_id: string
          probability: number | null
          source: string | null
          stage_entered_at: string | null
          stage_id: string | null
          status: string | null
          title: string
          updated_at: string
          value: number | null
          win_probability: number | null
          won_at: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          current_stage_id?: string | null
          deal_owner_id: string
          deal_value?: number
          description?: string | null
          expected_close_date?: string | null
          forecasted_close_date?: string | null
          id?: string
          last_activity_at?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          notes?: string | null
          owner_id?: string | null
          pipeline_id: string
          probability?: number | null
          source?: string | null
          stage_entered_at?: string | null
          stage_id?: string | null
          status?: string | null
          title: string
          updated_at?: string
          value?: number | null
          win_probability?: number | null
          won_at?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          current_stage_id?: string | null
          deal_owner_id?: string
          deal_value?: number
          description?: string | null
          expected_close_date?: string | null
          forecasted_close_date?: string | null
          id?: string
          last_activity_at?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          notes?: string | null
          owner_id?: string | null
          pipeline_id?: string
          probability?: number | null
          source?: string | null
          stage_entered_at?: string | null
          stage_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          value?: number | null
          win_probability?: number | null
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_deal_owner_id_fkey"
            columns: ["deal_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          contact_id: string
          document_type: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          name: string
          notes: string | null
          uploaded_at: string
          verified: boolean
          verified_at: string | null
          verified_by_id: string | null
        }
        Insert: {
          contact_id: string
          document_type: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          name: string
          notes?: string | null
          uploaded_at?: string
          verified?: boolean
          verified_at?: string | null
          verified_by_id?: string | null
        }
        Update: {
          contact_id?: string
          document_type?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          name?: string
          notes?: string | null
          uploaded_at?: string
          verified?: boolean
          verified_at?: string | null
          verified_by_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_verified_by_id_fkey"
            columns: ["verified_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_replies: {
        Row: {
          ai_intent: string | null
          body: string | null
          body_preview: string | null
          campaign_id: string | null
          contact_id: string | null
          created_at: string | null
          deal_id: string | null
          email_send_id: string | null
          follow_up_status: string | null
          from_email: string | null
          from_name: string | null
          html_body: string | null
          id: string
          in_reply_to: string | null
          intent: string | null
          match_status: string | null
          matched: boolean | null
          matched_at: string | null
          matched_by_id: string | null
          message_id: string | null
          pipeline_id: string | null
          portal_user_id: string | null
          processed: boolean | null
          raw_payload: Json | null
          read: boolean | null
          received_at: string | null
          replied: boolean | null
          status: string | null
          subject: string | null
          to_email: string | null
          updated_at: string | null
        }
        Insert: {
          ai_intent?: string | null
          body?: string | null
          body_preview?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          email_send_id?: string | null
          follow_up_status?: string | null
          from_email?: string | null
          from_name?: string | null
          html_body?: string | null
          id?: string
          in_reply_to?: string | null
          intent?: string | null
          match_status?: string | null
          matched?: boolean | null
          matched_at?: string | null
          matched_by_id?: string | null
          message_id?: string | null
          pipeline_id?: string | null
          portal_user_id?: string | null
          processed?: boolean | null
          raw_payload?: Json | null
          read?: boolean | null
          received_at?: string | null
          replied?: boolean | null
          status?: string | null
          subject?: string | null
          to_email?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_intent?: string | null
          body?: string | null
          body_preview?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          email_send_id?: string | null
          follow_up_status?: string | null
          from_email?: string | null
          from_name?: string | null
          html_body?: string | null
          id?: string
          in_reply_to?: string | null
          intent?: string | null
          match_status?: string | null
          matched?: boolean | null
          matched_at?: string | null
          matched_by_id?: string | null
          message_id?: string | null
          pipeline_id?: string | null
          portal_user_id?: string | null
          processed?: boolean | null
          raw_payload?: Json | null
          read?: boolean | null
          received_at?: string | null
          replied?: boolean | null
          status?: string | null
          subject?: string | null
          to_email?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_replies_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_replies_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_replies_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_replies_email_send_id_fkey"
            columns: ["email_send_id"]
            isOneToOne: false
            referencedRelation: "email_sends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_replies_matched_by_id_fkey"
            columns: ["matched_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_replies_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_replies_portal_user_id_fkey"
            columns: ["portal_user_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sends: {
        Row: {
          automation_log_id: string | null
          campaign_id: string | null
          click_count: number | null
          clicked_at: string | null
          created_at: string | null
          from_email: string | null
          from_name: string | null
          id: string
          open_count: number | null
          opened_at: string | null
          recipient_contact_id: string | null
          recipient_email: string
          reply_to: string | null
          resend_message_id: string | null
          sent_at: string | null
          status: string | null
          subject: string
          tracking_id: string | null
        }
        Insert: {
          automation_log_id?: string | null
          campaign_id?: string | null
          click_count?: number | null
          clicked_at?: string | null
          created_at?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          open_count?: number | null
          opened_at?: string | null
          recipient_contact_id?: string | null
          recipient_email: string
          reply_to?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          tracking_id?: string | null
        }
        Update: {
          automation_log_id?: string | null
          campaign_id?: string | null
          click_count?: number | null
          clicked_at?: string | null
          created_at?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          open_count?: number | null
          opened_at?: string | null
          recipient_contact_id?: string | null
          recipient_email?: string
          reply_to?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          tracking_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_automation_log_id_fkey"
            columns: ["automation_log_id"]
            isOneToOne: false
            referencedRelation: "automation_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_recipient_contact_id_fkey"
            columns: ["recipient_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_modules: {
        Row: {
          block_content: Json
          block_type: string
          created_at: string | null
          created_by_id: string | null
          description: string | null
          id: string
          name: string
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          block_content: Json
          block_type: string
          created_at?: string | null
          created_by_id?: string | null
          description?: string | null
          id?: string
          name: string
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          block_content?: Json
          block_type?: string
          created_at?: string | null
          created_by_id?: string | null
          description?: string | null
          id?: string
          name?: string
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          attachments: Json | null
          body_html: string
          body_json: Json | null
          category: string
          created_at: string
          created_by_id: string | null
          fixed_from_email: string | null
          fixed_from_name: string | null
          from_name_type: string
          id: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          body_html: string
          body_json?: Json | null
          category: string
          created_at?: string
          created_by_id?: string | null
          fixed_from_email?: string | null
          fixed_from_name?: string | null
          from_name_type?: string
          id?: string
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          body_html?: string
          body_json?: Json | null
          category?: string
          created_at?: string
          created_by_id?: string | null
          fixed_from_email?: string | null
          fixed_from_name?: string | null
          from_name_type?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          assigned_user_id: string | null
          automation_id: string | null
          contact_id: string | null
          created_at: string | null
          deal_id: string | null
          error_message: string | null
          form_id: string
          id: string
          payload: Json | null
          status: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          automation_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          error_message?: string | null
          form_id: string
          id?: string
          payload?: Json | null
          status?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          automation_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          error_message?: string | null
          form_id?: string
          id?: string
          payload?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          contact_id: string
          created_at: string
          created_by_id: string
          currency: string
          deal_id: string | null
          description: string
          due_date: string
          id: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          sent_at: string | null
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          type: string
          updated_at: string
          xero_invoice_id: string | null
        }
        Insert: {
          amount: number
          contact_id: string
          created_at?: string
          created_by_id: string
          currency?: string
          deal_id?: string | null
          description: string
          due_date: string
          id?: string
          invoice_number: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          sent_at?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          type: string
          updated_at?: string
          xero_invoice_id?: string | null
        }
        Update: {
          amount?: number
          contact_id?: string
          created_at?: string
          created_by_id?: string
          currency?: string
          deal_id?: string | null
          description?: string
          due_date?: string
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          sent_at?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          type?: string
          updated_at?: string
          xero_invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_dynamic: boolean
          name: string
          rules: Json | null
          sport: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_dynamic?: boolean
          name: string
          rules?: Json | null
          sport?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_dynamic?: boolean
          name?: string
          rules?: Json | null
          sport?: string
          updated_at?: string
        }
        Relationships: []
      }
      manual_round_robin_state: {
        Row: {
          created_at: string | null
          id: string
          last_assigned_at: string | null
          last_assigned_user_id: string | null
          pipeline_key: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_assigned_at?: string | null
          last_assigned_user_id?: string | null
          pipeline_key: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_assigned_at?: string | null
          last_assigned_user_id?: string | null
          pipeline_key?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_round_robin_state_last_assigned_user_id_fkey"
            columns: ["last_assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          created_at: string
          deposit_amount: number
          id: string
          installment_count: number
          installment_frequency: string
          is_active: boolean
          name: string
          programme_id: string | null
          total_amount: number
        }
        Insert: {
          created_at?: string
          deposit_amount: number
          id?: string
          installment_count: number
          installment_frequency: string
          is_active?: boolean
          name: string
          programme_id?: string | null
          total_amount: number
        }
        Update: {
          created_at?: string
          deposit_amount?: number
          id?: string
          installment_count?: number
          installment_frequency?: string
          is_active?: boolean
          name?: string
          programme_id?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          contact_id: string
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string
          recorded_by_id: string
          reference: string | null
          status: string | null
          stripe_payment_id: string | null
        }
        Insert: {
          amount: number
          contact_id: string
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date: string
          payment_method: string
          recorded_by_id: string
          reference?: string | null
          status?: string | null
          stripe_payment_id?: string | null
        }
        Update: {
          amount?: number
          contact_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          recorded_by_id?: string
          reference?: string | null
          status?: string | null
          stripe_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_id_fkey"
            columns: ["recorded_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          automation_id: string | null
          color: string
          created_at: string
          display_order: number
          id: string
          name: string
          pipeline_id: string
          stage_type: string
          triggers_automation: boolean
          updated_at: string
        }
        Insert: {
          automation_id?: string | null
          color?: string
          created_at?: string
          display_order: number
          id?: string
          name: string
          pipeline_id: string
          stage_type: string
          triggers_automation?: boolean
          updated_at?: string
        }
        Update: {
          automation_id?: string | null
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          pipeline_id?: string
          stage_type?: string
          triggers_automation?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_pipeline_stages_automation"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          programme_id: string | null
          sport: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          programme_id?: string | null
          sport?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          programme_id?: string | null
          sport?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_notifications: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          is_read: boolean
          link_url: string | null
          message: string
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          link_url?: string | null
          message: string
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          link_url?: string | null
          message?: string
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_notifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_users: {
        Row: {
          activated_at: string | null
          activation_sent_at: string | null
          activation_token: string | null
          calendly_url: string | null
          contact_id: string
          created_at: string
          email: string
          email_signature: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          password_hash: string | null
          phone: string | null
        }
        Insert: {
          activated_at?: string | null
          activation_sent_at?: string | null
          activation_token?: string | null
          calendly_url?: string | null
          contact_id: string
          created_at?: string
          email: string
          email_signature?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          password_hash?: string | null
          phone?: string | null
        }
        Update: {
          activated_at?: string | null
          activation_sent_at?: string | null
          activation_token?: string | null
          calendly_url?: string | null
          contact_id?: string
          created_at?: string
          email?: string
          email_signature?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          password_hash?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_users_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          calendly_url: string | null
          created_at: string
          email: string
          email_signature: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          pipeline_assignments: string[] | null
          role: string
          sport: string
          title: string | null
          updated_at: string
          zoom_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          calendly_url?: string | null
          created_at?: string
          email: string
          email_signature?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          pipeline_assignments?: string[] | null
          role?: string
          sport?: string
          title?: string | null
          updated_at?: string
          zoom_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          calendly_url?: string | null
          created_at?: string
          email?: string
          email_signature?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          pipeline_assignments?: string[] | null
          role?: string
          sport?: string
          title?: string | null
          updated_at?: string
          zoom_url?: string | null
        }
        Relationships: []
      }
      programmes: {
        Row: {
          created_at: string
          default_deposit_amount: number | null
          default_total_cost: number | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          sport: string
          type: string
          university_partner: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_deposit_amount?: number | null
          default_total_cost?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sport?: string
          type: string
          university_partner?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_deposit_amount?: number | null
          default_total_cost?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sport?: string
          type?: string
          university_partner?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      round_robin_state: {
        Row: {
          automation_id: string | null
          id: string
          last_assigned_at: string | null
          last_assigned_user_id: string | null
        }
        Insert: {
          automation_id?: string | null
          id?: string
          last_assigned_at?: string | null
          last_assigned_user_id?: string | null
        }
        Update: {
          automation_id?: string | null
          id?: string
          last_assigned_at?: string | null
          last_assigned_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "round_robin_state_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: true
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_robin_state_last_assigned_user_id_fkey"
            columns: ["last_assigned_user_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          ai_intent: string | null
          ai_intent_confidence: number | null
          campaign_id: string | null
          click_send_number: string | null
          contact_id: string | null
          content: string
          created_at: string
          direction: string
          follow_up_status: string
          id: string
          match_status: string
          matched_at: string | null
          matched_by_id: string | null
          phone_number: string
          pipeline_id: string | null
        }
        Insert: {
          ai_intent?: string | null
          ai_intent_confidence?: number | null
          campaign_id?: string | null
          click_send_number?: string | null
          contact_id?: string | null
          content: string
          created_at?: string
          direction: string
          follow_up_status?: string
          id?: string
          match_status?: string
          matched_at?: string | null
          matched_by_id?: string | null
          phone_number: string
          pipeline_id?: string | null
        }
        Update: {
          ai_intent?: string | null
          ai_intent_confidence?: number | null
          campaign_id?: string | null
          click_send_number?: string | null
          contact_id?: string | null
          content?: string
          created_at?: string
          direction?: string
          follow_up_status?: string
          id?: string
          match_status?: string
          matched_at?: string | null
          matched_by_id?: string | null
          phone_number?: string
          pipeline_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_matched_by_id_fkey"
            columns: ["matched_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_replies: {
        Row: {
          body: string | null
          contact_id: string | null
          created_at: string | null
          deal_id: string | null
          delivered_at: string | null
          direction: string | null
          error_message: string | null
          failed_at: string | null
          from_number: string | null
          id: string
          portal_user_id: string | null
          raw_payload: Json | null
          read: boolean | null
          received_at: string | null
          sent_at: string | null
          status: string | null
          to_number: string | null
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          delivered_at?: string | null
          direction?: string | null
          error_message?: string | null
          failed_at?: string | null
          from_number?: string | null
          id?: string
          portal_user_id?: string | null
          raw_payload?: Json | null
          read?: boolean | null
          received_at?: string | null
          sent_at?: string | null
          status?: string | null
          to_number?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          delivered_at?: string | null
          direction?: string | null
          error_message?: string | null
          failed_at?: string | null
          from_number?: string | null
          id?: string
          portal_user_id?: string | null
          raw_payload?: Json | null
          read?: boolean | null
          received_at?: string | null
          sent_at?: string | null
          status?: string | null
          to_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_replies_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_replies_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_replies_portal_user_id_fkey"
            columns: ["portal_user_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          color: string | null
          created_at: string | null
          display_order: number | null
          id: string
          name: string
          pipeline_id: string | null
          position: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
          pipeline_id?: string | null
          position?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
          pipeline_id?: string | null
          position?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          category: string | null
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_invites: {
        Row: {
          calendly_url: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string | null
          phone: string | null
          pipeline_ids: string[] | null
          role: string
          sport: string
          status: string
          title: string | null
          zoom_url: string | null
        }
        Insert: {
          calendly_url?: string | null
          created_at?: string
          email: string
          expires_at?: string
          full_name: string
          id?: string
          invited_by?: string | null
          phone?: string | null
          pipeline_ids?: string[] | null
          role?: string
          sport?: string
          status?: string
          title?: string | null
          zoom_url?: string | null
        }
        Update: {
          calendly_url?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          phone?: string | null
          pipeline_ids?: string[] | null
          role?: string
          sport?: string
          status?: string
          title?: string | null
          zoom_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      campaign_email_stats: {
        Row: {
          campaign_id: string | null
          click_rate: number | null
          click_to_open_rate: number | null
          open_rate: number | null
          total_bounced: number | null
          total_clicked: number | null
          total_complained: number | null
          total_delivered: number | null
          total_failed: number | null
          total_opened: number | null
          total_sent: number | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_reply_stops: {
        Row: {
          automation_id: string | null
          automation_name: string | null
          contact_id: string | null
          contact_name: string | null
          enrollment_id: string | null
          reply_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_enrollments_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_replies_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_campaign_email_stats: {
        Args: { p_campaign_id: string }
        Returns: {
          click_rate: number
          click_to_open_rate: number
          open_rate: number
          total_bounced: number
          total_clicked: number
          total_delivered: number
          total_failed: number
          total_opened: number
          total_sent: number
        }[]
      }
      check_automation_steps: {
        Args: { p_automation_name?: string }
        Returns: {
          automation_id: string
          automation_is_active: boolean
          automation_name: string
          delay_days: number
          delay_hours: number
          email_template_id: string
          step_id: string
          step_order: number
          step_type: string
          template_name: string
        }[]
      }
      check_email_logs: {
        Args: { p_deal_title?: string }
        Returns: {
          automation_name: string
          deal_title: string
          email_send_id: string
          email_status: string
          error_message: string
          log_id: string
          log_status: string
          log_type: string
          recipient_email: string
          resend_message_id: string
          sent_at: string
          step_type: string
        }[]
      }
      check_enrollment_status: {
        Args: { p_deal_title?: string }
        Returns: {
          automation_id: string
          automation_name: string
          current_step_id: string
          deal_id: string
          deal_title: string
          enrolled_at: string
          enrollment_id: string
          enrollment_status: string
          next_step_at: string
          step_order: number
          step_type: string
          stopped_reason: string
        }[]
      }
      debug_automation_matching: {
        Args: never
        Returns: {
          automation_id: string
          automation_is_active: boolean
          automation_name: string
          automation_pipeline_id: string
          automation_trigger_stage_id: string
          automation_trigger_stage_name: string
          automation_trigger_type: string
          deal_id: string
          deal_pipeline_id: string
          deal_pipeline_name: string
          deal_stage_id: string
          deal_stage_name: string
          deal_title: string
          is_enrolled: boolean
          pipeline_matches: boolean
          stage_matches: boolean
        }[]
      }
      get_next_round_robin_user_manual: {
        Args: { p_pipeline_key: string; p_user_ids: string[] }
        Returns: string
      }
      get_user_role: { Args: never; Returns: string }
      has_contact_replied_to_automation: {
        Args: { p_automation_id: string; p_contact_id: string }
        Returns: boolean
      }
      invoke_process_automations: { Args: never; Returns: Json }
      manually_enroll_deal_in_automation: {
        Args: { p_automation_id: string; p_deal_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
