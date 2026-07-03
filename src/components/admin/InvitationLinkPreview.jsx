import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildInvitationUrl, copyToClipboard } from '@/lib/teacherSlug'
import { useToast } from '@/contexts/ToastContext'

export function InvitationLinkPreview({ slug, className = '' }) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const url = buildInvitationUrl(slug)

  const handleCopy = async () => {
    if (!url) return
    try {
      await copyToClipboard(url)
      setCopied(true)
      toast({ title: 'Link copied', variant: 'success' })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: 'Could not copy link', variant: 'danger' })
    }
  }

  if (!slug) return null

  return (
    <div className={`rounded-control border border-border bg-muted/20 p-4 space-y-3 ${className}`}>
      <p className="text-sm font-medium text-foreground">Invitation Link</p>
      <p className="break-all text-sm text-muted-foreground font-mono">{url || 'Enter a slug to preview'}</p>
      {url && (
        <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="gap-2">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied!' : 'Copy Invitation Link'}
        </Button>
      )}
    </div>
  )
}
