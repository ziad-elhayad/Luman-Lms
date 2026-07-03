import { XCircle, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { useAuth } from '@/contexts/AuthContext'

export default function RejectedPage() {
  const { signOut } = useAuth()

  return (
    <AuthPageShell
      title="Registration Declined"
      subtitle="Your request to join this classroom was not approved"
      maxWidth="max-w-lg"
    >
      <Card className="shadow-lg">
        <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/10">
            <XCircle className="h-8 w-8 text-danger" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Access not granted</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Your teacher has declined your registration request. Please contact your teacher
              if you believe this was a mistake.
            </p>
          </div>
          <Button variant="outline" onClick={() => signOut()} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </AuthPageShell>
  )
}
