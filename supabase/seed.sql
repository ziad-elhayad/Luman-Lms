-- Lumen LMS Seed Data
-- Run AFTER 001_schema.sql
-- NOTE: Create auth users first in Supabase Auth, then update UUIDs below OR use the helper at bottom

-- For testing, we'll use fixed UUIDs. Create these users in Supabase Auth dashboard:
-- superadmin@lumen.edu / password123 (super_admin)
-- teacher1@lumen.edu / password123 (teacher)
-- teacher2@lumen.edu / password123 (teacher)
-- student1@lumen.edu / password123 (student, grade 2)
-- student2@lumen.edu / password123 (student, grade 2)
-- student3@lumen.edu / password123 (student, grade 1)

-- After creating auth users, get their UUIDs from auth.users and replace below.
-- OR run the seed helper function at the bottom after users exist.

-- Example profiles (update IDs to match your auth.users)
-- INSERT INTO profiles (id, full_name, role, grade) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'Admin User', 'super_admin', NULL),
--   ('00000000-0000-0000-0000-000000000002', 'Dr. Sarah Chen', 'teacher', NULL),
--   ('00000000-0000-0000-0000-000000000003', 'Mr. James Wilson', 'teacher', NULL),
--   ('00000000-0000-0000-0000-000000000004', 'Alex Johnson', 'student', 2),
--   ('00000000-0000-0000-0000-000000000005', 'Emma Davis', 'student', 2),
--   ('00000000-0000-0000-0000-000000000006', 'Noah Brown', 'student', 1);

-- Seed helper: updates profiles for existing auth users by email
CREATE OR REPLACE FUNCTION seed_lumen_data()
RETURNS void AS $$
DECLARE
  admin_id UUID;
  teacher1_id UUID;
  teacher2_id UUID;
  student1_id UUID;
  student2_id UUID;
  student3_id UUID;
  course_physics UUID;
  course_math UUID;
  course_chemistry UUID;
  session1_id UUID;
  session2_id UUID;
  session3_id UUID;
  quiz1_id UUID;
