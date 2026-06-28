import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ToastContextProvider } from '@/contexts/ToastContext'
import { ProtectedRoute, PublicRoute } from '@/components/auth/ProtectedRoute'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

import LoginPage from '@/pages/auth/LoginPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'

import AdminDashboard from '@/pages/admin/AdminDashboard'
import AdminTeachersPage from '@/pages/admin/AdminTeachersPage'
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage'

import TeacherDashboard from '@/pages/teacher/TeacherDashboard'
import TeacherCoursesPage from '@/pages/teacher/TeacherCoursesPage'
import TeacherCourseDetailPage from '@/pages/teacher/TeacherCourseDetailPage'
import TeacherQuizBuilderPage from '@/pages/teacher/TeacherQuizBuilderPage'
import TeacherAssignmentsPage from '@/pages/teacher/TeacherAssignmentsPage'
import TeacherGradesPage from '@/pages/teacher/TeacherGradesPage'
import TeacherStudentsPage from '@/pages/teacher/TeacherStudentsPage'
import TeacherAnnouncementsPage from '@/pages/teacher/TeacherAnnouncementsPage'
import TeacherProfilePage from '@/pages/teacher/TeacherProfilePage'
import TeacherSettingsPage from '@/pages/teacher/TeacherSettingsPage'

import StudentDashboard from '@/pages/student/StudentDashboard'
import StudentCoursesPage from '@/pages/student/StudentCoursesPage'
import StudentCourseDetailPage from '@/pages/student/StudentCourseDetailPage'
import StudentLessonPage from '@/pages/student/StudentLessonPage'
import StudentQuizPage from '@/pages/student/StudentQuizPage'
import StudentQuizResultPage from '@/pages/student/StudentQuizResultPage'
import StudentAssignmentsPage from '@/pages/student/StudentAssignmentsPage'
import StudentProfilePage from '@/pages/student/StudentProfilePage'
import StudentSettingsPage from '@/pages/student/StudentSettingsPage'

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastContextProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
              <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />

              <Route path="/admin" element={<ProtectedRoute allowedRoles={['super_admin']}><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<AdminDashboard />} />
                <Route path="teachers" element={<AdminTeachersPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>

              <Route path="/teacher" element={<ProtectedRoute allowedRoles={['teacher']}><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<TeacherDashboard />} />
                <Route path="courses" element={<TeacherCoursesPage />} />
                <Route path="courses/:courseId" element={<TeacherCourseDetailPage />} />
                <Route path="courses/:courseId/quiz-builder" element={<TeacherQuizBuilderPage />} />
                <Route path="assignments" element={<TeacherAssignmentsPage />} />
                <Route path="grades" element={<TeacherGradesPage />} />
                <Route path="students" element={<TeacherStudentsPage />} />
                <Route path="announcements" element={<TeacherAnnouncementsPage />} />
                <Route path="profile" element={<TeacherProfilePage />} />
                <Route path="settings" element={<TeacherSettingsPage />} />
              </Route>

              <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<StudentDashboard />} />
                <Route path="courses" element={<StudentCoursesPage />} />
                <Route path="courses/:courseId" element={<StudentCourseDetailPage />} />
                <Route path="courses/:courseId/lesson/:sessionId" element={<StudentLessonPage />} />
                <Route path="courses/:courseId/quiz/:quizId" element={<StudentQuizPage />} />
                <Route path="courses/:courseId/quiz/:quizId/result" element={<StudentQuizResultPage />} />
                <Route path="assignments" element={<StudentAssignmentsPage />} />
                <Route path="profile" element={<StudentProfilePage />} />
                <Route path="settings" element={<StudentSettingsPage />} />
              </Route>

              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </AuthProvider>
        </ToastContextProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
