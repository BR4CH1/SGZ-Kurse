import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { courseCategories } from './data/courses'
import { bookOnePlace, loadCourses, resetLocalCourseState, saveCourses } from './lib/courseStore'
import type { CourseCategory, CourseOffering, RegistrationFormData } from './types'

type Screen = 'home' | 'courses' | 'register' | 'success' | 'admin'

type SuccessState = {
  participantName: string
  email: string
  courseTitle: string
  courseNumber: string
} | null

const emptyForm: RegistrationFormData = {
  firstName: '',
  lastName: '',
  street: '',
  postalCode: '',
  city: '',
  birthDate: '',
  phone: '',
  mobile: '',
  email: '',
  guardianFirstName: '',
  guardianLastName: '',
  guardianBirthDate: '',
  paymentMethod: 'bar',
  discountReason: '',
  wantsCertificate: false,
  premiumPackage: false,
  appInstalled: false,
  privacyAccepted: false,
  termsAccepted: false,
  accountHolder: '',
  accountStreet: '',
  accountPostalCode: '',
  accountCity: '',
  iban: '',
  bankName: '',
}

function formatDate(date: string | null): string {
  if (!date) return 'individuell'
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(`${date}T12:00:00`),
  )
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(price)
}

function isAvailabilityValid(course: CourseOffering): boolean {
  return (
    course.capacity !== null &&
    course.capacity > 0 &&
    course.freePlaces !== null &&
    course.freePlaces >= 0 &&
    course.freePlaces <= course.capacity
  )
}

