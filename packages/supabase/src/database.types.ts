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
      announcements: {
        Row: {
          club_id: string
          content: string
          created_at: string
          created_by: string
          id: string
          priority: string
          published_at: string | null
          target_tier_ids: string[] | null
          title: string
        }
        Insert: {
          club_id: string
          content: string
          created_at?: string
          created_by: string
          id?: string
          priority?: string
          published_at?: string | null
          target_tier_ids?: string[] | null
          title: string
        }
        Update: {
          club_id?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          priority?: string
          published_at?: string | null
          target_tier_ids?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_members: {
        Row: {
          amount: number
          assessment_id: string
          created_at: string
          id: string
          member_id: string
          paid_amount: number
          status: string
          updated_at: string
          waiver_reason: string | null
        }
        Insert: {
          amount: number
          assessment_id: string
          created_at?: string
          id?: string
          member_id: string
          paid_amount?: number
          status?: string
          updated_at?: string
          waiver_reason?: string | null
        }
        Update: {
          amount?: number
          assessment_id?: string
          created_at?: string
          id?: string
          member_id?: string
          paid_amount?: number
          status?: string
          updated_at?: string
          waiver_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_members_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          allow_installments: boolean
          amount: number
          club_id: string
          created_at: string
          created_by: string
          description: string | null
          due_date: string
          id: string
          installment_amount: number | null
          installment_count: number | null
          invoices_generated: boolean
          name: string
          status: string
          target_all_members: boolean
          target_member_ids: string[] | null
          target_tier_ids: string[] | null
          total_assessed: number
          total_collected: number
          type: string
          updated_at: string
        }
        Insert: {
          allow_installments?: boolean
          amount: number
          club_id: string
          created_at?: string
          created_by: string
          description?: string | null
          due_date: string
          id?: string
          installment_amount?: number | null
          installment_count?: number | null
          invoices_generated?: boolean
          name: string
          status?: string
          target_all_members?: boolean
          target_member_ids?: string[] | null
          target_tier_ids?: string[] | null
          total_assessed?: number
          total_collected?: number
          type: string
          updated_at?: string
        }
        Update: {
          allow_installments?: boolean
          amount?: number
          club_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string
          id?: string
          installment_amount?: number | null
          installment_count?: number | null
          invoices_generated?: boolean
          name?: string
          status?: string
          target_all_members?: boolean
          target_member_ids?: string[] | null
          target_tier_ids?: string[] | null
          total_assessed?: number
          total_collected?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_credits: {
        Row: {
          amount: number
          applied_to_invoice_id: string | null
          club_id: string
          created_at: string
          created_by: string
          id: string
          member_id: string
          reason: string
        }
        Insert: {
          amount: number
          applied_to_invoice_id?: string | null
          club_id: string
          created_at?: string
          created_by: string
          id?: string
          member_id: string
          reason: string
        }
        Update: {
          amount?: number
          applied_to_invoice_id?: string | null
          club_id?: string
          created_at?: string
          created_by?: string
          id?: string
          member_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_credits_applied_to_invoice_id_fkey"
            columns: ["applied_to_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_credits_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_credits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_credits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_cycles: {
        Row: {
          club_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          invoices_created: number
          period_end: string
          period_start: string
          run_by: string
          status: string
          total_amount: number
          type: string
        }
        Insert: {
          club_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          invoices_created?: number
          period_end: string
          period_start: string
          run_by: string
          status?: string
          total_amount?: number
          type: string
        }
        Update: {
          club_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          invoices_created?: number
          period_end?: string
          period_start?: string
          run_by?: string
          status?: string
          total_amount?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_cycles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_cycles_run_by_fkey"
            columns: ["run_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_slots: {
        Row: {
          day_of_week: number
          end_time: string
          facility_id: string
          id: string
          is_active: boolean
          max_bookings: number
          start_time: string
        }
        Insert: {
          day_of_week: number
          end_time: string
          facility_id: string
          id?: string
          is_active?: boolean
          max_bookings?: number
          start_time: string
        }
        Update: {
          day_of_week?: number
          end_time?: string
          facility_id?: string
          id?: string
          is_active?: boolean
          max_bookings?: number
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_slots_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_waitlist: {
        Row: {
          club_id: string
          created_at: string
          date: string
          end_time: string
          facility_id: string
          id: string
          member_id: string
          notified_at: string | null
          party_size: number
          position: number
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          date: string
          end_time: string
          facility_id: string
          id?: string
          member_id: string
          notified_at?: string | null
          party_size?: number
          position?: number
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          date?: string
          end_time?: string
          facility_id?: string
          id?: string
          member_id?: string
          notified_at?: string | null
          party_size?: number
          position?: number
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_waitlist_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_waitlist_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_waitlist_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          club_id: string
          created_at: string
          date: string
          end_time: string
          facility_id: string
          id: string
          member_id: string
          notes: string | null
          party_size: number
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          date: string
          end_time: string
          facility_id: string
          id?: string
          member_id: string
          notes?: string | null
          party_size?: number
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          date?: string
          end_time?: string
          facility_id?: string
          id?: string
          member_id?: string
          notes?: string | null
          party_size?: number
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      card_templates: {
        Row: {
          apple_background_color: string | null
          apple_foreground_color: string | null
          apple_label_color: string | null
          club_id: string
          created_at: string
          description: string | null
          google_hex_background: string | null
          google_logo_url: string | null
          hero_image_url: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          metadata: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          apple_background_color?: string | null
          apple_foreground_color?: string | null
          apple_label_color?: string | null
          club_id: string
          created_at?: string
          description?: string | null
          google_hex_background?: string | null
          google_logo_url?: string | null
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          metadata?: Json | null
          name?: string
          updated_at?: string
        }
        Update: {
          apple_background_color?: string | null
          apple_foreground_color?: string | null
          apple_label_color?: string | null
          club_id?: string
          created_at?: string
          description?: string | null
          google_hex_background?: string | null
          google_logo_url?: string | null
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          metadata?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_templates_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          club_id: string
          created_at: string
          id: string
          member_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          member_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          member_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          slug: string
          stripe_account_id: string | null
          timezone: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          slug: string
          stripe_account_id?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          slug?: string
          stripe_account_id?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      digital_passes: {
        Row: {
          barcode_payload: string
          club_id: string
          created_at: string
          device_library_id: string | null
          id: string
          installed_at: string | null
          last_updated_tag: string | null
          member_id: string
          metadata: Json | null
          pass_serial: string
          pass_type_id: string | null
          platform: string
          push_token: string | null
          status: string
          updated_at: string
        }
        Insert: {
          barcode_payload: string
          club_id: string
          created_at?: string
          device_library_id?: string | null
          id?: string
          installed_at?: string | null
          last_updated_tag?: string | null
          member_id: string
          metadata?: Json | null
          pass_serial: string
          pass_type_id?: string | null
          platform: string
          push_token?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          barcode_payload?: string
          club_id?: string
          created_at?: string
          device_library_id?: string | null
          id?: string
          installed_at?: string | null
          last_updated_tag?: string | null
          member_id?: string
          metadata?: Json | null
          pass_serial?: string
          pass_type_id?: string | null
          platform?: string
          push_token?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_passes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_passes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      dining_order_items: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string
          name: string
          order_id: string
          price: number
          quantity: number
          special_instructions: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id: string
          name: string
          order_id: string
          price: number
          quantity?: number
          special_instructions?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string
          name?: string
          order_id?: string
          price?: number
          quantity?: number
          special_instructions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dining_order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dining_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "dining_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      dining_orders: {
        Row: {
          booking_id: string | null
          club_id: string
          created_at: string
          facility_id: string
          id: string
          invoice_id: string | null
          member_id: string
          notes: string | null
          status: string
          subtotal: number
          table_number: string | null
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          club_id: string
          created_at?: string
          facility_id: string
          id?: string
          invoice_id?: string | null
          member_id: string
          notes?: string | null
          status?: string
          subtotal?: number
          table_number?: string | null
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          club_id?: string
          created_at?: string
          facility_id?: string
          id?: string
          invoice_id?: string | null
          member_id?: string
          notes?: string | null
          status?: string
          subtotal?: number
          table_number?: string | null
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dining_orders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dining_orders_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dining_orders_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dining_orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dining_orders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          guest_count: number
          id: string
          member_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          guest_count?: number
          id?: string
          member_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          guest_count?: number
          id?: string
          member_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number | null
          club_id: string
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          image_url: string | null
          location: string | null
          price: number | null
          start_date: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          club_id: string
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          price?: number | null
          start_date: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          club_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          price?: number | null
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      export_batches: {
        Row: {
          club_id: string
          created_at: string
          date_from: string
          date_to: string
          entry_count: number
          error_message: string | null
          exported_by: string
          file_url: string | null
          format: string
          id: string
          provider: string
          status: string
          total_credits: number
          total_debits: number
        }
        Insert: {
          club_id: string
          created_at?: string
          date_from: string
          date_to: string
          entry_count?: number
          error_message?: string | null
          exported_by: string
          file_url?: string | null
          format: string
          id?: string
          provider: string
          status?: string
          total_credits?: number
          total_debits?: number
        }
        Update: {
          club_id?: string
          created_at?: string
          date_from?: string
          date_to?: string
          entry_count?: number
          error_message?: string | null
          exported_by?: string
          file_url?: string | null
          format?: string
          id?: string
          provider?: string
          status?: string
          total_credits?: number
          total_debits?: number
        }
        Relationships: [
          {
            foreignKeyName: "export_batches_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_batches_exported_by_fkey"
            columns: ["exported_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          capacity: number | null
          club_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          type: string
        }
        Insert: {
          capacity?: number | null
          club_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          type: string
        }
        Update: {
          capacity?: number | null
          club_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "facilities_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          billing_consolidated: boolean
          billing_email: string | null
          club_id: string
          created_at: string
          id: string
          name: string
          primary_member_id: string | null
        }
        Insert: {
          billing_consolidated?: boolean
          billing_email?: string | null
          club_id: string
          created_at?: string
          id?: string
          name: string
          primary_member_id?: string | null
        }
        Update: {
          billing_consolidated?: boolean
          billing_email?: string | null
          club_id?: string
          created_at?: string
          id?: string
          name?: string
          primary_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "families_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_families_primary_member"
            columns: ["primary_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_accounts: {
        Row: {
          account_number: string
          club_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          type: string
        }
        Insert: {
          account_number: string
          club_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          type: string
        }
        Update: {
          account_number?: string
          club_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "gl_accounts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_mappings: {
        Row: {
          club_id: string
          created_at: string
          description: string | null
          gl_account_id: string
          id: string
          source_category: string
        }
        Insert: {
          club_id: string
          created_at?: string
          description?: string | null
          gl_account_id: string
          id?: string
          source_category: string
        }
        Update: {
          club_id?: string
          created_at?: string
          description?: string | null
          gl_account_id?: string
          id?: string
          source_category?: string
        }
        Relationships: [
          {
            foreignKeyName: "gl_mappings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_mappings_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      golf_rates: {
        Row: {
          cart_fee: number
          club_id: string
          created_at: string
          day_type: Database["public"]["Enums"]["golf_day_type"]
          facility_id: string
          guest_price: number
          holes: Database["public"]["Enums"]["golf_holes"]
          id: string
          is_active: boolean
          member_price: number
          name: string
          time_type: Database["public"]["Enums"]["golf_time_type"]
          updated_at: string
        }
        Insert: {
          cart_fee?: number
          club_id: string
          created_at?: string
          day_type?: Database["public"]["Enums"]["golf_day_type"]
          facility_id: string
          guest_price?: number
          holes?: Database["public"]["Enums"]["golf_holes"]
          id?: string
          is_active?: boolean
          member_price?: number
          name: string
          time_type?: Database["public"]["Enums"]["golf_time_type"]
          updated_at?: string
        }
        Update: {
          cart_fee?: number
          club_id?: string
          created_at?: string
          day_type?: Database["public"]["Enums"]["golf_day_type"]
          facility_id?: string
          guest_price?: number
          holes?: Database["public"]["Enums"]["golf_holes"]
          id?: string
          is_active?: boolean
          member_price?: number
          name?: string
          time_type?: Database["public"]["Enums"]["golf_time_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "golf_rates_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "golf_rates_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_fee_schedules: {
        Row: {
          club_id: string
          created_at: string
          facility_type: string
          guest_fee: number
          id: string
          is_active: boolean
          tier_id: string | null
          weekend_surcharge: number
        }
        Insert: {
          club_id: string
          created_at?: string
          facility_type: string
          guest_fee?: number
          id?: string
          is_active?: boolean
          tier_id?: string | null
          weekend_surcharge?: number
        }
        Update: {
          club_id?: string
          created_at?: string
          facility_type?: string
          guest_fee?: number
          id?: string
          is_active?: boolean
          tier_id?: string | null
          weekend_surcharge?: number
        }
        Relationships: [
          {
            foreignKeyName: "guest_fee_schedules_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_fee_schedules_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "membership_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_policies: {
        Row: {
          advance_registration_required: boolean
          blackout_days: number[] | null
          club_id: string
          created_at: string
          facility_type: string | null
          guest_fee: number
          id: string
          is_active: boolean
          max_guest_visits_per_month: number | null
          max_guests_per_visit: number
          max_same_guest_per_month: number | null
          name: string
          notes: string | null
          require_member_present: boolean
          updated_at: string
        }
        Insert: {
          advance_registration_required?: boolean
          blackout_days?: number[] | null
          club_id: string
          created_at?: string
          facility_type?: string | null
          guest_fee?: number
          id?: string
          is_active?: boolean
          max_guest_visits_per_month?: number | null
          max_guests_per_visit?: number
          max_same_guest_per_month?: number | null
          name: string
          notes?: string | null
          require_member_present?: boolean
          updated_at?: string
        }
        Update: {
          advance_registration_required?: boolean
          blackout_days?: number[] | null
          club_id?: string
          created_at?: string
          facility_type?: string | null
          guest_fee?: number
          id?: string
          is_active?: boolean
          max_guest_visits_per_month?: number | null
          max_guests_per_visit?: number
          max_same_guest_per_month?: number | null
          name?: string
          notes?: string | null
          require_member_present?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_policies_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_visits: {
        Row: {
          booking_id: string | null
          check_in_time: string | null
          check_out_time: string | null
          club_id: string
          created_at: string
          facility_type: string | null
          fee_invoiced: boolean
          guest_fee: number
          guest_id: string
          host_member_id: string
          id: string
          invoice_id: string | null
          notes: string | null
          status: string
          updated_at: string
          visit_date: string
        }
        Insert: {
          booking_id?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          club_id: string
          created_at?: string
          facility_type?: string | null
          fee_invoiced?: boolean
          guest_fee?: number
          guest_id: string
          host_member_id: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          visit_date?: string
        }
        Update: {
          booking_id?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          club_id?: string
          created_at?: string
          facility_type?: string | null
          fee_invoiced?: boolean
          guest_fee?: number
          guest_id?: string
          host_member_id?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_visits_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_visits_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_visits_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_visits_host_member_id_fkey"
            columns: ["host_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_visits_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          block_reason: string | null
          club_id: string
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_blocked: boolean
          last_name: string
          last_visit_date: string | null
          notes: string | null
          phone: string | null
          total_visits: number
          updated_at: string
        }
        Insert: {
          block_reason?: string | null
          club_id: string
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_blocked?: boolean
          last_name: string
          last_visit_date?: string | null
          notes?: string | null
          phone?: string | null
          total_visits?: number
          updated_at?: string
        }
        Update: {
          block_reason?: string | null
          club_id?: string
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_blocked?: boolean
          last_name?: string
          last_visit_date?: string | null
          notes?: string | null
          phone?: string | null
          total_visits?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          club_id: string
          completed_at: string | null
          created_at: string
          entity_type: string
          error_rows: number
          errors: Json
          field_mapping: Json
          file_name: string
          id: string
          imported_by: string
          imported_rows: number
          skipped_rows: number
          source_system: string
          status: string
          total_rows: number
          valid_rows: number
        }
        Insert: {
          club_id: string
          completed_at?: string | null
          created_at?: string
          entity_type: string
          error_rows?: number
          errors?: Json
          field_mapping?: Json
          file_name: string
          id?: string
          imported_by: string
          imported_rows?: number
          skipped_rows?: number
          source_system: string
          status?: string
          total_rows?: number
          valid_rows?: number
        }
        Update: {
          club_id?: string
          completed_at?: string | null
          created_at?: string
          entity_type?: string
          error_rows?: number
          errors?: Json
          field_mapping?: Json
          file_name?: string
          id?: string
          imported_by?: string
          imported_rows?: number
          skipped_rows?: number
          source_system?: string
          status?: string
          total_rows?: number
          valid_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          club_id: string
          created_at: string
          description: string
          due_date: string
          id: string
          member_id: string
          paid_at: string | null
          status: string
          stripe_invoice_id: string | null
        }
        Insert: {
          amount: number
          club_id: string
          created_at?: string
          description: string
          due_date: string
          id?: string
          member_id: string
          paid_at?: string | null
          status?: string
          stripe_invoice_id?: string | null
        }
        Update: {
          amount?: number
          club_id?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          member_id?: string
          paid_at?: string | null
          status?: string
          stripe_invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          amount: number
          club_id: string
          created_at: string
          credit_account_id: string
          date: string
          debit_account_id: string
          description: string
          export_batch_id: string | null
          id: string
          member_id: string | null
          reference: string | null
          source: string
          source_id: string
        }
        Insert: {
          amount: number
          club_id: string
          created_at?: string
          credit_account_id: string
          date: string
          debit_account_id: string
          description: string
          export_batch_id?: string | null
          id?: string
          member_id?: string | null
          reference?: string | null
          source: string
          source_id: string
        }
        Update: {
          amount?: number
          club_id?: string
          created_at?: string
          credit_account_id?: string
          date?: string
          debit_account_id?: string
          description?: string
          export_batch_id?: string | null
          id?: string
          member_id?: string | null
          reference?: string | null
          source?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_credit_account_id_fkey"
            columns: ["credit_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_debit_account_id_fkey"
            columns: ["debit_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_export_batch_id_fkey"
            columns: ["export_batch_id"]
            isOneToOne: false
            referencedRelation: "export_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          avatar_url: string | null
          club_id: string
          created_at: string
          email: string
          family_id: string | null
          first_name: string
          id: string
          invite_accepted_at: string | null
          invite_expires_at: string | null
          invite_sent_at: string | null
          invite_token: string | null
          join_date: string
          last_name: string
          member_number: string | null
          membership_tier_id: string | null
          notes: string | null
          phone: string | null
          push_token: string | null
          role: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          club_id: string
          created_at?: string
          email: string
          family_id?: string | null
          first_name: string
          id?: string
          invite_accepted_at?: string | null
          invite_expires_at?: string | null
          invite_sent_at?: string | null
          invite_token?: string | null
          join_date?: string
          last_name: string
          member_number?: string | null
          membership_tier_id?: string | null
          notes?: string | null
          phone?: string | null
          push_token?: string | null
          role?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          club_id?: string
          created_at?: string
          email?: string
          family_id?: string | null
          first_name?: string
          id?: string
          invite_accepted_at?: string | null
          invite_expires_at?: string | null
          invite_sent_at?: string | null
          invite_token?: string | null
          join_date?: string
          last_name?: string
          member_number?: string | null
          membership_tier_id?: string | null
          notes?: string | null
          phone?: string | null
          push_token?: string | null
          role?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_membership_tier_id_fkey"
            columns: ["membership_tier_id"]
            isOneToOne: false
            referencedRelation: "membership_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_tiers: {
        Row: {
          annual_dues: number | null
          benefits: Json
          club_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          level: string
          monthly_dues: number
          name: string
          stripe_price_id: string | null
          stripe_product_id: string | null
        }
        Insert: {
          annual_dues?: number | null
          benefits?: Json
          club_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          level: string
          monthly_dues?: number
          name: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
        }
        Update: {
          annual_dues?: number | null
          benefits?: Json
          club_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          level?: string
          monthly_dues?: number
          name?: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_tiers_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          club_id: string
          created_at: string
          description: string | null
          facility_id: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          club_id: string
          created_at?: string
          description?: string | null
          facility_id: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          club_id?: string
          created_at?: string
          description?: string | null
          facility_id?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string
          club_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id: string
          club_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          club_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      nfc_tap_log: {
        Row: {
          club_id: string
          created_at: string
          device_id: string | null
          facility_id: string | null
          id: string
          latitude: number | null
          location: string | null
          longitude: number | null
          member_id: string
          tap_type: string
          verified: boolean
        }
        Insert: {
          club_id: string
          created_at?: string
          device_id?: string | null
          facility_id?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          member_id: string
          tap_type?: string
          verified?: boolean
        }
        Update: {
          club_id?: string
          created_at?: string
          device_id?: string | null
          facility_id?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          member_id?: string
          tap_type?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "nfc_tap_log_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfc_tap_log_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfc_tap_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          body: string
          category: string
          channel: string
          club_id: string
          created_at: string
          data: Json | null
          error_message: string | null
          expo_receipt_id: string | null
          id: string
          member_id: string | null
          sent_at: string | null
          status: string
          title: string
        }
        Insert: {
          body: string
          category: string
          channel?: string
          club_id: string
          created_at?: string
          data?: Json | null
          error_message?: string | null
          expo_receipt_id?: string | null
          id?: string
          member_id?: string | null
          sent_at?: string | null
          status?: string
          title: string
        }
        Update: {
          body?: string
          category?: string
          channel?: string
          club_id?: string
          created_at?: string
          data?: Json | null
          error_message?: string | null
          expo_receipt_id?: string | null
          id?: string
          member_id?: string | null
          sent_at?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          category: string
          created_at: string
          email_enabled: boolean
          id: string
          member_id: string
          push_enabled: boolean
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          email_enabled?: boolean
          id?: string
          member_id: string
          push_enabled?: boolean
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          email_enabled?: boolean
          id?: string
          member_id?: string
          push_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body_template: string
          category: string
          club_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          title_template: string
        }
        Insert: {
          body_template: string
          category: string
          club_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          title_template: string
        }
        Update: {
          body_template?: string
          category?: string
          club_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          title_template?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          club_id: string
          created_at: string
          description: string | null
          id: string
          invoice_id: string | null
          member_id: string
          method: string
          stripe_payment_id: string | null
        }
        Insert: {
          amount: number
          club_id: string
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          member_id: string
          method?: string
          stripe_payment_id?: string | null
        }
        Update: {
          amount?: number
          club_id?: string
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          member_id?: string
          method?: string
          stripe_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
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
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_configs: {
        Row: {
          club_id: string
          config: Json
          created_at: string
          id: string
          is_active: boolean
          location: string
          name: string
          provider: string
          updated_at: string
        }
        Insert: {
          club_id: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          location: string
          name: string
          provider: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string
          name?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_configs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transaction_items: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          quantity: number
          sku: string | null
          total: number
          transaction_id: string
          unit_price: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          quantity?: number
          sku?: string | null
          total?: number
          transaction_id: string
          unit_price?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          quantity?: number
          sku?: string | null
          total?: number
          transaction_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "pos_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transactions: {
        Row: {
          club_id: string
          created_at: string
          description: string | null
          external_id: string | null
          id: string
          invoice_id: string | null
          location: string
          member_id: string | null
          metadata: Json | null
          payment_method: string | null
          pos_config_id: string
          status: string
          subtotal: number
          tax: number
          tip: number
          total: number
          type: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          invoice_id?: string | null
          location: string
          member_id?: string | null
          metadata?: Json | null
          payment_method?: string | null
          pos_config_id: string
          status?: string
          subtotal?: number
          tax?: number
          tip?: number
          total?: number
          type?: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          invoice_id?: string | null
          location?: string
          member_id?: string | null
          metadata?: Json | null
          payment_method?: string | null
          pos_config_id?: string
          status?: string
          subtotal?: number
          tax?: number
          tip?: number
          total?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_transactions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_pos_config_id_fkey"
            columns: ["pos_config_id"]
            isOneToOne: false
            referencedRelation: "pos_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      spending_minimums: {
        Row: {
          amount: number
          category: string
          club_id: string
          created_at: string
          enforce_shortfall: boolean
          id: string
          is_active: boolean
          name: string
          period: string
          shortfall_description: string | null
          tier_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          club_id: string
          created_at?: string
          enforce_shortfall?: boolean
          id?: string
          is_active?: boolean
          name: string
          period?: string
          shortfall_description?: string | null
          tier_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          club_id?: string
          created_at?: string
          enforce_shortfall?: boolean
          id?: string
          is_active?: boolean
          name?: string
          period?: string
          shortfall_description?: string | null
          tier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spending_minimums_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spending_minimums_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "membership_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      spending_tracking: {
        Row: {
          amount_required: number
          amount_spent: number
          club_id: string
          created_at: string
          id: string
          invoice_id: string | null
          member_id: string
          minimum_id: string
          period_end: string
          period_start: string
          shortfall: number
          shortfall_invoiced: boolean
          updated_at: string
        }
        Insert: {
          amount_required: number
          amount_spent?: number
          club_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          member_id: string
          minimum_id: string
          period_end: string
          period_start: string
          shortfall?: number
          shortfall_invoiced?: boolean
          updated_at?: string
        }
        Update: {
          amount_required?: number
          amount_spent?: number
          club_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          member_id?: string
          minimum_id?: string
          period_end?: string
          period_start?: string
          shortfall?: number
          shortfall_invoiced?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spending_tracking_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spending_tracking_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spending_tracking_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spending_tracking_minimum_id_fkey"
            columns: ["minimum_id"]
            isOneToOne: false
            referencedRelation: "spending_minimums"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_member_club_id: { Args: never; Returns: string }
      is_club_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      golf_day_type: "weekday" | "weekend"
      golf_holes: "9" | "18"
      golf_time_type: "prime" | "afternoon" | "twilight"
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
      golf_day_type: ["weekday", "weekend"],
      golf_holes: ["9", "18"],
      golf_time_type: ["prime", "afternoon", "twilight"],
    },
  },
} as const
