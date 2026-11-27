/**
 * TaskNudge — Single-Page App Controller
 * Sonny Boy & Notion Aesthetics
 */

// 1. Dashboard URL constant (as requested, top of file)
const DASHBOARD_URL = ""; 

// 2. Storage Key
const STORAGE_KEY = "tasknudge_tasks_v1";

// 3. Sample Announcement for Quick Demo
const SAMPLE_NOTICE = `URGENT NOTICE - DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING
Ref: CSE/2026/ODD/042

1. Major Project Phase-1 Synopsis Submission:
All Final Year B.Tech students are strictly required to submit their project synopsis approved by their guide on or before 28th November 2026, 4:00 PM to the department lab.

2. Cloud Computing Lab Quiz:
The second continuous evaluation lab quiz will be held on 27th November 2026 during respective batch hours. Attendance is mandatory.

3. IEEE Student Chapter Membership Renewal:
Students interested in IEEE student branch membership renewal may register through the student coordinator by 5th December 2026.`;

// Application State
let appState = {
  currentView: "add",
  tasks: [],
  selectedWeekDate: null,
  extractedBuffer: [],
  searchQuery: "",
  filterSubject: "all",
  filterPriority: "all"
};

// ============================================================================
// STORAGE HELPERS (Safe LocalStorage wrappers)
// ============================================================================
function loadTasksFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to read tasks from localStorage:", err);
    showToast("Could not load tasks from local storage", "error");
    return [];
  }
}

function saveTasksToStorage(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (err) {
    console.error("Failed to save tasks to localStorage:", err);
    showToast("Could not save tasks to local storage", "error");
    return false;
  }
}

// Generate unique ID
function generateId() {
  return "task_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
}

// Check for duplicate task (same task title + deadline)
function isDuplicateTask(existingTasks, taskTitle, deadline) {
  const normTitle = (taskTitle || "").trim().toLowerCase();
  const normDeadline = (deadline || "").trim();
  return existingTasks.some((t) => {
    const tTitle = (t.task || "").trim().toLowerCase();
    const tDeadline = (t.deadline || "").trim();
    return tTitle === normTitle && tDeadline === normDeadline;
  });
}

// ============================================================================
// DATE UTILITIES (Local / Asia-Kolkata Friendly)
// ============================================================================
function getTodayIsoString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getOffsetDateIsoString(daysOffset) {
  const target = new Date();
  target.setDate(target.getDate() + daysOffset);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, "0");
  const d = String(target.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoDate(isoStr) {
  if (!isoStr) return null;
  const parts = isoStr.split("-");
  if (parts.length !== 3) return null;
  const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  return isNaN(date.getTime()) ? null : date;
}

// Format "days left" label
function getDaysLeftInfo(deadlineStr, isDone) {
  if (isDone) {
    return { label: "✓ Done", cssClass: "due-done" };
  }
  if (!deadlineStr) {
    return { label: "No deadline", cssClass: "due-none" };
  }

  const todayStr = getTodayIsoString();
  if (deadlineStr === todayStr) {
    return { label: "📌 Due Today", cssClass: "due-today" };
  }

  const tomorrowStr = getOffsetDateIsoString(1);
  if (deadlineStr === tomorrowStr) {
    return { label: "⏳ Tomorrow", cssClass: "due-tomorrow" };
  }

  // Calculate day difference
  const targetDate = parseIsoDate(deadlineStr);
  const todayDate = parseIsoDate(todayStr);

  if (!targetDate || !todayDate) {
    return { label: deadlineStr, cssClass: "due-none" };
  }

  const diffTime = targetDate.getTime() - todayDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      label: `⚠️ ${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`,
      cssClass: "due-overdue"
    };
  } else {
    return {
      label: `${diffDays} day${diffDays === 1 ? "" : "s"} left`,
      cssClass: diffDays <= 3 ? "due-tomorrow" : "due-later"
    };
  }
}