function App() {
  const [courses, setCourses] = useState<CourseOffering[]>(() => loadCourses())
  const [screen, setScreen] = useState<Screen>(() =>
    typeof window !== 'undefined' && window.location.hash === '#admin' ? 'admin' : 'home',
  )
  const [selectedCategory, setSelectedCategory] = useState<CourseCategory | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [form, setForm] = useState<RegistrationFormData>({ ...emptyForm })
  const [success, setSuccess] = useState<SuccessState>(null)
  const [adminSearch, setAdminSearch] = useState('')
  const [adminCategory, setAdminCategory] = useState<'Alle' | CourseCategory>('Alle')

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null

  const availableCourses = useMemo(
    () => courses.filter((course) => course.published && course.freePlaces !== null && course.freePlaces > 0),
    [courses],
  )

  const visibleCategoryCourses = useMemo(() => {
    if (!selectedCategory) return []
    return availableCourses
      .filter((course) => course.category === selectedCategory)
      .sort((a, b) => {
        const dateA = a.startDate ?? '9999-12-31'
        const dateB = b.startDate ?? '9999-12-31'
        return dateA.localeCompare(dateB) || a.startTime.localeCompare(b.startTime)
      })
  }, [availableCourses, selectedCategory])

  const filteredAdminCourses = useMemo(() => {
    const query = adminSearch.trim().toLowerCase()
    return courses.filter((course) => {
      const categoryMatch = adminCategory === 'Alle' || course.category === adminCategory
      const searchMatch =
        !query ||
        course.title.toLowerCase().includes(query) ||
        course.courseNumber.toLowerCase().includes(query) ||
        course.weekday.toLowerCase().includes(query) ||
        course.instructor?.toLowerCase().includes(query)
      return categoryMatch && Boolean(searchMatch)
    })
  }, [adminCategory, adminSearch, courses])

  const resetToHome = () => {
    setScreen('home')
    setSelectedCategory(null)
    setSelectedCourseId(null)
    setForm({ ...emptyForm })
    setSuccess(null)
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }

  useEffect(() => {
    if (screen !== 'success') return
    const timer = window.setTimeout(resetToHome, 5000)
    return () => window.clearTimeout(timer)
  }, [screen])

  useEffect(() => {
    if (screen === 'home' || screen === 'admin' || screen === 'success') return

    let timer: number
    const restart = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(resetToHome, 90_000)
    }

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart']
    events.forEach((event) => window.addEventListener(event, restart, { passive: true }))
    restart()

    return () => {
      window.clearTimeout(timer)
      events.forEach((event) => window.removeEventListener(event, restart))
    }
  }, [screen])

  const openCategory = (category: CourseCategory) => {
    setSelectedCategory(category)
    setScreen('courses')
  }

  const openCourse = (courseId: string) => {
    setSelectedCourseId(courseId)
    setForm({ ...emptyForm })
    setScreen('register')
  }

  const openAdmin = () => {
    window.location.hash = 'admin'
    setScreen('admin')
  }

  const updateCourse = (courseId: string, patch: Partial<CourseOffering>) => {
    setCourses((previous) => {
      const next = previous.map((course) => (course.id === courseId ? { ...course, ...patch } : course))
      saveCourses(next)
      return next
    })
  }

  const handlePublishToggle = (course: CourseOffering) => {
    if (!course.published && !isAvailabilityValid(course)) return
    updateCourse(course.id, { published: !course.published })
  }

  const submitRegistration = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedCourse) return

    const currentCourse = courses.find((course) => course.id === selectedCourse.id)
    if (!currentCourse?.published || currentCourse.freePlaces === null || currentCourse.freePlaces <= 0) {
      window.alert('Dieser Kurs ist leider gerade nicht mehr verfügbar.')
      resetToHome()
      return
    }

    const nextCourses = bookOnePlace(courses, currentCourse.id)
    setCourses(nextCourses)
    saveCourses(nextCourses)

    setSuccess({
      participantName: `${form.firstName} ${form.lastName}`.trim(),
      email: form.email,
      courseTitle: currentCourse.title,
      courseNumber: currentCourse.courseNumber,
    })

    // Keine personenbezogenen Daten im Browser speichern. Der produktive Versand folgt serverseitig.
    setForm({ ...emptyForm })
    setSelectedCourseId(null)
    setScreen('success')
  }

  const resetDemo = () => {
    if (!window.confirm('Alle lokal gepflegten Platzangaben und Freigaben zurücksetzen?')) return
    setCourses(resetLocalCourseState())
  }

  const configuredCount = courses.filter(isAvailabilityValid).length
  const publishedCount = courses.filter((course) => course.published).length
  const isChildRegistration = selectedCourse?.category === 'Kinder & Jugend im Bad'

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={resetToHome} aria-label="Zur Startseite">
          <span className="brand-mark">SGZ</span>
          <span>
            <strong>Altenessen</strong>
            <small>Kursanmeldung</small>
          </span>
        </button>
        {screen !== 'home' && screen !== 'success' && (
          <button className="ghost-button" type="button" onClick={resetToHome}>
            Startseite
          </button>
        )}
      </header>

      {screen === 'home' && (
        <main className="page kiosk-home">
          <section className="hero-card">
            <p className="eyebrow">Programm 2. Halbjahr 2026</p>
            <h1>Für welchen Kurs möchten Sie sich anmelden?</h1>
            <p>Wählen Sie zuerst den passenden Kursbereich. Angezeigt werden ausschließlich Kurse mit freien Plätzen.</p>
          </section>

          {availableCourses.length === 0 ? (
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
          ) : (
            <section className="category-grid" aria-label="Kursbereiche">
              {courseCategories.map((category) => {
                const count = availableCourses.filter((course) => course.category === category).length
                if (count === 0) return null
                return (
                  <button className="category-card" type="button" key={category} onClick={() => openCategory(category)}>
                    <span className="category-icon" aria-hidden="true">
                      {category === 'Kinder & Jugend im Bad'
                        ? '🏊'
                        : category === 'Fitness & Halle'
                          ? '🏋️'
                          : category === 'Wasser & Schwimmen Erwachsene'
                            ? '💧'
                            : category === 'Wellness & Entspannung'
                              ? '🧘'
                              : category === 'AOK-Kurse'
                                ? '💚'
                                : '❤'}
                    </span>
                    <strong>{category}</strong>
                    <span>{count} buchbare {count === 1 ? 'Kurszeit' : 'Kurszeiten'}</span>
                  </button>
                )
              })}
            </section>
          )}

          <footer className="kiosk-footer">
            <span>Sport- und Gesundheitszentrum Altenessen e.V.</span>
            <button type="button" className="admin-link" onClick={openAdmin}>
              Verwaltung (MVP)
            </button>
          </footer>
        </main>
      )}

      {screen === 'courses' && selectedCategory && (
        <main className="page">
          <div className="page-heading">
            <button className="back-button" type="button" onClick={() => setScreen('home')}>
              ← Zurück
            </button>
            <div>
              <p className="eyebrow">Kursbereich</p>
              <h1>{selectedCategory}</h1>
              <p>Bitte wählen Sie Ihren gewünschten Termin.</p>
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

      {screen === 'register' && selectedCourse && (
        <main className="page registration-page">
          <div className="page-heading">
            <button className="back-button" type="button" onClick={() => setScreen('courses')}>
              ← Kursauswahl
            </button>
            <div>
              <p className="eyebrow">Ihre Kursanmeldung</p>
              <h1>{selectedCourse.title}</h1>
              <p>
                {selectedCourse.weekday}, {selectedCourse.startTime}–{selectedCourse.endTime} Uhr · {selectedCourse.courseNumber}
              </p>
            </div>
          </div>

          <div className="development-notice">
            <strong>Entwicklungsstand:</strong> Die Platzreduzierung funktioniert bereits lokal. PDF- und E-Mail-Versand werden als nächster Backend-Schritt angeschlossen.
          </div>

          <form className="registration-form" onSubmit={submitRegistration}>
            <section className="form-section">
              <h2>{isChildRegistration ? 'Daten des Kindes' : 'Persönliche Daten'}</h2>
              <div className="form-grid two-columns">
                <label>
                  Vorname *
                  <input required autoComplete="given-name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </label>
                <label>
                  Nachname *
                  <input required autoComplete="family-name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </label>
                <label>
                  Geburtsdatum *
                  <input required type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
                </label>
                <label>
                  E-Mail *
                  <input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </label>
                <label className="wide-field">
                  Straße, Hausnummer *
                  <input required autoComplete="street-address" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
                </label>
                <label>
                  PLZ *
                  <input required inputMode="numeric" autoComplete="postal-code" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
                </label>
                <label>
                  Ort *
                  <input required autoComplete="address-level2" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </label>
                <label>
                  Telefon
                  <input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </label>
                <label>
                  Mobil
                  <input type="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                </label>
              </div>
            </section>

            {isChildRegistration && (
              <section className="form-section">
                <h2>Erziehungsberechtigte/r</h2>
                <div className="form-grid three-columns">
                  <label>
                    Vorname *
                    <input required value={form.guardianFirstName} onChange={(e) => setForm({ ...form, guardianFirstName: e.target.value })} />
                  </label>
                  <label>
                    Nachname *
                    <input required value={form.guardianLastName} onChange={(e) => setForm({ ...form, guardianLastName: e.target.value })} />
                  </label>
                  <label>
                    Geburtsdatum *
                    <input required type="date" value={form.guardianBirthDate} onChange={(e) => setForm({ ...form, guardianBirthDate: e.target.value })} />
                  </label>
                </div>
              </section>
            )}

            <section className="form-section">
              <h2>Zahlung & Optionen</h2>
              <div className="payment-options" role="radiogroup" aria-label="Zahlungsmethode">
                {[
                  ['bar', 'Barzahlung'],
                  ['ec', 'EC-Karte'],
                  ['sepa', 'SEPA-Lastschrift'],
                ].map(([value, label]) => (
                  <label className="choice-card" key={value}>
                    <input
                      type="radio"
                      name="payment"
                      value={value}
                      checked={form.paymentMethod === value}
                      onChange={() => setForm({ ...form, paymentMethod: value as RegistrationFormData['paymentMethod'] })}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              {form.paymentMethod === 'sepa' && (
                <div className="sepa-box">
                  <h3>SEPA-Lastschrift</h3>
                  <div className="form-grid two-columns">
                    <label>
                      Kontoinhaber/in *
                      <input required value={form.accountHolder} onChange={(e) => setForm({ ...form, accountHolder: e.target.value })} />
                    </label>
                    <label>
                      IBAN *
                      <input required autoCapitalize="characters" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value.toUpperCase() })} />
                    </label>
                    <label className="wide-field">
                      Straße, Hausnummer
                      <input value={form.accountStreet} onChange={(e) => setForm({ ...form, accountStreet: e.target.value })} />
                    </label>
                    <label>
                      PLZ
                      <input value={form.accountPostalCode} onChange={(e) => setForm({ ...form, accountPostalCode: e.target.value })} />
                    </label>
                    <label>
                      Ort
                      <input value={form.accountCity} onChange={(e) => setForm({ ...form, accountCity: e.target.value })} />
                    </label>
                    <label>
                      Kreditinstitut
                      <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
                    </label>
                  </div>
                </div>
              )}

              <label className="wide-label">
                Rabatt / Grund
                <input value={form.discountReason} onChange={(e) => setForm({ ...form, discountReason: e.target.value })} placeholder="z. B. Geschwisterrabatt" />
              </label>

              <div className="checkbox-stack">
                <label><input type="checkbox" checked={form.wantsCertificate} onChange={(e) => setForm({ ...form, wantsCertificate: e.target.checked })} /> Teilnahmebescheinigung erwünscht</label>
                <label><input type="checkbox" checked={form.premiumPackage} onChange={(e) => setForm({ ...form, premiumPackage: e.target.checked })} /> Premium Kurspaket vorhanden</label>
                <label><input type="checkbox" checked={form.appInstalled} onChange={(e) => setForm({ ...form, appInstalled: e.target.checked })} /> SGZ-App installiert</label>
              </div>
            </section>

            <section className="form-section consent-section">
              <label>
                <input required type="checkbox" checked={form.privacyAccepted} onChange={(e) => setForm({ ...form, privacyAccepted: e.target.checked })} />
                Ich bin mit der Verarbeitung meiner personenbezogenen Daten im Rahmen der Kursanmeldung einverstanden. *
              </label>
              <label>
                <input required type="checkbox" checked={form.termsAccepted} onChange={(e) => setForm({ ...form, termsAccepted: e.target.checked })} />
                Ich habe die Teilnahme- und Zahlungsbedingungen gelesen und akzeptiere sie. *
              </label>
            </section>

            <div className="submit-row">
              <div>
                <span>Kursgebühr</span>
                <strong>{formatPrice(selectedCourse.priceEuro)}</strong>
              </div>
              <button className="primary-button large-button" type="submit">
                Verbindlich anmelden
              </button>
            </div>
          </form>
        </main>
      )}

      {screen === 'success' && success && (
        <main className="success-page">
          <div className="success-icon">✓</div>
          <p className="eyebrow">Anmeldung abgeschlossen</p>
          <h1>Vielen Dank, {success.participantName}!</h1>
          <p>
            Der Platz für <strong>{success.courseTitle}</strong> ({success.courseNumber}) wurde reserviert.
          </p>
          <p className="success-email">Die Bestätigung soll später automatisch an {success.email} versendet werden.</p>
          <div className="development-notice compact-notice">MVP: E-Mail und PDF sind noch nicht angeschlossen.</div>
          <p className="reset-hint">Diese Seite wird automatisch für die nächste Anmeldung zurückgesetzt.</p>
          <button className="primary-button" type="button" onClick={resetToHome}>Jetzt zurück zur Startseite</button>
        </main>
      )}

      {screen === 'admin' && (
        <main className="admin-page">
          <section className="admin-header">
            <div>
              <p className="eyebrow">SGZ Verwaltung · MVP</p>
              <h1>Kursplätze verwalten</h1>
              <p>Die Kursdaten stammen aus dem Programm für das 2. Halbjahr 2026. Hier werden Gesamtplätze und aktuell freie Plätze gepflegt.</p>
            </div>
            <button className="primary-button" type="button" onClick={resetToHome}>Zum Terminal</button>
          </section>

          <div className="development-notice">
            <strong>Noch lokale MVP-Daten:</strong> Änderungen werden aktuell nur in diesem Browser gespeichert. Für den echten Betrieb wird dieser Bereich anschließend an die zentrale Datenbank angebunden und geschützt.
          </div>

          <section className="stats-grid">
            <div><span>Kursangebote</span><strong>{courses.length}</strong></div>
            <div><span>Plätze gepflegt</span><strong>{configuredCount}</strong></div>
            <div><span>Freigeschaltet</span><strong>{publishedCount}</strong></div>
            <div><span>Aktuell buchbar</span><strong>{availableCourses.length}</strong></div>
          </section>

          <section className="admin-toolbar">
            <label>
              Kurs suchen
              <input value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} placeholder="Kursname, Nummer, Kursleitung …" />
            </label>
            <label>
              Bereich
              <select value={adminCategory} onChange={(e) => setAdminCategory(e.target.value as 'Alle' | CourseCategory)}>
                <option value="Alle">Alle Bereiche</option>
                {courseCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <button className="danger-link" type="button" onClick={resetDemo}>Lokale Platzdaten zurücksetzen</button>
          </section>

          <section className="admin-course-list">
            {filteredAdminCourses.map((course) => {
              const valid = isAvailabilityValid(course)
              return (
                <article className={course.published ? 'admin-course-row is-published' : 'admin-course-row'} key={course.id}>
                  <div className="admin-course-info">
                    <div className="admin-course-titleline">
                      <span className="course-number">{course.courseNumber}</span>
                      <span className="quarter-pill">{course.quarter}</span>
                      {course.published && <span className="live-pill">Buchbar</span>}
                    </div>
                    <strong>{course.title}</strong>
                    <span>{course.weekday} · {course.startTime}–{course.endTime} · {course.location}{course.instructor ? ` · ${course.instructor}` : ''}</span>
                    <small>{course.startDate ? `${formatDate(course.startDate)} – ${formatDate(course.endDate)}` : 'Termin individuell'} · {course.sessions} Einheiten · {formatPrice(course.priceEuro)}</small>
                  </div>
                  <div className="availability-editor">
                    <label>
                      Gesamtplätze
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={course.capacity ?? ''}
                        onChange={(e) => updateCourse(course.id, { capacity: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      Aktuell frei
                      <input
                        type="number"
                        min="0"
                        max={course.capacity ?? undefined}
                        inputMode="numeric"
                        value={course.freePlaces ?? ''}
                        onChange={(e) => updateCourse(course.id, { freePlaces: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                    </label>
                    <button
                      type="button"
                      className={course.published ? 'publish-button published' : 'publish-button'}
                      disabled={!course.published && !valid}
                      onClick={() => handlePublishToggle(course)}
                    >
                      {course.published ? 'Ausblenden' : 'Freigeben'}
                    </button>
                    {!valid && <small className="validation-hint">Plätze vollständig eintragen</small>}
                  </div>
                </article>
              )
            })}
          </section>
        </main>
      )}
    </div>
  )
}

export default App
