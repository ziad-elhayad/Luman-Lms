import { useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { getSubjectGroups, subjectLabel } from '@/lib/teacherSubjects'

function Field({ id, label, error, children, hint }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function StudentForm({ form, errors, isEdit, onChange, disabled }) {
  const { profile: teacherProfile } = useAuth()

  // Helper to patch changes to parent form state
  const patch = (updates) => onChange({ ...form, ...updates })
  const set = (key) => (e) => patch({ [key]: e.target.value })

  // Determine teacher's education level and subjects
  const teacherLevel = teacherProfile?.education_level || 'middle' // fallback
  const teacherSubjects = teacherProfile?.subjects || []

  // Options for grade years
  const gradeOptions = [
    { value: '1', label: '1st Year' },
    { value: '2', label: '2nd Year' },
    { value: '3', label: '3rd Year' },
  ]

  // Filter teacher subjects based on standard configuration definitions
  // If teacher has subjects, let's list them. If only 1 subject, auto-select it.
  useEffect(() => {
    if (teacherSubjects.length === 1 && (!form.subjects || form.subjects.length !== 1 || form.subjects[0] !== teacherSubjects[0])) {
      patch({ subjects: [teacherSubjects[0]] })
    }
  }, [teacherSubjects, form.subjects])

  const toggleSubject = (id) => {
    const selected = new Set(form.subjects || [])
    if (selected.has(id)) {
      // Don't allow empty selection if we want to force subject choices
      selected.delete(id)
    } else {
      selected.add(id)
    }
    patch({ subjects: [...selected] })
  }

  return (
    <div className="space-y-4">
      {/* First Name & Last Name */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label="First name" error={errors.firstName}>
          <Input
            id="firstName"
            value={form.firstName || ''}
            onChange={set('firstName')}
            disabled={disabled}
            autoComplete="given-name"
            placeholder="John"
          />
        </Field>
        <Field id="lastName" label="Last name" error={errors.lastName}>
          <Input
            id="lastName"
            value={form.lastName || ''}
            onChange={set('lastName')}
            disabled={disabled}
            autoComplete="family-name"
            placeholder="Doe"
          />
        </Field>
      </div>

      {/* Email */}
      <Field id="email" label="Email" error={errors.email}>
        <Input
          id="email"
          type="email"
          value={form.email || ''}
          onChange={set('email')}
          disabled={disabled}
          autoComplete="email"
          placeholder="student@school.edu"
        />
      </Field>

      {/* Phone */}
      <Field id="phone" label="Phone" error={errors.phone}>
        <Input
          id="phone"
          type="tel"
          value={form.phone || ''}
          onChange={set('phone')}
          disabled={disabled}
          placeholder="+20 100 000 0000"
          autoComplete="tel"
        />
      </Field>

      {/* Grade Year Selection */}
      <Field id="gradeYear" label="Grade Year" error={errors.gradeYear}>
        <Select
          value={form.gradeYear || undefined}
          onValueChange={(value) => patch({ gradeYear: value })}
          disabled={disabled}
        >
          <SelectTrigger id="gradeYear">
            <SelectValue placeholder="Select grade year" />
          </SelectTrigger>
          <SelectContent>
            {gradeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label} ({teacherLevel === 'middle' ? 'Prep' : 'Secondary'})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Subjects Selection */}
      {teacherSubjects.length > 1 ? (
        <Field id="subjects" label="Subjects" error={errors.subjects} hint="Select the subjects this student is enrolled in">
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-control border border-border p-3">
            {teacherSubjects.map((subId) => {
              const checked = form.subjects?.includes(subId)
              return (
                <label
                  key={subId}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-sm hover:bg-muted/40 transition-colors',
                    disabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={!!checked}
                    onChange={() => toggleSubject(subId)}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>{subjectLabel(subId)}</span>
                </label>
              )
            })}
          </div>
        </Field>
      ) : teacherSubjects.length === 1 ? (
        <div className="rounded-control bg-muted/20 border border-border p-3 text-sm space-y-1">
          <p className="font-medium text-foreground">Assigned Subject</p>
          <p className="text-muted-foreground">{subjectLabel(teacherSubjects[0])}</p>
        </div>
      ) : (
        <div className="rounded-control bg-danger/10 border border-danger/20 p-3 text-sm text-danger">
          No subjects are configured on your teacher profile. Configure subjects in settings first.
        </div>
      )}

      {/* Password Fields */}
      <Field
        id="password"
        label="Password"
        error={errors.password}
        hint={isEdit ? 'Leave blank to keep the current password' : 'Set a password for the student account'}
      >
        <Input
          id="password"
          type="password"
          value={form.password || ''}
          onChange={set('password')}
          disabled={disabled}
          autoComplete="new-password"
          placeholder={isEdit ? '••••••••' : 'Password123'}
        />
      </Field>

      <Field
        id="confirmPassword"
        label="Confirm password"
        error={errors.confirmPassword}
        hint={isEdit ? 'Required only when changing password' : 'Confirm the password set above'}
      >
        <Input
          id="confirmPassword"
          type="password"
          value={form.confirmPassword || ''}
          onChange={set('confirmPassword')}
          disabled={disabled}
          autoComplete="new-password"
          placeholder={isEdit ? '••••••••' : 'Password123'}
        />
      </Field>
    </div>
  )
}
