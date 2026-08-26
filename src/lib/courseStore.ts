import { initialCourses } from '../data/courses'
import type { CourseOffering } from '../types'

const STORAGE_KEY = 'sgz-kurse-course-state-v1'

function cloneInitialCourses(): CourseOffering[] {
  return initialCourses.map((course) => ({ ...course }))
}

export function loadCourses(): CourseOffering[] {
  if (typeof window === 'undefined') return cloneInitialCourses()

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) return cloneInitialCourses()

  try {
    const parsed = JSON.parse(stored) as CourseOffering[]
    const byId = new Map(parsed.map((course) => [course.id, course]))

    return initialCourses.map((source) => ({
      ...source,
      capacity: byId.get(source.id)?.capacity ?? source.capacity,
      freePlaces: byId.get(source.id)?.freePlaces ?? source.freePlaces,
      published: byId.get(source.id)?.published ?? source.published,
    }))
  } catch {
    return cloneInitialCourses()
  }
}

export function saveCourses(courses: CourseOffering[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(courses))
}

export function bookOnePlace(courses: CourseOffering[], courseId: string): CourseOffering[] {
  return courses.map((course) => {
    if (course.id !== courseId) return course
    if (!course.published || course.freePlaces === null || course.freePlaces <= 0) return course

    return {
      ...course,
      freePlaces: course.freePlaces - 1,
    }
  })
}

export function resetLocalCourseState(): CourseOffering[] {
  window.localStorage.removeItem(STORAGE_KEY)
  return cloneInitialCourses()
}