BEGIN
  -- Get user IDs from auth
  SELECT id INTO admin_id FROM auth.users WHERE email = 'superadmin@lumen.edu';
  SELECT id INTO teacher1_id FROM auth.users WHERE email = 'teacher1@lumen.edu';
  SELECT id INTO teacher2_id FROM auth.users WHERE email = 'teacher2@lumen.edu';
  SELECT id INTO student1_id FROM auth.users WHERE email = 'student1@lumen.edu';
  SELECT id INTO student2_id FROM auth.users WHERE email = 'student2@lumen.edu';
  SELECT id INTO student3_id FROM auth.users WHERE email = 'student3@lumen.edu';

  IF admin_id IS NULL THEN
    RAISE NOTICE 'Create auth users first! See seed.sql comments.';
    RETURN;
  END IF;

  -- Update profiles
  UPDATE profiles SET full_name = 'Admin User', role = 'super_admin', grade = NULL WHERE id = admin_id;
  UPDATE profiles SET full_name = 'Dr. Sarah Chen', role = 'teacher', grade = NULL WHERE id = teacher1_id;
  UPDATE profiles SET full_name = 'Mr. James Wilson', role = 'teacher', grade = NULL WHERE id = teacher2_id;
  UPDATE profiles SET full_name = 'Alex Johnson', role = 'student', grade = 2 WHERE id = student1_id;
  UPDATE profiles SET full_name = 'Emma Davis', role = 'student', grade = 2 WHERE id = student2_id;
  UPDATE profiles SET full_name = 'Noah Brown', role = 'student', grade = 1 WHERE id = student3_id;

  -- Grade 2 Courses
  INSERT INTO courses (id, title, subject, grade, teacher_id, thumbnail, description)
  VALUES
    (uuid_generate_v4(), 'Physics Grade 2', 'Physics', 2, teacher1_id,
     'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400', 'Introduction to mechanics and thermodynamics for Grade 2 students.')
  RETURNING id INTO course_physics;

  INSERT INTO courses (title, subject, grade, teacher_id, thumbnail, description)
  VALUES
    ('Math Grade 2', 'Mathematics', 2, teacher1_id,
     'https://images.unsplash.com/photo-1635070041408-e5f23d4a3a6a?w=400', 'Algebra, geometry, and calculus fundamentals.')
  RETURNING id INTO course_math;

  INSERT INTO courses (title, subject, grade, teacher_id, thumbnail, description)
  VALUES
    ('Chemistry Grade 2', 'Chemistry', 2, teacher2_id,
     'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400', 'Organic and inorganic chemistry basics.')
  RETURNING id INTO course_chemistry;

  -- Grade 1 course (student3 should NOT see Grade 2 courses)
  INSERT INTO courses (title, subject, grade, teacher_id, thumbnail, description)
  VALUES
    ('Math Grade 1', 'Mathematics', 1, teacher2_id,
     'https://images.unsplash.com/photo-1509228468518-180dd4867304?w=400', 'Basic arithmetic and number theory.');

  -- Physics sessions
  INSERT INTO sessions (course_id, order_no, title, duration_min, video_url, locked)
  VALUES
    (course_physics, 1, 'Introduction to Motion', 25,
     'https://www.youtube.com/embed/6D05L3w9lVM', false)
  RETURNING id INTO session1_id;

  INSERT INTO sessions (course_id, order_no, title, duration_min, video_url, locked)
  VALUES
    (course_physics, 2, 'Forces and Newton''s Laws', 30,
     'https://www.youtube.com/embed/kKKM4Y6R0Tg', true)
  RETURNING id INTO session2_id;

  INSERT INTO sessions (course_id, order_no, title, duration_min, video_url, locked)
  VALUES
    (course_physics, 3, 'Energy and Work', 28,
     'https://www.youtube.com/embed/z2of0ROp4TE', true)
  RETURNING id INTO session3_id;

  -- Resources for session 1
  INSERT INTO resources (session_id, name, file_url, type)
  VALUES
    (session1_id, 'Motion Lecture Notes', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 'pdf'),
    (session1_id, 'Practice Problems', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 'pdf');

  -- Math sessions
  INSERT INTO sessions (course_id, order_no, title, duration_min, video_url, locked)
  VALUES
    (course_math, 1, 'Linear Equations', 20, 'https://www.youtube.com/embed/fNk_zzaMoSs', false),
    (course_math, 2, 'Quadratic Functions', 35, 'https://www.youtube.com/embed/HfRJgqxmZKk', true);

  -- Chemistry sessions
  INSERT INTO sessions (course_id, order_no, title, duration_min, video_url, locked)
  VALUES
    (course_chemistry, 1, 'Atomic Structure', 22, 'https://www.youtube.com/embed/FSyAehMdpyI', false),
    (course_chemistry, 2, 'Chemical Bonds', 27, 'https://www.youtube.com/embed/QXT4OVM4vXI', true);

  -- Quiz for Physics
  INSERT INTO quizzes (course_id, title, passing_score, time_limit_min, attempts)
  VALUES (course_physics, 'Motion & Forces Quiz', 70, 15, 3)
  RETURNING id INTO quiz1_id;

  INSERT INTO questions (quiz_id, text, type, options, correct_index, order_no)
  VALUES
    (quiz1_id, 'What is the SI unit of force?', 'multiple_choice',
     '["Joule", "Newton", "Watt", "Pascal"]', 1, 1),
    (quiz1_id, 'Which law states F = ma?', 'multiple_choice',
     '["First Law", "Second Law", "Third Law", "Law of Gravitation"]', 1, 2),
    (quiz1_id, 'What is velocity?', 'multiple_choice',
     '["Speed with direction", "Total distance", "Rate of acceleration", "Force per mass"]', 0, 3),
    (quiz1_id, 'Energy cannot be created or destroyed. This is the law of:', 'multiple_choice',
     '["Momentum", "Conservation of Energy", "Thermodynamics", "Gravity"]', 1, 4),
    (quiz1_id, 'What is the formula for kinetic energy?', 'multiple_choice',
     '["mgh", "½mv²", "Fd", "ma"]', 1, 5);

  -- Assignment
  INSERT INTO assignments (course_id, title, due_date, description)
  VALUES
    (course_physics, 'Lab Report: Motion Experiment', NOW() + INTERVAL '7 days',
     'Submit your lab report on the motion experiment conducted in class.'),
    (course_math, 'Problem Set 3', NOW() + INTERVAL '5 days',
     'Complete problems 1-20 from Chapter 4.');

  -- Enrollments for Grade 2 students
  INSERT INTO enrollments (student_id, course_id, progress)
  SELECT student1_id, id, 15 FROM courses WHERE grade = 2
  ON CONFLICT DO NOTHING;

  INSERT INTO enrollments (student_id, course_id, progress)
  SELECT student2_id, id, 30 FROM courses WHERE grade = 2
  ON CONFLICT DO NOTHING;

  -- Enroll grade 1 student in grade 1 course only
  INSERT INTO enrollments (student_id, course_id, progress)
  SELECT student3_id, id, 10 FROM courses WHERE grade = 1
  ON CONFLICT DO NOTHING;

  -- Announcement
  INSERT INTO announcements (course_id, teacher_id, title, body)
  VALUES
    (course_physics, teacher1_id, 'Midterm Review Session',
     'Join us this Friday at 3 PM for a comprehensive midterm review. Bring your questions!');

  RAISE NOTICE 'Seed data inserted successfully!';
END;
$$ LANGUAGE plpgsql;

-- To run seed after creating auth users:
-- SELECT seed_lumen_data();
