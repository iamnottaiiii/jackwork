import { defineAction, z, type ActionsModule } from "@hatch/space-sdk";
import { and, desc, eq, sql } from "drizzle-orm";
import * as schema from "./schema";

const jobShape = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string(),
  description: z.string(),
  location: z.string(),
  landmark: z.string().nullable(),
  budgetAmount: z.number().nullable(),
  budgetCurrency: z.string(),
  budgetType: z.string(),
  urgency: z.string(),
  scheduledDate: z.string().nullable(),
  scheduledTime: z.string().nullable(),
  houseDirections: z.string().nullable(),
  customerName: z.string(),
  customerPhone: z.string(),
  contactPhone: z.string().nullable(),
  task: z.string().nullable(),
  customerProfileId: z.number().nullable(),
  gpsLat: z.number().nullable(),
  gpsLng: z.number().nullable(),
  placeLat: z.number().nullable(),
  placeLng: z.number().nullable(),
  status: z.string(),
  providerName: z.string().nullable(),
  providerPhone: z.string().nullable(),
  providerId: z.number().nullable(),
  rating: z.number().nullable(),
  review: z.string().nullable(),
  payMethod: z.string(),
  ratingByProvider: z.number().nullable(),
  reviewByProvider: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const profileShape = z.object({
  id: z.number(),
  fullName: z.string(),
  phone: z.string(),
  location: z.string(),
  address: z.string(),
  dateOfBirth: z.string().nullable(),
  idType: z.string().nullable(),
  hasIdOnFile: z.boolean(),
  profileImageUrl: z.string().nullable(),
  county: z.string().nullable(),
  district: z.string().nullable(),
  city: z.string().nullable(),
  community: z.string().nullable(),
  houseDirections: z.string().nullable(),
  mobileMoneyNumber: z.string().nullable(),
  workPreferences: z.array(z.string()),
  verificationStatus: z.string(),
  offersServices: z.boolean(),
  gpsLat: z.number().nullable(),
  gpsLng: z.number().nullable(),
  placeLat: z.number().nullable(),
  placeLng: z.number().nullable(),
  tradeCategory: z.string().nullable(),
  bio: z.string(),
  yearsExperience: z.number().nullable(),
  available: z.boolean(),
  createdAt: z.string(),
});

/* What the Find work board may see of other people: only the
   photo and the picked place a job card shows. Never phone,
   date of birth, ID number, ID photo, or Mobile Money number. */
const boardProfileShape = z.object({
  id: z.number(),
  profileImageUrl: z.string().nullable(),
  county: z.string().nullable(),
  district: z.string().nullable(),
  city: z.string().nullable(),
  community: z.string().nullable(),
  address: z.string(),
});

const workerShape = z.object({
  id: z.number(),
  name: z.string(),
  category: z.string(),
  location: z.string(),
  bio: z.string(),
  yearsExperience: z.number().nullable(),
  available: z.boolean(),
  verificationStatus: z.string(),
  jobsCompleted: z.number(),
  avgRating: z.number().nullable(),
  createdAt: z.string(),
});

type JobRow = typeof schema.jobs.$inferSelect;
type ProfileRow = typeof schema.profiles.$inferSelect;

