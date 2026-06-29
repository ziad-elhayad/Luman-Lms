-- Fix: Add missing first_name and last_name columns to public.profiles
-- Run this in the Supabase SQL Editor.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
