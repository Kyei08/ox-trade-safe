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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      bids: {
        Row: {
          amount: number
          bidder_id: string
          created_at: string
          id: string
          is_winning: boolean | null
          listing_id: string
        }
        Insert: {
          amount: number
          bidder_id: string
          created_at?: string
          id?: string
          is_winning?: boolean | null
          listing_id: string
        }
        Update: {
          amount?: number
          bidder_id?: string
          created_at?: string
          id?: string
          is_winning?: boolean | null
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bids_bidder_id_fkey"
            columns: ["bidder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_bidder_id_fkey"
            columns: ["bidder_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          listing_count: number | null
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          listing_count?: number | null
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          listing_count?: number | null
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      category_condition_groups: {
        Row: {
          category_id: string
          created_at: string
          icon: string | null
          id: string
          is_multi_select: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          icon?: string | null
          id?: string
          is_multi_select?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_multi_select?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_condition_groups_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_condition_options: {
        Row: {
          created_at: string
          group_id: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "category_condition_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "category_condition_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          listing_id: string
          seller_id: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          listing_id: string
          seller_id: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_availability_history: {
        Row: {
          available: boolean
          changed_at: string
          id: string
          user_id: string
        }
        Insert: {
          available: boolean
          changed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          available?: boolean
          changed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_submissions: {
        Row: {
          additional_info: string | null
          created_at: string
          document_type: string
          document_url: string
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_info?: string | null
          created_at?: string
          document_type: string
          document_url: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_info?: string | null
          created_at?: string
          document_type?: string
          document_url?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      listing_conditions: {
        Row: {
          created_at: string
          listing_id: string
          option_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          option_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          option_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_conditions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_conditions_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "category_condition_options"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          auction_ends_at: string | null
          bid_count: number | null
          category_id: string | null
          condition: string | null
          created_at: string
          current_bid: number | null
          delivery_options: string[] | null
          description: string
          fixed_price: number | null
          id: string
          images: string[] | null
          listing_type: Database["public"]["Enums"]["listing_type"]
          location: string | null
          reserve_price: number | null
          seller_id: string
          starting_price: number | null
          status: Database["public"]["Enums"]["listing_status"]
          subcategory_id: string | null
          title: string
          updated_at: string
          view_count: number | null
        }
        Insert: {
          auction_ends_at?: string | null
          bid_count?: number | null
          category_id?: string | null
          condition?: string | null
          created_at?: string
          current_bid?: number | null
          delivery_options?: string[] | null
          description: string
          fixed_price?: number | null
          id?: string
          images?: string[] | null
          listing_type?: Database["public"]["Enums"]["listing_type"]
          location?: string | null
          reserve_price?: number | null
          seller_id: string
          starting_price?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          subcategory_id?: string | null
          title: string
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          auction_ends_at?: string | null
          bid_count?: number | null
          category_id?: string | null
          condition?: string | null
          created_at?: string
          current_bid?: number | null
          delivery_options?: string[] | null
          description?: string
          fixed_price?: number | null
          id?: string
          images?: string[] | null
          listing_type?: Database["public"]["Enums"]["listing_type"]
          location?: string | null
          reserve_price?: number | null
          seller_id?: string
          starting_price?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          subcategory_id?: string | null
          title?: string
          updated_at?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_booking_attempts: {
        Row: {
          courier_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          payload: Json | null
          reason: string
        }
        Insert: {
          courier_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          payload?: Json | null
          reason: string
        }
        Update: {
          courier_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          payload?: Json | null
          reason?: string
        }
        Relationships: []
      }
      logistics_bookings: {
        Row: {
          courier_id: string
          created_at: string
          customer_id: string
          dropoff_address: string
          id: string
          item_category: string | null
          notes: string | null
          pickup_address: string
          price_cents: number | null
          size: string | null
          status: string
          updated_at: string
          urgency: string | null
        }
        Insert: {
          courier_id: string
          created_at?: string
          customer_id: string
          dropoff_address: string
          id?: string
          item_category?: string | null
          notes?: string | null
          pickup_address: string
          price_cents?: number | null
          size?: string | null
          status?: string
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          courier_id?: string
          created_at?: string
          customer_id?: string
          dropoff_address?: string
          id?: string
          item_category?: string | null
          notes?: string | null
          pickup_address?: string
          price_cents?: number | null
          size?: string | null
          status?: string
          updated_at?: string
          urgency?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string
          delivery_option: string | null
          id: string
          invoice_number: string | null
          listing_id: string
          notes: string | null
          seller_id: string
          shipping_address: string | null
          status: Database["public"]["Enums"]["order_status"]
          stripe_session_id: string | null
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          buyer_id: string
          created_at?: string
          delivery_option?: string | null
          id?: string
          invoice_number?: string | null
          listing_id: string
          notes?: string | null
          seller_id: string
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_session_id?: string | null
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string
          delivery_option?: string | null
          id?: string
          invoice_number?: string | null
          listing_id?: string
          notes?: string | null
          seller_id?: string
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_session_id?: string | null
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_verified_at: string | null
          avatar_url: string | null
          bio: string | null
          courier_available: boolean
          courier_available_updated_at: string | null
          created_at: string
          dashboard_active_tab: string | null
          email: string
          facebook_url: string | null
          full_name: string | null
          id: string
          instagram_url: string | null
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          kyc_verified_at: string | null
          linkedin_url: string | null
          location: string | null
          phone: string | null
          phone_verified_at: string | null
          rating: number | null
          seller_type: Database["public"]["Enums"]["seller_type"] | null
          seller_verification_status: Database["public"]["Enums"]["seller_verification_status"]
          tiktok_url: string | null
          total_reviews: number | null
          twitter_url: string | null
          updated_at: string
          website_url: string | null
          whatsapp_number: string | null
          youtube_url: string | null
        }
        Insert: {
          address_verified_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          courier_available?: boolean
          courier_available_updated_at?: string | null
          created_at?: string
          dashboard_active_tab?: string | null
          email: string
          facebook_url?: string | null
          full_name?: string | null
          id: string
          instagram_url?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          kyc_verified_at?: string | null
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          rating?: number | null
          seller_type?: Database["public"]["Enums"]["seller_type"] | null
          seller_verification_status?: Database["public"]["Enums"]["seller_verification_status"]
          tiktok_url?: string | null
          total_reviews?: number | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
          whatsapp_number?: string | null
          youtube_url?: string | null
        }
        Update: {
          address_verified_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          courier_available?: boolean
          courier_available_updated_at?: string | null
          created_at?: string
          dashboard_active_tab?: string | null
          email?: string
          facebook_url?: string | null
          full_name?: string | null
          id?: string
          instagram_url?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          kyc_verified_at?: string | null
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          rating?: number | null
          seller_type?: Database["public"]["Enums"]["seller_type"] | null
          seller_verification_status?: Database["public"]["Enums"]["seller_verification_status"]
          tiktok_url?: string | null
          total_reviews?: number | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
          whatsapp_number?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string | null
          id: string
          reason: string
          report_type: Database["public"]["Enums"]["report_type"]
          reported_listing_id: string | null
          reported_user_id: string | null
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          report_type: Database["public"]["Enums"]["report_type"]
          reported_listing_id?: string | null
          reported_user_id?: string | null
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          report_type?: Database["public"]["Enums"]["report_type"]
          reported_listing_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_listing_id_fkey"
            columns: ["reported_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          listing_id: string
          rating: number
          reviewed_user_id: string
          reviewer_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          listing_id: string
          rating: number
          reviewed_user_id: string
          reviewer_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          rating?: number
          reviewed_user_id?: string
          reviewer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_verification_audit_log: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          requested_documents: string[] | null
          review_notes: string | null
          snapshot: Json | null
          status_from:
            | Database["public"]["Enums"]["seller_verification_status"]
            | null
          status_to:
            | Database["public"]["Enums"]["seller_verification_status"]
            | null
          user_id: string
          verification_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          requested_documents?: string[] | null
          review_notes?: string | null
          snapshot?: Json | null
          status_from?:
            | Database["public"]["Enums"]["seller_verification_status"]
            | null
          status_to?:
            | Database["public"]["Enums"]["seller_verification_status"]
            | null
          user_id: string
          verification_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          requested_documents?: string[] | null
          review_notes?: string | null
          snapshot?: Json | null
          status_from?:
            | Database["public"]["Enums"]["seller_verification_status"]
            | null
          status_to?:
            | Database["public"]["Enums"]["seller_verification_status"]
            | null
          user_id?: string
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_verification_audit_log_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "seller_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_verification_documents: {
        Row: {
          content_type: string | null
          created_at: string
          field_key: string
          file_size: number | null
          id: string
          is_current: boolean
          storage_path: string
          user_id: string
          verification_id: string
          version: number
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          field_key: string
          file_size?: number | null
          id?: string
          is_current?: boolean
          storage_path: string
          user_id: string
          verification_id: string
          version?: number
        }
        Update: {
          content_type?: string | null
          created_at?: string
          field_key?: string
          file_size?: number | null
          id?: string
          is_current?: boolean
          storage_path?: string
          user_id?: string
          verification_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "seller_verification_documents_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "seller_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_verifications: {
        Row: {
          business_address: string | null
          cipc_document_path: string | null
          company_name: string | null
          created_at: string
          full_name: string | null
          id: string
          id_document_path: string | null
          phone: string | null
          physical_address: string | null
          proof_of_business_address_path: string | null
          proof_of_business_banking_path: string | null
          proof_of_residence_path: string | null
          registration_number: string | null
          representative_id_path: string | null
          representative_name: string | null
          requested_documents: string[] | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_path: string | null
          seller_type: Database["public"]["Enums"]["seller_type"]
          status: Database["public"]["Enums"]["seller_verification_status"]
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          business_address?: string | null
          cipc_document_path?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          id_document_path?: string | null
          phone?: string | null
          physical_address?: string | null
          proof_of_business_address_path?: string | null
          proof_of_business_banking_path?: string | null
          proof_of_residence_path?: string | null
          registration_number?: string | null
          representative_id_path?: string | null
          representative_name?: string | null
          requested_documents?: string[] | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string | null
          seller_type: Database["public"]["Enums"]["seller_type"]
          status?: Database["public"]["Enums"]["seller_verification_status"]
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          business_address?: string | null
          cipc_document_path?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          id_document_path?: string | null
          phone?: string | null
          physical_address?: string | null
          proof_of_business_address_path?: string | null
          proof_of_business_banking_path?: string | null
          proof_of_residence_path?: string | null
          registration_number?: string | null
          representative_id_path?: string | null
          representative_name?: string | null
          requested_documents?: string[] | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string | null
          seller_type?: Database["public"]["Enums"]["seller_type"]
          status?: Database["public"]["Enums"]["seller_verification_status"]
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          address_verified_at: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          facebook_url: string | null
          full_name: string | null
          id: string | null
          instagram_url: string | null
          kyc_status: Database["public"]["Enums"]["kyc_status"] | null
          linkedin_url: string | null
          phone_verified_at: string | null
          rating: number | null
          seller_type: Database["public"]["Enums"]["seller_type"] | null
          seller_verification_status:
            | Database["public"]["Enums"]["seller_verification_status"]
            | null
          tiktok_url: string | null
          total_reviews: number | null
          twitter_url: string | null
          website_url: string | null
          whatsapp_number: string | null
          youtube_url: string | null
        }
        Insert: {
          address_verified_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          facebook_url?: string | null
          full_name?: string | null
          id?: string | null
          instagram_url?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"] | null
          linkedin_url?: string | null
          phone_verified_at?: string | null
          rating?: number | null
          seller_type?: Database["public"]["Enums"]["seller_type"] | null
          seller_verification_status?:
            | Database["public"]["Enums"]["seller_verification_status"]
            | null
          tiktok_url?: string | null
          total_reviews?: number | null
          twitter_url?: string | null
          website_url?: string | null
          whatsapp_number?: string | null
          youtube_url?: string | null
        }
        Update: {
          address_verified_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          facebook_url?: string | null
          full_name?: string | null
          id?: string | null
          instagram_url?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"] | null
          linkedin_url?: string | null
          phone_verified_at?: string | null
          rating?: number | null
          seller_type?: Database["public"]["Enums"]["seller_type"] | null
          seller_verification_status?:
            | Database["public"]["Enums"]["seller_verification_status"]
            | null
          tiktok_url?: string | null
          total_reviews?: number | null
          twitter_url?: string | null
          website_url?: string | null
          whatsapp_number?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      dblink: { Args: { "": string }; Returns: Record<string, unknown>[] }
      dblink_cancel_query: { Args: { "": string }; Returns: string }
      dblink_close: { Args: { "": string }; Returns: string }
      dblink_connect: { Args: { "": string }; Returns: string }
      dblink_connect_u: { Args: { "": string }; Returns: string }
      dblink_current_query: { Args: never; Returns: string }
      dblink_disconnect:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      dblink_error_message: { Args: { "": string }; Returns: string }
      dblink_exec: { Args: { "": string }; Returns: string }
      dblink_fdw_validator: {
        Args: { catalog: unknown; options: string[] }
        Returns: undefined
      }
      dblink_get_connections: { Args: never; Returns: string[] }
      dblink_get_notify:
        | { Args: { conname: string }; Returns: Record<string, unknown>[] }
        | { Args: never; Returns: Record<string, unknown>[] }
      dblink_get_pkey: {
        Args: { "": string }
        Returns: Database["public"]["CompositeTypes"]["dblink_pkey_results"][]
        SetofOptions: {
          from: "*"
          to: "dblink_pkey_results"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      dblink_get_result: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      dblink_is_busy: { Args: { "": string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_failed_booking_attempt: {
        Args: {
          _courier_id: string
          _customer_id: string
          _payload: Json
          _reason: string
        }
        Returns: undefined
      }
      slugify: { Args: { _input: string }; Returns: string }
    }
    Enums: {
      app_role: "user" | "verified_seller" | "admin" | "courier"
      kyc_status: "pending" | "verified" | "rejected"
      listing_status: "draft" | "active" | "sold" | "expired" | "removed"
      listing_type: "auction" | "fixed_price"
      order_status:
        | "pending"
        | "paid"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded"
      report_status: "pending" | "reviewed" | "resolved" | "dismissed"
      report_type: "listing" | "user"
      seller_type: "individual" | "business"
      seller_verification_status:
        | "not_started"
        | "pending_review"
        | "approved"
        | "rejected"
        | "requires_more_info"
    }
    CompositeTypes: {
      dblink_pkey_results: {
        position: number | null
        colname: string | null
      }
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
      app_role: ["user", "verified_seller", "admin", "courier"],
      kyc_status: ["pending", "verified", "rejected"],
      listing_status: ["draft", "active", "sold", "expired", "removed"],
      listing_type: ["auction", "fixed_price"],
      order_status: [
        "pending",
        "paid",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
      ],
      report_status: ["pending", "reviewed", "resolved", "dismissed"],
      report_type: ["listing", "user"],
      seller_type: ["individual", "business"],
      seller_verification_status: [
        "not_started",
        "pending_review",
        "approved",
        "rejected",
        "requires_more_info",
      ],
    },
  },
} as const
