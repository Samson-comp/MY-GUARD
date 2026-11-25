import express from "express";
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import { fileTypeFromBuffer } from "file-type";
import { fileURLToPath } from "node:url";
import { encryptPrivateData, decryptPrivateData } from "./src/crypto.js";
import {
  hireRequestSchema,
  professionalSchema,
  jobApplicationSchema,
  jobSchema,
  hireUpdateSchema,
  applicationUpdateSchema,
  profileUpdateSchema,
  jobStatusSchema,
  loginSchema
} from "./src/validation.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageDir = path.join(__dirname, "data");
const dataFile = path.join(storageDir, "store.json");
const app = express();
const port = Number(process.env.PORT || 3000);
const firstValidationError = (error, fallback) =>
  error instanceof z.ZodError ? error.issues[0]?.message || fallback : fallback;

if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

const fallbackAdminEmail = (process.env.ADMIN_EMAIL || "admin@mysecurity.local").trim().toLowerCase();
const fallbackAdminPassword = process.env.ADMIN_PASSWORD || "AdminPass123!";

const safeReadStore = () => {
  try {
    const file = fs.readFileSync(dataFile, "utf8");
    if (!file.trim()) return { admins: [], professionals: [], hireRequests: [], jobs: [], jobApplications: [] };
    return JSON.parse(file);
  } catch {
    return { admins: [], professionals: [], hireRequests: [], jobs: [], jobApplications: [] };
  }
};

const state = safeReadStore();
state.admins ??= [];
state.professionals ??= [];
state.hireRequests ??= [];
state.jobs ??= [];
state.jobApplications ??= [];

const ensureDefaultAdmin = async () => {
  const exist = state.admins.find(item => item.email === fallbackAdminEmail);
  if (!exist) {
    const passwordHash = await bcrypt.hash(fallbackAdminPassword, 12);
    state.admins.push({ id: crypto.randomUUID(), email: fallbackAdminEmail, passwordHash, createdAt: new Date().toISOString() });
    persistStore();
  }
};

const persistStore = () => {
  fs.writeFileSync(dataFile, JSON.stringify(state, null, 2));
};

const encryptionKey = process.env.DATA_ENCRYPTION_KEY
  ? Buffer.from(process.env.DATA_ENCRYPTION_KEY, "base64")
  : Buffer.from("12345678901234567890123456789012", "utf8");

const fromStored = value => {
  if (!value) return {};
  try {
    return decryptPrivateData(value, encryptionKey);
  } catch {
    return {};
  }
};

const toStored = value => encryptPrivateData(value, encryptionKey);

const sanitizeProfessional = entry => ({
  id: entry.id,
  displayName: entry.displayName,
  role: entry.role,
  experienceYears: entry.experienceYears,
  description: entry.description,
  status: entry.status,
  hasPhoto: Boolean(entry.photoMime),
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt
});

const sanitizeJob = entry => ({
  id: entry.id,
  title: entry.title,
  category: entry.category,
  description: entry.description,
  county: entry.county,
  payMinKes: entry.payMinKes,
  payMaxKes: entry.payMaxKes,
  deadline: entry.deadline,
  status: entry.status,
  createdAt: entry.createdAt,
  applicationCount: entry.applicationCount ?? 0
});

const mustAdmin = (req, res, next) => {
  if (!req.session || !req.session.isAuthenticated) {
    return res.status(401).json({ error: "Authentication required." });
  }
  next();
};

const csrfToken = (req, res) => {
  req.session.csrfToken ??= crypto.randomBytes(24).toString("hex");
  return req.session.csrfToken;
};

const parseBody = async (req, res, next) => {
  if (req.is("application/json")) {
    express.json()(req, res, () => next());
    return;
  }
  next();
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_, file, callback) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) callback(null, true);
    else callback(new Error("Only JPG, PNG and WebP images are allowed."));
  }
});

app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"]
    }
  }
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "1mb" }));
app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret-change-this",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: false }
}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

app.get("/api/auth/csrf", (req, res) => {
  res.json({ token: csrfToken(req, res) });
});

