import { z } from "zod";

const trimmedString = (maximum) => z.string().trim().min(1).max(maximum);
const email = z.string().trim().email().max(254).transform(value => value.toLowerCase());
const phone = z.string().trim().min(7).max(40).regex(/^[+\d().\-\s]+$/, "Enter a valid phone number.");
const consent = z.preprocess(value => value === true || value === "true", z.literal(true));

export const hireRequestSchema = z.object({
    professionalId: z.uuid(),
    customerName: trimmedString(120),
    email,
    phone,
    reason: trimmedString(1500),
    budgetKes: z.number().int().min(0).max(5000000).nullable(),
    consent
}).strict();

export const professionalSchema = z.object({
    displayName: trimmedString(80),
    fullName: trimmedString(120),
    email,
    phone,
    role: z.enum(["Bouncer", "Bodyguard", "Security guard", "Watchman", "Personal security", "Other"]),
    experienceYears: z.coerce.number().int().min(0).max(60),
    description: trimmedString(1200),
    consent
}).strict();

export const jobApplicationSchema = z.object({
    jobId: z.uuid(),
    applicantName: trimmedString(120),
    email,
    phone,
    experience: z.string().trim().max(1200),
    consent
}).strict();

export const jobSchema = z.object({
    title: trimmedString(120),
    category: trimmedString(80),
    description: trimmedString(2500),
    county: z.string().trim().max(80).nullable(),
    payMinKes: z.number().int().min(0).max(5000000).nullable(),
    payMaxKes: z.number().int().min(0).max(5000000).nullable(),
    deadline: z.iso.date().nullable()
}).strict().refine(
    value => value.payMinKes == null || value.payMaxKes == null || value.payMinKes <= value.payMaxKes,
    { message: "Maximum pay must be greater than or equal to minimum pay.", path: ["payMaxKes"] }
);

export const hireUpdateSchema = z.object({
    status: z.enum(["new", "contacted", "meeting_arranged", "agreement_signed", "closed", "rejected"]),
    adminNotes: z.string().trim().max(2000),
    agreementDate: z.iso.date().nullable()
}).strict();

export const applicationUpdateSchema = z.object({
    status: z.enum(["new", "contacted", "meeting_arranged", "accepted", "rejected", "closed"]),
    adminNotes: z.string().trim().max(2000)
}).strict();

export const profileUpdateSchema = z.object({
    status: z.enum(["pending", "published", "hidden"])
}).strict();

export const jobStatusSchema = z.object({
    status: z.enum(["open", "closed"])
}).strict();

export const loginSchema = z.object({
    email,
    password: z.string().min(1).max(200)
}).strict();
