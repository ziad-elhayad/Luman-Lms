import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput } from '@/components/shared/SearchInput'
import { Pagination } from '@/components/shared/Pagination'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/contexts/ToastContext'

const PAGE_SIZE = 10

export default function AdminTeachersPage() {
  const { toast } = useToast()
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [disableId, setDisableId] = useState(null)
  const [form, setForm] = useState({ full_name: '', email: '', password: 'password123' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'teacher').order('full_name')
    setTeachers(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = teachers.filter((t) => {
    const matchSearch = t.full_name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'active' && !t.disabled) || (filter === 'disabled' && t.disabled)
    return matchSearch && matchFilter
  })
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editing) {
        await supabase.from('profiles').update({ full_name: form.full_name }).eq('id', editing.id)
        toast({ title: 'Teacher updated', variant: 'success' })
      } else {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { full_name: form.full_name, role: 'teacher' } },
        })
        if (error) throw error
        toast({ title: 'Teacher created', variant: 'success' })
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    await supabase.from('profiles').delete().eq('id', deleteId)
    toast({ title: 'Teacher deleted', variant: 'success' })
    setDeleteId(null)
    load()
  }

  const handleDisable = async () => {
    const teacher = teachers.find((t) => t.id === disableId)
    await supabase.from('profiles').update({ disabled: !teacher.disabled }).eq('id', disableId)
    toast({ title: teacher.disabled ? 'Teacher enabled' : 'Teacher disabled', variant: 'success' })
    setDisableId(null)
    load()
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r) => r.full_name },
    {
      key: 'status', label: 'Status',
      render: (r) => <Badge variant={r.disabled ? 'danger' : 'success'}>{r.disabled ? 'Disabled' : 'Active'}</Badge>,
    },
    {
      key: 'actions', label: 'Actions',
      render: (r) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setForm({ full_name: r.full_name, email: '', password: '' }); setDialogOpen(true) }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDisableId(r.id)}>
            {r.disabled ? 'Enable' : 'Disable'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDeleteId(r.id)}>
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Teacher Management</h2>
          <p className="text-muted-foreground">Manage platform teachers</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ full_name: '', email: '', password: 'password123' }); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" /> Add Teacher
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search teachers..." className="sm:w-64" />
        <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={paginated} loading={loading} emptyTitle="No teachers" emptyDescription="Add teachers to get started." />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Teacher' : 'Add Teacher'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Full Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            {!editing && (
              <>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} title="Delete teacher?" description="This will permanently remove the teacher." onConfirm={handleDelete} />
      <ConfirmDialog
        open={!!disableId}
        onOpenChange={() => setDisableId(null)}
        title={teachers.find((t) => t.id === disableId)?.disabled ? 'Enable teacher?' : 'Disable teacher?'}
        description="The teacher will lose access to the platform."
        confirmLabel={teachers.find((t) => t.id === disableId)?.disabled ? 'Enable' : 'Disable'}
        variant="default"
        onConfirm={handleDisable}
      />
    </div>
  )
}