function toJob(row: JobRow, stripPrivate = false): z.infer<typeof jobShape> {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    location: row.location,
    landmark: row.landmark ?? null,
    budgetAmount: row.budgetAmount ?? null,
    budgetCurrency: row.budgetCurrency,
    budgetType: row.budgetType,
    urgency: row.urgency,
    scheduledDate: row.scheduledDate ?? null,
    scheduledTime: row.scheduledTime ?? null,
    // Private to the poster and the worker on the job: the call
    // numbers, the house directions, and the person's own GPS pin
    // never go to other board viewers. placeLat/placeLng stay:
    // they are the surveyed coordinates of a named town from the
    // public settlement dataset, the same for everyone there,
    // and the board's distance feature runs on them.
    houseDirections: stripPrivate ? null : (row.houseDirections ?? null),
    customerName: row.customerName,
    customerPhone: stripPrivate ? "" : row.customerPhone,
    contactPhone: stripPrivate ? null : (row.contactPhone ?? null),
    task: row.task ?? null,
    customerProfileId: row.customerProfileId ?? null,
    gpsLat: stripPrivate ? null : (row.gpsLat ?? null),
    gpsLng: stripPrivate ? null : (row.gpsLng ?? null),
    placeLat: row.placeLat ?? null,
    placeLng: row.placeLng ?? null,
    status: row.status,
    providerName: row.providerName ?? null,
    providerPhone: stripPrivate ? null : (row.providerPhone ?? null),
    providerId: row.providerId ?? null,
    rating: row.rating ?? null,
    review: row.review ?? null,
    payMethod: row.payMethod === "Mobile Money" ? "Mobile Money" : "Mobile Money",
    ratingByProvider: row.ratingByProvider ?? null,
    reviewByProvider: row.reviewByProvider ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function toProfile(
  ctx: { blobs: { getUrl: (k: string) => Promise<string> } },
  row: ProfileRow,
): Promise<z.infer<typeof profileShape>> {
  // The ID document itself (its number and photo) is NOT part of
  // the profile payload. Only the session holder can fetch it,
  // through getMyIdDocument.
  let profileImageUrl: string | null = null;
  if (row.profileBlobKey) {
    try {
      profileImageUrl = await ctx.blobs.getUrl(row.profileBlobKey);
    } catch {
      profileImageUrl = null;
    }
  }
  return {
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    location: row.location,
    address: row.address,
    dateOfBirth: row.dateOfBirth ?? null,
    idType: row.idType ?? null,
    hasIdOnFile: !!row.idBlobKey,
    profileImageUrl,
    county: row.county ?? null,
    district: row.district ?? null,
    city: row.city ?? null,
    community: row.community ?? (row.address ? row.address : null),
    houseDirections: row.houseDirections ?? null,
    mobileMoneyNumber: row.mobileMoneyNumber ?? null,
    workPreferences: (() => {
      try {
        const v: unknown = row.workPreferences ? JSON.parse(row.workPreferences) : [];
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
      } catch {
        return [];
      }
    })(),
    verificationStatus: row.verificationStatus,
    offersServices: row.offersServices === 1,
    gpsLat: row.gpsLat ?? null,
    gpsLng: row.gpsLng ?? null,
    placeLat: row.placeLat ?? null,
    placeLng: row.placeLng ?? null,
    tradeCategory: row.tradeCategory ?? null,
    bio: row.bio,
    yearsExperience: row.yearsExperience ?? null,
    available: row.available === 1,
    createdAt: row.createdAt.toISOString(),
  };
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export const Actions = {
  getOverview: defineAction({
    description: "Returns marketplace counts: open jobs, total jobs, verified profiles, workers, completed jobs.",
    request: z.object({}),
    response: z.object({
      openJobs: z.number(),
      totalJobs: z.number(),
      completedJobs: z.number(),
      totalProfiles: z.number(),
      verifiedProfiles: z.number(),
      totalWorkers: z.number(),
      availableWorkers: z.number(),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const jobRows = await db
        .select({ status: schema.jobs.status, n: sql<number>`count(*)` })
        .from(schema.jobs)
        .groupBy(schema.jobs.status);
      const profRows = await db
        .select({
          verificationStatus: schema.profiles.verificationStatus,
          offersServices: schema.profiles.offersServices,
          available: schema.profiles.available,
          n: sql<number>`count(*)`,
        })
        .from(schema.profiles)
        .groupBy(
          schema.profiles.verificationStatus,
          schema.profiles.offersServices,
          schema.profiles.available,
        );
      let openJobs = 0, totalJobs = 0, completedJobs = 0;
      for (const r of jobRows) {
        totalJobs += r.n;
        if (r.status === "open") openJobs = r.n;
        if (r.status === "completed") completedJobs = r.n;
      }
      let totalProfiles = 0, verifiedProfiles = 0, totalWorkers = 0, availableWorkers = 0;
      for (const r of profRows) {
        totalProfiles += r.n;
        if (r.verificationStatus === "verified") verifiedProfiles += r.n;
        if (r.offersServices === 1) {
          totalWorkers += r.n;
          if (r.available === 1) availableWorkers += r.n;
        }
      }
      return { openJobs, totalJobs, completedJobs, totalProfiles, verifiedProfiles, totalWorkers, availableWorkers };
    },
  }),

  /* ---------------- unified profile ---------------- */

  getMyProfile: defineAction({
    description: "Loads the caller's own unified profile. Requires the session token issued when the person proved their sign-in code; a phone number alone never returns a profile.",
    request: z.object({
      phone: z.string().min(6).max(30),
      sessionToken: z.string().min(10).max(300),
    }),
    response: z.object({ profile: profileShape.nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const target = digitsOnly(args.phone);
      const rows = await db.select().from(schema.profiles).orderBy(desc(schema.profiles.id));
      const mine = rows.find((r) => {
        const d = digitsOnly(r.phone);
        return d === target || d.endsWith(target.slice(-7)) || target.endsWith(d.slice(-7));
      });
      if (!mine) return { profile: null };
      if (!mine.sessionToken || mine.sessionToken !== args.sessionToken) return { profile: null };
      return { profile: await toProfile(ctx, mine) };
    },
  }),

  getMyIdDocument: defineAction({
    description: "Returns the caller's own ID document details (type, last digits of the number, and the photo) for their My ID screen. Only the session token holder for that profile can read it.",
    request: z.object({
      profileId: z.number().int().positive(),
      sessionToken: z.string().min(10).max(300),
    }),
    response: z.object({
      ok: z.boolean(),
      idType: z.string().nullable(),
      idNumberTail: z.string().nullable(),
      idImageUrl: z.string().nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.profiles).where(eq(schema.profiles.id, args.profileId)).limit(1);
      const p = rows[0];
      if (!p || !p.sessionToken || p.sessionToken !== args.sessionToken) {
        return { ok: false, idType: null, idNumberTail: null, idImageUrl: null };
      }
      let idImageUrl: string | null = null;
      if (p.idBlobKey) {
        try {
          idImageUrl = await ctx.blobs.getUrl(p.idBlobKey);
        } catch {
          idImageUrl = null;
        }
      }
      return {
        ok: true,
        idType: p.idType ?? null,
        idNumberTail: p.idNumber ? p.idNumber.slice(-3) : null,
        idImageUrl,
      };
    },
  }),

  createProfile: defineAction({
    description: "Registers a person once with their real information. This one profile is used both to post jobs and to accept jobs.",
    request: z.object({
      fullName: z.string().min(2).max(80),
      phone: z.string().min(6).max(30),
      location: z.string().min(2).max(120),
      address: z.string().max(200).default(""),
      county: z.string().max(60).optional(),
      district: z.string().max(80).optional(),
      city: z.string().max(80).optional(),
      dateOfBirth: z.string().max(20).optional(),
      offersServices: z.boolean().default(false),
      tradeCategory: z.string().max(60).optional(),
      bio: z.string().max(600).default(""),
      yearsExperience: z.number().int().min(0).max(60).optional(),
    }),
    response: z.object({ id: z.number(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const target = digitsOnly(args.phone);
      const rows = await db.select({ phone: schema.profiles.phone }).from(schema.profiles);
      const exists = rows.some((r) => {
        const d = digitsOnly(r.phone);
        return d === target || d.endsWith(target.slice(-7)) || target.endsWith(d.slice(-7));
      });
      if (exists) {
        return { id: 0, error: "A profile with this phone number already exists. One person, one profile." };
      }
      const now = new Date();
      const result = await db
        .insert(schema.profiles)
        .values({
          fullName: args.fullName.trim(),
          phone: args.phone.trim(),
          location: args.location.trim(),
          address: args.address.trim(),
          county: args.county?.trim() ? args.county.trim() : null,
          district: args.district?.trim() ? args.district.trim() : null,
          city: args.city?.trim() ? args.city.trim() : null,
          dateOfBirth: args.dateOfBirth?.trim() ? args.dateOfBirth.trim() : null,
          offersServices: args.offersServices ? 1 : 0,
          tradeCategory: args.offersServices && args.tradeCategory ? args.tradeCategory : null,
          bio: args.bio.trim(),
          yearsExperience: args.yearsExperience ?? null,
          available: 1,
          verificationStatus: "unverified",
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: schema.profiles.id });
      const inserted = result[0];
      if (!inserted) throw new Error("createProfile: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id, error: null };
    },
  }),

  uploadIdDocument: defineAction({
    description: "Uploads the person's ID document photo (license or passport) to their profile and moves verification to pending.",
    request: z.object({
      profileId: z.number().int().positive(),
      idType: z.enum(["National ID", "Voter ID", "Passport", "Driver license", "Work ID", "School ID", "Other ID"]),
      idNumber: z.string().min(3).max(60),
      dataBase64: z.string().min(10),
      mimeType: z.string().min(3).max(60),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      if (!args.mimeType.startsWith("image/")) {
        return { ok: false, error: "Please upload a photo of the ID (image file)." };
      }
      const rows = await db.select().from(schema.profiles).where(eq(schema.profiles.id, args.profileId)).limit(1);
      if (!rows[0]) return { ok: false, error: "Profile not found." };
      const key = `id-documents/profile-${args.profileId}`;
      const bytes = Buffer.from(args.dataBase64, "base64");
      await ctx.blobs.put(key, bytes, { contentType: args.mimeType });
      await db
        .update(schema.profiles)
        .set({
          idType: args.idType,
          idNumber: args.idNumber.trim(),
          idBlobKey: key,
          idMime: args.mimeType,
          verificationStatus: "pending",
          updatedAt: new Date(),
        })
        .where(eq(schema.profiles.id, args.profileId));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  confirmVerification: defineAction({
    description: "Completes ID verification: the person confirms the uploaded ID is theirs and the profile details match it. Sets the profile to verified.",
    request: z.object({ profileId: z.number().int().positive() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.profiles).where(eq(schema.profiles.id, args.profileId)).limit(1);
      const p = rows[0];
      if (!p) return { ok: false, error: "Profile not found." };
      if (!p.idBlobKey) return { ok: false, error: "Upload your ID document first." };
      await db
        .update(schema.profiles)
        .set({ verificationStatus: "verified", updatedAt: new Date() })
        .where(eq(schema.profiles.id, args.profileId));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  updateWorkProfile: defineAction({
    description: "Updates the work side of the unified profile: whether the person offers services, their trade, bio, experience, and availability.",
    request: z.object({
      profileId: z.number().int().positive(),
      offersServices: z.boolean(),
      tradeCategory: z.string().max(60).optional(),
      bio: z.string().max(600).default(""),
      yearsExperience: z.number().int().min(0).max(60).optional(),
      available: z.boolean().default(true),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.profiles)
        .set({
          offersServices: args.offersServices ? 1 : 0,
          tradeCategory: args.offersServices && args.tradeCategory ? args.tradeCategory : null,
          bio: args.bio.trim(),
          yearsExperience: args.yearsExperience ?? null,
          available: args.available ? 1 : 0,
          updatedAt: new Date(),
        })
        .where(eq(schema.profiles.id, args.profileId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  updateProfileDetails: defineAction({
    description: "Edits the person's basic profile details: name, location, and address on the unified profile.",
    request: z.object({
      profileId: z.number().int().positive(),
      fullName: z.string().min(2).max(80),
      location: z.string().min(2).max(120),
      address: z.string().max(200).default(""),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.profiles)
        .set({
          fullName: args.fullName.trim(),
          location: args.location.trim(),
          address: args.address.trim(),
          updatedAt: new Date(),
        })
        .where(eq(schema.profiles.id, args.profileId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  updateHomeLocation: defineAction({
    description: "Saves the home place picked from the real Liberia place data: county, district, town, and the community where a real source names one (Greater Monrovia only; a town pick with no community is complete by itself). The community is stored as its own field (and mirrored in address for older displays) so people and jobs can be filtered and matched by it, and the picked record's coordinates are stored with the place so distance matching is real.",
    request: z.object({
      profileId: z.number().int().positive(),
      county: z.string().min(2).max(60),
      district: z.string().max(80).default(""),
      city: z.string().min(2).max(80),
      community: z.string().max(120).optional(),
      houseDirections: z.string().max(300).optional(),
      placeLat: z.number().min(-90).max(90).optional(),
      placeLng: z.number().min(-180).max(180).optional(),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const location = [args.city.trim(), args.county.trim()].filter(Boolean).join(", ");
      const community = args.community?.trim() ? args.community.trim() : null;
      await db
        .update(schema.profiles)
        .set({
          county: args.county.trim(),
          district: args.district.trim() || null,
          city: args.city.trim(),
          community,
          ...(args.houseDirections !== undefined ? { houseDirections: args.houseDirections.trim() || null } : {}),
          location,
          address: community ?? "",
          placeLat: args.placeLat ?? null,
          placeLng: args.placeLng ?? null,
          updatedAt: new Date(),
        })
        .where(eq(schema.profiles.id, args.profileId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  uploadProfilePhoto: defineAction({
    description: "Uploads the person's own profile picture to their profile.",
    request: z.object({
      profileId: z.number().int().positive(),
      dataBase64: z.string().min(10),
      mimeType: z.string().min(3).max(60),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      if (!args.mimeType.startsWith("image/")) {
        return { ok: false, error: "Please pick a photo (image file)." };
      }
      const rows = await db.select().from(schema.profiles).where(eq(schema.profiles.id, args.profileId)).limit(1);
      if (!rows[0]) return { ok: false, error: "Profile not found." };
      const key = `profile-photos/profile-${args.profileId}`;
      const bytes = Buffer.from(args.dataBase64, "base64");
      await ctx.blobs.put(key, bytes, { contentType: args.mimeType });
      await db
        .update(schema.profiles)
        .set({ profileBlobKey: key, profileMime: args.mimeType, updatedAt: new Date() })
        .where(eq(schema.profiles.id, args.profileId));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  listWorkers: defineAction({
    description: "Lists people whose unified profile offers services, with completed job counts and average ratings from finished jobs. Browsing fields only: no phone numbers — contact details belong to the parties of an accepted job.",
    request: z.object({
      category: z.string().optional(),
      limit: z.number().int().positive().max(200).default(100),
    }),
    response: z.object({ workers: z.array(workerShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.profiles)
        .where(
          args.category
            ? and(eq(schema.profiles.offersServices, 1), eq(schema.profiles.tradeCategory, args.category))
            : eq(schema.profiles.offersServices, 1),
        )
        .orderBy(desc(schema.profiles.id))
        .limit(args.limit);
      const done = await db
        .select({
          providerId: schema.jobs.providerId,
          providerPhone: schema.jobs.providerPhone,
          rating: schema.jobs.rating,
        })
        .from(schema.jobs)
        .where(eq(schema.jobs.status, "completed"));
      const workers = rows.map((p) => {
        const mine = done.filter(
          (j) => j.providerId === p.id || (j.providerId == null && j.providerPhone === p.phone),
        );
        const rated = mine.filter((j) => j.rating != null);
        const avg = rated.length
          ? Math.round((rated.reduce((s, j) => s + (j.rating ?? 0), 0) / rated.length) * 10) / 10
          : null;
        return {
          id: p.id,
          name: p.fullName,
          category: p.tradeCategory ?? "Other",
          location: p.location,
          bio: p.bio,
          yearsExperience: p.yearsExperience ?? null,
          available: p.available === 1,
          verificationStatus: p.verificationStatus,
          jobsCompleted: mine.length,
          avgRating: avg,
          createdAt: p.createdAt.toISOString(),
        };
      });
      return { workers };
    },
  }),

  /* ---------------- sign-in: name + phone + code, no password ---------------- */

  requestSignInCode: defineAction({
    description: "Sends a one-time sign-in code to a phone number. On this first build the code is returned for on-screen delivery until the live texting line is connected.",
    request: z.object({ phone: z.string().min(6).max(30) }),
    response: z.object({ sent: z.boolean(), deliveredCode: z.string(), profileExists: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const target = digitsOnly(args.phone);
      const all = await db.select().from(schema.profiles);
      const profileExists = all.some((r) => {
        const d = digitsOnly(r.phone);
        return d === target || d.endsWith(target.slice(-7)) || target.endsWith(d.slice(-7));
      });
      // Invalidate older codes for this phone.
      const old = await db.select().from(schema.signinCodes).where(eq(schema.signinCodes.used, 0));
      for (const row of old) {
        const d = digitsOnly(row.phone);
        if (d === target || d.endsWith(target.slice(-7)) || target.endsWith(d.slice(-7))) {
          await db.update(schema.signinCodes).set({ used: 1 }).where(eq(schema.signinCodes.id, row.id));
        }
      }
      const code = String(Math.floor(1000 + Math.random() * 9000));
      const now = new Date();
      await db.insert(schema.signinCodes).values({
        phone: args.phone.trim(),
        code,
        expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
        used: 0,
        createdAt: now,
      });
      return { sent: true, deliveredCode: code, profileExists };
    },
  }),

  verifySignInCode: defineAction({
    description: "Checks a sign-in code. If the phone is new, creates the person's one profile with their name. On success it issues a fresh session token: the profile is only ever handed back to the holder of that token.",
    request: z.object({
      phone: z.string().min(6).max(30),
      code: z.string().min(4).max(8),
      name: z.string().max(80).default(""),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable(), profileId: z.number().nullable(), sessionToken: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const target = digitsOnly(args.phone);
      const codes = await db
        .select()
        .from(schema.signinCodes)
        .where(eq(schema.signinCodes.used, 0))
        .orderBy(desc(schema.signinCodes.id));
      const match = codes.find((r) => {
        const d = digitsOnly(r.phone);
        return (d === target || d.endsWith(target.slice(-7)) || target.endsWith(d.slice(-7))) && r.code === args.code.trim();
      });
      if (!match) return { ok: false, error: "That code is not right. Check it and try again, or send a new code.", profileId: null, sessionToken: null };
      if (match.expiresAt.getTime() < Date.now()) {
        return { ok: false, error: "That code has expired. Send a new one.", profileId: null, sessionToken: null };
      }
      await db.update(schema.signinCodes).set({ used: 1 }).where(eq(schema.signinCodes.id, match.id));
      const sessionToken = `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
      const all = await db.select().from(schema.profiles).orderBy(desc(schema.profiles.id));
      const existing = all.find((r) => {
        const d = digitsOnly(r.phone);
        return d === target || d.endsWith(target.slice(-7)) || target.endsWith(d.slice(-7));
      });
      if (existing) {
        await db
          .update(schema.profiles)
          .set({ sessionToken, updatedAt: new Date() })
          .where(eq(schema.profiles.id, existing.id));
        ctx.invalidateQueries();
        return { ok: true, error: null, profileId: existing.id, sessionToken };
      }
      const name = args.name.trim();
      if (name.length < 2) {
        return { ok: false, error: "Enter your name so people know who they are dealing with.", profileId: null, sessionToken: null };
      }
      const now = new Date();
      const result = await db
        .insert(schema.profiles)
        .values({
          fullName: name,
          phone: args.phone.trim(),
          location: "",
          address: "",
          offersServices: 0,
          bio: "",
          available: 1,
          verificationStatus: "unverified",
          sessionToken,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: schema.profiles.id });
      const inserted = result[0];
      if (!inserted) throw new Error("verifySignInCode: profile insert returned no rows");
      ctx.invalidateQueries();
      return { ok: true, error: null, profileId: inserted.id, sessionToken };
    },
  }),

  /* ---------------- jobs ---------------- */

  listJobs: defineAction({
    description: "Lists jobs, newest first, optionally filtered by status or category. A job's private parts (call numbers, house directions, the poster's own GPS pin) are included only for the viewer whose verified session token belongs to the person who posted the job or accepted it; the viewer is derived from the token server-side, never from a caller-supplied id. Other viewers get the public board view.",
    request: z.object({
      status: z.string().optional(),
      category: z.string().optional(),
      limit: z.number().int().positive().max(200).default(100),
      viewerSessionToken: z.string().min(10).max(300).optional(),
    }),
    response: z.object({ jobs: z.array(jobShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const conds = [];
      if (args.status) conds.push(eq(schema.jobs.status, args.status as "open" | "accepted" | "in_progress" | "completed" | "cancelled"));
      if (args.category) conds.push(eq(schema.jobs.category, args.category));
      const rows = await db
        .select()
        .from(schema.jobs)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(schema.jobs.id))
        .limit(args.limit);
      let viewerId: number | null = null;
      let viewerPhone = "";
      if (args.viewerSessionToken) {
        const vp = await db
          .select({ id: schema.profiles.id, phone: schema.profiles.phone })
          .from(schema.profiles)
          .where(eq(schema.profiles.sessionToken, args.viewerSessionToken))
          .limit(1);
        if (vp[0]) {
          viewerId = vp[0].id;
          viewerPhone = digitsOnly(vp[0].phone);
        }
      }
      const phoneMatch = (p: string | null) => {
        if (!p || !viewerPhone) return false;
        const d = digitsOnly(p);
        return d === viewerPhone || d.endsWith(viewerPhone.slice(-7)) || viewerPhone.endsWith(d.slice(-7));
      };
      const isParty = (j: JobRow) =>
        viewerId != null &&
        (j.customerProfileId === viewerId ||
          j.providerId === viewerId ||
          phoneMatch(j.customerPhone) ||
          phoneMatch(j.providerPhone));
      return { jobs: rows.map((j) => toJob(j, !isParty(j))) };
    },
  }),

  createJob: defineAction({
    description: "Posts a new service request from a customer's unified profile (Post a job). Starts as open and shows right away in My jobs and on the Find work board. Non-emergency jobs carry the exact scheduled day (YYYY-MM-DD) and time the poster picked; Need It NOW jobs have neither and mean right now.",
    request: z.object({
      title: z.string().min(3).max(120),
      category: z.string().min(1),
      description: z.string().min(10).max(2000),
      location: z.string().min(2).max(120),
      landmark: z.string().max(200).optional(),
      budgetAmount: z.number().int().positive().max(100000000).optional(),
      budgetCurrency: z.enum(["USD", "LRD"]).default("USD"),
      budgetType: z.string().default("Fixed price"),
      urgency: z.string().default("Right now"),
      scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      scheduledTime: z.string().regex(/^\d{1,2}:\d{2}\s(AM|PM)$/).optional(),
      houseDirections: z.string().max(300).optional(),
      customerName: z.string().min(2).max(80),
      customerPhone: z.string().min(6).max(30),
      contactPhone: z.string().max(30).optional(),
      task: z.string().max(120).optional(),
      customerProfileId: z.number().int().positive().optional(),
      gpsLat: z.number().min(-90).max(90).optional(),
      gpsLng: z.number().min(-180).max(180).optional(),
      placeLat: z.number().min(-90).max(90).optional(),
      placeLng: z.number().min(-180).max(180).optional(),
      payMethod: z.enum(["Mobile Money"]).default("Mobile Money"),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const now = new Date();
      const result = await db
        .insert(schema.jobs)
        .values({
          title: args.title.trim(),
          category: args.category,
          description: args.description.trim(),
          location: args.location.trim(),
          landmark: args.landmark?.trim() ? args.landmark.trim() : null,
          budgetAmount: args.budgetAmount ?? null,
          budgetCurrency: args.budgetCurrency,
          budgetType: args.budgetType,
          urgency: args.urgency,
          scheduledDate: args.scheduledDate ?? null,
          scheduledTime: args.scheduledTime ?? null,
          houseDirections: args.houseDirections?.trim() ? args.houseDirections.trim() : null,
          customerName: args.customerName.trim(),
          customerPhone: args.customerPhone.trim(),
          contactPhone: args.contactPhone?.trim() ? args.contactPhone.trim() : args.customerPhone.trim(),
          task: args.task?.trim() ? args.task.trim() : null,
          customerProfileId: args.customerProfileId ?? null,
          gpsLat: args.gpsLat ?? null,
          gpsLng: args.gpsLng ?? null,
          placeLat: args.placeLat ?? null,
          placeLng: args.placeLng ?? null,
          payMethod: args.payMethod,
          status: "open",
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: schema.jobs.id });
      const inserted = result[0];
      if (!inserted) throw new Error("createJob: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  acceptJob: defineAction({
    description: "A signed-in profile accepts an open job as the service provider. Uses the same unified profile the person posts jobs with.",
    request: z.object({
      jobId: z.number().int().positive(),
      providerProfileId: z.number().int().positive(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const jobRows = await db.select().from(schema.jobs).where(eq(schema.jobs.id, args.jobId)).limit(1);
      const job = jobRows[0];
      if (!job) return { ok: false, error: "That job no longer exists." };
      if (job.status !== "open") return { ok: false, error: "Someone else already took this job." };
      const profRows = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, args.providerProfileId))
        .limit(1);
      const prof = profRows[0];
      if (!prof) return { ok: false, error: "Create your profile first, then you can accept jobs." };
      if (job.customerProfileId === prof.id) {
        return { ok: false, error: "You cannot accept your own job." };
      }
      await db
        .update(schema.jobs)
        .set({
          status: "accepted",
          providerName: prof.fullName,
          providerPhone: prof.phone,
          providerId: prof.id,
          updatedAt: new Date(),
        })
        .where(eq(schema.jobs.id, args.jobId));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  updateJobStatus: defineAction({
    description: "Moves a job to a new status: in_progress, completed, cancelled, or back to open (releases the worker).",
    request: z.object({
      jobId: z.number().int().positive(),
      status: z.enum(["open", "in_progress", "completed", "cancelled"]),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const patch: Partial<JobRow> = { status: args.status, updatedAt: new Date() };
      if (args.status === "open") {
        patch.providerName = null;
        patch.providerPhone = null;
        patch.providerId = null;
      }
      await db.update(schema.jobs).set(patch).where(eq(schema.jobs.id, args.jobId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  rateJob: defineAction({
    description: "Customer rates a completed job from 1 to 5 stars with an optional short review.",
    request: z.object({
      jobId: z.number().int().positive(),
      rating: z.number().int().min(1).max(5),
      review: z.string().max(500).optional(),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.jobs)
        .set({ rating: args.rating, review: args.review?.trim() ? args.review.trim() : null, updatedAt: new Date() })
        .where(eq(schema.jobs.id, args.jobId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  rateCustomer: defineAction({
    description: "Provider rates the customer after a completed job, 1 to 5 stars, with an optional short note.",
    request: z.object({
      jobId: z.number().int().positive(),
      rating: z.number().int().min(1).max(5),
      review: z.string().max(500).optional(),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.jobs)
        .set({ ratingByProvider: args.rating, reviewByProvider: args.review?.trim() ? args.review.trim() : null, updatedAt: new Date() })
        .where(eq(schema.jobs.id, args.jobId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setMyLocation: defineAction({
    description: "Saves the optional GPS position on a profile, used only to show distance and sort jobs nearest first.",
    request: z.object({
      profileId: z.number().int().positive(),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.profiles)
        .set({ gpsLat: args.lat, gpsLng: args.lng, updatedAt: new Date() })
        .where(eq(schema.profiles.id, args.profileId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getProfileStats: defineAction({
    description: "Returns a profile's track record: jobs done as a worker with average customer rating, and jobs posted as a customer with average worker rating.",
    request: z.object({ profileId: z.number().int().positive() }),
    response: z.object({
      jobsDone: z.number(),
      jobsPosted: z.number(),
      workerAvg: z.number().nullable(),
      workerRatingCount: z.number(),
      customerAvg: z.number().nullable(),
      customerRatingCount: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const done = await db.select().from(schema.jobs).where(eq(schema.jobs.status, "completed"));
      const asWorker = done.filter((j) => j.providerId === args.profileId);
      const asCustomer = done.filter((j) => j.customerProfileId === args.profileId);
      const wRated = asWorker.filter((j) => j.rating != null);
      const cRated = asCustomer.filter((j) => j.ratingByProvider != null);
      const avg = (rows: typeof done, pick: (j: (typeof done)[number]) => number | null) =>
        rows.length ? Math.round((rows.reduce((sum, j) => sum + (pick(j) ?? 0), 0) / rows.length) * 10) / 10 : null;
      return {
        jobsDone: asWorker.length,
        jobsPosted: asCustomer.length,
        workerAvg: avg(wRated, (j) => j.rating),
        workerRatingCount: wRated.length,
        customerAvg: avg(cRated, (j) => j.ratingByProvider),
        customerRatingCount: cRated.length,
      };
    },
  }),

  deleteJob: defineAction({
    description: "Deletes a job posting entirely.",
    request: z.object({ jobId: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.jobs).where(eq(schema.jobs.id, args.jobId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  updateMobileMoney: defineAction({
    description: "Saves the person's Mobile Money number on their profile. Payment for jobs goes from and to this number.",
    request: z.object({
      profileId: z.number().int().positive(),
      number: z.string().min(6).max(30),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.profiles)
        .set({ mobileMoneyNumber: args.number.trim(), updatedAt: new Date() })
        .where(eq(schema.profiles.id, args.profileId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  updateWorkPreferences: defineAction({
    description: "Saves which kinds of work the person wants. Preferred work shows first on the Find work board; the board still shows every open job.",
    request: z.object({
      profileId: z.number().int().positive(),
      preferences: z.array(z.string().max(60)).max(40),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.profiles)
        .set({ workPreferences: JSON.stringify(args.preferences), updatedAt: new Date() })
        .where(eq(schema.profiles.id, args.profileId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  /* ---------------- profile list (board photos and places) ---------------- */

  listAllProfiles: defineAction({
    description: "Lists board-safe profile cards newest first: only the id, profile photo, and picked place the Find work board shows on job cards. ID, phone, Mobile Money, and birth details are never included.",
    request: z.object({ limit: z.number().int().positive().max(500).default(200) }),
    response: z.object({ profiles: z.array(boardProfileShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.profiles)
        .orderBy(desc(schema.profiles.id))
        .limit(args.limit);
      const profiles: z.infer<typeof boardProfileShape>[] = [];
      for (const r of rows) {
        let profileImageUrl: string | null = null;
        if (r.profileBlobKey) {
          try {
            profileImageUrl = await ctx.blobs.getUrl(r.profileBlobKey);
          } catch {
            profileImageUrl = null;
          }
        }
        profiles.push({
          id: r.id,
          profileImageUrl,
          county: r.county ?? null,
          district: r.district ?? null,
          city: r.city ?? null,
          community: r.community ?? (r.address ? r.address : null),
          address: r.address,
        });
      }
      return { profiles };
    },
  }),

} satisfies ActionsModule;