// Format deadline nicely for human display
function formatDeadlineDisplay(isoStr) {
  if (!isoStr) return "No deadline";
  const date = parseIsoDate(isoStr);
  if (!date) return isoStr;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

// Google Calendar URL generator
// https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=YYYYMMDD/YYYYMMDD(next day)&details=...
function buildGoogleCalendarUrl(task) {
  let startDateStr = task.deadline;
  if (!startDateStr) {
    startDateStr = getTodayIsoString();
  }

  const startDate = parseIsoDate(startDateStr) || new Date();
  const nextDay = new Date(startDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const formatCalendarDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  };

  const datesParam = `${formatCalendarDate(startDate)}/${formatCalendarDate(nextDay)}`;
  const title = encodeURIComponent(task.task || "College Task");

  const detailsLines = [];
  if (task.subject) detailsLines.push(`Subject: ${task.subject}`);
  if (task.priority) detailsLines.push(`Priority: ${task.priority.toUpperCase()}`);
  if (task.notes) detailsLines.push(`Notes: ${task.notes}`);
  detailsLines.push(`Imported from TaskNudge`);
  const details = encodeURIComponent(detailsLines.join("\n"));

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${datesParam}&details=${details}`;
}

// Export all tasks as .ics iCalendar file
function exportAllTasksToIcs(tasks) {
  const validTasks = tasks.filter((t) => t.deadline);
  if (validTasks.length === 0) {
    showToast("No tasks with deadlines to export.", "info");
    return;
  }

  const formatIcsDate = (isoStr) => {
    const d = parseIsoDate(isoStr) || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  };

  const escapeIcs = (str) => {
    if (!str) return "";
    return String(str).replace(/[\\;,]/g, "\\$&").replace(/\n/g, "\\n");
  };

  let icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TaskNudge//Campus AI Task Manager//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH"
  ];

  validTasks.forEach((t) => {
    const dtStart = formatIcsDate(t.deadline);
    const startDate = parseIsoDate(t.deadline);
    const nextDay = new Date(startDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const dtEnd = formatIcsDate(
      `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`
    );

    icsLines.push("BEGIN:VEVENT");
    icsLines.push(`UID:${t.id || generateId()}@tasknudge`);
    icsLines.push(`DTSTAMP:${formatIcsDate(getTodayIsoString())}T000000Z`);
    icsLines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    icsLines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    icsLines.push(`SUMMARY:${escapeIcs(t.task)}`);
    
    let desc = `Subject: ${t.subject || "General"}\nPriority: ${(t.priority || "medium").toUpperCase()}`;
    if (t.notes) desc += `\nNotes: ${t.notes}`;
    icsLines.push(`DESCRIPTION:${escapeIcs(desc)}`);
    icsLines.push("STATUS:CONFIRMED");
    icsLines.push("END:VEVENT");
  });

  icsLines.push("END:VCALENDAR");

  const icsBlob = new Blob([icsLines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(icsBlob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = `tasknudge-tasks-${getTodayIsoString()}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);

  showToast(`Exported ${validTasks.length} task(s) to .ics calendar!`, "success");
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icon = type === "success" ? "✓" : type === "error" ? "⚠️" : "✦";
  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.25s ease-out";
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// Escape HTML utility
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================================
// APP NAVIGATION (4 VIEWS)
// ============================================================================
function switchView(viewName) {
  appState.currentView = viewName;

  // Update tabs
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    if (tab.dataset.view === viewName) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  });

  // Update panels
  document.querySelectorAll(".view-panel").forEach((panel) => {
    if (panel.id === `view-${viewName}`) {
      panel.classList.add("active");
    } else {
      panel.classList.remove("active");
    }
  });

  // Breadcrumb title
  const breadcrumb = document.getElementById("current-view-title");
  if (breadcrumb) {
    const titles = {
      add: "Add & Extract",
      tasks: "My Tasks",
      week: "7-Day Horizon",
      dashboard: "Dashboard"
    };
    breadcrumb.textContent = titles[viewName] || viewName;
  }

  // Refresh view specific data
  if (viewName === "tasks") {
    renderMyTasks();
  } else if (viewName === "week") {
    renderWeekView();
  } else if (viewName === "dashboard") {
    renderDashboardView();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================================
// VIEW 1: ADD & EXTRACT LOGIC
// ============================================================================
function setupAddView() {
  const noticeInput = document.getElementById("notice-textarea");
  const charCount = document.getElementById("notice-char-count");
  const btnSample = document.getElementById("btn-paste-sample");
  const btnClear = document.getElementById("btn-clear-notice");
  const btnExtract = document.getElementById("btn-extract");
  const loadingIndicator = document.getElementById("extract-loading");
  const previewSection = document.getElementById("extracted-preview-section");
  const previewList = document.getElementById("preview-items-list");
  const previewCountBadge = document.getElementById("preview-count-badge");
  const btnSelectAll = document.getElementById("btn-select-all");
  const btnDeselectAll = document.getElementById("btn-deselect-all");
  const btnImportSelected = document.getElementById("btn-import-selected");
  const importCountTag = document.getElementById("import-count-tag");
  const manualForm = document.getElementById("manual-task-form");

  // Character counter
  noticeInput.addEventListener("input", () => {
    const len = noticeInput.value.length;
    charCount.textContent = `${len.toLocaleString()} chars`;
  });

  // Paste Sample
  btnSample.addEventListener("click", () => {
    noticeInput.value = SAMPLE_NOTICE;
    noticeInput.dispatchEvent(new Event("input"));
    noticeInput.focus();
    showToast("Sample notice loaded!", "info");
  });

  // Clear
  btnClear.addEventListener("click", () => {
    noticeInput.value = "";
    noticeInput.dispatchEvent(new Event("input"));
    previewSection.classList.add("hidden");
    appState.extractedBuffer = [];
  });

  // Ctrl+Enter shortcut to extract
  noticeInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      btnExtract.click();
    }
  });

  // Extract Action
  btnExtract.addEventListener("click", async () => {
    const notice = noticeInput.value.trim();
    if (!notice) {
      showToast("Please paste a college notice first.", "error");
      noticeInput.focus();
      return;
    }

    btnExtract.disabled = true;
    loadingIndicator.classList.remove("hidden");
    previewSection.classList.add("hidden");
    appState.extractedBuffer = [];

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notice })
      });

      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error("Invalid response format received from extraction service.");
      }

      if (!response.ok) {
        throw new Error(data?.error || `Request failed with status ${response.status}`);
      }

      if (!Array.isArray(data) || data.length === 0) {
        showToast("No tasks detected in this notice.", "info");
        return;
      }

      // Populate preview buffer (all ticked by default)
      appState.extractedBuffer = data.map((t) => ({
        id: generateId(),
        task: t.task || "Untitled Task",
        subject: t.subject || "General",
        deadline: t.deadline || null,
        priority: (t.priority || "medium").toLowerCase(),
        notes: t.notes || "",
        selected: true
      }));

      renderExtractedPreview();
      showToast(`Discovered ${data.length} task(s)!`, "success");
    } catch (err) {
      console.error("Extraction error:", err);
      showToast(err.message || "Failed to extract tasks. Check your connection.", "error");
    } finally {
      loadingIndicator.classList.add("hidden");
      btnExtract.disabled = false;
    }
  });

  // Render preview items
  function renderExtractedPreview() {
    previewList.innerHTML = "";
    if (appState.extractedBuffer.length === 0) {
      previewSection.classList.add("hidden");
      return;
    }

    previewSection.classList.remove("hidden");
    previewCountBadge.textContent = `${appState.extractedBuffer.length} found`;

    appState.extractedBuffer.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "preview-item-card";

      const priorityBadgeClass = `badge-priority-${item.priority || "medium"}`;
      const daysInfo = getDaysLeftInfo(item.deadline, false);

      card.innerHTML = `
        <div class="preview-checkbox-wrap">
          <input type="checkbox" class="preview-checkbox" id="prev-check-${index}" ${item.selected ? "checked" : ""}>
        </div>
        <div class="preview-item-info">
          <label for="prev-check-${index}" class="preview-item-title">${escapeHtml(item.task)}</label>
          <div class="preview-item-meta">
            <span class="chip chip-subject">${escapeHtml(item.subject || "General")}</span>
            <span class="chip ${priorityBadgeClass}">${item.priority.toUpperCase()}</span>
            <span class="chip chip-days-left ${daysInfo.cssClass}">
              📅 ${formatDeadlineDisplay(item.deadline)} (${daysInfo.label})
            </span>
          </div>
          ${item.notes ? `<div class="preview-item-notes">${escapeHtml(item.notes)}</div>` : ""}
        </div>
      `;

      // Checkbox listener
      const cb = card.querySelector(".preview-checkbox");
      cb.addEventListener("change", () => {
        item.selected = cb.checked;
        updateImportButtonCount();
      });

      previewList.appendChild(card);
    });

    updateImportButtonCount();
  }

  function updateImportButtonCount() {
    const selectedCount = appState.extractedBuffer.filter((t) => t.selected).length;
    importCountTag.textContent = `(${selectedCount})`;
    btnImportSelected.disabled = selectedCount === 0;
  }

  btnSelectAll.addEventListener("click", () => {
    appState.extractedBuffer.forEach((t) => (t.selected = true));
    document.querySelectorAll(".preview-checkbox").forEach((cb) => (cb.checked = true));
    updateImportButtonCount();
  });

  btnDeselectAll.addEventListener("click", () => {
    appState.extractedBuffer.forEach((t) => (t.selected = false));
    document.querySelectorAll(".preview-checkbox").forEach((cb) => (cb.checked = false));
    updateImportButtonCount();
  });

  // Import Selected Tasks to My Tasks (Skip duplicates)
  btnImportSelected.addEventListener("click", () => {
    const selectedTasks = appState.extractedBuffer.filter((t) => t.selected);
    if (selectedTasks.length === 0) return;

    let addedCount = 0;
    let skippedCount = 0;

    selectedTasks.forEach((item) => {
      if (isDuplicateTask(appState.tasks, item.task, item.deadline)) {
        skippedCount++;
      } else {
        appState.tasks.push({
          id: generateId(),
          task: item.task,
          subject: item.subject || "General",
          deadline: item.deadline || null,
          priority: item.priority || "medium",
          notes: item.notes || "",
          done: false,
          createdAt: Date.now()
        });
        addedCount++;
      }
    });

    saveTasksToStorage(appState.tasks);
    updateTaskCounters();

    // Reset buffer & clear preview
    appState.extractedBuffer = [];
    previewSection.classList.add("hidden");
    noticeInput.value = "";
    noticeInput.dispatchEvent(new Event("input"));

    if (addedCount > 0 && skippedCount > 0) {
      showToast(`Added ${addedCount} task(s) (${skippedCount} duplicate skipped)`, "success");
    } else if (addedCount > 0) {
      showToast(`Added ${addedCount} task(s) to My Tasks!`, "success");
    } else {
      showToast(`All selected tasks were already in your list!`, "info");
    }

    // Switch to My Tasks view so user sees their new tasks
    switchView("tasks");
  });

  // Manual Task Form Submit
  manualForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const taskInput = document.getElementById("manual-task");
    const subjectInput = document.getElementById("manual-subject");
    const deadlineInput = document.getElementById("manual-deadline");
    const priorityInput = document.getElementById("manual-priority");
    const notesInput = document.getElementById("manual-notes");

    const taskTitle = taskInput.value.trim();
    if (!taskTitle) return;

    const deadline = deadlineInput.value || null;
    const subject = subjectInput.value.trim() || "General";
    const priority = priorityInput.value || "medium";
    const notes = notesInput.value.trim();

    if (isDuplicateTask(appState.tasks, taskTitle, deadline)) {
      showToast("A task with the same name and deadline already exists!", "error");
      return;
    }

    const newTask = {
      id: generateId(),
      task: taskTitle,
      subject: subject,
      deadline: deadline,
      priority: priority,
      notes: notes,
      done: false,
      createdAt: Date.now()
    };

    appState.tasks.push(newTask);
    saveTasksToStorage(appState.tasks);
    updateTaskCounters();

    manualForm.reset();
    showToast("Task added to My Tasks!", "success");
    switchView("tasks");
  });
}

