import { Sparkles } from 'lucide-react'

export function AuthPageShell({ title, subtitle, children, maxWidth = 'max-w-md' }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className={`w-full ${maxWidth} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-card bg-primary text-white shadow-lg">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}
