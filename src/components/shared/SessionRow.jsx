import { Lock, CheckCircle2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function SessionRow({ session, completed, locked, onWatch }) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-card border border-border bg-card p-4 transition-colors hover:bg-muted/10',
        locked && 'opacity-60'
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
        {session.order_no}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{session.title}</p>
        <p className="text-sm text-muted-foreground">{formatDuration(session.duration_min)}</p>
      </div>
      <div className="flex items-center gap-2">
        {locked ? (
          <Lock className="h-5 w-5 text-muted-foreground" />
        ) : completed ? (
          <CheckCircle2 className="h-5 w-5 text-success" />
        ) : null}
        <Button size="sm" disabled={locked} onClick={onWatch}>
          <Play className="h-4 w-4" />
          Watch
        </Button>
      </div>
    </div>
  )
}