app.get("/api/auth/me", (req, res) => {
  res.json({ authenticated: Boolean(req.session.isAuthenticated), email: req.session.email || null });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const payload = loginSchema.parse(req.body || {});
    const match = state.admins.find(item => item.email === payload.email.toLowerCase());
    if (!match) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    const valid = await bcrypt.compare(payload.password, match.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    req.session.isAuthenticated = true;
    req.session.email = match.email;
    req.session.csrfToken = crypto.randomBytes(24).toString("hex");
    res.json({ ok: true, csrfToken: req.session.csrfToken });
  } catch (error) {
    res.status(400).json({ error: firstValidationError(error, "Please supply a valid email and password.") });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.use((req, res, next) => {
  if (req.method === "POST" && req.path.startsWith("/api/")) {
    const token = req.get("X-CSRF-Token");
    if (req.path.startsWith("/api/public/")) {
      if (!token || token !== req.session.csrfToken) {
        return res.status(403).json({ error: "Security token is missing or invalid. Refresh the page and try again." });
      }
    }
  }
  next();
});

app.get("/api/public/professionals", (req, res) => {
  const professionals = state.professionals
    .filter(item => item.status === "published")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(sanitizeProfessional);
  res.json({ professionals });
});

app.get("/api/public/professionals/:id/photo", (req, res) => {
  const professional = state.professionals.find(item => item.id === req.params.id);
  if (!professional || !professional.photoData || !professional.photoMime) {
    return res.status(404).json({ error: "Photo not found." });
  }
  res.type(professional.photoMime).send(Buffer.from(professional.photoData, "base64"));
});

app.get("/api/public/jobs", (req, res) => {
  const jobs = state.jobs
    .filter(item => item.status === "open")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(sanitizeJob);
  res.json({ jobs });
});

app.post("/api/public/hire-requests", async (req, res, next) => {
  try {
    const payload = hireRequestSchema.parse(req.body || {});
    const professional = state.professionals.find(item => item.id === payload.professionalId && item.status === "published");
    if (!professional) return res.status(404).json({ error: "This professional profile is currently unavailable." });
    const record = {
      id: crypto.randomUUID(),
      professionalId: professional.id,
      professionalName: professional.displayName,
      privateData: toStored({
        customerName: payload.customerName,
        email: payload.email,
        phone: payload.phone,
        reason: payload.reason,
        budgetKes: payload.budgetKes
      }),
      status: "new",
      adminNotes: toStored(""),
      agreementDate: null,
      consentedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.hireRequests.push(record);
    persistStore();
    res.status(201).json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: firstValidationError(error, "Please check the request details and try again.") });
    }
    next(error);
  }
});

app.post("/api/public/professionals", upload.single("photo"), async (req, res, next) => {
  try {
    const payload = professionalSchema.parse({
      displayName: req.body.displayName,
      fullName: req.body.fullName,
      email: req.body.email,
      phone: req.body.phone,
      role: req.body.role,
      experienceYears: req.body.experienceYears,
      description: req.body.description,
      consent: req.body.consent
    });
    const photoType = req.file ? await fileTypeFromBuffer(req.file.buffer) : null;
    if (req.file && !["image/jpeg", "image/png", "image/webp"].includes(photoType?.mime)) {
      return res.status(400).json({ error: "That file is not a valid JPG, PNG or WebP image. Please choose a different photo." });
    }
    const record = {
      id: crypto.randomUUID(),
      displayName: payload.displayName,
      role: payload.role,
      experienceYears: Number(payload.experienceYears),
      description: payload.description,
      status: "pending",
      consentedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      privateData: toStored({
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone
      }),
      photoData: req.file ? Buffer.from(req.file.buffer).toString("base64") : null,
      photoMime: photoType?.mime || null
    };
    state.professionals.push(record);
    persistStore();
    res.status(201).json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message || "Please check your profile details and try again." });
    }
    next(error);
  }
});

app.post("/api/public/job-applications", async (req, res) => {
  try {
    const payload = jobApplicationSchema.parse(req.body || {});
    const job = state.jobs.find(item => item.id === payload.jobId && item.status === "open");
    if (!job) return res.status(404).json({ error: "This job opening is not accepting applications right now." });
    const record = {
      id: crypto.randomUUID(),
      jobId: job.id,
      jobTitle: job.title,
      privateData: toStored({
        applicantName: payload.applicantName,
        email: payload.email,
        phone: payload.phone,
        experience: payload.experience
      }),
      status: "new",
      adminNotes: toStored(""),
      consentedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.jobApplications.push(record);
    persistStore();
    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: firstValidationError(error, "Please check your application details and try again.") });
  }
});

app.get("/api/admin/overview", mustAdmin, (req, res) => {
  const overview = {
    openRequests: state.hireRequests.filter(item => item.status !== "closed" && item.status !== "rejected").length,
    publicProfiles: state.professionals.filter(item => item.status === "published").length,
    openJobs: state.jobs.filter(item => item.status === "open").length,
    jobApplications: state.jobApplications.filter(item => item.status !== "closed").length
  };
  res.json(overview);
});