// ============================================================================
// VIEW 2: MY TASKS (Grouping, Filters, Search, Actions)
// ============================================================================
function setupTasksView() {
  const searchInput = document.getElementById("tasks-search");
  const btnClearSearch = document.getElementById("btn-clear-search");
  const filterSubject = document.getElementById("filter-subject");
  const filterPriority = document.getElementById("filter-priority");
  const btnExportIcs = document.getElementById("btn-export-ics");
  const btnResetFilters = document.getElementById("btn-reset-filters");
  const btnEmptyAdd = document.getElementById("btn-empty-add-switch");

  searchInput.addEventListener("input", () => {
    appState.searchQuery = searchInput.value.trim().toLowerCase();
    btnClearSearch.classList.toggle("hidden", !appState.searchQuery);
    renderMyTasks();
  });

  btnClearSearch.addEventListener("click", () => {
    searchInput.value = "";
    appState.searchQuery = "";
    btnClearSearch.classList.add("hidden");
    renderMyTasks();
  });

  filterSubject.addEventListener("change", () => {
    appState.filterSubject = filterSubject.value;
    renderMyTasks();
  });

  filterPriority.addEventListener("change", () => {
    appState.filterPriority = filterPriority.value;
    renderMyTasks();
  });

  btnResetFilters.addEventListener("click", () => {
    searchInput.value = "";
    appState.searchQuery = "";
    btnClearSearch.classList.add("hidden");
    filterSubject.value = "all";
    appState.filterSubject = "all";
    filterPriority.value = "all";
    appState.filterPriority = "all";
    renderMyTasks();
  });

  btnExportIcs.addEventListener("click", () => {
    exportAllTasksToIcs(appState.tasks);
  });

  btnEmptyAdd.addEventListener("click", () => {
    switchView("add");
  });
}

