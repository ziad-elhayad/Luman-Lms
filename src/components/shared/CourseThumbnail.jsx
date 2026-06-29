import { BookOpen } from 'lucide-react'
import { cn, getCourseThumbnailColor } from '@/lib/utils'

export function CourseThumbnail({ course, className, iconClassName, aspectClass = 'aspect-video' }) {
  const colorKey = course?.id || course?.title
  const bgColor = getCourseThumbnailColor(colorKey)

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden',
        aspectClass,
        bgColor,
        className
      )}
    >
      <BookOpen
        className={cn('text-white/90 drop-shadow-sm', iconClassName || 'h-12 w-12')}
        strokeWidth={1.5}
      />
    </div>
  )
}
