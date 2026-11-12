import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const CATEGORIES = [
  "House cleaning",
  "Deep cleaning",
  "Laundry and ironing",
  "Dish washing",
  "Carpet and windows",
  "Office cleaning",
  "Furniture assembly",
  "Door repairs",
  "Locks",
  "Mounting and installing",
  "Small repairs",
  "Pipes and leaks",
  "Toilet",
  "Sink and drain",
  "Water tank and pump",
  "Shower and bathroom",
  "Lights",
  "Sockets and switches",
  "Wiring",
  "Solar and inverter",
  "Generator wiring",
  "Moving help",
  "Truck hire",
  "Package and food delivery",
  "Market and pharmacy runs",
  "Airport and trips",
  "Car mechanic",
  "Oil, tires and battery",
  "Car wash",
  "Motorbike and keke",
  "Driver",
  "Towing",
  "Generator repair",
  "Generator service",
  "Generator install",
  "Generator fuel",
  "Hair",
  "Barber",
  "Makeup and nails",
  "Massage and spa",
  "School tutoring",
  "Reading and languages",
  "Computer and phone lessons",
  "Music and driving lessons",
  "Masonry",
  "Tiles and finishing",
  "Painting",
  "Roofing",
  "Carpentry and welding",
  "Septic and digging",
  "Emergency help",
  "Fridge and freezer",
  "Air conditioning",
  "Fans, stove and machines",
  "Childcare",
  "Care for old or sick",
  "Maid and house help",
  "Cooking for people",
  "House sitting and pets",
  "Phone repair",
  "Computer repair",
  "WiFi and network",
  "CCTV and TV",
  "Printer",
  "Design and photos",
  "Social media and marketing",
  "Office help",
  "Business setup",
  "Errands",
  "Personal assistant",
  "Fitness",
  "Canopy, chairs and setup",
  "Decoration",
  "Music and hosting",
  "Photo and video",
  "Event food and cleanup",
  "Event security",
  "Guards",
  "Night watch",
  "Yard work",
  "Farm work",
  "Animals and poultry",
  "Water delivery",
  "Wells and boreholes",
  "Professionals",
  "Other",
] as const;

export const JOB_STATUSES = [
  "open",
  "accepted",
  "price_proposed",
  "confirmed",
  "held",
  "in_progress",
  "worker_done",
  "completed",
  "cancelled",
] as const;

export const JOB_PAYMENT_STATES = ["waiting", "held", "paid"] as const;

export const VERIFICATION_STATUSES = ["unverified", "pending", "verified"] as const;

/**
 * ONE profile per person. The same row is used to post jobs (as a customer)
 * and to accept jobs (as a service provider). Verification is the ID
 * document on file: idType + idNumber + the uploaded license/passport photo.
 */
