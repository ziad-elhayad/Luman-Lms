import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { GRADE_YEARS, VIDEO_EDUCATION_LEVELS } from '@/lib/videoConstants'
import { getTeacherSubjectOptions } from '@/lib/videos'

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

export function StudentForm({ form, errors, isEdit, onChange, disabled, teacherCourses = [], teacherProfile }) {
  const patch = (updates) => onChange({ ...form, ...updates })
  const set = (key) => (e) => patch({ [key]: e.target.value })

  const subjectOptions = getTeacherSubjectOptions(teacherProfile, form.educationLevel || 'middle')

  const toggleSubject = (subjectId) => {
    const selected = new Set(form.subjects || [])
    if (selected.has(subjectId)) {
      selected.delete(subjectId)
    } else {
      selected.add(subjectId)
    }
    patch({ subjects: [...selected] })
  }

  const toggleCourse = (courseId) => {
    const selected = new Set(form.courseIds || [])
    if (selected.has(courseId)) {
      selected.delete(courseId)
    } else {
      selected.add(courseId)
    }
    patch({ courseIds: [...selected] })
  }

  return (
    <div className="space-y-4">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="educationLevel" label="Education level" error={errors.educationLevel}>
          <Select
            value={form.educationLevel || ''}
            onValueChange={(v) => patch({ educationLevel: v, subjects: [] })}
            disabled={disabled}
          >
            <SelectTrigger id="educationLevel">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              {VIDEO_EDUCATION_LEVELS.map((lvl) => (
                <SelectItem key={lvl.value} value={lvl.value}>{lvl.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id="gradeYear" label="Grade year" error={errors.gradeYear}>
          <Select
            value={form.gradeYear ? String(form.gradeYear) : ''}
            onValueChange={(v) => patch({ gradeYear: v })}
            disabled={disabled}
          >
            <SelectTrigger id="gradeYear">
              <SelectValue placeholder="Select grade" />
            </SelectTrigger>
            <SelectContent>
              {GRADE_YEARS.map((g) => (
                <SelectItem key={g.value} value={String(g.value)}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field
        id="subjects"
        label="Subjects"
        error={errors.subjects}
        hint="Used to match lesson videos for this student"
      >
        {subjectOptions.length ? (
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-control border border-border p-3">
            {subjectOptions.map((subject) => {
              const checked = form.subjects?.includes(subject.id)
              return (
                <label
                  key={subject.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-sm hover:bg-muted/40 transition-colors',
                    disabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={!!checked}
                    onChange={() => toggleSubject(subject.id)}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>{subject.label}</span>
                </label>
              )
            })}
          </div>
        ) : (
          <p className="rounded-control border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            Select an education level. Your teacher must have subjects assigned on their profile.
          </p>
        )}
      </Field>

      <Field
        id="courseIds"
        label="Assign courses"
        error={errors.courseIds}
        hint="Select which of your courses this student can access"
      >
        {teacherCourses.length ? (
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-control border border-border p-3">
            {teacherCourses.map((course) => {
              const checked = form.courseIds?.includes(course.id)
              return (
                <label
                  key={course.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-sm hover:bg-muted/40 transition-colors',
                    disabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={!!checked}
                    onChange={() => toggleCourse(course.id)}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>{course.title}</span>
                </label>
              )
            })}
          </div>
        ) : (
          <p className="rounded-control border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            Create courses first, then assign them when adding a student.
          </p>
        )}
      </Field>

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
