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
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_fix_auth_trigger.sql` (if user creation fails)
   - `supabase/migrations/003_grants.sql` (fixes 403 permission denied)

### 3. Create test users

In Supabase Auth → Users, create each user. For **User Metadata**, use:

| Email | Password | User Metadata (JSON) |
|-------|----------|----------------------|
| superadmin@lumen.edu | password123 | `{"full_name":"Admin User","role":"super_admin"}` |
| teacher1@lumen.edu | password123 | `{"full_name":"Dr. Sarah Chen","role":"teacher"}` |
| teacher2@lumen.edu | password123 | `{"full_name":"Mr. James Wilson","role":"teacher"}` |
| student1@lumen.edu | password123 | `{"full_name":"Alex Johnson","role":"student","grade":2}` |
| student2@lumen.edu | password123 | `{"full_name":"Emma Davis","role":"student","grade":2}` |
| student3@lumen.edu | password123 | `{"full_name":"Noah Brown","role":"student","grade":1}` |

> If user creation fails with "Database error creating new user", run `supabase/migrations/002_fix_auth_trigger.sql` in the SQL Editor first.

Then run `SELECT seed_lumen_data();` in SQL Editor.

### 4. Create storage bucket

In Supabase Storage, create a public bucket named `submissions` for assignment uploads.

### 5. Run dev server

```bash
npm run dev
```

## Features

- **Three roles**: Super Admin, Teacher, Student — each with a distinct dashboard
- **Grade filtering**: Students only see courses matching their grade (enforced in queries + RLS)
- **Student flow**: Courses → Lessons (video) → Quizzes (timer) → Results
- **Teacher flow**: Course CRUD, sessions, quiz builder, grades, students, assignments, announcements
- **Admin flow**: Dashboard with charts, teacher management (CRUD, disable, search, pagination)
- **Dark mode**, responsive layout, toasts, empty states, skeleton loaders, confirmation dialogs

## Tech Stack

- Vite + React (JavaScript)
- Tailwind CSS v4
- shadcn/ui (Radix primitives)
- React Router v7
- Supabase (auth, database, storage)
- lucide-react, recharts
