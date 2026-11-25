const loginPanel = document.querySelector("#login-panel");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#login-form");
const loginFeedback = document.querySelector("#login-feedback");
const dashboardMessage = document.querySelector("#dashboard-message");
let csrfToken;

async function api(path, options = {}) {
    let response;
    try {
        response = await fetch(path, {
            credentials: "same-origin",
            ...options,
            headers: {
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...(options.headers || {})
            }
        });
    } catch {
        throw new Error("Cannot connect to the app server. Keep “npm start” running and open http://localhost:3000/admin.");
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        if (!response.ok) {
            throw new Error(`The server returned HTTP ${response.status}. Check that you opened the admin page from http://localhost:3000/admin and review the app terminal.`);
        }
        throw new Error("The server returned an unexpected response. Open the admin page from http://localhost:3000/admin.");
    }

    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || `The server returned HTTP ${response.status}.`);
    }
    return result;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function dateText(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? escapeHtml(value) : escapeHtml(date.toLocaleDateString());
}

function setMessage(message, isError = false) {
    dashboardMessage.textContent = message;
    dashboardMessage.style.color = isError ? "#a23e38" : "#3e735b";
}

function setLoginError(message) {
    loginFeedback.textContent = message;
}

function showLogin() {
    loginPanel.hidden = false;
    dashboard.hidden = true;
}

function showDashboard() {
    loginPanel.hidden = true;
    dashboard.hidden = false;
}

function emptyMarkup(message) {
    return `<p class="empty">${escapeHtml(message)}</p>`;
}

function statusOptions(status, choices) {
    return choices.map(([value, label]) =>
        `<option value="${value}"${value === status ? " selected" : ""}>${label}</option>`
    ).join("");
}

function getFieldValue(container, name) {
    const field = container.querySelector(`[name="${name}"]`);
    if (!field) throw new Error(`Could not find the ${name} field.`);
    return field.value;
}

function renderSummary(data) {
    const summaries = [
        ["Open requests", data.openRequests],
        ["Public profiles", data.publicProfiles],
        ["Open jobs", data.openJobs],
        ["Job applications", data.jobApplications]
    ];
    document.querySelector("#summary-grid").innerHTML = summaries.map(([label, count]) =>
        `<div class="summary-card"><span>${label}</span><strong>${Number(count) || 0}</strong></div>`
    ).join("");
}

function renderRequests(requests) {
    const target = document.querySelector("#requests-list");
    if (!requests.length) {
        target.innerHTML = emptyMarkup("No hire requests have been received.");
        return;
    }
    const statuses = [
        ["new", "New"], ["contacted", "Contacted"], ["meeting_arranged", "Meeting arranged"],
        ["agreement_signed", "Agreement signed"], ["closed", "Closed"], ["rejected", "Rejected"]
    ];
    target.innerHTML = requests.map(request => {
        const details = request.privateData || {};
        return `<article class="record-card">
            <div class="record-top">
                <div><h3>${escapeHtml(details.customerName || "Hire request")}</h3><p>For ${escapeHtml(request.professionalName)} · received ${dateText(request.createdAt)}</p></div>
                <span class="record-status status-${escapeHtml(request.status)}">${escapeHtml(request.status.replaceAll("_", " "))}</span>
            </div>
            <div class="record-details">
                <div><strong>Email:</strong> ${escapeHtml(details.email)}</div>
                <div><strong>Phone:</strong> ${escapeHtml(details.phone)}</div>
                <div><strong>Proposed amount:</strong> ${details.budgetKes == null ? "Not specified" : `KSh ${Number(details.budgetKes).toLocaleString()}`}</div>
                <div><strong>Agreement date:</strong> ${dateText(request.agreementDate)}</div>
                <div class="record-description"><strong>Reason:</strong> ${escapeHtml(details.reason)}</div>
            </div>
            <div class="record-actions" data-request-actions="${escapeHtml(request.id)}">
                <label>Status<select name="status">${statusOptions(request.status, statuses)}</select></label>
                <label>Admin notes (private)<input name="adminNotes" value="${escapeHtml(request.adminNotes || "")}" maxlength="2000"></label>
                <label>Agreement signed on<input name="agreementDate" type="date" value="${escapeHtml(request.agreementDate || "")}"></label>
                <button class="button button-secondary" type="button" data-save-request="${escapeHtml(request.id)}">Save progress</button>
            </div>
        </article>`;
    }).join("");
}

