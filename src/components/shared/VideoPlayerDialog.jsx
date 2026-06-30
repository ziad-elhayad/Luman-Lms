import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LessonVideoPlayer } from '@/components/shared/LessonVideoPlayer'

export function VideoPlayerDialog({ video, open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-4 overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{video?.title || 'Lesson video'}</DialogTitle>
        </DialogHeader>
        {video && <LessonVideoPlayer video={video} />}
        {video?.description && (
          <p className="px-6 pb-6 text-sm text-muted-foreground">{video.description}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
