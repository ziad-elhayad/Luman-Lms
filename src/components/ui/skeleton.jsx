import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-control bg-foreground/8', className)}
      {...props}
    />
  )
}

export { Skeleton }