app.get("/api/admin/requests", mustAdmin, (req, res) => {
  const requests = state.hireRequests
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(item => ({
      id: item.id,
      professionalId: item.professionalId,
      professionalName: item.professionalName,
      status: item.status,
      agreementDate: item.agreementDate,
      adminNotes: fromStored(item.adminNotes),
      privateData: fromStored(item.privateData),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));
  res.json({ requests });
});

app.get("/api/admin/professionals", mustAdmin, (req, res) => {
  const professionals = state.professionals
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(item => ({
      id: item.id,
      displayName: item.displayName,
      role: item.role,
      experienceYears: item.experienceYears,
      description: item.description,
      status: item.status,
      hasPhoto: Boolean(item.photoData),
      privateData: fromStored(item.privateData),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));
  res.json({ professionals });
});

app.get("/api/admin/jobs", mustAdmin, (req, res) => {
  const jobs = state.jobs
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(item => ({
      id: item.id,
      title: item.title,
      category: item.category,
      description: item.description,
      county: item.county,
      payMinKes: item.payMinKes,
      payMaxKes: item.payMaxKes,
      deadline: item.deadline,
      status: item.status,
      applicationCount: state.jobApplications.filter(app => app.jobId === item.id).length,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));
  res.json({ jobs });
});

app.get("/api/admin/job-applications", mustAdmin, (req, res) => {
  const applications = state.jobApplications
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(item => ({
      id: item.id,
      jobId: item.jobId,
      jobTitle: item.jobTitle,
      status: item.status,
      adminNotes: fromStored(item.adminNotes),
      privateData: fromStored(item.privateData),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));
  res.json({ applications });
});

app.patch("/api/admin/requests/:id", mustAdmin, async (req, res) => {
  try {
    const payload = hireUpdateSchema.parse(req.body || {});
    const record = state.hireRequests.find(item => item.id === req.params.id);
    if (!record) return res.status(404).json({ error: "Request not found." });
    record.status = payload.status;
    record.adminNotes = toStored(payload.adminNotes || "");
    record.agreementDate = payload.agreementDate || null;
    record.updatedAt = new Date().toISOString();
    persistStore();
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: firstValidationError(error, "Invalid request update.") });
  }
});

app.patch("/api/admin/professionals/:id", mustAdmin, async (req, res) => {
  try {
    const payload = profileUpdateSchema.parse(req.body || {});
    const record = state.professionals.find(item => item.id === req.params.id);
    if (!record) return res.status(404).json({ error: "Professional profile not found." });
    record.status = payload.status;
    record.updatedAt = new Date().toISOString();
    persistStore();
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: firstValidationError(error, "Invalid profile update.") });
  }
});

app.patch("/api/admin/jobs/:id", mustAdmin, async (req, res) => {
  try {
    const payload = jobStatusSchema.parse(req.body || {});
    const record = state.jobs.find(item => item.id === req.params.id);
    if (!record) return res.status(404).json({ error: "Job opening not found." });
    record.status = payload.status;
    record.updatedAt = new Date().toISOString();
    persistStore();
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: firstValidationError(error, "Invalid job status update.") });
  }
});

app.patch("/api/admin/job-applications/:id", mustAdmin, async (req, res) => {
  try {
    const payload = applicationUpdateSchema.parse(req.body || {});
    const record = state.jobApplications.find(item => item.id === req.params.id);
    if (!record) return res.status(404).json({ error: "Application not found." });
    record.status = payload.status;
    record.adminNotes = toStored(payload.adminNotes || "");
    record.updatedAt = new Date().toISOString();
    persistStore();
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: firstValidationError(error, "Invalid application update.") });
  }
});

app.post("/api/admin/jobs", mustAdmin, async (req, res) => {
  try {
    const payload = jobSchema.parse({
      title: req.body.title,
      category: req.body.category,
      description: req.body.description,
      county: req.body.county || null,
      payMinKes: req.body.payMinKes == null || req.body.payMinKes === "" ? null : Number(req.body.payMinKes),
      payMaxKes: req.body.payMaxKes == null || req.body.payMaxKes === "" ? null : Number(req.body.payMaxKes),
      deadline: req.body.deadline || null
    });
    const record = {
      id: crypto.randomUUID(),
      title: payload.title,
      category: payload.category,
      description: payload.description,
      county: payload.county,
      payMinKes: payload.payMinKes,
      payMaxKes: payload.payMaxKes,
      deadline: payload.deadline,
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      applicationCount: 0
    };
    state.jobs.push(record);
    persistStore();
    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: firstValidationError(error, "Please provide all the details for the new opening.") });
  }
});

app.use(express.static(__dirname));

app.get("/admin", (_, res) => { res.sendFile(path.join(__dirname, "admin.html")); });
app.get("/", (_, res) => { res.sendFile(path.join(__dirname, "index.html")); });

app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "The profile photo must be 3 MB or smaller."
      : "The profile photo could not be processed. Please choose a JPG, PNG or WebP image.";
    return res.status(400).json({ error: message });
  }
  if (error.message === "Only JPG, PNG and WebP images are allowed.") {
    return res.status(400).json({ error: "Please choose a JPG, PNG or WebP profile photo." });
  }
  console.error("Unhandled application error:", error);
  return res.status(500).json({ error: "The server could not save your profile. Please try again later." });
});

await ensureDefaultAdmin();

app.listen(port, () => {
  console.log(`My Security app running at http://localhost:${port}`);
  console.log(`Default admin: ${fallbackAdminEmail} / ${fallbackAdminPassword}`);
});