function renderProfessionals(professionals) {
    const target = document.querySelector("#professionals-list");
    if (!professionals.length) {
        target.innerHTML = emptyMarkup("No professional profiles have been submitted yet.");
        return;
    }
    target.innerHTML = professionals.map(person => {
        const details = person.privateData || {};
        const isPublished = person.status === "published";
        const nextStatus = isPublished ? "hidden" : "published";
        const actionLabel = person.status === "pending"
            ? "Approve and publish"
            : isPublished
                ? "Hide public listing"
                : "Restore public listing";
        const buttonClass = isPublished ? "button-secondary" : "button-primary";
        return `<article class="record-card">
            <div class="record-top">
                <div><h3>${escapeHtml(person.displayName)} <span class="record-status status-${escapeHtml(person.status)}">${escapeHtml(person.status)}</span></h3><p>${escapeHtml(person.role)} · ${Number(person.experienceYears)} years · submitted ${dateText(person.createdAt)}</p></div>
            </div>
            <div class="record-details">
                <div><strong>Full name:</strong> ${escapeHtml(details.fullName)}</div>
                <div><strong>Email:</strong> ${escapeHtml(details.email)}</div>
                <div><strong>Phone:</strong> ${escapeHtml(details.phone)}</div>
                <div class="record-description"><strong>Public description:</strong> ${escapeHtml(person.description)}</div>
            </div>
            <div class="record-actions">
                <span class="privacy-label">${person.hasPhoto ? "Profile photo uploaded" : "No photo uploaded"}</span>
                <button class="button ${buttonClass}" type="button" data-toggle-profile="${escapeHtml(person.id)}" data-next-status="${nextStatus}">${actionLabel}</button>
            </div>
        </article>`;
    }).join("");
}

function renderJobs(jobs) {
    const target = document.querySelector("#jobs-list");
    if (!jobs.length) {
        target.innerHTML = emptyMarkup("No job openings have been posted.");
        return;
    }
    target.innerHTML = jobs.map(job => {
        const pay = job.payMinKes == null && job.payMaxKes == null
            ? "Pay not specified"
            : `${job.payMinKes == null ? "" : `KSh ${Number(job.payMinKes).toLocaleString()}`}${job.payMinKes != null && job.payMaxKes != null ? "–" : ""}${job.payMaxKes == null ? "" : `KSh ${Number(job.payMaxKes).toLocaleString()}`}`;
        return `<article class="record-card">
            <div class="record-top">
                <div><h3>${escapeHtml(job.title)}</h3><p>${escapeHtml(job.category)} · ${escapeHtml(job.county || "Area not specified")} · ${pay}</p></div>
                <span class="record-status status-${escapeHtml(job.status)}">${escapeHtml(job.status)}</span>
            </div>
            <div class="record-details">
                <div><strong>Applications:</strong> ${Number(job.applicationCount) || 0}</div>
                <div><strong>Deadline:</strong> ${dateText(job.deadline)}</div>
                <div class="record-description">${escapeHtml(job.description)}</div>
            </div>
            <div class="record-actions">
                <span></span>
                <button class="button button-secondary" type="button" data-toggle-job="${escapeHtml(job.id)}" data-next-status="${job.status === "open" ? "closed" : "open"}">${job.status === "open" ? "Close opening" : "Reopen opening"}</button>
            </div>
        </article>`;
    }).join("");
}

function renderApplications(applications) {
    const target = document.querySelector("#applications-list");
    if (!applications.length) {
        target.innerHTML = emptyMarkup("No job applications have been received.");
        return;
    }
    const statuses = [["new", "New"], ["contacted", "Contacted"], ["meeting_arranged", "Meeting arranged"], ["accepted", "Accepted"], ["rejected", "Rejected"], ["closed", "Closed"]];
    target.innerHTML = applications.map(application => {
        const details = application.privateData || {};
        return `<article class="record-card">
            <div class="record-top">
                <div><h3>${escapeHtml(details.applicantName || "Job applicant")}</h3><p>Applied for ${escapeHtml(application.jobTitle)} · ${dateText(application.createdAt)}</p></div>
                <span class="record-status status-${escapeHtml(application.status)}">${escapeHtml(application.status.replaceAll("_", " "))}</span>
            </div>
            <div class="record-details">
                <div><strong>Email:</strong> ${escapeHtml(details.email)}</div>
                <div><strong>Phone:</strong> ${escapeHtml(details.phone)}</div>
                <div class="record-description"><strong>Experience:</strong> ${escapeHtml(details.experience || "Not provided")}</div>
            </div>
            <div class="record-actions" data-application-actions="${escapeHtml(application.id)}">
                <label>Status<select name="status">${statusOptions(application.status, statuses)}</select></label>
                <label>Admin notes (private)<input name="adminNotes" value="${escapeHtml(application.adminNotes || "")}" maxlength="2000"></label>
                <button class="button button-secondary" type="button" data-save-application="${escapeHtml(application.id)}">Save progress</button>
            </div>
        </article>`;
    }).join("");
}

async function loadDashboard() {
    const [overview, requests, professionals, jobs, applications] = await Promise.all([
        api("/api/admin/overview"),
        api("/api/admin/requests"),
        api("/api/admin/professionals"),
        api("/api/admin/jobs"),
        api("/api/admin/job-applications")
    ]);
    renderSummary(overview);
    renderRequests(requests.requests);
    renderProfessionals(professionals.professionals);
    renderJobs(jobs.jobs);
    renderApplications(applications.applications);
}

