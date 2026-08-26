from pathlib import Path
import re

app_path = Path('src/App.tsx')
css_path = Path('src/styles.css')
app = app_path.read_text()
css = css_path.read_text()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'Marker not found: {label}')
    return text.replace(old, new, 1)

app = replace_once(
    app,
    "type Screen = 'home' | 'courses' | 'register' | 'success' | 'admin'",
    "type Screen = 'home' | 'days' | 'courses' | 'register' | 'success' | 'admin'",
    'Screen type',
)

group_defs = r'''
type CustomerGroupKey = 'kinder' | 'praevention' | 'fitness' | 'wasser' | 'tanz' | 'wellness'

type CustomerGroup = {
  key: CustomerGroupKey
  title: string
  description: string
  spritePosition: string
  matches: (course: CourseOffering) => boolean
}

const danceCoursePattern = /zumba|dance|tanz/i

const customerGroups: CustomerGroup[] = [
  {
    key: 'kinder',
    title: 'Kinderkurse',
    description: 'Schwimmen, Bewegung & Spaß für Kinder',
    spritePosition: '0% 0%',
    matches: (course) => course.category === 'Kinder & Jugend im Bad',
  },
  {
    key: 'praevention',
    title: 'Präventionskurse',
    description: 'Gesundheit fördern & Beschwerden vorbeugen',
    spritePosition: '50% 0%',
    matches: (course) => course.category === 'AOK-Kurse' || course.category === 'Präventionskurse §20',
  },
  {
    key: 'fitness',
    title: 'Fitnesskurse',
    description: 'Kraft, Ausdauer & Energie',
    spritePosition: '100% 0%',
    matches: (course) => course.category === 'Fitness & Halle' && !danceCoursePattern.test(course.title),
  },
  {
    key: 'wasser',
    title: 'Wasserkurse',
    description: 'Aqua-Fitness & Bewegung im Wasser',
    spritePosition: '0% 100%',
    matches: (course) => course.category === 'Wasser & Schwimmen Erwachsene',
  },
  {
    key: 'tanz',
    title: 'Tanzkurse',
    description: 'Zumba® & Bewegung zur Musik',
    spritePosition: '50% 100%',
    matches: (course) => course.category === 'Fitness & Halle' && danceCoursePattern.test(course.title),
  },
  {
    key: 'wellness',
    title: 'Wellness & mehr',
    description: 'Entspannung, Balance & Wohlbefinden',
    spritePosition: '100% 100%',
    matches: (course) => course.category === 'Wellness & Entspannung',
  },
]

const weekdayOrder = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

function getWeekdays(courses: CourseOffering[]): string[] {
  return Array.from(new Set(courses.map((course) => course.weekday))).sort((a, b) => {
    const aIndex = weekdayOrder.indexOf(a)
    const bIndex = weekdayOrder.indexOf(b)
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b, 'de')
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })
}

function sortCourses(courses: CourseOffering[]): CourseOffering[] {
  return [...courses].sort((a, b) => {
    const dayA = weekdayOrder.indexOf(a.weekday)
    const dayB = weekdayOrder.indexOf(b.weekday)
    const safeDayA = dayA === -1 ? 99 : dayA
    const safeDayB = dayB === -1 ? 99 : dayB
    const dateA = a.startDate ?? '9999-12-31'
    const dateB = b.startDate ?? '9999-12-31'
    return safeDayA - safeDayB || a.startTime.localeCompare(b.startTime) || dateA.localeCompare(dateB)
  })
}
'''

app = replace_once(app, "} | null\n\nconst emptyForm", "} | null\n" + group_defs + "\nconst emptyForm", 'group definitions')

app = replace_once(
    app,
    "  const [selectedCategory, setSelectedCategory] = useState<CourseCategory | null>(null)\n  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)",
    "  const [selectedGroupKey, setSelectedGroupKey] = useState<CustomerGroupKey | null>(null)\n  const [selectedWeekday, setSelectedWeekday] = useState<string | null>(null)\n  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)",
    'selection state',
)

