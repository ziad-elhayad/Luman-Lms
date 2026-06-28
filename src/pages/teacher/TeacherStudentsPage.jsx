import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DataTable } from '@/components/shared/DataTable'
import { SearchInput } from '@/components/shared/SearchInput'
import { Pagination } from '@/components/shared/Pagination'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/contexts/ToastContext'

const PAGE_SIZE = 10

export default function TeacherStudentsPage() {
  const { toast } = useToast()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', grade: '2', password: 'password123' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'student').order('full_name')
    setStudents(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = students.filter((s) =>
    s.full_name?.toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleCreate = async () => {
    setSaving(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.full_name, role: 'student', grade: parseInt(form.grade) } },
      })
      if (error) throw error
      toast({ title: 'Student created', variant: 'success' })
      setDialogOpen(false)
      load()
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r) => r.full_name },
    { key: 'grade', label: 'Grade', render: (r) => <Badge variant="secondary">Grade {r.grade}</Badge> },
    { key: 'status', label: 'Status', render: (r) => <Badge variant={r.disabled ? 'danger' : 'success'}>{r.disabled ? 'Disabled' : 'Active'}</Badge> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Students</h2>
          <p className="text-muted-foreground">Manage your students</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Add Student</Button>
      </div>

      <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search students..." className="max-w-sm" />

      <DataTable columns={columns} data={paginated} loading={loading} emptyTitle="No students" emptyDescription="Add students to get started." />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Student</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Full Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Grade</Label>
              <Select value={form.grade} onValueChange={(v) => setForm({ ...form, grade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                    <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
