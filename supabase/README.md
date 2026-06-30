# Lumen LMS Database

Minimal Supabase SQL layout for the Lumen LMS project.

## Files

| File | Purpose |
|------|---------|
| `migrations/001_initial.sql` | Tables, indexes, constraints, enable RLS |
| `migrations/002_database_logic.sql` | Functions, auth trigger, seed helpers |
| `migrations/003_security.sql` | RLS policies, storage policies, grants |
| `migrations/004_enrollment_access.sql` | Enrollment-based student access |
| `migrations/005_videos.sql` | Teacher lesson videos (Cloudinary metadata) |
| `migrations/006_session_videos.sql` | Cloudinary fields on course sessions |
| `seeds.sql` | Demo data (run once after creating Auth users) |

## Fresh setup (Supabase SQL Editor)

Run in order:

1. `migrations/001_initial.sql`
2. `migrations/002_database_logic.sql`
3. `migrations/003_security.sql`
4. `migrations/004_enrollment_access.sql` (if using enrollment-based access)
5. `migrations/005_videos.sql` (for teacher lesson videos)

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
| `patches/videos_table.sql` | Teacher lesson videos table + RLS |
| `patches/student_videos_rls.sql` | Student SELECT policy for matching lesson videos |
| `patches/session_cloudinary_fields.sql` | Cloudinary metadata columns on sessions |

## Cloudinary video uploads

Teacher lesson videos are stored in **Cloudinary**; only metadata lives in Postgres (`videos` table).

### Setup

1. Create a [Cloudinary](https://cloudinary.com) account and note your cloud name, API key, and API secret.
2. Run `migrations/005_videos.sql` (fresh) or `patches/videos_table.sql` (existing DB).
3. Deploy edge functions from the project root:

```bash
supabase functions deploy cloudinary-sign
supabase functions deploy cloudinary-delete
```

4. Set edge function secrets in Supabase Dashboard (**Project Settings → Edge Functions → Secrets**):

| Secret | Purpose |
|--------|---------|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key (safe to return to signed uploads) |
| `CLOUDINARY_API_SECRET` | **Server only** — never expose in frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | Used by delete function to verify ownership |

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are usually injected automatically when deploying via Supabase CLI.

5. Add frontend env vars to `.env` (see `.env.example`).

Teachers upload at **/teacher/videos**. Uploads use signed requests via `cloudinary-sign`; deletions use `cloudinary-delete`.

After running a patch, wait a few seconds or reload the app before retrying.

## Production

Revoke dev seed functions when deploying:

```sql
REVOKE EXECUTE ON FUNCTION public.seed_lumen_data() FROM postgres, service_role;
REVOKE EXECUTE ON FUNCTION public.sync_demo_profiles() FROM postgres, service_role;
```
