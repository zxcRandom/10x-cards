/**
 * Study View Types
 * 
 * Local types for the study session view.
 * These types are view models (VM) derived from API DTOs for UI needs.
 */

/**
 * Study Card View Model
 * Projection of CardDTO for UI rendering in study session
 */
export interface StudyCardVM {
  id: string;
  question: string;
  answer: string;
  nextReviewDate: string;
  intervalDays: number;
  repetitions: number;
  easeFactor: number;
}

/**
 * Study Session State
 * Represents the current state of the study session workflow
 */
export type StudyState = 'loading' | 'ready' | 'submitting' | 'done' | 'error';

/**
 * Study Session Statistics
 * Accumulated statistics during the study session
 */
export interface StudySessionStats {
  reviewedCount: number;
  totalGrades: number;
  averageGrade: number;
}

/**
 * API Error for UI
 * Simplified error structure for displaying API errors to users
 */
export interface ApiErrorUI {
  status: number;
  code: string;
  message: string;
  details?: string;
}