// Populate dynamic subject options in filter dropdown
function updateSubjectFilterOptions() {
  const select = document.getElementById("filter-subject");
  if (!select) return;

  const currentVal = appState.filterSubject;
  const subjects = new Set();
  appState.tasks.forEach((t) => {
    if (t.subject) subjects.add(t.subject.trim());
  });

  const sortedSubjects = Array.from(subjects).sort();
  select.innerHTML = '<option value="all">All Subjects</option>';
  sortedSubjects.forEach((sub) => {
    const opt = document.createElement("option");
    opt.value = sub;
    opt.textContent = sub;
    if (sub === currentVal) opt.selected = true;
    select.appendChild(opt);
  });
}

function renderMyTasks() {
  updateSubjectFilterOptions();
  const container = document.getElementById("task-groups-container");
  const emptyState = document.getElementById("tasks-empty-state");
  const emptyTitle = document.getElementById("empty-state-title");
  const emptyDesc = document.getElementById("empty-state-desc");
  const filterStatusBar = document.getElementById("filter-status-bar");
  const filterStatusText = document.getElementById("filter-status-text");

  container.innerHTML = "";

  // Check filter active status
  const hasFilter = appState.searchQuery || appState.filterSubject !== "all" || appState.filterPriority !== "all";
  if (hasFilter) {
    filterStatusBar.classList.remove("hidden");
    const activeFilters = [];
    if (appState.searchQuery) activeFilters.push(`"${appState.searchQuery}"`);
    if (appState.filterSubject !== "all") activeFilters.push(`Subject: ${appState.filterSubject}`);
    if (appState.filterPriority !== "all") activeFilters.push(`Priority: ${appState.filterPriority}`);
    filterStatusText.textContent = `Showing results for: ${activeFilters.join(" • ")}`;
  } else {
    filterStatusBar.classList.add("hidden");
  }

  // Filter tasks
  const filtered = appState.tasks.filter((t) => {
    // Search query
    if (appState.searchQuery) {
      const q = appState.searchQuery;
      const titleMatch = (t.task || "").toLowerCase().includes(q);
      const subMatch = (t.subject || "").toLowerCase().includes(q);
      const notesMatch = (t.notes || "").toLowerCase().includes(q);
      if (!titleMatch && !subMatch && !notesMatch) return false;
    }
    // Subject
    if (appState.filterSubject !== "all") {
      if ((t.subject || "").trim() !== appState.filterSubject) return false;
    }
    // Priority
    if (appState.filterPriority !== "all") {
      if ((t.priority || "medium").toLowerCase() !== appState.filterPriority) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    if (hasFilter) {
      emptyTitle.textContent = "No tasks match your filters";
      emptyDesc.textContent = "Try clearing your search query or reset the subject and priority filters.";
    } else {
      emptyTitle.textContent = "Your task canvas is clear";
      emptyDesc.textContent = "Paste an announcement or add a task manually from the Add tab.";
    }
    return;
  }

  emptyState.classList.add("hidden");

  // Date boundaries for grouping
  const todayStr = getTodayIsoString();
  const tomorrowStr = getOffsetDateIsoString(1);
  const endOfWeekStr = getOffsetDateIsoString(7);

  // Group definitions
  const groups = [
    { id: "overdue", title: "⚠️ Overdue", cssClass: "group-overdue", items: [] },
    { id: "today", title: "📌 Due Today", cssClass: "group-today", items: [] },
    { id: "tomorrow", title: "⏳ Tomorrow", cssClass: "group-tomorrow", items: [] },
    { id: "this_week", title: "🗓️ This Week", cssClass: "group-this-week", items: [] },
    { id: "later", title: "📅 Later", cssClass: "group-later", items: [] },
    { id: "no_deadline", title: "☁️ No Deadline", cssClass: "group-no-deadline", items: [] },
    { id: "done", title: "✓ Completed", cssClass: "group-done", items: [] }
  ];

  filtered.forEach((task) => {
    if (task.done) {
      groups.find((g) => g.id === "done").items.push(task);
      return;
    }

    const d = task.deadline;
    if (!d) {
      groups.find((g) => g.id === "no_deadline").items.push(task);
    } else if (d < todayStr) {
      groups.find((g) => g.id === "overdue").items.push(task);
    } else if (d === todayStr) {
      groups.find((g) => g.id === "today").items.push(task);
    } else if (d === tomorrowStr) {
      groups.find((g) => g.id === "tomorrow").items.push(task);
    } else if (d <= endOfWeekStr) {
      groups.find((g) => g.id === "this_week").items.push(task);
    } else {
      groups.find((g) => g.id === "later").items.push(task);
    }
  });

  // Render each group that has items
  groups.forEach((group) => {
    if (group.items.length === 0) return;

    // Sort items inside group by deadline
    group.items.sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    });

    const groupEl = document.createElement("div");
    groupEl.className = `task-group ${group.cssClass}`;

    groupEl.innerHTML = `
      <div class="group-header">
        <div class="group-title-wrap">
          <h3 class="group-title">${group.title}</h3>
          <span class="group-badge">${group.items.length}</span>
        </div>
      </div>
      <div class="task-list"></div>
    `;

    const listEl = groupEl.querySelector(".task-list");
    group.items.forEach((task) => {
      listEl.appendChild(createTaskCardElement(task));
    });

    container.appendChild(groupEl);
  });
}

