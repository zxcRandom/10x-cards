import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";
import type { DbProfile, ProfileDTO, ProfileDeletedDTO, UpdateProfileCommand } from "@/types";

/**
 * Type for Supabase client with proper typing
 */
type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Custom error class for conflict scenarios (409)
 * Example: Trying to restore a profile that is already active
 */
export class ConflictError extends Error {
  constructor(
    message: string,
    public details?: string
  ) {
    super(message);
    this.name = "ConflictError";
  }
}

/**
 * Custom error class for unprocessable entity scenarios (422)
 * Example: Trying to update privacy consent on a deleted profile without restoring it
 */
export class UnprocessableError extends Error {
  constructor(
    message: string,
    public details?: string
  ) {
    super(message);
    this.name = "UnprocessableError";
  }
}

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

  /**
   * Updates a user profile
   * @param userId - User UUID from JWT token
   * @param command - Data to update (UpdateProfileCommand)
   * @param supabase - Supabase client instance tied to the request
   * @returns Updated ProfileDTO
   * @throws ConflictError - When trying to restore a profile that is not deleted
   * @throws UnprocessableError - When trying to update a deleted profile without restoring it
   * @throws Error - Other database errors or when profile is not found
   */
  async updateProfile(
    userId: string,
    command: UpdateProfileCommand,
    supabase: TypedSupabaseClient
  ): Promise<ProfileDTO> {
    // Step 1: Retrieve current profile (state validation)
    const currentProfile = await this.getProfile(userId, supabase);

    if (!currentProfile) {
      throw new Error("Profile not found");
    }

    // Step 2: Validate business logic
    this.validateUpdateCommand(command, currentProfile);

    // Step 3: Prepare data for update (snake_case)
    const updateData: Partial<DbProfile> = {};

    if (command.privacyConsent !== undefined) {
      updateData.privacy_consent = command.privacyConsent;
    }

    if (command.restore === true) {
      updateData.deleted_at = null;
    }

    // Step 4: Execute update
    const { data, error } = await supabase.from("profiles").update(updateData).eq("id", userId).select().single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data) {
      throw new Error("Update failed: no data returned");
    }

    // Step 5: Return mapped DTO
    return mapProfileToDTO(data);
  },

  /**
   * Validates update command against current profile state
   * @param command - Update command to validate
   * @param currentProfile - Current state of the profile
   * @throws ConflictError - When restore is requested for an active profile
   * @throws UnprocessableError - When trying to update deleted profile without restoring
   */
  validateUpdateCommand(command: UpdateProfileCommand, currentProfile: ProfileDTO): void {
    // Validation 1: Restore only for deleted profiles
    if (command.restore === true && currentProfile.deletedAt === null) {
      throw new ConflictError(
        "Cannot restore profile that is not deleted",
        "Profile is already active (deletedAt is null)"
      );
    }

    // Validation 2: Cannot update privacyConsent on deleted profile without restore
    if (command.privacyConsent !== undefined && currentProfile.deletedAt !== null && command.restore !== true) {
      throw new UnprocessableError(
        "Cannot update privacy consent on deleted profile",
        'Please restore the profile first or include "restore": true in the request'
      );
    }
  },

  /**
   * Soft deletes a user profile by setting deleted_at timestamp
   * Enables idempotent deletion: multiple calls return success without changing data
   *
   * @param userId - User UUID from JWT token
   * @param supabase - Supabase client instance tied to the request
   * @returns ProfileDeletedDTO with deleted_at timestamp
   * @throws Error - When profile is not found or database error occurs
   */
  async deleteProfile(userId: string, supabase: TypedSupabaseClient): Promise<ProfileDeletedDTO> {
    // Step 1: Retrieve current profile to ensure it exists
    const currentProfile = await this.getProfile(userId, supabase);

    if (!currentProfile) {
      throw new Error("Profile not found");
    }

    // Step 2: Perform soft delete (Strategia A: true idempotency)
    // If already deleted, this returns the existing deleted_at timestamp
    const { data, error } = await supabase
      .from("profiles")
      .update({
        deleted_at: currentProfile.deletedAt || new Date().toISOString(),
      })
      .eq("id", userId)
      .select("deleted_at")
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || !data.deleted_at) {
      throw new Error("Delete failed: no data returned");
    }

    // Step 3: Return deletion response with timestamp
    return {
      status: "deleted" as const,
      deletedAt: data.deleted_at,
    };
  },
} as const;
