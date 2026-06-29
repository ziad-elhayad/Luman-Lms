export const EDUCATION_LEVELS = [
  { value: 'middle', label: 'Middle School' },
  { value: 'secondary', label: 'Secondary School' },
  { value: 'both', label: 'Middle & Secondary' },
]

export const SECONDARY_TRACKS = [
  { value: 'science', label: 'Science (علمي علوم)' },
  { value: 'math', label: 'Math (علمي رياضة)' },
  { value: 'literature', label: 'Literature (أدبي)' },
]

export const MIDDLE_SUBJECTS = [
  { id: 'arabic', label: 'Arabic', group: 'middle' },
  { id: 'english', label: 'English', group: 'middle' },
  { id: 'math', label: 'Math', group: 'middle' },
  { id: 'science', label: 'Science', group: 'middle' },
  { id: 'social_studies', label: 'Social Studies', group: 'middle' },
  { id: 'religion', label: 'Religion', group: 'middle' },
  { id: 'second_language_german', label: 'Second Language — German', group: 'middle' },
  { id: 'second_language_french', label: 'Second Language — French', group: 'middle' },
  { id: 'second_language_italian', label: 'Second Language — Italian', group: 'middle' },
]

export const SECONDARY_CORE_SUBJECTS = [
  { id: 'arabic', label: 'Arabic', group: 'secondary_core' },
  { id: 'english', label: 'English', group: 'secondary_core' },
  { id: 'religion', label: 'Religion', group: 'secondary_core' },
]

export const TRACK_SUBJECTS = {
  science: [
    { id: 'biology', label: 'Biology', group: 'track' },
    { id: 'chemistry', label: 'Chemistry', group: 'track' },
    { id: 'physics', label: 'Physics', group: 'track' },
    { id: 'geology', label: 'Geology', group: 'track' },
  ],
  math: [
    { id: 'mathematics', label: 'Mathematics', group: 'track' },
    { id: 'physics', label: 'Physics', group: 'track' },
    { id: 'chemistry', label: 'Chemistry', group: 'track' },
  ],
  literature: [
    { id: 'arabic_advanced', label: 'Arabic (advanced)', group: 'track' },
    { id: 'english_advanced', label: 'English (advanced)', group: 'track' },
    { id: 'history', label: 'History', group: 'track' },
    { id: 'geography', label: 'Geography', group: 'track' },
    { id: 'psychology_sociology', label: 'Psychology / Sociology', group: 'track' },
  ],
}

const SUBJECT_LABELS = Object.fromEntries(
  [...MIDDLE_SUBJECTS, ...SECONDARY_CORE_SUBJECTS, ...Object.values(TRACK_SUBJECTS).flat()]
    .map((s) => [s.id, s.label]),
)

export function getAvailableSubjects(educationLevel, secondaryTrack) {
  const seen = new Set()
  const result = []

  const add = (items) => {
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        result.push(item)
      }
    }
  }

  if (educationLevel === 'middle') {
    add(MIDDLE_SUBJECTS)
  } else if (educationLevel === 'secondary') {
    add(SECONDARY_CORE_SUBJECTS)
    if (secondaryTrack && TRACK_SUBJECTS[secondaryTrack]) {
      add(TRACK_SUBJECTS[secondaryTrack])
    }
  } else if (educationLevel === 'both') {
    add(MIDDLE_SUBJECTS)
    add(SECONDARY_CORE_SUBJECTS)
    if (secondaryTrack && TRACK_SUBJECTS[secondaryTrack]) {
      add(TRACK_SUBJECTS[secondaryTrack])
    }
  }

  return result
}

export function getSubjectGroups(educationLevel, secondaryTrack) {
  const available = getAvailableSubjects(educationLevel, secondaryTrack)
  const groups = []

  if (educationLevel === 'middle' || educationLevel === 'both') {
    const middle = available.filter((s) => s.group === 'middle')
    if (middle.length) groups.push({ key: 'middle', title: 'Middle school subjects', items: middle })
  }

  if (educationLevel === 'secondary' || educationLevel === 'both') {
    const core = available.filter((s) => s.group === 'secondary_core')
    if (core.length) groups.push({ key: 'secondary_core', title: 'Secondary core subjects', items: core })

    const track = available.filter((s) => s.group === 'track')
    if (track.length) {
      const trackLabel = SECONDARY_TRACKS.find((t) => t.value === secondaryTrack)?.label || 'Track subjects'
      groups.push({ key: 'track', title: trackLabel, items: track })
    }
  }

  return groups
}

export function pruneSubjects(subjects, educationLevel, secondaryTrack) {
  const allowed = new Set(getAvailableSubjects(educationLevel, secondaryTrack).map((s) => s.id))
  return (subjects || []).filter((id) => allowed.has(id))
}

export function subjectLabel(id) {
  return SUBJECT_LABELS[id] || id
}

export function formatSubjectsList(subjects) {
  if (!subjects?.length) return '—'
  return subjects.map(subjectLabel).join(', ')
}

export function needsSecondaryTrack(educationLevel) {
  return educationLevel === 'secondary' || educationLevel === 'both'
}