// Create single task card element
function createTaskCardElement(task) {
  const card = document.createElement("div");
  card.className = `task-card ${task.done ? "is-done" : ""}`;
  card.id = `card-${task.id}`;

  const priority = (task.priority || "medium").toLowerCase();
  const priorityBadgeClass = `badge-priority-${priority}`;
  const daysInfo = getDaysLeftInfo(task.deadline, task.done);
  const calendarUrl = buildGoogleCalendarUrl(task);

  card.innerHTML = `
    <div class="task-card-main">
      <div class="task-check-wrap">
        <input type="checkbox" class="task-checkbox" ${task.done ? "checked" : ""} aria-label="Mark task complete">
      </div>
      <div class="task-content">
        <div class="task-title">${escapeHtml(task.task)}</div>
        <div class="task-meta-row">
          <span class="chip chip-subject">${escapeHtml(task.subject || "General")}</span>
          <span class="chip ${priorityBadgeClass}">${priority.toUpperCase()}</span>
          <span class="chip chip-days-left ${daysInfo.cssClass}">
            ${daysInfo.label}
          </span>
          ${task.deadline ? `<span class="chip" style="background:#f1f5f9; color:#475569;">📅 ${formatDeadlineDisplay(task.deadline)}</span>` : ""}
        </div>
        ${task.notes ? `<div class="task-notes-block">${escapeHtml(task.notes)}</div>` : ""}
      </div>
    </div>

    <div class="task-card-footer">
      <div class="task-footer-left">
        ${task.deadline ? `Due: ${task.deadline}` : "No set date"}
      </div>
      <div class="task-footer-actions">
        <a href="${calendarUrl}" target="_blank" rel="noopener noreferrer" class="btn-task-action" title="Add to Google Calendar as all-day event">
          <span>📅 Add to Cal</span>
        </a>
        <button type="button" class="btn-task-action btn-action-edit" title="Edit task details">
          <span>✏️ Edit</span>
        </button>
        <button type="button" class="btn-task-action btn-action-delete" title="Delete task">
          <span>🗑️ Delete</span>
        </button>
      </div>
    </div>
  `;

  // Toggle done checkbox
  const cb = card.querySelector(".task-checkbox");
  cb.addEventListener("change", () => {
    task.done = cb.checked;
    saveTasksToStorage(appState.tasks);
    updateTaskCounters();
    renderMyTasks();
    if (appState.currentView === "week") renderWeekView();
    showToast(task.done ? "Task marked complete! 🌱" : "Task restored to active list.", "info");
  });

  // Edit button
  const btnEdit = card.querySelector(".btn-action-edit");
  btnEdit.addEventListener("click", () => {
    openEditModal(task);
  });

  // Delete button
  const btnDelete = card.querySelector(".btn-action-delete");
  btnDelete.addEventListener("click", () => {
    deleteTask(task.id);
  });

  return card;
}

