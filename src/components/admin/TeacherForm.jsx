import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  EDUCATION_LEVELS,
  SECONDARY_TRACKS,
  getSubjectGroups,
  needsSecondaryTrack,
} from '@/lib/teacherSubjects'
import { applyTeacherFormChange } from '@/lib/teacherForm'
import { InvitationLinkPreview } from '@/components/admin/InvitationLinkPreview'

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

export function TeacherForm({ form, errors, isEdit, onChange, disabled }) {
  const patch = (updates) => onChange(applyTeacherFormChange(form, updates))

  const set = (key) => (e) => patch({ [key]: e.target.value })

  const toggleSubject = (id) => {
    const selected = new Set(form.subjects || [])
    if (selected.has(id)) selected.delete(id)
    else selected.add(id)
    patch({ subjects: [...selected] })
  }

  const showTrack = needsSecondaryTrack(form.educationLevel)
  const subjectGroups = form.educationLevel
    ? getSubjectGroups(form.educationLevel, form.secondaryTrack)
    : []

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label="First name" error={errors.firstName}>
          <Input id="firstName" value={form.firstName} onChange={set('firstName')} disabled={disabled} autoComplete="given-name" />
        </Field>
        <Field id="lastName" label="Last name" error={errors.lastName}>
          <Input id="lastName" value={form.lastName} onChange={set('lastName')} disabled={disabled} autoComplete="family-name" />
        </Field>
      </div>

      <Field id="email" label="Email" error={errors.email}>
        <Input id="email" type="email" value={form.email} onChange={set('email')} disabled={disabled} autoComplete="email" />
      </Field>

      <Field id="phone" label="Phone" error={errors.phone}>
        <Input id="phone" type="tel" value={form.phone} onChange={set('phone')} disabled={disabled} placeholder="+20 100 000 0000" autoComplete="tel" />
      </Field>

      <Field
        id="slug"
        label="Teacher Slug"
        error={errors.slug}
        hint="Lowercase letters, numbers, and hyphens only (e.g. ahmed-math)"
      >
        <Input
          id="slug"
          value={form.slug}
          onChange={set('slug')}
          disabled={disabled}
          placeholder="ahmed-math"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <InvitationLinkPreview slug={form.slug} />

      <Field id="educationLevel" label="Education level" error={errors.educationLevel}>
        <Select
          value={form.educationLevel || undefined}
          onValueChange={(value) => patch({ educationLevel: value })}
          disabled={disabled}
        >
          <SelectTrigger id="educationLevel"><SelectValue placeholder="Select level" /></SelectTrigger>
          <SelectContent>
            {EDUCATION_LEVELS.map((level) => (
              <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {showTrack && (
        <Field id="secondaryTrack" label="Secondary track" error={errors.secondaryTrack}>
          <Select
            value={form.secondaryTrack || undefined}
            onValueChange={(value) => patch({ secondaryTrack: value })}
            disabled={disabled}
          >
            <SelectTrigger id="secondaryTrack"><SelectValue placeholder="Select track" /></SelectTrigger>
            <SelectContent>
              {SECONDARY_TRACKS.map((track) => (
                <SelectItem key={track.value} value={track.value}>{track.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {form.educationLevel && (!showTrack || form.secondaryTrack) && (
        <Field id="subjects" label="Subjects" error={errors.subjects} hint="Select all subjects this teacher can teach">
          <div className="max-h-56 space-y-3 overflow-y-auto rounded-control border border-border p-3">
            {subjectGroups.map((group) => (
              <div key={group.key} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{group.title}</p>
                <div className="space-y-1">
                  {group.items.map((subject) => {
                    const checked = form.subjects?.includes(subject.id)
                    return (
                      <label
                        key={`${group.key}-${subject.id}`}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-sm hover:bg-muted/40',
                          disabled && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSubject(subject.id)}
                          disabled={disabled}
                          className="h-4 w-4 rounded border-border"
                        />
                        <span>{subject.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </Field>
      )}

      <Field id="password" label="Password" error={errors.password} hint={isEdit ? 'Leave blank to keep the current password' : undefined}>
        <Input id="password" type="password" value={form.password} onChange={set('password')} disabled={disabled} autoComplete="new-password" />
      </Field>

      <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword} hint={isEdit ? 'Required only when changing password' : undefined}>
        <Input id="confirmPassword" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} disabled={disabled} autoComplete="new-password" />
      </Field>
    </div>
  )
}