visible_pattern = re.compile(r"  const visibleCategoryCourses = useMemo\([\s\S]*?  \}, \[availableCourses, selectedCategory\]\)\n", re.M)
visible_replacement = r'''  const selectedGroup = customerGroups.find((group) => group.key === selectedGroupKey) ?? null

  const selectedGroupCourses = useMemo(() => {
    if (!selectedGroup) return []
    return sortCourses(availableCourses.filter((course) => selectedGroup.matches(course)))
  }, [availableCourses, selectedGroup])

  const groupWeekdays = useMemo(() => getWeekdays(selectedGroupCourses), [selectedGroupCourses])
  const shouldChooseDay = groupWeekdays.length >= 3 && selectedGroupCourses.length >= 6

  const visibleCategoryCourses = useMemo(() => {
    if (!selectedWeekday) return selectedGroupCourses
    return selectedGroupCourses.filter((course) => course.weekday === selectedWeekday)
  }, [selectedGroupCourses, selectedWeekday])
'''
app, count = visible_pattern.subn(visible_replacement, app, count=1)
if count != 1:
    raise RuntimeError('Could not replace visible course selector')

app = replace_once(app, "    setSelectedCategory(null)\n    setSelectedCourseId(null)", "    setSelectedGroupKey(null)\n    setSelectedWeekday(null)\n    setSelectedCourseId(null)", 'reset selection')

open_pattern = re.compile(r"  const openCategory = \(category: CourseCategory\) => \{[\s\S]*?  \}\n\n  const openCourse", re.M)
open_replacement = r'''  const openGroup = (groupKey: CustomerGroupKey) => {
    const group = customerGroups.find((item) => item.key === groupKey)
    if (!group) return
    const matchingCourses = sortCourses(availableCourses.filter((course) => group.matches(course)))
    const weekdays = getWeekdays(matchingCourses)
    setSelectedGroupKey(groupKey)
    setSelectedWeekday(null)
    setScreen(weekdays.length >= 3 && matchingCourses.length >= 6 ? 'days' : 'courses')
  }

  const openDay = (weekday: string) => {
    setSelectedWeekday(weekday)
    setScreen('courses')
  }

  const openCourse'''
app, count = open_pattern.subn(open_replacement, app, count=1)
if count != 1:
    raise RuntimeError('Could not replace openCategory')

home_start = app.index("      {screen === 'home' && (")
courses_start = app.index("      {screen === 'courses' && selectedCategory && (")
new_home = r'''      {screen === 'home' && (
        <main className="page kiosk-home">
          <section className="hero-card compact-hero">
            <p className="eyebrow">Programm 2. Halbjahr 2026</p>
            <h1>Welcher Kurs passt zu Ihnen?</h1>
            <p>Wählen Sie einen Kursbereich. Danach führen wir Sie Schritt für Schritt zum passenden Termin.</p>
          </section>

          {availableCourses.length === 0 && (
            <section className="setup-card">
              <div>
                <span className="status-dot" />
                <strong>Noch keine Kurse freigeschaltet</strong>
                <p>Im Verwaltungsbereich zuerst Gesamtplätze und aktuell freie Plätze eintragen und Kurse freigeben.</p>
              </div>
              <button className="primary-button" type="button" onClick={openAdmin}>
                Verwaltung öffnen
              </button>
            </section>
          )}

          <section className="category-grid image-category-grid" aria-label="Kursbereiche">
            {customerGroups.map((group) => {
              const count = availableCourses.filter((course) => group.matches(course)).length
              return (
                <button
                  className={`category-card image-category-card category-${group.key}`}
                  type="button"
                  key={group.key}
                  onClick={() => openGroup(group.key)}
                  disabled={count === 0}
                >
                  <span className="category-photo" style={{ backgroundPosition: group.spritePosition }} aria-hidden="true" />
                  <span className="category-shade" aria-hidden="true" />
                  <span className="category-card-content">
                    <strong>{group.title}</strong>
                    <span>{group.description}</span>
                    <small>{count > 0 ? `${count} buchbare ${count === 1 ? 'Kurszeit' : 'Kurszeiten'}` : 'Aktuell keine freien Plätze'}</small>
                  </span>
                  <span className="category-arrow" aria-hidden="true">→</span>
                </button>
              )
            })}
          </section>

          <footer className="kiosk-footer">
            <span>Sport- und Gesundheitszentrum Altenessen e.V.</span>
            <button type="button" className="admin-link" onClick={openAdmin}>
              Verwaltung (MVP)
            </button>
          </footer>
        </main>
      )}

'''
app = app[:home_start] + new_home + app[courses_start:]