// Delete task helper
function deleteTask(taskId) {
  const idx = appState.tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return;

  const deletedTask = appState.tasks.splice(idx, 1)[0];
  saveTasksToStorage(appState.tasks);
  updateTaskCounters();
  renderMyTasks();
  if (appState.currentView === "week") renderWeekView();

  showToast(`Deleted "${deletedTask.task.slice(0, 24)}..."`, "info");
}

// ============================================================================
// EDIT TASK MODAL
// ============================================================================
function setupEditModal() {
  const modal = document.getElementById("edit-modal-overlay");
  const form = document.getElementById("edit-task-form");
  const btnClose = document.getElementById("btn-close-modal");
  const btnCancel = document.getElementById("btn-cancel-modal");

  const closeModal = () => modal.classList.add("hidden");

  btnClose.addEventListener("click", closeModal);
  btnCancel.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("edit-task-id").value;
    const task = appState.tasks.find((t) => t.id === id);
    if (!task) return;

    task.task = document.getElementById("edit-task-title").value.trim();
    task.subject = document.getElementById("edit-task-subject").value.trim() || "General";
    task.deadline = document.getElementById("edit-task-deadline").value || null;
    task.priority = document.getElementById("edit-task-priority").value || "medium";
    task.notes = document.getElementById("edit-task-notes").value.trim();

    saveTasksToStorage(appState.tasks);
    renderMyTasks();
    if (appState.currentView === "week") renderWeekView();
    closeModal();
    showToast("Task updated!", "success");
  });
}

