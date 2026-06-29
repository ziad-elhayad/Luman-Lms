# Lumen LMS Database

Minimal Supabase SQL layout for the Lumen LMS project.

## Files

| File | Purpose |
|------|---------|
| `migrations/001_initial.sql` | Tables, indexes, constraints, enable RLS |
| `migrations/002_database_logic.sql` | Functions, auth trigger, seed helpers |
| `migrations/003_security.sql` | RLS policies, storage policies, grants |
| `seeds.sql` | Demo data (run once after creating Auth users) |

## Fresh setup (Supabase SQL Editor)

Run in order:

1. `migrations/001_initial.sql`
2. `migrations/002_database_logic.sql`
3. `migrations/003_security.sql`

Then configure Auth (**Authentication → Providers → Email**):

- Enable Email provider
- Enable email signup
- For testing: disable Confirm email

Create demo users in **Authentication → Users** (password: `password123`, Auto Confirm):

| Email | User Metadata |
|-------|---------------|
| superadmin@lumen.edu | `{"full_name":"Admin User","role":"super_admin"}` |
| teacher1@lumen.edu | `{"full_name":"Dr. Sarah Chen","role":"teacher"}` |
| teacher2@lumen.edu | `{"full_name":"Mr. James Wilson","role":"teacher"}` |
| student1@lumen.edu | `{"full_name":"Alex Johnson","role":"student","grade":2}` |
| student2@lumen.edu | `{"full_name":"Emma Davis","role":"student","grade":2}` |
| student3@lumen.edu | `{"full_name":"Noah Brown","role":"student","grade":1}` |

Create storage bucket `submissions` (public) in **Storage**.

Run `seeds.sql`.

## Functions

| Function | Used by |
|----------|---------|
| `get_user_role()` | RLS policies |
| `get_user_grade()` | RLS policies |
| `teacher_owns_course(uuid)` | RLS policies |
| `handle_new_user()` | Auth trigger on signup |
| `confirm_user_email(text)` | Admin/teacher dashboard user creation |
| `delete_user_account(uuid)` | Admin dashboard user deletion |
| `sync_demo_profiles()` | Dev seed only |
| `seed_lumen_data()` | Dev seed only |

## Existing databases

If you already set up Supabase before the repo cleanup, run patches as needed:

| Patch | When |
|-------|------|
| `patches/delete_user_account.sql` | Admin delete teacher returns 404 |
| `patches/teacher_profile_fields.sql` | Teacher form with first/last name, phone, edit mode |
| `patches/teacher_education_fields.sql` | Education level, track, and subjects on teacher form |

After running a patch, wait a few seconds or reload the app before retrying.

## Production

Revoke dev seed functions when deploying:

```sql
REVOKE EXECUTE ON FUNCTION public.seed_lumen_data() FROM postgres, service_role;
REVOKE EXECUTE ON FUNCTION public.sync_demo_profiles() FROM postgres, service_role;
```
