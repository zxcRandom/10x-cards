-- ============================================================================
-- Temporary Migration: Disable RLS for Testing
-- Description: Disables RLS on all tables to allow testing without policies
-- WARNING: This is for development only - DO NOT use in production!
-- ============================================================================

-- Disable RLS on all tables temporarily
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_logs DISABLE ROW LEVEL SECURITY;

-- Add comment
COMMENT ON TABLE public.profiles IS 'RLS DISABLED FOR TESTING';
COMMENT ON TABLE public.decks IS 'RLS DISABLED FOR TESTING';
COMMENT ON TABLE public.cards IS 'RLS DISABLED FOR TESTING';
COMMENT ON TABLE public.reviews IS 'RLS DISABLED FOR TESTING';
COMMENT ON TABLE public.ai_generation_logs IS 'RLS DISABLED FOR TESTING';
