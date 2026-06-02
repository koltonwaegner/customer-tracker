const STORAGE_KEY = "customer-tracker.customers.v2";
const LEGACY_KEY = "customers";

const statusOrder = ["Lead", "Contacted", "Proposal", "Active", "Won", "Lost"];
const priorityWeight = { High: 3, Medium: 2, Low: 1 };

let customers = loadCustomers();
let selectedCustomerId = customers[0]?.id || null;

const elements = {
  form: document.getElementById("customerForm"),
  customerId: document.getElementById("customerId"),
  name: document.getElementById("name"),
  phone: document.getElementById("phone"),
  email: document.getElementById("email"),
  status: document.getElementById("status"),
  priority: document.getElementById("priority"),
  lastContact: document.getElementById("lastContact"),
  nextFollowUp: document.getElementById("nextFollowUp"),
  notes: document.getElementById("notes"),
  search: document.getElementById("search"),
  statusFilter: document.getElementById("statusFilter"),
  sortBy: document.getElementById("sortBy"),
  customerList: document.getElementById("customerList"),
  aiInsights: document.getElementById("aiInsights"),
  aiDraft: document.getElementById("aiDraft"),
  toast: document.getElementById("toast"),
  nameError: document.getElementById("nameError"),
  emailError: document.getElementById("emailError"),
  saveButton: document.getElementById("saveButton"),
  totalCustomers: document.getElementById("totalCustomers"),
  dueFollowUps: document.getElementById("dueFollowUps"),
  activeDeals: document.getElementById("activeDeals")
};

elements.form.addEventListener("submit", saveCustomer);
document.getElementById("resetFormButton").addEventListener("click", resetForm);
document.getElementById("aiDraftButton").addEventListener("click", draftFromForm);
document.getElementById("refreshAiButton").addEventListener("click", renderAssistant);
document.getElementById("copyDraftButton").addEventListener("click", copyDraft);
document.getElementById("exportButton").addEventListener("click", exportCustomers);
document.getElementById("importFile").addEventListener("change", importCustomers);
elements.search.addEventListener("input", renderAll);
elements.statusFilter.addEventListener("change", renderAll);
elements.sortBy.addEventListener("change", renderAll);

renderAll();

function loadCustomers() {
  const saved = readJson(STORAGE_KEY);
  if (Array.isArray(saved)) return saved.map(normalizeCustomer);

  const legacy = readJson(LEGACY_KEY);
  if (Array.isArray(legacy)) {
    const upgraded = legacy.map(normalizeCustomer);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(upgraded));
    return upgraded;
  }

  return [];
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function normalizeCustomer(customer) {
  const now = new Date().toISOString();
  return {
    id: String(customer.id || createId()),
    name: customer.name || "",
    phone: customer.phone || "",
    email: customer.email || "",
    status: statusOrder.includes(customer.status) ? customer.status : "Lead",
    priority: priorityWeight[customer.priority] ? customer.priority : "Medium",
    lastContact: customer.lastContact || customer.date || "",
    nextFollowUp: customer.nextFollowUp || customer.date || "",
    notes: customer.notes || "",
    createdAt: customer.createdAt || now,
    updatedAt: customer.updatedAt || now
  };
}

function persistCustomers() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
}