function openEditModal(task) {
  const modal = document.getElementById("edit-modal-overlay");
  document.getElementById("edit-task-id").value = task.id;
  document.getElementById("edit-task-title").value = task.task;
  document.getElementById("edit-task-subject").value = task.subject || "";
  document.getElementById("edit-task-deadline").value = task.deadline || "";
  document.getElementById("edit-task-priority").value = task.priority || "medium";
  document.getElementById("edit-task-notes").value = task.notes || "";

  modal.classList.remove("hidden");
  document.getElementById("edit-task-title").focus();
}

// ============================================================================
// VIEW 3: WEEK VIEW (7-Day Horizon & Crunch Days)
// ============================================================================
function setupWeekView() {
  // Initial default selected date is today
  appState.selectedWeekDate = getTodayIsoString();
}

function renderWeekView() {
  const strip = document.getElementById("week-strip");
  const selectedTitle = document.getElementById("selected-day-title");
  const selectedCountBadge = document.getElementById("selected-day-count");
  const selectedCrunchBadge = document.getElementById("selected-day-crunch-badge");
  const selectedTasksContainer = document.getElementById("selected-day-tasks");

  strip.innerHTML = "";
  selectedTasksContainer.innerHTML = "";

  const todayIso = getTodayIsoString();
  if (!appState.selectedWeekDate) {
    appState.selectedWeekDate = todayIso;
  }

  let anyCrunchInWeek = false;

  // 7 days starting today
  const daysData = [];
  for (let i = 0; i < 7; i++) {
    const iso = getOffsetDateIsoString(i);
    const dateObj = parseIsoDate(iso);
    const dayName = i === 0 ? "Today" : dateObj.toLocaleDateString(undefined, { weekday: "short" });
    const dayDateNum = dateObj.getDate();
    const monthName = dateObj.toLocaleDateString(undefined, { month: "short" });

    // Count non-completed tasks on this deadline (or all tasks)
    const dayTasks = appState.tasks.filter((t) => t.deadline === iso && !t.done);
    const count = dayTasks.length;
    const isCrunch = count >= 3;

    if (isCrunch) anyCrunchInWeek = true;

    daysData.push({
      iso,
      dayName,
      dayDateNum,
      monthName,
      count,
      isCrunch,
      isToday: iso === todayIso,
      tasks: dayTasks
    });
  }

  // Update top nav crunch indicator
  const navCrunchPill = document.getElementById("week-crunch-pill");
  if (navCrunchPill) {
    navCrunchPill.classList.toggle("hidden", !anyCrunchInWeek);
  }

  // Render 7-day strip
  daysData.forEach((day) => {
    const card = document.createElement("div");
    card.className = `week-day-card ${day.isCrunch ? "is-crunch-day" : ""} ${day.iso === appState.selectedWeekDate ? "is-active-day" : ""} ${day.isToday ? "is-today-day" : ""}`;

    card.innerHTML = `
      <span class="day-name">${day.dayName}</span>
      <span class="day-date">${day.dayDateNum}</span>
      <span class="day-count-badge">${day.count}</span>
      ${day.isCrunch ? '<span class="day-crunch-tag">⚡ Crunch</span>' : ""}
    `;

    card.addEventListener("click", () => {
      appState.selectedWeekDate = day.iso;
      renderWeekView();
    });

    strip.appendChild(card);
  });

  // Render tasks for selected day
  const selectedDay = daysData.find((d) => d.iso === appState.selectedWeekDate) || daysData[0];
  const dateObj = parseIsoDate(selectedDay.iso);
  const prettyDateStr = dateObj
    ? dateObj.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : selectedDay.iso;

  selectedTitle.textContent = selectedDay.isToday ? `Today's Deadlines (${prettyDateStr})` : prettyDateStr;
  selectedCountBadge.textContent = `${selectedDay.count} task${selectedDay.count === 1 ? "" : "s"}`;
  selectedCrunchBadge.classList.toggle("hidden", !selectedDay.isCrunch);

  if (selectedDay.tasks.length === 0) {
    selectedTasksContainer.innerHTML = `
      <div class="empty-state-card" style="padding: 2rem 1rem;">
        <div style="font-size: 2rem; margin-bottom: 0.25rem;">☁️</div>
        <h4 style="font-size: 1.05rem; font-weight: 700;">Clear skies on this day</h4>
        <p style="font-size: 0.85rem; color: var(--c-navy-muted);">No pending deadlines scheduled. Enjoy your peaceful study window!</p>
      </div>
    `;
  } else {
    selectedDay.tasks.forEach((task) => {
      selectedTasksContainer.appendChild(createTaskCardElement(task));
    });
  }
}

