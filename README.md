# TaskNudge ⚡

A clean, modern, dark-themed, and mobile-friendly web app that converts college notices, circulars, and WhatsApp group announcements into clear, prioritized tasks sorted by deadline.

---

## 🚀 Architecture & Tech Stack

- **Frontend**: Static HTML5, modern vanilla CSS (dark theme, glassmorphism, responsive grid), and vanilla JavaScript.
- **Backend**: Single Vercel Serverless Function at `/api/extract.js`.
- **Infrastructure**: Zero database, no authentication required. Preconfigured for Vercel deployment with `maxDuration: 30` in `vercel.json`.

---

## 📁 Project Structure

```
TaskNudge/
├── api/
│   └── extract.js        # Vercel serverless function (Make.com webhook forwarder)
├── test/
│   └── test-extract.js    # Unit test suite verifying all API scenarios
├── .env.example          # Template for required environment variables
├── index.html            # Main web application entry point
├── style.css             # Dark theme, mobile-friendly styles
├── app.js                # Frontend controller (extraction, sorting, rendering)
├── package.json          # Node scripts and metadata
├── vercel.json           # Vercel function configuration (maxDuration = 30s)
└── README.md             # Documentation
```

---

## ✨ Features

1. **Intuitive Notice Input**:
   - Large auto-expanding textarea with character counter.
   - Convenient "Paste Sample" button for one-click testing.
   - Keyboard shortcut: <kbd>Ctrl</kbd> + <kbd>Enter</kbd> (or <kbd>Cmd</kbd> + <kbd>Enter</kbd>) to extract tasks immediately.
2. **Real-Time Extraction Feedback**:
   - Animated loading spinner with the message: *"Reading your notice... (extracting deadlines, subjects, and priorities... takes 10 to 15 seconds)"*.
3. **Smart Task Cards**:
   - **Sorted by deadline**: tasks closest to completion appear first.
   - **Priority badges**: High (Red), Medium (Amber), Low (Green).
   - Subject tags, formatted deadline dates, and notes context.
   - Handled empty states ("No tasks found") and friendly error banners.
4. **Future-Proof Placeholder Sections**:
   - **Dashboard**: Ready-to-use `<iframe>` element styled to embed your future calendar, Notion database, or custom analytics dashboard.
   - **Chatbot Widget Spot**: Dedicated container `#chatbot-widget-container` and floating launcher button ready for embedding Botpress, Voiceflow, Chatbase, or custom widget scripts.

---

## 🛠️ Backend API (`/api/extract.js`) Details

- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "notice": "All 4th sem CSE students must submit Assignment 2 by Nov 28, 2026."
  }
  ```
- **Forwarded Payload to Make.com Webhook**:
  ```json
  {
    "notice": "...",
    "today": "2026-11-25"
  }
  ```
  *(The `today` date is automatically generated in `YYYY-MM-DD` format according to the `Asia/Kolkata` timezone)*
- **Headers Sent to Webhook**:
  - `Content-Type: application/json`
  - `x-make-apikey: <MAKE_API_KEY>` *(if set in environment)*
- **Response Handling**:
  - Automatically strips Markdown code fences (e.g. ```` ```json ... ``` ````) if returned by an LLM module in Make.
  - Returns sanitized JSON array:
    ```json
    [
      {
        "task": "Submit Assignment 2",
        "subject": "Computer Science",
        "deadline": "2026-11-28",
        "priority": "high",
        "notes": "Late submissions will incur grade penalties"
      }
    ]
    ```

---

## ⚙️ Environment Variables

Set these in your Vercel project dashboard or `.env.local`:

| Variable | Description | Required |
| :--- | :--- | :--- |
| `MAKE_WEBHOOK_URL` | The endpoint URL of your Make.com Custom Webhook | **Yes** |
| `MAKE_API_KEY` | Secret key sent in `x-make-apikey` header | Optional |

---

## 🚢 Deployment on Vercel

### Deploying via Vercel CLI
```bash
# 1. Install Vercel CLI (if not already installed)
npm i -g vercel

# 2. Deploy
vercel
```

### Deploying via GitHub / Git
1. Push this repository to GitHub or GitLab.
2. Import the project into your [Vercel Dashboard](https://vercel.com/new).
3. Under **Project Settings > Environment Variables**, add:
   - `MAKE_WEBHOOK_URL`
   - `MAKE_API_KEY` (if used)
4. Click **Deploy**. Vercel will automatically detect `vercel.json` and configure `/api/extract.js` with a 30-second execution timeout.

---

## 🧪 Testing Locally

To run the automated backend test suite:
```bash
npm test
```
The test suite verifies:
- `405 Method Not Allowed` for non-POST requests.
- `400 Bad Request` when notice text is empty.
- `500 Internal Server Error` when `MAKE_WEBHOOK_URL` is missing.
- Date calculation in `Asia/Kolkata` (`YYYY-MM-DD`).
- Payload forwarding, header forwarding (`x-make-apikey`).
- Markdown code fence removal (` ```json `).
- Parsing resilience and upstream error handling.