function saveCustomer(event) {
  event.preventDefault();
  clearErrors();

  const customer = getFormCustomer();
  const errors = validateCustomer(customer);
  if (errors.length) {
    errors.forEach(({ field, message }) => {
      elements[`${field}Error`].textContent = message;
    });
    showToast("Please fix the highlighted fields.");
    return;
  }

  const existingIndex = customers.findIndex((item) => item.id === customer.id);
  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    customers[existingIndex] = {
      ...customers[existingIndex],
      ...customer,
      updatedAt: now
    };
    showToast("Customer updated.");
  } else {
    customer.id = createId();
    customer.createdAt = now;
    customer.updatedAt = now;
    customers.unshift(customer);
    showToast("Customer saved.");
  }

  selectedCustomerId = customer.id;
  persistCustomers();
  resetForm(false);
  renderAll();
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `customer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getFormCustomer() {
  return {
    id: elements.customerId.value,
    name: elements.name.value.trim(),
    phone: elements.phone.value.trim(),
    email: elements.email.value.trim(),
    status: elements.status.value,
    priority: elements.priority.value,
    lastContact: elements.lastContact.value,
    nextFollowUp: elements.nextFollowUp.value,
    notes: elements.notes.value.trim()
  };
}

function validateCustomer(customer) {
  const errors = [];
  if (!customer.name) errors.push({ field: "name", message: "Name is required." });
  if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
    errors.push({ field: "email", message: "Use a valid email address." });
  }
  return errors;
}

function clearErrors() {
  elements.nameError.textContent = "";
  elements.emailError.textContent = "";
}

function resetForm(showMessage = true) {
  elements.form.reset();
  elements.customerId.value = "";
  elements.status.value = "Lead";
  elements.priority.value = "Medium";
  elements.saveButton.textContent = "Save customer";
  clearErrors();
  if (showMessage) showToast("Form cleared.");
}

function renderAll() {
  renderMetrics();
  renderCustomers();
  renderAssistant();
}

function renderMetrics() {
  elements.totalCustomers.textContent = customers.length;
  elements.dueFollowUps.textContent = customers.filter(isDue).length;
  elements.activeDeals.textContent = customers.filter((customer) =>
    ["Lead", "Contacted", "Proposal", "Active"].includes(customer.status)
  ).length;
}

function renderCustomers() {
  const visibleCustomers = getVisibleCustomers();

  if (!visibleCustomers.length) {
    elements.customerList.innerHTML = `
      <div class="empty-state">
        <h3>No customers found</h3>
        <p>Add a customer or adjust the search and filters.</p>
      </div>
    `;
    return;
  }

  elements.customerList.innerHTML = "";
  visibleCustomers.forEach((customer) => {
    const card = document.createElement("article");
    card.className = `customer-card ${isDue(customer) ? "is-due" : ""}`;
    if (customer.id === selectedCustomerId) card.classList.add("is-selected");

    card.innerHTML = `
      <div class="customer-top">
        <div>
          <h3>${escapeHtml(customer.name)}</h3>
          <p>${escapeHtml(customer.email || customer.phone || "No contact method yet")}</p>
        </div>
        <span class="status ${customer.status.toLowerCase()}">${customer.status}</span>
      </div>
      <div class="customer-meta">
        <span>${customer.priority} priority</span>
        <span>${formatFollowUp(customer)}</span>
      </div>
      <p class="customer-notes">${escapeHtml(customer.notes || "No notes yet.")}</p>
      <div class="card-actions">
        <button type="button" data-action="select" data-id="${customer.id}">Use AI</button>
        <button type="button" data-action="edit" data-id="${customer.id}">Edit</button>
        <button type="button" data-action="delete" data-id="${customer.id}">Delete</button>
      </div>
    `;

    card.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", handleCardAction);
    });
    elements.customerList.appendChild(card);
  });
}

function getVisibleCustomers() {
  const query = elements.search.value.trim().toLowerCase();
  const statusFilter = elements.statusFilter.value;

  return customers
    .filter((customer) => {
      const haystack = [
        customer.name,
        customer.phone,
        customer.email,
        customer.status,
        customer.priority,
        customer.notes
      ].join(" ").toLowerCase();
      return (!query || haystack.includes(query)) &&
        (statusFilter === "All" || customer.status === statusFilter);
    })
    .sort(sortCustomers);
}

function sortCustomers(a, b) {
  const mode = elements.sortBy.value;
  if (mode === "priority") return priorityWeight[b.priority] - priorityWeight[a.priority];
  if (mode === "name") return a.name.localeCompare(b.name);
  if (mode === "updated") return new Date(b.updatedAt) - new Date(a.updatedAt);

  const aDate = a.nextFollowUp || "9999-12-31";
  const bDate = b.nextFollowUp || "9999-12-31";
  return aDate.localeCompare(bDate) || priorityWeight[b.priority] - priorityWeight[a.priority];
}

function handleCardAction(event) {
  const id = event.currentTarget.dataset.id;
  const action = event.currentTarget.dataset.action;

  if (action === "delete") {
    const customer = customers.find((item) => item.id === id);
    if (!customer || !confirm(`Delete ${customer.name}?`)) return;
    customers = customers.filter((item) => item.id !== id);
    if (selectedCustomerId === id) selectedCustomerId = customers[0]?.id || null;
    persistCustomers();
    renderAll();
    showToast("Customer deleted.");
    return;
  }

  selectedCustomerId = id;
  if (action === "edit") fillForm(customers.find((item) => item.id === id));
  renderAll();
}

function fillForm(customer) {
  if (!customer) return;
  elements.customerId.value = customer.id;
  elements.name.value = customer.name;
  elements.phone.value = customer.phone;
  elements.email.value = customer.email;
  elements.status.value = customer.status;
  elements.priority.value = customer.priority;
  elements.lastContact.value = customer.lastContact;
  elements.nextFollowUp.value = customer.nextFollowUp;
  elements.notes.value = customer.notes;
  elements.saveButton.textContent = "Update customer";
  elements.name.focus();
}

function renderAssistant() {
  const selected = customers.find((customer) => customer.id === selectedCustomerId);
  const insights = buildInsights(selected);

  elements.aiInsights.innerHTML = insights.map((insight) => `<li>${escapeHtml(insight)}</li>`).join("");
  elements.aiDraft.value = selected ? buildFollowUpDraft(selected) : "";
}

function buildInsights(selected) {
  if (!customers.length) {
    return [
      "Add your first customer, then I can prioritize follow-ups and draft next steps.",
      "Capture a follow-up date and a note for each person to make the tracker more useful."
    ];
  }

  const due = customers.filter(isDue).sort(sortByUrgency);
  const stale = customers.filter(isStale).sort(sortByUrgency);
  const highPriority = customers.filter((customer) =>
    customer.priority === "High" && !["Won", "Lost"].includes(customer.status)
  );
  const selectedTip = selected ? getCustomerTip(selected) : "Select a customer to get a tailored next action.";

  const insights = [];
  if (due.length) insights.push(`${due[0].name} needs attention now: follow-up is due ${formatDate(due[0].nextFollowUp)}.`);
  if (stale.length) insights.push(`${stale[0].name} has gone quiet. Refresh the relationship with a quick check-in.`);
  if (highPriority.length) insights.push(`${highPriority.length} high-priority customer${highPriority.length === 1 ? "" : "s"} still need movement.`);
  insights.push(selectedTip);

  return insights.slice(0, 4);
}

function getCustomerTip(customer) {
  const noteText = customer.notes.toLowerCase();
  if (customer.status === "Proposal") return `Ask ${customer.name} whether the proposal matches their timeline and decision criteria.`;
  if (noteText.includes("price") || noteText.includes("budget")) return `For ${customer.name}, lead with value and clarify budget concerns.`;
  if (noteText.includes("call") || noteText.includes("meeting")) return `Schedule or confirm the next conversation with ${customer.name}.`;
  if (isDue(customer)) return `${customer.name} is due for follow-up. Keep it short, specific, and helpful.`;
  return `For ${customer.name}, ask one clear question that moves the relationship forward.`;
}

function draftFromForm() {
  const draftCustomer = normalizeCustomer(getFormCustomer());
  if (!draftCustomer.name) {
    showToast("Add a customer name first.");
    elements.name.focus();
    return;
  }
  elements.aiDraft.value = buildFollowUpDraft(draftCustomer);
  showToast("Follow-up draft ready.");
}

function buildFollowUpDraft(customer) {
  const topic = summarizeNotes(customer.notes);
  const ask = getNextAsk(customer);

  return `Hi ${customer.name},

