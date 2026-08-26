export type CourseCategory =
  | 'Kinder & Jugend im Bad'
  | 'Fitness & Halle'
  | 'Wasser & Schwimmen Erwachsene'
  | 'Wellness & Entspannung'
  | 'AOK-Kurse'
  | 'Präventionskurse §20'

export type Quarter = '3. Quartal' | '4. Quartal' | 'Flexibel'

export interface CourseOffering {
  id: string
  courseNumber: string
  title: string
  category: CourseCategory
  quarter: Quarter
  weekday: string
  startTime: string
  endTime: string
  instructor: string | null
  location: string
  startDate: string | null
  endDate: string | null
  sessions: number
  priceEuro: number
  notes?: string
  capacity: number | null
  freePlaces: number | null
  published: boolean
}

export type PaymentMethod = 'bar' | 'ec' | 'sepa'

export interface RegistrationFormData {
  firstName: string
  lastName: string
  street: string
  postalCode: string
  city: string
  birthDate: string
  phone: string
  mobile: string
  email: string
  guardianFirstName: string
  guardianLastName: string
  guardianBirthDate: string
  paymentMethod: PaymentMethod
  discountReason: string
  wantsCertificate: boolean
  premiumPackage: boolean
  appInstalled: boolean
  privacyAccepted: boolean
  termsAccepted: boolean
  accountHolder: string
  accountStreet: string
  accountPostalCode: string
  accountCity: string
  iban: string
  bankName: string
}

export interface RegistrationRecord {
  id: string
  courseId: string
  courseNumber: string
  createdAt: string
  participantName: string
  email: string
}