courses_marker = "      {screen === 'courses' && selectedCategory && ("
register_marker = "      {screen === 'register' && selectedCourse && ("
courses_start = app.index(courses_marker)
register_start = app.index(register_marker)
new_course_flow = r'''      {screen === 'days' && selectedGroup && (
        <main className="page">
          <div className="page-heading">
            <button className="back-button" type="button" onClick={() => setScreen('home')}>
              ← Zurück
            </button>
            <div>
              <p className="eyebrow">{selectedGroup.title}</p>
              <h1>Wann möchten Sie trainieren?</h1>
              <p>Wählen Sie einen Wochentag. Danach sehen Sie nur noch die passenden Kurstermine.</p>
            </div>
          </div>

          <section className="day-grid" aria-label="Wochentage">
            {groupWeekdays.map((weekday) => {
              const count = selectedGroupCourses.filter((course) => course.weekday === weekday).length
              return (
                <button className="day-card" type="button" key={weekday} onClick={() => openDay(weekday)}>
                  <span>{weekday}</span>
                  <strong>{count}</strong>
                  <small>{count === 1 ? 'Kurszeit' : 'Kurszeiten'}</small>
                  <span className="day-arrow">→</span>
                </button>
              )
            })}
          </section>

          <button className="all-courses-button" type="button" onClick={() => { setSelectedWeekday(null); setScreen('courses') }}>
            Alle Termine in {selectedGroup.title} anzeigen
          </button>
        </main>
      )}

      {screen === 'courses' && selectedGroup && (
        <main className="page">
          <div className="page-heading">
            <button
              className="back-button"
              type="button"
              onClick={() => {
                setSelectedWeekday(null)
                setScreen(shouldChooseDay ? 'days' : 'home')
              }}
            >
              ← Zurück
            </button>
            <div>
              <p className="eyebrow">{selectedGroup.title}</p>
              <h1>{selectedWeekday ? `${selectedWeekday}: passende Kurse` : 'Kurs auswählen'}</h1>
              <p>{selectedWeekday ? 'Bitte wählen Sie Ihren gewünschten Termin.' : 'Hier finden Sie alle aktuell buchbaren Termine dieses Bereichs.'}</p>
            </div>
          </div>

          <section className="course-grid">
            {visibleCategoryCourses.map((course) => (
              <button className="course-card" type="button" key={course.id} onClick={() => openCourse(course.id)}>
                <div className="course-card-topline">
                  <span className="course-number">{course.courseNumber}</span>
                  <span className={course.freePlaces !== null && course.freePlaces <= 3 ? 'places places-low' : 'places'}>
                    {course.freePlaces} {course.freePlaces === 1 ? 'Platz' : 'Plätze'} frei
                  </span>
                </div>
                <h2>{course.title}</h2>
                <div className="course-meta">
                  <span>📅 {course.weekday}</span>
                  <span>🕒 {course.startTime === 'individuell' ? 'individuell' : `${course.startTime}–${course.endTime} Uhr`}</span>
                  <span>📍 {course.location}</span>
                  {course.instructor && <span>👤 {course.instructor}</span>}
                </div>
                <div className="course-period">
                  <span>{course.quarter}</span>
                  <span>{course.startDate ? `${formatDate(course.startDate)} – ${formatDate(course.endDate)}` : 'Termine individuell'}</span>
                  <strong>{formatPrice(course.priceEuro)}</strong>
                </div>
                {course.notes && <p className="course-note">{course.notes}</p>}
              </button>
            ))}
          </section>
        </main>
      )}

'''
app = app[:courses_start] + new_course_flow + app[register_start:]

