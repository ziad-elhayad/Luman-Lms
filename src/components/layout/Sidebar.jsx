import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Settings,
  BookOpen,
  FileText,
  GraduationCap,
  User,
  ChevronLeft,
  ChevronRight,
  Sun,
  Sparkles,
  ClipboardList,
  Video,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/navigation'
import { Button } from '@/components/ui/button'

const ICONS = {
  LayoutDashboard,
  Users,
  Settings,
  BookOpen,
  FileText,
  GraduationCap,
  User,
  ClipboardList,
  Video,
}

export function Sidebar({ role, collapsed, onToggle, mobileOpen, onMobileClose }) {
  const items = NAV_ITEMS[role] || []

  const content = (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-card transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      <div className={cn('flex h-16 items-center border-b border-border px-4', collapsed ? 'justify-center' : 'gap-3')}>
        <div className="flex h-9 w-9 items-center justify-center rounded-control bg-primary text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-bold text-foreground">Lumen LMS</p>
            <p className="text-xs text-muted-foreground capitalize">{role?.replace('_', ' ')}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const Icon = ICONS[item.icon]
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === `/admin` || item.path === `/teacher` || item.path === `/student`}
              onClick={onMobileClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/30',
                  isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
                  collapsed && 'justify-center px-2'
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      <div className="hidden border-t border-border p-3 lg:block">
        <Button variant="ghost" size="sm" className="w-full" onClick={onToggle}>
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /> Collapse</>}
        </Button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block">{content}</div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onMobileClose} aria-hidden="true" />
          <div className="absolute left-0 top-0 h-full w-64 shadow-card">{content}</div>
        </div>
      )}
    </>
  )
}
