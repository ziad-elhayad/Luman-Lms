# Lumen LMS

A Learning Management System SaaS MVP built with Vite + React, Tailwind CSS, shadcn/ui, and Supabase.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Copy `.env.example` to `.env` and add your credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. Run the SQL migrations in Supabase SQL Editor (in order):
   - `supabase/migrations/001_initial.sql`
   - `supabase/migrations/002_database_logic.sql`
   - `supabase/migrations/003_security.sql`
   - `supabase/migrations/004_enrollment_access.sql` (only if your database was created before this update)
   - `supabase/patches/fix_teacher_data_isolation.sql` (each teacher sees only their own data)

   See `supabase/README.md` for full database documentation.

### 3. Auth settings (required for login)

In **Authentication → Providers → Email**, enable:
- **Enable Email provider**
- **Enable email signup**

For local testing, turn **off** **Confirm email** so demo users can log in immediately.

### 4. Create test users

In Supabase Auth → Users, create each user. Check **Auto Confirm User**. For **User Metadata**, use:

| Email | Password | User Metadata (JSON) |
|-------|----------|----------------------|
| superadmin@lumen.edu | password123 | `{"full_name":"Admin User","role":"super_admin"}` |
| teacher1@lumen.edu | password123 | `{"full_name":"Dr. Sarah Chen","role":"teacher"}` |
| teacher2@lumen.edu | password123 | `{"full_name":"Mr. James Wilson","role":"teacher"}` |
| student1@lumen.edu | password123 | `{"full_name":"Alex Johnson","role":"student"}` |
| student2@lumen.edu | password123 | `{"full_name":"Emma Davis","role":"student"}` |
| student3@lumen.edu | password123 | `{"full_name":"Noah Brown","role":"student"}` |

> Create users with **Auto Confirm User** checked. The auth trigger in `002_database_logic.sql` creates profiles automatically.

Then run `supabase/seeds.sql` in the SQL Editor.

If login says **email not confirmed**, confirm users in **Authentication → Users** or re-run the first statement in `seeds.sql`.

### 5. Create storage bucket

Run `supabase/patches/create_submissions_bucket.sql` in the SQL Editor (creates the public `submissions` bucket for assignment uploads).

For exams, also run (in order, if not already applied):
- `supabase/patches/exams_tables.sql`
- `supabase/patches/exam_course_submissions.sql`

Or manually: **Storage → New bucket** → name `submissions` → enable **Public bucket**.

### 6. Run dev server

```bash
npm run dev
```

## Features

- **Three roles**: Super Admin, Teacher, Student — each with a distinct dashboard
- **Course assignment**: Teachers create courses, then assign them to students when adding a student
- **Student flow**: Courses → Lessons (video) → Quizzes (timer) → Results
- **Teacher flow**: Create courses → add students with course assignment → sessions, quizzes, assignments
- **Admin flow**: Dashboard with charts, teacher management (CRUD, disable, search, pagination)
- **Dark mode**, responsive layout, toasts, empty states, skeleton loaders, confirmation dialogs

## Tech Stack

- Vite + React (JavaScript)
- Tailwind CSS v4
- shadcn/ui (Radix primitives)
- React Router v7
- Supabase (auth, database, storage)
- lucide-react, recharts
