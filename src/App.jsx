import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ToastContextProvider } from '@/contexts/ToastContext'
import { ProtectedRoute, PublicRoute } from '@/components/auth/ProtectedRoute'
import { StudentAccessGuard } from '@/components/auth/StudentAccessGuard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import JoinPage from '@/pages/auth/JoinPage'
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
import TeacherExamsPage from '@/pages/teacher/TeacherExamsPage'
import TeacherExamBuilderPage from '@/pages/teacher/TeacherExamBuilderPage'
import TeacherStudentsPage from '@/pages/teacher/TeacherStudentsPage'
import TeacherVideosPage from '@/pages/teacher/TeacherVideosPage'
import TeacherProfilePage from '@/pages/teacher/TeacherProfilePage'
import TeacherSettingsPage from '@/pages/teacher/TeacherSettingsPage'

import StudentDashboard from '@/pages/student/StudentDashboard'
import StudentCoursesPage from '@/pages/student/StudentCoursesPage'
import StudentCourseDetailPage from '@/pages/student/StudentCourseDetailPage'
import StudentLessonPage from '@/pages/student/StudentLessonPage'
import StudentQuizPage from '@/pages/student/StudentQuizPage'
import StudentQuizResultPage from '@/pages/student/StudentQuizResultPage'
import StudentExamPage from '@/pages/student/StudentExamPage'
import StudentExamResultPage from '@/pages/student/StudentExamResultPage'
import StudentAssignmentsPage from '@/pages/student/StudentAssignmentsPage'
import StudentProfilePage from '@/pages/student/StudentProfilePage'
import StudentSettingsPage from '@/pages/student/StudentSettingsPage'
import PendingApprovalPage from '@/pages/student/PendingApprovalPage'
import RejectedPage from '@/pages/student/RejectedPage'

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastContextProvider>
          <AuthProvider>
            <Routes>
              <Route path="/join/:teacherSlug" element={<JoinPage />} />
              <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
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
                <Route path="exams" element={<TeacherExamsPage />} />
                <Route path="exams/new" element={<TeacherExamBuilderPage />} />
                <Route path="exams/:examId/edit" element={<TeacherExamBuilderPage />} />
                <Route path="students" element={<TeacherStudentsPage />} />
                <Route path="videos" element={<TeacherVideosPage />} />
                <Route path="profile" element={<TeacherProfilePage />} />
                <Route path="settings" element={<TeacherSettingsPage />} />
              </Route>

              <Route path="/student/pending" element={<ProtectedRoute allowedRoles={['student']}><PendingApprovalPage /></ProtectedRoute>} />
              <Route path="/student/rejected" element={<ProtectedRoute allowedRoles={['student']}><RejectedPage /></ProtectedRoute>} />

              <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentAccessGuard><DashboardLayout /></StudentAccessGuard></ProtectedRoute>}>
                <Route index element={<StudentDashboard />} />
                <Route path="courses" element={<StudentCoursesPage />} />
                <Route path="courses/:courseId" element={<StudentCourseDetailPage />} />
                <Route path="courses/:courseId/lesson/:sessionId" element={<StudentLessonPage />} />
                <Route path="courses/:courseId/quiz/:quizId" element={<StudentQuizPage />} />
                <Route path="courses/:courseId/quiz/:quizId/result" element={<StudentQuizResultPage />} />
                <Route path="courses/:courseId/exam/:examId" element={<StudentExamPage />} />
                <Route path="courses/:courseId/exam/:examId/result" element={<StudentExamResultPage />} />
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
