const professionalList = document.querySelector("#professional-list");
const jobList = document.querySelector("#job-list");
const dialogs = [...document.querySelectorAll(".form-dialog")];
let csrfToken;

async function requestJson(path, options = {}) {
    let response;
    try {
        response = await fetch(path, {
            credentials: "same-origin",
            ...options,
            headers: {
                ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
                ...(options.headers || {})
            }
        });
    } catch {
        throw new Error("Cannot connect to the app server. Keep “npm start” running and refresh the page.");
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        if (!response.ok) {
            throw new Error(`The server returned HTTP ${response.status}. Refresh the page and check that you opened it from http://localhost:3000.`);
        }
        throw new Error("The server returned an unexpected response. Refresh the page and try again.");
    }

    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || "The request could not be completed. Please try again.");
    }
    return result;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function showEmpty(container, message) {
    container.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
}

function showLoadError(container, label) {
    container.innerHTML = `<p class="empty-state error-message">${escapeHtml(label)} could not load. Please refresh or try again later.</p>`;
}

function openDialog(dialog) {
    if (dialog && !dialog.open) dialog.showModal();
}

function setFeedback(form, message, isError = false) {
    const feedback = form.querySelector(".form-feedback");
    feedback.textContent = message;
    feedback.dataset.error = String(isError);
}

async function loadProfessionals() {
    try {
        const { professionals } = await requestJson("/api/public/professionals");
        if (!professionals.length) {
            showEmpty(professionalList, "There are no public profiles yet. If you are a security professional, you can create the first one.");
            return;
        }
        professionalList.innerHTML = professionals.map(person => {
            const photo = person.hasPhoto
                ? `<img class="profile-photo" src="/api/public/professionals/${encodeURIComponent(person.id)}/photo" alt="Profile photo of ${escapeHtml(person.displayName)}">`
                : `<div class="profile-photo placeholder" aria-hidden="true">${escapeHtml(person.displayName.slice(0, 1))}</div>`;
            const years = Number(person.experienceYears);
            return `<article class="professional-card">
                ${photo}
                <div class="professional-content">
                    <p class="profile-role">${escapeHtml(person.role)}</p>
                    <h3>${escapeHtml(person.displayName)}</h3>
                    <p class="profile-experience">${years} ${years === 1 ? "year" : "years"} of experience</p>
                    <p class="profile-description">${escapeHtml(person.description)}</p>
                    <button class="button card-hire" type="button" data-hire-id="${escapeHtml(person.id)}" data-hire-name="${escapeHtml(person.displayName)}">Request to hire</button>
                </div>
            </article>`;
        }).join("");
    } catch {
        showLoadError(professionalList, "Professional profiles");
    }
}

async function loadJobs() {
    try {
        const { jobs } = await requestJson("/api/public/jobs");
        if (!jobs.length) {
            showEmpty(jobList, "There are no open positions right now. Check back soon, or create a professional profile to list your services.");
            return;
        }
        jobList.innerHTML = jobs.map(job => {
            const pay = job.payMinKes == null && job.payMaxKes == null
                ? "Pay discussed with admin"
                : job.payMinKes != null && job.payMaxKes != null
                    ? `KSh ${Number(job.payMinKes).toLocaleString()}–${Number(job.payMaxKes).toLocaleString()}`
                    : `From KSh ${Number(job.payMinKes ?? job.payMaxKes).toLocaleString()}`;
            return `<article class="job-card">
                <div>
                    <p class="job-category">${escapeHtml(job.category)}</p>
                    <h3>${escapeHtml(job.title)}</h3>
                    <p class="job-meta"><span>${escapeHtml(job.county || "Location shared by admin")}</span><span>${escapeHtml(pay)}</span></p>
                    <p class="job-description">${escapeHtml(job.description)}</p>
                </div>
                <button class="button job-apply" type="button" data-apply-id="${escapeHtml(job.id)}" data-apply-title="${escapeHtml(job.title)}">Apply now <span aria-hidden="true">→</span></button>
            </article>`;
        }).join("");
    } catch {
        showLoadError(jobList, "Job openings");
    }
}

async function prepareCsrfToken() {
    const result = await requestJson("/api/auth/csrf");
    csrfToken = result.token;
}

async function sendForm(form, path, body, isMultipart = false) {
    setFeedback(form, "Sending…");
    try {
        if (!csrfToken) await prepareCsrfToken();
        await requestJson(path, {
            method: "POST",
            headers: { "X-CSRF-Token": csrfToken },
            body: isMultipart ? body : JSON.stringify(body)
        });
        form.reset();
        setFeedback(form, "Thank you. Your details have been sent privately to the My Security admin team.");
        return true;
    } catch (error) {
        setFeedback(form, error.message, true);
        return false;
    }
}

professionalList.addEventListener("click", event => {
    const button = event.target.closest("[data-hire-id]");
    if (!button) return;
    document.querySelector("#hire-professional-id").value = button.dataset.hireId;
    document.querySelector("#selected-professional").textContent = `Requesting: ${button.dataset.hireName}`;
    setFeedback(document.querySelector("#hire-form"), "");
    openDialog(document.querySelector("#hire-dialog"));
});

jobList.addEventListener("click", event => {
    const button = event.target.closest("[data-apply-id]");
    if (!button) return;
    document.querySelector("#application-job-id").value = button.dataset.applyId;
    document.querySelector("#application-job-name").textContent = `Applying for: ${button.dataset.applyTitle}`;
    setFeedback(document.querySelector("#application-form"), "");
    openDialog(document.querySelector("#application-dialog"));
});

document.querySelectorAll("[data-open-dialog]").forEach(button => {
    button.addEventListener("click", () => {
        const dialog = document.getElementById(button.dataset.openDialog);
        setFeedback(dialog.querySelector("form"), "");
        openDialog(dialog);
    });
});

document.querySelectorAll("[data-close-dialog]").forEach(button => {
    button.addEventListener("click", () => button.closest("dialog").close());
});

dialogs.forEach(dialog => {
    dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.close();
    });
});

document.querySelector("#hire-form").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    data.budgetKes = data.budgetKes ? Number(data.budgetKes) : null;
    data.consent = form.elements.consent.checked;
    void sendForm(form, "/api/public/hire-requests", data);
});

document.querySelector("#professional-form").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("consent", form.elements.consent.checked ? "true" : "false");
    void sendForm(form, "/api/public/professionals", data, true).then(success => {
        if (success) void loadProfessionals();
    });
});

document.querySelector("#application-form").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    data.consent = form.elements.consent.checked;
    void sendForm(form, "/api/public/job-applications", data);
});

const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector("#main-nav");
menuToggle.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") !== "true";
    menuToggle.setAttribute("aria-expanded", String(open));
    mainNav.classList.toggle("open", open);
});
mainNav.addEventListener("click", event => {
    if (event.target.closest("a")) {
        mainNav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
    }
});

document.querySelector("#current-year").textContent = String(new Date().getFullYear());
void loadProfessionals();
void loadJobs();
