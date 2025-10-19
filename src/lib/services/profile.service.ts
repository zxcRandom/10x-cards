import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";
import type { DbProfile, ProfileDTO } from "@/types";

/**
 * Type for Supabase client with proper typing
 */
type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Maps DbProfile (snake_case from database) to ProfileDTO (camelCase for API)
 * @param dbProfile - Database row from profiles table
 * @returns ProfileDTO with camelCase fields
 */
function mapProfileToDTO(dbProfile: DbProfile): ProfileDTO {
  return {
    id: dbProfile.id,
    privacyConsent: dbProfile.privacy_consent,
    deletedAt: dbProfile.deleted_at,
    createdAt: dbProfile.created_at,
    updatedAt: dbProfile.updated_at,
  };
}

/**
 * ProfileService
 * Handles all business logic related to user profiles
 */
export const ProfileService = {
  /**
   * Retrieves a user profile from the database
   * @param userId - User UUID from JWT token
   * @param supabase - Supabase client instance tied to the request
   * @returns ProfileDTO or null if profile doesn't exist
   * @throws Error if database error occurs (other than not found)
   */
  async getProfile(userId: string, supabase: TypedSupabaseClient): Promise<ProfileDTO | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, privacy_consent, deleted_at, created_at, updated_at")
      .eq("id", userId)
      .single();

    if (error) {
      // PGRST116 = no rows found - return null instead of throwing
      if (error.code === "PGRST116") {
        return null;
      }
      // Other database errors - throw exception
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return mapProfileToDTO(data);
  },
} as const;