export const profiles = sqliteTable("profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  location: text("location").notNull(),
  address: text("address").notNull().default(""),
  dateOfBirth: text("date_of_birth"),
  idType: text("id_type"),
  idNumber: text("id_number"),
  idBlobKey: text("id_blob_key"),
  idMime: text("id_mime"),
  /** Bearer token issued when the person proves their sign-in code. The profile (and its ID document) is only ever returned to the holder of this token; it rotates at every sign-in. */
  sessionToken: text("session_token"),
  /** Profile picture the person adds for themselves. */
  profileBlobKey: text("profile_blob_key"),
  profileMime: text("profile_mime"),
  /** Home location picked at sign-up: county, district, city or town.
      `location` keeps the combined words; `address` keeps the community. */
  county: text("county"),
  district: text("district"),
  city: text("city"),
  /** The community the person PICKED from the fixed list for their town. Never free text: it is the same fixed entry for everyone in that community, so jobs and people can be filtered and matched by it. Older profiles keep it in `address`. */
  community: text("community"),
  /** How to get to the person's own house, in their own words, written once and kept with their place (e.g. "When you get to the field, call me"). The only person-specific part of an address: not a form, not a map. Jobs carry it automatically from the profile. */
  houseDirections: text("house_directions"),
  /** The Mobile Money number payment goes from and to. The only way to pay on Jackwork. */
  mobileMoneyNumber: text("mobile_money_number"),
  /** JSON array of service names the person wants work in. Preferred work shows first on the board; the board still shows every open job. */
  workPreferences: text("work_preferences"),
  /** 1 once the person has answered the Find work first-visit ask, either by saving kinds of work or by choosing to see all jobs. While 0 with empty preferences, Find work asks "What job can you do?" first instead of dropping the person straight on the board. Saving preferences through the board Categories screen also sets it. */
  workPrefsAnswered: integer("work_prefs_answered").notNull().default(0),
  /** The Terms version the person agreed to, and when. Null until
      they pass the first-time agreement gate. */
  termsVersion: integer("terms_version"),
  termsAgreedAt: integer("terms_agreed_at", { mode: "timestamp_ms" }),
  verificationStatus: text("verification_status", { enum: VERIFICATION_STATUSES })
    .notNull()
    .default("unverified"),
  offersServices: integer("offers_services").notNull().default(0),
  /** Optional GPS position used only for distance matching. Written location stays primary. */
  gpsLat: real("gps_lat"),
  gpsLng: real("gps_lng"),
  /** Coordinates of the person's picked place, copied from the real place record they picked (HDX Liberia settlements). Null only for profiles saved before the real place data loaded, or for the few Greater Monrovia community towns with no surveyed point. */
  placeLat: real("place_lat"),
  placeLng: real("place_lng"),
  tradeCategory: text("trade_category"),
  bio: text("bio").notNull().default(""),
  yearsExperience: integer("years_experience"),
  available: integer("available").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** One-time codes for password-free sign-in: name + phone + code is the whole setup. */
export const signinCodes = sqliteTable("signin_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phone: text("phone").notNull(),
  code: text("code").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  used: integer("used").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull(),
  landmark: text("landmark"),
  budgetAmount: integer("budget_amount"),
  budgetCurrency: text("budget_currency").notNull().default("USD"),
  budgetType: text("budget_type").notNull().default("Fixed price"),
  urgency: text("urgency").notNull().default("Right now"),
  /** The exact day the person picked for the job, as YYYY-MM-DD. Null only for Need It NOW jobs, which mean right now. */
  scheduledDate: text("scheduled_date"),
  /** The exact time the person picked for the job, like "9:00 AM". Null only for Need It NOW jobs. */
  scheduledTime: text("scheduled_time"),
  /** How to get to the poster's house, in their own words, copied automatically from their profile when the job is posted. Shown to the worker on the job with the call number. */
  houseDirections: text("house_directions"),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  /** The number the worker should call for this job (defaults to the profile phone). */
  contactPhone: text("contact_phone"),
  /** The exact detailed task picked in the deep service list, e.g. "Fix a leaking pipe". */
  task: text("task"),
  customerProfileId: integer("customer_profile_id"),
  /** Optional GPS pin saved with the job, from the phone's live location or a map pin drop. */
  gpsLat: real("gps_lat"),
  gpsLng: real("gps_lng"),
  /** Coordinates of the place the job was posted from, copied from the poster's picked real place record. Find work orders by the distance between these and the worker's place coordinates. */
  placeLat: real("place_lat"),
  placeLng: real("place_lng"),
  status: text("status", { enum: JOB_STATUSES }).notNull().default("open"),
  providerName: text("provider_name"),
  providerPhone: text("provider_phone"),
  /** The unified profile id of the worker who accepted the job. */
  providerId: integer("provider_id"),
  /** When the worker confirmed, after calling the poster, that they will do the job. */
  workerConfirmedAt: integer("worker_confirmed_at", { mode: "timestamp_ms" }),
  /** A new price the worker proposed after the confirmation call, in the job's own currency. One round only: poster accepts it or releases the worker and the job returns to open at the original price. */
  proposedBudgetAmount: integer("proposed_budget_amount"),
  priceProposedAt: integer("price_proposed_at", { mode: "timestamp_ms" }),
  /** Simulated Mobile Money state for the approved hold and release flow: waiting, held, or paid. No real money moves in this test launch. */
  paymentState: text("payment_state", { enum: JOB_PAYMENT_STATES }).notNull().default("waiting"),
  /** When the poster marked the simulated Mobile Money as sent and Jackwork marked it held. */
  paymentMarkedAt: integer("payment_marked_at", { mode: "timestamp_ms" }),
  /** Proof the worker supplied before starting: a picture, video, or audio recording stored as a blob. */
  beforeProofBlobKey: text("before_proof_blob_key"),
  beforeProofMime: text("before_proof_mime"),
  /** Proof the worker supplied when marking the job done: a picture, video, or audio recording stored as a blob. */
  afterProofBlobKey: text("after_proof_blob_key"),
  afterProofMime: text("after_proof_mime"),
  /** When the worker marked the job done. Poster confirmation or the automatic completion window runs from this moment. */
  workerDoneAt: integer("worker_done_at", { mode: "timestamp_ms" }),
  /** When the poster confirmed the job is done. */
  posterConfirmedAt: integer("poster_confirmed_at", { mode: "timestamp_ms" }),
  /** When the job reached completed, by poster confirmation or by the automatic safety valve. */
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  /** True when the safety valve completed the job because the poster did not act in time. */
  autoCompleted: integer("auto_completed").notNull().default(0),
  /** A problem reported by either side. It freezes automatic completion and flags the job for admin. */
  problemReported: integer("problem_reported").notNull().default(0),
  problemBy: text("problem_by"),
  problemAt: integer("problem_at", { mode: "timestamp_ms" }),
  rating: integer("rating"),
  review: text("review"),
  payMethod: text("pay_method").notNull().default("Cash"),
  ratingByProvider: integer("rating_by_provider"),
  reviewByProvider: text("review_by_provider"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** One notification per job event, addressed to one person. The in-app
    list reads these; readAt is set when the person opens the list.
    smsStatus records what happened with the text message for the same
    event: while no SMS line is connected it stays "waiting_for_line"
    and no text is sent. */
export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id").notNull(),
  jobId: integer("job_id"),
  kind: text("kind").notNull(),
  text: text("text").notNull(),
  smsStatus: text("sms_status").notNull().default("waiting_for_line"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  readAt: integer("read_at", { mode: "timestamp_ms" }),
});

/** Web Push subscriptions, one per browser or installed app where the
    person turned phone notifications on. */
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