old_category_css = re.compile(r"\.category-grid \{[\s\S]*?\.category-card span:last-child \{\n  color: var\(--muted\);\n\}\n", re.M)
new_category_css = r'''.category-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 26px;
}

.image-category-card {
  position: relative;
  min-height: 255px;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 26px;
  background: #163944;
  color: white;
  cursor: pointer;
  text-align: left;
  box-shadow: 0 12px 38px rgba(21, 57, 67, 0.16);
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.image-category-card:not(:disabled):hover,
.image-category-card:not(:disabled):active {
  transform: translateY(-3px);
  box-shadow: 0 20px 46px rgba(21, 57, 67, 0.24);
}

.image-category-card:disabled {
  cursor: not-allowed;
  filter: grayscale(0.55);
  opacity: 0.68;
}

.category-photo,
.category-shade {
  position: absolute;
  inset: 0;
}

.category-photo {
  background-image: url('/SGZ-Kurse/course-tiles.webp');
  background-size: 300% 200%;
  background-repeat: no-repeat;
  transform: scale(1.015);
  transition: transform 220ms ease;
}

.image-category-card:not(:disabled):hover .category-photo {
  transform: scale(1.05);
}

.category-shade {
  background: linear-gradient(180deg, rgba(7, 35, 43, 0.04) 25%, rgba(7, 35, 43, 0.9) 100%);
}

.category-card-content {
  position: absolute;
  z-index: 2;
  left: 22px;
  right: 58px;
  bottom: 20px;
  display: grid;
  gap: 5px;
}

.category-card-content strong {
  font-size: clamp(1.35rem, 2.5vw, 1.75rem);
  line-height: 1.05;
}

.category-card-content > span {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
}

.category-card-content small {
  margin-top: 4px;
  color: #ccecf2;
  font-weight: 750;
}

.category-arrow {
  position: absolute;
  z-index: 3;
  right: 20px;
  bottom: 20px;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  color: var(--sgz-dark);
  font-size: 1.25rem;
  font-weight: 900;
}

.day-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.day-card {
  position: relative;
  min-height: 150px;
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: white;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
  display: grid;
  align-content: end;
  gap: 3px;
  box-shadow: 0 8px 26px rgba(21, 57, 67, 0.06);
}

.day-card:hover,
.day-card:active {
  border-color: #9fcbd5;
  box-shadow: 0 14px 34px rgba(21, 57, 67, 0.12);
}

.day-card > span:first-child {
  font-size: 1.25rem;
  font-weight: 850;
}

.day-card strong {
  font-size: 2.2rem;
  color: var(--sgz);
}

.day-card small {
  color: var(--muted);
}

.day-arrow {
  position: absolute;
  top: 18px;
  right: 18px;
  color: var(--sgz);
  font-size: 1.35rem;
  font-weight: 900;
}

.all-courses-button {
  margin-top: 18px;
  min-height: 52px;
  padding: 12px 18px;
  border: 1px solid #bdd6dc;
  border-radius: 14px;
  background: #edf5f7;
  color: var(--sgz-dark);
  cursor: pointer;
  font-weight: 800;
}
'''
css, count = old_category_css.subn(new_category_css, css, count=1)
if count != 1:
    raise RuntimeError('Could not replace category CSS')

css = css.replace(
    "  .category-grid,\n  .stats-grid {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }",
    "  .category-grid,\n  .stats-grid,\n  .day-grid {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }",
)
css = css.replace(
    "  .category-grid,\n  .stats-grid,\n  .two-columns,",
    "  .category-grid,\n  .stats-grid,\n  .day-grid,\n  .two-columns,",
)
css = css.replace(
    "  .category-card {\n    min-height: 160px;\n  }",
    "  .image-category-card {\n    min-height: 210px;\n  }\n\n  .day-card {\n    min-height: 125px;\n  }",
)
css = css.replace(
    "  .category-card,\n  .course-card {\n    min-height: 180px;\n  }",
    "  .image-category-card,\n  .day-card,\n  .course-card {\n    min-height: 180px;\n  }",
)

app_path.write_text(app)
css_path.write_text(css)
print('Kiosk image tile upgrade applied successfully.')