// ============================================================================
// VIEW 4: DASHBOARD (Iframe Embed or Coming Soon Card)
// ============================================================================
function renderDashboardView() {
  const iframe = document.getElementById("dashboard-frame");
  const emptyCard = document.getElementById("dashboard-empty-card");

  if (DASHBOARD_URL && DASHBOARD_URL.trim()) {
    iframe.src = DASHBOARD_URL.trim();
    iframe.classList.remove("hidden");
    emptyCard.classList.add("hidden");
  } else {
    iframe.classList.add("hidden");
    emptyCard.classList.remove("hidden");
  }
}

// ============================================================================
// COUNTERS & INITIALIZATION
// ============================================================================
function updateTaskCounters() {
  const pill = document.getElementById("tasks-total-pill");
  if (pill) {
    const activeTasks = appState.tasks.filter((t) => !t.done);
    pill.textContent = activeTasks.length;
  }

  // Check week crunch
  const todayIso = getTodayIsoString();
  let crunchFound = false;
  for (let i = 0; i < 7; i++) {
    const iso = getOffsetDateIsoString(i);
    const count = appState.tasks.filter((t) => t.deadline === iso && !t.done).length;
    if (count >= 3) {
      crunchFound = true;
      break;
    }
  }
  const navCrunch = document.getElementById("week-crunch-pill");
  if (navCrunch) {
    navCrunch.classList.toggle("hidden", !crunchFound);
  }
}

// Global Event Listeners & Bootstrapping
document.addEventListener("DOMContentLoaded", () => {
  // Load tasks
  appState.tasks = loadTasksFromStorage();

  // Setup navigation tabs
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const view = tab.dataset.view;
      if (view) switchView(view);
    });
  });

  // Setup views
  setupAddView();
  setupTasksView();
  setupWeekView();
  setupEditModal();

  // Initial render
  updateTaskCounters();
  renderMyTasks();
});
