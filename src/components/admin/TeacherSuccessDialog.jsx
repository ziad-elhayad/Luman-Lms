import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Check, QrCode } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { buildInvitationUrl, copyToClipboard } from '@/lib/teacherSlug'
import { useToast } from '@/contexts/ToastContext'

export function TeacherSuccessDialog({ open, onOpenChange, teacherName, slug }) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const url = buildInvitationUrl(slug)

  const handleCopy = async () => {
    if (!url) return
    try {
      await copyToClipboard(url)
      setCopied(true)
      toast({ title: 'Invitation link copied', variant: 'success' })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: 'Could not copy link', variant: 'danger' })
    }
  }

  const handleClose = () => {
    setShowQr(false)
    setCopied(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Teacher created successfully</DialogTitle>
          <DialogDescription>
            {teacherName ? `${teacherName} can now receive students via their invitation link.` : 'Share the invitation link with students.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-control border border-border bg-muted/20 p-4 space-y-2">
            <p className="text-sm font-medium">Invitation Link</p>
            <p className="break-all text-sm text-muted-foreground font-mono">{url}</p>
          </div>

          {showQr && url && (
            <div className="flex flex-col items-center gap-3 rounded-control border border-border p-6 animate-in fade-in duration-300">
              <QRCodeSVG value={url} size={200} level="M" includeMargin />
              <p className="text-xs text-muted-foreground text-center">Scan to open the teacher invitation page</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={handleCopy} className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowQr((v) => !v)} className="gap-2">
            <QrCode className="h-4 w-4" />
            {showQr ? 'Hide QR Code' : 'Generate QR Code'}
          </Button>
          <Button type="button" onClick={handleClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
