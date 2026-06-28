import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function StatCard({ title, value, icon: Icon, trend, className }) {
  return (
    <Card className={cn('transition-shadow hover:shadow-card', className)}>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
          {trend && <p className="mt-1 text-xs text-success">{trend}</p>}
        </div>
        {Icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-card bg-primary/10 text-primary">
            <Icon className="h-6 w-6" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