async function ensureCsrfToken() {
    if (!csrfToken) {
        const result = await api("/api/auth/csrf");
        csrfToken = result.token;
    }
}

async function updateResource(path, data, message) {
    setMessage("");
    try {
        await ensureCsrfToken();
        await api(path, {
            method: "PATCH",
            headers: { "X-CSRF-Token": csrfToken },
            body: JSON.stringify(data)
        });
        await loadDashboard();
        setMessage(message);
    } catch (error) {
        setMessage(error.message, true);
    }
}

loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    setLoginError("");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
        await ensureCsrfToken();
        const result = await api("/api/auth/login", {
            method: "POST",
            headers: { "X-CSRF-Token": csrfToken },
            body: JSON.stringify(data)
        });
        csrfToken = result.csrfToken;
        form.reset();
        showDashboard();
        await loadDashboard();
    } catch (error) {
        setLoginError(error.message);
    }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
    try {
        await ensureCsrfToken();
        await api("/api/auth/logout", {
            method: "POST",
            headers: { "X-CSRF-Token": csrfToken }
        });
        csrfToken = undefined;
        showLogin();
        setLoginError("You have signed out.");
    } catch (error) {
        setMessage(error.message, true);
    }
});

document.querySelector("#job-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    data.payMinKes = data.payMinKes ? Number(data.payMinKes) : null;
    data.payMaxKes = data.payMaxKes ? Number(data.payMaxKes) : null;
    data.deadline = data.deadline || null;
    setMessage("");
    try {
        await ensureCsrfToken();
        await api("/api/admin/jobs", {
            method: "POST",
            headers: { "X-CSRF-Token": csrfToken },
            body: JSON.stringify(data)
        });
        form.reset();
        await loadDashboard();
        setMessage("The job opening has been published.");
    } catch (error) {
        setMessage(error.message, true);
    }
});

dashboard.addEventListener("click", event => {
    const tab = event.target.closest("[data-panel]");
    if (tab) {
        document.querySelectorAll(".admin-tabs button").forEach(button => button.classList.toggle("active", button === tab));
        document.querySelectorAll(".dashboard-panel").forEach(panel => panel.classList.toggle("active", panel.id === tab.dataset.panel));
        return;
    }
    const requestButton = event.target.closest("[data-save-request]");
    if (requestButton) {
        const fields = requestButton.closest("[data-request-actions]");
        if (!fields) {
            setMessage("Could not find this request’s progress fields. Refresh the dashboard and try again.", true);
            return;
        }
        let data;
        try {
            data = {
                status: getFieldValue(fields, "status"),
                adminNotes: getFieldValue(fields, "adminNotes"),
                agreementDate: getFieldValue(fields, "agreementDate") || null
            };
        } catch (error) {
            setMessage(error.message, true);
            return;
        }
        void updateResource(`/api/admin/requests/${encodeURIComponent(requestButton.dataset.saveRequest)}`, {
            ...data
        }, "Hire request progress saved.");
        return;
    }
    const profileButton = event.target.closest("[data-toggle-profile]");
    if (profileButton) {
        const nextStatus = profileButton.dataset.nextStatus;
        const message = nextStatus === "published"
            ? "Professional profile approved and published."
            : "Professional profile hidden from the public website.";
        void updateResource(`/api/admin/professionals/${encodeURIComponent(profileButton.dataset.toggleProfile)}`, {
            status: nextStatus
        }, message);
        return;
    }
    const jobButton = event.target.closest("[data-toggle-job]");
    if (jobButton) {
        void updateResource(`/api/admin/jobs/${encodeURIComponent(jobButton.dataset.toggleJob)}`, {
            status: jobButton.dataset.nextStatus
        }, `Job opening ${jobButton.dataset.nextStatus === "closed" ? "closed" : "reopened"}.`);
        return;
    }
    const applicationButton = event.target.closest("[data-save-application]");
    if (applicationButton) {
        const fields = applicationButton.closest("[data-application-actions]");
        if (!fields) {
            setMessage("Could not find this application’s progress fields. Refresh the dashboard and try again.", true);
            return;
        }
        let data;
        try {
            data = {
                status: getFieldValue(fields, "status"),
                adminNotes: getFieldValue(fields, "adminNotes")
            };
        } catch (error) {
            setMessage(error.message, true);
            return;
        }
        void updateResource(`/api/admin/job-applications/${encodeURIComponent(applicationButton.dataset.saveApplication)}`, {
            ...data
        }, "Application progress saved.");
    }
});

async function initialize() {
    try {
        await ensureCsrfToken();
        const auth = await api("/api/auth/me");
        if (auth.authenticated) {
            showDashboard();
            await loadDashboard();
        } else {
            showLogin();
        }
    } catch (error) {
        showLogin();
        setLoginError(`${error.message} Check that the application server is running.`);
    }
}

document.querySelector("#current-year")?.remove();
void initialize();
