import { Link } from 'react-router-dom'
import { Users, BookOpen } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

export function CourseCard({ course, to, teacherName, studentCount, sessionCount, progress = 0 }) {
  return (
    <Link to={to} className="block group">
      <Card className="overflow-hidden transition-all hover:shadow-card hover:-translate-y-0.5">
        <div className="aspect-video overflow-hidden bg-muted/30">
          {course.thumbnail ? (
            <img
              src={course.thumbnail}
              alt={course.title}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <BookOpen className="h-12 w-12 opacity-40" />
            </div>
          )}
        </div>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground line-clamp-2">{course.title}</h3>
            <Badge variant="secondary">Grade {course.grade}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{teacherName || 'Instructor'}</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {studentCount ?? 0} students
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              {sessionCount ?? 0} sessions
            </span>
          </div>
          {progress !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
