-- ============================================================================
-- Migration: Enable RLS Policies
-- Description: Re-enables RLS and adds all security policies
-- Date: 2025-10-29
-- ============================================================================
-- This migration implements Row Level Security policies as designed in db-plan.md
-- Replaces the temporary RLS disable from 20251019160000_disable_rls_temp.sql
-- ============================================================================

-- ============================================================================
-- RE-ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES TABLE POLICIES
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Profiles are created automatically via trigger, no INSERT policy needed for users
-- System can insert profiles (handled by handle_new_user function with SECURITY DEFINER)

-- ============================================================================
-- DECKS TABLE POLICIES
-- ============================================================================

-- Users can view their own decks
CREATE POLICY "Users can view own decks"
  ON public.decks
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own decks
CREATE POLICY "Users can insert own decks"
  ON public.decks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own decks
CREATE POLICY "Users can update own decks"
  ON public.decks
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own decks
CREATE POLICY "Users can delete own decks"
  ON public.decks
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- CARDS TABLE POLICIES
-- ============================================================================

-- Users can view cards from their own decks
CREATE POLICY "Users can view cards from own decks"
  ON public.cards
  FOR SELECT
  USING (
    deck_id IN (
      SELECT id FROM public.decks WHERE user_id = auth.uid()
    )
  );

-- Users can insert cards into their own decks
CREATE POLICY "Users can insert cards into own decks"
  ON public.cards
  FOR INSERT
  WITH CHECK (
    deck_id IN (
      SELECT id FROM public.decks WHERE user_id = auth.uid()
    )
  );

-- Users can update cards from their own decks
CREATE POLICY "Users can update cards from own decks"
  ON public.cards
  FOR UPDATE
  USING (
    deck_id IN (
      SELECT id FROM public.decks WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    deck_id IN (
      SELECT id FROM public.decks WHERE user_id = auth.uid()
    )
  );

-- Users can delete cards from their own decks
CREATE POLICY "Users can delete cards from own decks"
  ON public.cards
  FOR DELETE
  USING (
    deck_id IN (
      SELECT id FROM public.decks WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- REVIEWS TABLE POLICIES
-- ============================================================================

-- Users can view their own reviews
CREATE POLICY "Users can view own reviews"
  ON public.reviews
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own reviews
CREATE POLICY "Users can insert own reviews"
  ON public.reviews
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own reviews (limited scenario)
CREATE POLICY "Users can update own reviews"
  ON public.reviews
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews"
  ON public.reviews
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- AI_GENERATION_LOGS TABLE POLICIES
-- ============================================================================

-- Users can view their own AI generation logs
CREATE POLICY "Users can view own AI logs"
  ON public.ai_generation_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own AI generation logs
CREATE POLICY "Users can insert own AI logs"
  ON public.ai_generation_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE policy for ai_generation_logs (logs are immutable)
-- No DELETE policy for ai_generation_logs (logs are archival)

-- ============================================================================
-- UPDATE TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE public.profiles IS 'User profile data extending Supabase Auth users - RLS ENABLED';
COMMENT ON TABLE public.decks IS 'Flashcard decks owned by users - RLS ENABLED';
COMMENT ON TABLE public.cards IS 'Flashcards with SM-2 spaced repetition algorithm data - RLS ENABLED';
COMMENT ON TABLE public.reviews IS 'Historical record of card reviews with SM-2 grades - RLS ENABLED';
COMMENT ON TABLE public.ai_generation_logs IS 'Audit log for AI flashcard generation operations - RLS ENABLED';

-- ============================================================================
-- VERIFICATION QUERIES (for manual testing)
-- ============================================================================
-- Run these queries as different users to verify RLS is working:
-- 
-- -- Test as user 1 (should see only their data):
-- SELECT * FROM public.decks;
-- SELECT * FROM public.cards;
-- 
-- -- Test as user 2 (should see different data):
-- SELECT * FROM public.decks;
-- SELECT * FROM public.cards;
-- 
-- -- Test anonymous (should see nothing):
-- SELECT * FROM public.decks; -- Should return 0 rows
-- ============================================================================

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