I wanted to follow up${topic ? ` on ${topic}` : ""}. ${ask}

Would it be helpful to connect for a few minutes and decide the next step?

Thanks,`;
}

function summarizeNotes(notes) {
  if (!notes) return "";
  const clean = notes.replace(/\s+/g, " ").trim();
  return clean.length > 90 ? `${clean.slice(0, 87)}...` : clean;
}

function getNextAsk(customer) {
  if (customer.status === "Lead") return "I can help answer questions and see whether this is a good fit.";
  if (customer.status === "Contacted") return "I am checking in to see what would be most useful next.";
  if (customer.status === "Proposal") return "I am happy to clarify scope, price, or timing so the decision is easier.";
  if (customer.status === "Active") return "I want to make sure everything is moving smoothly and nothing is stuck.";
  return "I am checking in to see how things are going.";
}

function copyDraft() {
  if (!elements.aiDraft.value.trim()) {
    showToast("No draft to copy yet.");
    return;
  }
  navigator.clipboard.writeText(elements.aiDraft.value)
    .then(() => showToast("Draft copied."))
    .catch(() => showToast("Copy failed. Select the text and copy manually."));
}

function exportCustomers() {
  const blob = new Blob([JSON.stringify(customers, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `customer-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Customer backup exported.");
}

function importCustomers(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("Invalid file");
      customers = imported.map(normalizeCustomer);
      selectedCustomerId = customers[0]?.id || null;
      persistCustomers();
      renderAll();
      showToast("Customer backup imported.");
    } catch {
      showToast("That file does not look like a customer backup.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function isDue(customer) {
  return Boolean(customer.nextFollowUp) &&
    !["Won", "Lost"].includes(customer.status) &&
    customer.nextFollowUp <= todayString();
}

function isStale(customer) {
  if (!customer.lastContact || ["Won", "Lost"].includes(customer.status)) return false;
  const days = daysBetween(customer.lastContact, todayString());
  return days >= 14;
}

function sortByUrgency(a, b) {
  return priorityWeight[b.priority] - priorityWeight[a.priority] ||
    (a.nextFollowUp || "").localeCompare(b.nextFollowUp || "");
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  return Math.floor((new Date(end) - new Date(start)) / 86400000);
}

function formatFollowUp(customer) {
  if (!customer.nextFollowUp) return "No follow-up set";
  return `${isDue(customer) ? "Due" : "Follow-up"} ${formatDate(customer.nextFollowUp)}`;
}

function formatDate(date) {
  if (!date) return "not set";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(`${date}T12:00:00`));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
}

