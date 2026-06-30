export const NAV_ITEMS = {
  super_admin: [
    { label: 'Dashboard', path: '/admin', icon: 'LayoutDashboard' },
    { label: 'Teachers', path: '/admin/teachers', icon: 'Users' },
    { label: 'Settings', path: '/admin/settings', icon: 'Settings' },
  ],
  teacher: [
    { label: 'Dashboard', path: '/teacher', icon: 'LayoutDashboard' },
    { label: 'My Courses', path: '/teacher/courses', icon: 'BookOpen' },
    { label: 'Assignments', path: '/teacher/assignments', icon: 'FileText' },
    { label: 'Grades', path: '/teacher/grades', icon: 'GraduationCap' },
    { label: 'Exams', path: '/teacher/exams', icon: 'ClipboardList' },
    { label: 'Videos', path: '/teacher/videos', icon: 'Video' },
    { label: 'Students', path: '/teacher/students', icon: 'Users' },
    { label: 'Profile', path: '/teacher/profile', icon: 'User' },
    { label: 'Settings', path: '/teacher/settings', icon: 'Settings' },
  ],
  student: [
    { label: 'Dashboard', path: '/student', icon: 'LayoutDashboard' },
    { label: 'My Courses', path: '/student/courses', icon: 'BookOpen' },
    { label: 'Assignments', path: '/student/assignments', icon: 'FileText' },
    { label: 'Profile', path: '/student/profile', icon: 'User' },
    { label: 'Settings', path: '/student/settings', icon: 'Settings' },
  ],
}
