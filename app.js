/**
 * TaskNudge Frontend Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const noticeInput = document.getElementById('notice-input');
  const extractBtn = document.getElementById('extract-btn');
  const charCount = document.getElementById('char-count');
  const sampleBtn = document.getElementById('sample-btn');
  const clearBtn = document.getElementById('clear-btn');

  const loadingState = document.getElementById('loading-state');
  const errorBox = document.getElementById('error-box');
  const errorMessage = document.getElementById('error-message');
  const errorDismiss = document.getElementById('error-dismiss');

  const resultsSection = document.getElementById('results-section');
  const emptyState = document.getElementById('empty-state');
  const noTasksState = document.getElementById('no-tasks-state');
  const taskGrid = document.getElementById('task-grid');
  const taskCountPill = document.getElementById('task-count-pill');
  const resultsMeta = document.getElementById('results-meta');

  // Sample Notice Text for quick demonstration
  const SAMPLE_NOTICE = `URGENT NOTICE - DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING
Ref: CSE/2026/ODD/042

1. Major Project Phase-1 Synopsis Submission:
All Final Year B.Tech students are strictly required to submit their project synopsis approved by their guide on or before 28th November 2026, 4:00 PM to the department lab.

2. Cloud Computing Lab Quiz:
The second lab continuous evaluation quiz will be held on 27th November 2026 during respective batch hours. Attendance is mandatory.

3. IEEE Student Chapter Membership Renewal:
Students interested in IEEE student branch membership renewal may register through the student coordinator by 5th December 2026.`;

  // Character counter
  noticeInput.addEventListener('input', () => {
    const len = noticeInput.value.length;
    charCount.textContent = `${len.toLocaleString()} character${len === 1 ? '' : 's'}`;
  });

  // Load sample notice
  sampleBtn.addEventListener('click', () => {
    noticeInput.value = SAMPLE_NOTICE;
    noticeInput.dispatchEvent(new Event('input'));
    noticeInput.focus();
    hideError();
  });

  // Clear button
  clearBtn.addEventListener('click', () => {
    noticeInput.value = '';
    noticeInput.dispatchEvent(new Event('input'));
    noticeInput.focus();
    hideError();
  });

  // Error dismiss button
  errorDismiss.addEventListener('click', () => {
    hideError();
  });

  function showError(msg) {
    errorMessage.textContent = msg;
    errorBox.classList.remove('hidden');
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideError() {
    errorBox.classList.add('hidden');
  }

  // Priority badge helper
  function getPriorityBadgeHtml(priority) {
    const p = (priority || 'medium').toLowerCase();
    let badgeClass = 'badge-medium';
    let label = 'Medium';

    if (p === 'high') {
      badgeClass = 'badge-high';
      label = 'High Priority';
    } else if (p === 'low') {
      badgeClass = 'badge-low';
      label = 'Low Priority';
    } else {
      label = 'Medium Priority';
    }

    return `<span class="priority-badge ${badgeClass}">${label}</span>`;
  }

  // Deadline sorting comparator helper
  function parseDateForSort(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') {
      return Number.MAX_SAFE_INTEGER; // Put items without dates at the end
    }
    const parsed = Date.parse(dateStr);
    if (isNaN(parsed)) {
      return Number.MAX_SAFE_INTEGER;
    }
    return parsed;
  }

  function sortTasksByDeadline(tasks) {
    if (!Array.isArray(tasks)) return [];
    return [...tasks].sort((a, b) => {
      const timeA = parseDateForSort(a.deadline);
      const timeB = parseDateForSort(b.deadline);
      return timeA - timeB;
    });
  }

  // Format deadline for human display
  function formatDeadlineDisplay(deadline) {
    if (!deadline) {
      return 'No specific deadline specified';
    }
    const parsed = new Date(deadline);
    if (!isNaN(parsed.getTime())) {
      // Valid date
      return parsed.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    return deadline; // Fallback to raw string if it's "Tomorrow 5 PM" etc.
  }

  // Escape HTML to prevent XSS
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Render task cards
  function renderTasks(tasks) {
    taskGrid.innerHTML = '';

    if (!tasks || tasks.length === 0) {
      emptyState.classList.add('hidden');
      noTasksState.classList.remove('hidden');
      taskGrid.classList.add('hidden');
      taskCountPill.classList.add('hidden');
      resultsMeta.classList.add('hidden');
      return;
    }

    // Sort by deadline
    const sorted = sortTasksByDeadline(tasks);

    emptyState.classList.add('hidden');
    noTasksState.classList.add('hidden');
    taskGrid.classList.remove('hidden');

    taskCountPill.textContent = `${sorted.length} task${sorted.length === 1 ? '' : 's'}`;
    taskCountPill.classList.remove('hidden');
    resultsMeta.classList.remove('hidden');

    sorted.forEach((item) => {
      const p = (item.priority || 'medium').toLowerCase();
      const priorityClass = `priority-${p === 'high' ? 'high' : p === 'low' ? 'low' : 'medium'}`;

      const card = document.createElement('div');
      card.className = `task-card ${priorityClass}`;

      const subject = item.subject || 'General';
      const taskTitle = item.task || 'Untitled Task';
      const deadline = formatDeadlineDisplay(item.deadline);
      const notes = item.notes;

      card.innerHTML = `
        <div class="task-card-top">
          <span class="subject-badge" title="Subject: ${escapeHtml(subject)}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            ${escapeHtml(subject)}
          </span>
          ${getPriorityBadgeHtml(item.priority)}
        </div>

        <h3 class="task-title">${escapeHtml(taskTitle)}</h3>

        <div class="task-deadline-row">
          <span class="deadline-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </span>
          <span>Deadline: <span class="deadline-value">${escapeHtml(deadline)}</span></span>
        </div>

        ${notes ? `
          <div class="task-notes">
            ${escapeHtml(notes)}
          </div>
        ` : ''}
      `;

      taskGrid.appendChild(card);
    });

    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Handle Extraction Request
  async function handleExtract() {
    const notice = noticeInput.value.trim();

    if (!notice) {
      showError('Please paste a college notice or message before extracting tasks.');
      noticeInput.focus();
      return;
    }

    hideError();

    // UI state: loading
    extractBtn.disabled = true;
    loadingState.classList.remove('hidden');
    emptyState.classList.add('hidden');
    noTasksState.classList.add('hidden');
    taskGrid.classList.add('hidden');
    taskCountPill.classList.add('hidden');
    resultsMeta.classList.add('hidden');

    // Scroll to loading indicator
    loadingState.scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notice })
      });

      let data;
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Received unexpected response format from server.');
      }

      if (!response.ok) {
        const errorMsg = data?.error || `Request failed with status ${response.status}`;
        throw new Error(errorMsg);
      }

      renderTasks(data);
    } catch (err) {
      console.error('Task extraction error:', err);
      showError(err.message || 'Could not connect to task extraction service. Please verify your connection and try again.');
      // Restore empty or no tasks view if nothing loaded
      emptyState.classList.remove('hidden');
    } finally {
      loadingState.classList.add('hidden');
      extractBtn.disabled = false;
    }
  }

  extractBtn.addEventListener('click', handleExtract);

  // Keyboard shortcut: Ctrl+Enter / Cmd+Enter to extract
  noticeInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExtract();
    }
  });

  // Floating chat widget click action (placeholder feedback)
  const floatingChat = document.getElementById('floating-chat-trigger');
  if (floatingChat) {
    floatingChat.addEventListener('click', () => {
      const chatbotSection = document.getElementById('chatbot-section');
      if (chatbotSection) {
        chatbotSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        chatbotSection.style.borderColor = 'var(--accent-primary)';
        setTimeout(() => {
          chatbotSection.style.borderColor = '';
        }, 1500);
      }
    });
  }
});
