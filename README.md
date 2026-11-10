# Pennywise — Personal Expense Tracker

> A clean, fully client-side personal expense tracker built with HTML5, CSS3, and Vanilla JavaScript for the RIAFY Software Engineer Practical Test.

---

## Table of Contents
1. [How to Run](#how-to-run)
2. [Technologies Used](#technologies-used)
3. [Expense Data Structure](#expense-data-structure)
4. [How Persistence Works](#how-persistence-works)
5. [Features Completed](#features-completed)
6. [Features Skipped and Why](#features-skipped-and-why)
7. [Known Limitations](#known-limitations)

---

## How to Run

The application is entirely self-contained. No build step, no npm, no server required.

### Method 1 — Double-click (fastest)

Open `index.html` directly in any modern browser (Chrome, Firefox, Edge, Safari). OR TYPE THIS COMMAND IN THE TERMINAL OF PROJECT

Start-Process index.html

### Method 2 — PowerShell

```powershell
Start-Process "index.html"
```

### Method 3 — Python 3 static server

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

### Method 4 — VS Code Live Server

Right-click `index.html` → **Open with Live Server**.

> No compilation, no npm install, no `.env` file needed.

---

## Technologies Used

| Layer | Choice |
| :--- | :--- |
| **Markup** | Semantic HTML5 with ARIA attributes (`role="dialog"`, `aria-live`, `aria-modal`) |
| **Styling** | Vanilla CSS3 with custom properties (design tokens), CSS Grid, Flexbox |
| **Logic** | Vanilla JavaScript (ES6+), `'use strict'`, modular service objects |
| **Currency** | `Intl.NumberFormat` with `en-IN` locale and `INR` currency |
| **IDs** | `crypto.randomUUID()` with a fallback for older browsers |
| **Persistence** | Browser `localStorage` |
| **Build** | None — zero dependencies, zero build steps |

---

## Expense Data Structure

Each expense is a plain JavaScript object stored as JSON in `localStorage` under the key `pennywise_expenses_v1`.

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Grocery Shopping",
  "amount": 850.50,
  "category": "Food",
  "date": "2026-11-10",
  "note": "Weekly vegetables and fruits",
  "createdAt": "2026-11-10T06:30:00.000Z",
  "updatedAt": "2026-11-10T07:00:00.000Z"
}
```

**Field rules:**

| Field | Type | Required | Constraints |
| :--- | :--- | :--- | :--- |
| `id` | string | yes | UUID, unique, never modified after creation |
| `title` | string | yes | 1–100 characters, non-blank |
| `amount` | number | yes | Positive (`> 0`), rounded to 2 decimal places |
| `category` | string | yes | One of: `Food`, `Transport`, `Shopping`, `Bills`, `Entertainment`, `Other` |
| `date` | string | yes | `YYYY-MM-DD` format, today or earlier, valid calendar date |
| `note` | string | no | 0–250 characters |
| `createdAt` | string | yes | ISO 8601 timestamp, set once on creation |
| `updatedAt` | string | no | ISO 8601 timestamp, set only on edit |

---

## How Persistence Works

- On every add, edit, or delete, the full `state.expenses` array is serialized with `JSON.stringify` and written to `localStorage` under the key `pennywise_expenses_v1`.
- On page load (`DOMContentLoaded`), `StorageService.load()` reads and parses the stored JSON.
- If the stored value is missing, `[]` is returned silently.
- If the JSON is malformed (corrupted), the `catch` block returns `[]` and logs the error to the console.
- If the parsed value is not an array, `[]` is returned.
- Each record is validated against the schema: invalid `id`, blank `title`, non-positive `amount`, invalid `category`, or invalid `date` causes that record to be dropped silently, protecting against partially-corrupted data.
- All valid surviving records are normalized (amounts rounded to 2dp, strings trimmed) before being returned to the application.
- Expenses persist across page refreshes and browser restarts as long as the browser's `localStorage` is not cleared.

---

## Features Completed

### 1. Add Expense ✅
- Required title (non-blank, max 100 chars) with inline validation error.
- Positive INR amount with inline validation error for zero, negative, and non-numeric inputs.
- Category dropdown: Food, Transport, Shopping, Bills, Entertainment, Other.
- Date field defaults to today; enforced `max` attribute prevents selecting future dates; JS validation also rejects future dates.
- Optional note (max 250 chars) with live character counter.

### 2. View Expenses ✅
- Table displays all expense fields: Date (formatted `10 Nov 2026` + relative label `Today` / `Yesterday`), Title, Note, Category (colour-coded badge), Amount in INR, Edit and Delete buttons.
- Default sort: most recent date first.
- Empty-state message when no expenses exist.

### 3. Edit and Delete ✅
- Edit: pre-fills all fields in the same modal; validates on submit; updates `localStorage` and refreshes UI; preserves original `id` and `createdAt`, adds `updatedAt`.
- Delete: opens a confirmation dialog showing the expense title and amount; on confirm, removes from state and `localStorage`, refreshes UI; on cancel, does nothing.

### 4. Monthly Summary ✅
- KPI card shows the current calendar month's total spending.
- Month selector dropdown lists every month that has expense data, plus the current calendar month; switching rerenders summary and breakdown without touching the filter or the expense list.
- Category-wise breakdown: stacked bar + individual rows showing amount, percentage of month total, and transaction count for each of the 6 categories.
- When a month has no expenses, all totals show `₹0.00` and all percentages show `0%`.

### 5. Filtering ✅
- Category filter: single-select dropdown, default "All Categories".
- Date range: "From Date" and "To Date" inputs; range is inclusive on both ends.
- Reversed date range (From > To): shows an inline warning banner and returns zero results (no silent clamping).
- Partial title search: case-insensitive substring match on the expense title.
- All three filters AND the sort work together simultaneously.
- "Clear Filters" button resets all filters to defaults; it is disabled when no filters are active.
- Record counter shows "Showing X of Y expenses".

### 6. Edge Cases ✅
- Empty expense list: empty-state illustration with "Add First Expense" CTA.
- Empty title / blank title: rejected with inline error message.
- Zero, negative, non-numeric amounts: rejected with inline error message.
- Invalid or future dates: rejected with inline error message; date input's `max` attribute also prevents browser-level selection of future dates.
- Reversed date range: warning shown, zero results returned.
- Expenses on month boundaries (1st and last day of month): correctly included in that month's summary.
- Missing `localStorage` key: silently returns empty array.
- Corrupted / non-JSON `localStorage` data: caught by `try/catch`, returns empty array.
- Malformed individual records (bad schema): filtered out during load, rest of data unaffected.
- Refresh persistence: all expenses survive a page reload.

### 7. Code Quality ✅
- Single consistent expense schema (see [Expense Data Structure](#expense-data-structure)).
- Separated concerns: `StorageService`, `AnalyticsService`, `FilterService`, `RenderService`, `FormService`, `DeleteService`, `ToastService`, `App`.
- No duplicate logic; analytics and filter engines are pure functions called by the render layer.
- No fake / seed data; no "Sample Data" button.
- Existing `localStorage` key (`pennywise_expenses_v1`) preserved; no breaking change.

### 8. Extras (not required, do not conflict with requirements)
- **JSON Export**: footer "Export JSON" button downloads all current expenses as a timestamped `.json` file.
- **Storage Reset**: footer "Reset Storage" button wipes `localStorage` after a native `confirm()` dialog.
- **Month navigation**: the month selector allows reviewing any past month's summary and breakdown independently of the main expense list.

---

## Features Skipped and Why

| Feature | Reason Skipped |
| :--- | :--- |
| **Sample / seed data button** | Explicitly excluded by the assignment requirements ("No fake data or sample-data button"). Removed from both the header and the empty-state area. |
| **Authentication** | Out of scope for a client-only practical test. |
| **Backend / API** | Out of scope; the assignment is a pure frontend exercise. |
| **Automated test suite** | Excluded per the assignment instructions ("Do not spend time building an unnecessary test suite"). Logic was verified with a Node.js script during development. |
| **Multi-currency** | Out of scope; INR is the specified currency. |
| **Cloud sync / IndexedDB** | Out of scope; `localStorage` is the specified persistence layer. |

---

## Known Limitations

1. **Storage capacity**: `localStorage` is limited to ~5 MB per origin. Very large numbers of expenses (thousands of records with long notes) could eventually hit this limit. The error is caught and surfaced as a toast.
2. **Single browser/device**: data is stored in the browser's `localStorage` and does not sync across devices or browsers.
3. **No search on note field**: the filter searches only the expense title, as specified in Requirement 5 ("Partial title text search").
4. **Date input browser differences**: the `<input type="date">` picker appearance varies by browser; functionality and validation are identical across all.
5. **No offline service worker**: the app works offline once loaded (all assets are local), but requires the initial file to be served or opened from disk.
