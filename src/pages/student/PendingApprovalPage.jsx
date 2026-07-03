import { Clock, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { useAuth } from '@/contexts/AuthContext'

export default function PendingApprovalPage() {
  const { profile, signOut } = useAuth()

  return (
    <AuthPageShell
      title="Pending Approval"
      subtitle="Your teacher will review your registration shortly"
      maxWidth="max-w-lg"
    >
      <Card className="shadow-lg">
        <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
            <Clock className="h-8 w-8 text-warning" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Your account is pending teacher approval</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Hi {profile?.full_name || 'there'}! Your registration was received successfully.
              Once your teacher approves your account, you&apos;ll get access to your courses and dashboard.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            You&apos;ll receive access to courses that match your grade level automatically.
          </p>
          <Button variant="outline" onClick={() => signOut()} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </AuthPageShell>
  )
}
