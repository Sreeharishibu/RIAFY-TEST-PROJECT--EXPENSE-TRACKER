/**
 * PENNYWISE — PERSONAL EXPENSE TRACKER
 * Pure Vanilla JavaScript Application (ES6+)
 * 
 * Features:
 * - Dynamic Monthly Financial Calculations & Category Breakdown
 * - Multi-criteria Filter & Search Engine (Category, Date Range, Partial Title)
 * - Full CRUD with Inline Form Validation and Delete Confirmation
 * - Robust localStorage persistence with Corrupted Data Auto-recovery
 * - Zero external framework dependencies
 */

'use strict';

// ============================================================================
// 1. CONFIGURATION & CONSTANTS
// ============================================================================
const CONFIG = {
  STORAGE_KEY: 'pennywise_expenses_v1',
  CURRENCY: 'INR',
  LOCALE: 'en-IN',
  CATEGORIES: [
    { id: 'Food', label: 'Food', emoji: '🍔', color: '#f97316', bg: '#fff7ed', border: '#ffedd5' },
    { id: 'Transport', label: 'Transport', emoji: '🚗', color: '#0284c7', bg: '#f0f9ff', border: '#e0f2fe' },
    { id: 'Shopping', label: 'Shopping', emoji: '🛍️', color: '#ec4899', bg: '#fdf2f8', border: '#fce7f3' },
    { id: 'Bills', label: 'Bills', emoji: '🧾', color: '#ef4444', bg: '#fef2f2', border: '#fee2e2' },
    { id: 'Entertainment', label: 'Entertainment', emoji: '🎬', color: '#8b5cf6', bg: '#f5f3ff', border: '#ede9fe' },
    { id: 'Other', label: 'Other', emoji: '📦', color: '#64748b', bg: '#f8fafc', border: '#f1f5f9' },
  ]
};

// ============================================================================
// 2. APPLICATION STATE
// ============================================================================
const state = {
  expenses: [],
  activeMonth: '', // Format: 'YYYY-MM'
  editingId: null,
  deletingId: null,
  filters: {
    search: '',
    category: 'ALL',
    fromDate: '',
    toDate: '',
    sortBy: 'date-desc'
  }
};

// ============================================================================
// 3. UTILITY FUNCTIONS
// ============================================================================
const Utils = {
  /**
   * Generates a collision-resistant unique ID
   */
  generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'exp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  },

  /**
   * Formats a number to Indian Rupee currency (₹)
   */
  formatINR(amount) {
    const num = Number(amount) || 0;
    try {
      return new Intl.NumberFormat(CONFIG.LOCALE, {
        style: 'currency',
        currency: CONFIG.CURRENCY,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num);
    } catch {
      return `₹${num.toFixed(2)}`;
    }
  },

  /**
   * Validates a date string format (YYYY-MM-DD) and verifies it is a valid calendar date
   */
  isValidDateString(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return false;
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    if (month < 1 || month > 12) return false;
    if (year < 1900 || year > 2100) return false;
    const d = new Date(year, month - 1, day);
    return d.getFullYear() === year && (d.getMonth() + 1) === month && d.getDate() === day;
  },

  /**
   * Formats a YYYY-MM-DD date string into user-friendly format (e.g. "10 Nov 2026")
   */
  formatDisplayDate(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);

    return d.toLocaleDateString(CONFIG.LOCALE, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  },

  /**
   * Returns a relative label like "Today", "Yesterday", or "X days ago"
   */
  getRelativeDateLabel(dateStr) {
    if (!dateStr) return '';
    const today = Utils.getTodayDateString();
    if (dateStr === today) return 'Today';

    const parts = dateStr.split('-').map(Number);
    const todayParts = today.split('-').map(Number);

    const expenseDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const currentDate = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);

    const diffTime = currentDate.getTime() - expenseDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Yesterday';
    if (diffDays > 1 && diffDays <= 7) return `${diffDays} days ago`;
    return '';
  },

  /**
   * Gets today's date formatted as YYYY-MM-DD based on local client time
   */
  getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Gets current month formatted as YYYY-MM
   */
  getCurrentMonthString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  },

  /**
   * Formats YYYY-MM to human label like "November 2026"
   */
  formatMonthLabel(yearMonthStr) {
    if (!yearMonthStr) return 'Current Month';
    const parts = yearMonthStr.split('-');
    if (parts.length !== 2) return yearMonthStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString(CONFIG.LOCALE, { month: 'long', year: 'numeric' });
  },

  /**
   * Safely escapes HTML strings to prevent XSS
   */
  escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Looks up category definition
   */
  getCategoryMeta(categoryId) {
    return CONFIG.CATEGORIES.find(c => c.id === categoryId) || {
      id: categoryId || 'Other',
      label: categoryId || 'Other',
      emoji: '🏷️',
      color: '#64748b',
      bg: '#f8fafc',
      border: '#f1f5f9'
    };
  }
};

// ============================================================================
// 4. STORAGE SERVICE (localStorage + Safe Error Recovery)
// ============================================================================
const StorageService = {
  /**
   * Loads expenses from localStorage with schema validation & corrupt data recovery
   */
  load() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        console.warn('StorageService: Stored data was not an array. Recovering to empty list.');
        return [];
      }

      const validCategories = CONFIG.CATEGORIES.map(c => c.id);

      // Validate and clean each record
      const cleaned = parsed.filter(item => {
        return item &&
          typeof item === 'object' &&
          typeof item.id === 'string' && item.id.trim().length > 0 &&
          typeof item.title === 'string' && item.title.trim().length > 0 &&
          !isNaN(Number(item.amount)) && Number(item.amount) > 0 &&
          typeof item.category === 'string' && validCategories.includes(item.category) &&
          typeof item.date === 'string' && Utils.isValidDateString(item.date);
      }).map(item => ({
        id: String(item.id),
        title: String(item.title).trim(),
        amount: Math.round(Number(item.amount) * 100) / 100,
        category: String(item.category),
        date: String(item.date),
        note: item.note ? String(item.note).trim() : '',
        createdAt: item.createdAt || new Date().toISOString(),
        ...(item.updatedAt ? { updatedAt: String(item.updatedAt) } : {})
      }));

      return cleaned;
    } catch (err) {
      console.error('StorageService: Error parsing localStorage data', err);
      return [];
    }
  },

  /**
   * Saves expenses array to localStorage
   */
  save(expenses) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(expenses));
      return true;
    } catch (err) {
      console.error('StorageService: Failed to save to localStorage', err);
      ToastService.show('Save Error', 'Could not save expenses to browser storage. Storage quota may be exceeded.', 'error');
      return false;
    }
  },

  /**
   * Clears storage
   */
  clear() {
    try {
      localStorage.removeItem(CONFIG.STORAGE_KEY);
      return true;
    } catch (err) {
      console.error('StorageService: Failed to clear localStorage', err);
      return false;
    }
  }
};

// ============================================================================
// 5. ANALYTICS & CALCULATION ENGINE
// ============================================================================
const AnalyticsService = {
  /**
   * Computes financial summaries for the given month (format: 'YYYY-MM')
   */
  calculateMonthlyMetrics(expenses, targetMonth) {
    const monthExpenses = expenses.filter(e => e.date && e.date.startsWith(targetMonth));
    const totalMonthSpend = Math.round(monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0) * 100) / 100;

    // All-time totals
    const totalAllTimeSpend = Math.round(expenses.reduce((sum, e) => sum + Number(e.amount), 0) * 100) / 100;

    // Highest single expense in target month
    let topExpense = null;
    if (monthExpenses.length > 0) {
      topExpense = [...monthExpenses].sort((a, b) => b.amount - a.amount)[0];
    }

    // Category breakdown
    const categoryTotals = {};
    const categoryCounts = {};
    CONFIG.CATEGORIES.forEach(cat => {
      categoryTotals[cat.id] = 0;
      categoryCounts[cat.id] = 0;
    });

    monthExpenses.forEach(exp => {
      const cat = exp.category;
      if (categoryTotals[cat] !== undefined) {
        categoryTotals[cat] = Math.round((categoryTotals[cat] + Number(exp.amount)) * 100) / 100;
        categoryCounts[cat] += 1;
      } else {
        // Fallback for custom or unknown category
        categoryTotals['Other'] = Math.round(((categoryTotals['Other'] || 0) + Number(exp.amount)) * 100) / 100;
        categoryCounts['Other'] = (categoryCounts['Other'] || 0) + 1;
      }
    });

    // Find top spending category
    let topCategory = null;
    let topCatAmount = 0;
    Object.keys(categoryTotals).forEach(catId => {
      if (categoryTotals[catId] > topCatAmount) {
        topCatAmount = categoryTotals[catId];
        topCategory = catId;
      }
    });

    const categoryBreakdown = CONFIG.CATEGORIES.map(cat => {
      const amount = categoryTotals[cat.id] || 0;
      const percentage = totalMonthSpend > 0 ? Math.round(((amount / totalMonthSpend) * 100) * 10) / 10 : 0;
      const count = categoryCounts[cat.id] || 0;
      return {
        ...cat,
        amount,
        percentage,
        count
      };
    });

    return {
      monthExpenses,
      totalMonthSpend,
      monthTxCount: monthExpenses.length,
      totalAllTimeSpend,
      allTimeTxCount: expenses.length,
      topExpense,
      topCategory,
      topCatAmount,
      categoryBreakdown
    };
  },

  /**
   * Extracts all distinct YYYY-MM months present in data + current calendar month
   */
  getAvailableMonths(expenses) {
    const set = new Set();
    set.add(Utils.getCurrentMonthString());
    expenses.forEach(e => {
      if (e.date && e.date.length >= 7) {
        set.add(e.date.substring(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }
};

// ============================================================================
// 6. FILTER & SORT ENGINE
// ============================================================================
const FilterService = {
  apply(expenses, filters) {
    let result = [...expenses];

    // 1. Partial Title Search
    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.trim().toLowerCase();
      result = result.filter(e => e.title && e.title.toLowerCase().includes(q));
    }

    // 2. Category Filter
    if (filters.category && filters.category !== 'ALL') {
      result = result.filter(e => e.category === filters.category);
    }

    // 3. Date Range Filter
    let dateRangeValid = true;
    if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
      dateRangeValid = false;
      result = []; // Reversed date range is invalid; zero records match
    } else {
      if (filters.fromDate) {
        result = result.filter(e => e.date >= filters.fromDate);
      }
      if (filters.toDate) {
        result = result.filter(e => e.date <= filters.toDate);
      }
    }

    // 4. Sorting (default: date descending, newest first)
    switch (filters.sortBy) {
      case 'date-desc':
        result.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
        break;
      case 'date-asc':
        result.sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || ''));
        break;
      case 'amount-desc':
        result.sort((a, b) => b.amount - a.amount);
        break;
      case 'amount-asc':
        result.sort((a, b) => a.amount - b.amount);
        break;
      case 'title-asc':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      default:
        result.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
    }

    return {
      filtered: result,
      dateRangeValid
    };
  },

  hasActiveFilters(filters) {
    return Boolean(
      (filters.search && filters.search.trim() !== '') ||
      (filters.category && filters.category !== 'ALL') ||
      filters.fromDate ||
      filters.toDate ||
      filters.sortBy !== 'date-desc'
    );
  }
};

// ============================================================================
// 7. TOAST NOTIFICATION SERVICE
// ============================================================================
const ToastService = {
  container: null,

  init() {
    this.container = document.getElementById('toast-container');
  },

  show(title, message, type = 'success', duration = 3500) {
    if (!this.container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `
      <div class="toast-icon">${iconSvg}</div>
      <div class="toast-content">
        <div class="toast-title">${Utils.escapeHTML(title)}</div>
        <div class="toast-message">${Utils.escapeHTML(message)}</div>
      </div>
      <button type="button" class="toast-close-btn" aria-label="Close notification">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close-btn');
    const dismiss = () => {
      toast.classList.add('toast-hiding');
      setTimeout(() => {
        if (toast.parentElement) {
          toast.remove();
        }
      }, 250);
    };

    closeBtn.addEventListener('click', dismiss);
    this.container.appendChild(toast);

    if (duration > 0) {
      setTimeout(dismiss, duration);
    }
  }
};

// ============================================================================
// 8. UI RENDERING ENGINE
// ============================================================================
const RenderService = {
  elements: {},

  cacheElements() {
    this.elements = {
      headerTodayText: document.getElementById('header-today-text'),
      activeMonthLabel: document.getElementById('active-month-label'),
      summaryMonthSelect: document.getElementById('summary-month-select'),
      kpiMonthLabel: document.getElementById('kpi-month-label'),
      kpiMonthTotal: document.getElementById('kpi-month-total'),
      kpiMonthTxCount: document.getElementById('kpi-month-tx-count'),
      kpiMonthStatus: document.getElementById('kpi-month-status'),
      kpiTopExpense: document.getElementById('kpi-top-expense'),
      kpiTopExpenseTitle: document.getElementById('kpi-top-expense-title'),
      kpiTopCategory: document.getElementById('kpi-top-category'),
      kpiTopCategoryAmount: document.getElementById('kpi-top-category-amount'),
      kpiAlltimeTotal: document.getElementById('kpi-alltime-total'),
      kpiAlltimeTxCount: document.getElementById('kpi-alltime-tx-count'),
      breakdownMonthTotal: document.getElementById('breakdown-month-total'),
      categoryStackedBar: document.getElementById('category-stacked-bar'),
      categoryBreakdownList: document.getElementById('category-breakdown-list'),
      recordsCounter: document.getElementById('records-counter'),
      btnClearFilters: document.getElementById('btn-clear-filters'),
      filterSearchInput: document.getElementById('filter-search-input'),
      btnClearSearch: document.getElementById('btn-clear-search'),
      filterCategorySelect: document.getElementById('filter-category-select'),
      filterDateFrom: document.getElementById('filter-date-from'),
      filterDateTo: document.getElementById('filter-date-to'),
      filterSortSelect: document.getElementById('filter-sort-select'),
      filterDateError: document.getElementById('filter-date-error'),
      transactionsTable: document.getElementById('transactions-table'),
      transactionsTbody: document.getElementById('transactions-tbody'),
      emptyStateNoData: document.getElementById('empty-state-no-data'),
      emptyStateNoMatches: document.getElementById('empty-state-no-matches'),
      expenseModalBackdrop: document.getElementById('expense-modal-backdrop'),
      deleteModalBackdrop: document.getElementById('delete-modal-backdrop'),
      expenseForm: document.getElementById('expense-form'),
      formExpenseId: document.getElementById('form-expense-id'),
      formTitle: document.getElementById('form-title'),
      formAmount: document.getElementById('form-amount'),
      formCategory: document.getElementById('form-category'),
      formDate: document.getElementById('form-date'),
      formNote: document.getElementById('form-note'),
      formNoteCounter: document.getElementById('form-note-counter'),
      modalTitle: document.getElementById('modal-title'),
      modalSubtitle: document.getElementById('modal-subtitle'),
      btnSaveExpenseText: document.getElementById('btn-save-expense-text'),
      deleteTargetTitle: document.getElementById('delete-target-title'),
      deleteTargetAmount: document.getElementById('delete-target-amount'),
    };
  },

  renderAll() {
    this.renderHeaderDate();
    this.renderMonthSelector();
    this.renderFinancialMetrics();
    this.renderCategoryBreakdown();
    this.renderTransactionsList();
    this.updateFilterControlsState();
  },

  renderHeaderDate() {
    const today = new Date();
    const formatted = today.toLocaleDateString(CONFIG.LOCALE, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    this.elements.headerTodayText.textContent = formatted;
  },

  renderMonthSelector() {
    const months = AnalyticsService.getAvailableMonths(state.expenses);
    const select = this.elements.summaryMonthSelect;
    const currentMonth = Utils.getCurrentMonthString();
    const currentVal = state.activeMonth || currentMonth;

    select.innerHTML = months.map(m => {
      const isSelected = m === currentVal ? 'selected' : '';
      const isCurrent = m === currentMonth;
      const label = Utils.formatMonthLabel(m) + (isCurrent ? ' (Current)' : '');
      return `<option value="${m}" ${isSelected}>${label}</option>`;
    }).join('');

    const activeDisplay = Utils.formatMonthLabel(state.activeMonth);
    this.elements.activeMonthLabel.textContent = state.activeMonth === currentMonth
      ? `${activeDisplay} (Current Month)`
      : activeDisplay;
  },

  renderFinancialMetrics() {
    const metrics = AnalyticsService.calculateMonthlyMetrics(state.expenses, state.activeMonth);
    const isCurrentMonth = state.activeMonth === Utils.getCurrentMonthString();

    // Month Total Card
    if (this.elements.kpiMonthLabel) {
      this.elements.kpiMonthLabel.textContent = isCurrentMonth
        ? "Current Month's Spending"
        : `${Utils.formatMonthLabel(state.activeMonth)} Spending`;
    }
    this.elements.kpiMonthTotal.textContent = Utils.formatINR(metrics.totalMonthSpend);
    this.elements.kpiMonthTxCount.textContent = `${metrics.monthTxCount} ${metrics.monthTxCount === 1 ? 'transaction' : 'transactions'}`;
    this.elements.kpiMonthStatus.textContent = isCurrentMonth ? 'This calendar month' : Utils.formatMonthLabel(state.activeMonth);

    // Top Expense
    if (metrics.topExpense) {
      this.elements.kpiTopExpense.textContent = Utils.formatINR(metrics.topExpense.amount);
      this.elements.kpiTopExpenseTitle.textContent = metrics.topExpense.title;
      this.elements.kpiTopExpenseTitle.title = metrics.topExpense.title;
    } else {
      this.elements.kpiTopExpense.textContent = '₹0.00';
      this.elements.kpiTopExpenseTitle.textContent = 'None recorded';
      this.elements.kpiTopExpenseTitle.title = '';
    }

    // Top Category
    if (metrics.topCategory && metrics.topCatAmount > 0) {
      const catMeta = Utils.getCategoryMeta(metrics.topCategory);
      this.elements.kpiTopCategory.textContent = `${catMeta.emoji} ${catMeta.label}`;
      const pct = Math.round((metrics.topCatAmount / metrics.totalMonthSpend) * 100);
      this.elements.kpiTopCategoryAmount.textContent = `${Utils.formatINR(metrics.topCatAmount)} (${pct}% of total)`;
    } else {
      this.elements.kpiTopCategory.textContent = '—';
      this.elements.kpiTopCategoryAmount.textContent = '₹0.00 (0% of total)';
    }

    // All Time Cumulative
    this.elements.kpiAlltimeTotal.textContent = Utils.formatINR(metrics.totalAllTimeSpend);
    this.elements.kpiAlltimeTxCount.textContent = `${metrics.allTimeTxCount} ${metrics.allTimeTxCount === 1 ? 'total record' : 'total records'}`;

    // Breakdown Card Header Total
    this.elements.breakdownMonthTotal.textContent = Utils.formatINR(metrics.totalMonthSpend);
  },

  renderCategoryBreakdown() {
    const metrics = AnalyticsService.calculateMonthlyMetrics(state.expenses, state.activeMonth);
    const { categoryBreakdown, totalMonthSpend } = metrics;

    // 1. Stacked Segment Bar
    const stackedBar = this.elements.categoryStackedBar;
    if (totalMonthSpend === 0) {
      stackedBar.innerHTML = `<div class="category-stacked-segment" style="width: 100%; background-color: var(--slate-200);" title="No expenses in this month"></div>`;
    } else {
      stackedBar.innerHTML = categoryBreakdown
        .filter(c => c.percentage > 0)
        .map(c => `
          <div 
            class="category-stacked-segment" 
            style="width: ${c.percentage}%; background-color: ${c.color};" 
            title="${c.label}: ${Utils.formatINR(c.amount)} (${c.percentage}%)"
          ></div>
        `).join('');
    }

    // 2. Individual Category Bars Grid
    const grid = this.elements.categoryBreakdownList;
    grid.innerHTML = categoryBreakdown.map(c => {
      const displayAmount = Utils.formatINR(c.amount);
      const displayCount = c.count === 1 ? '1 expense' : `${c.count} expenses`;
      return `
        <div class="category-item" data-category="${c.id}">
          <div class="category-item-header">
            <div class="category-badge-group">
              <span class="category-color-dot" style="background-color: ${c.color};"></span>
              <span class="category-name">${c.emoji} ${c.label}</span>
            </div>
            <div class="category-amount-group">
              <span class="category-amount">${displayAmount}</span>
              <span class="category-percentage">${c.percentage}%</span>
            </div>
          </div>
          <div class="progress-track" aria-hidden="true">
            <div class="progress-fill" style="width: ${c.percentage}%; background-color: ${c.color};"></div>
          </div>
          <span class="category-tx-count">${displayCount}</span>
        </div>
      `;
    }).join('');
  },

  renderTransactionsList() {
    const { filtered, dateRangeValid } = FilterService.apply(state.expenses, state.filters);

    // Show/hide date validation error banner
    if (!dateRangeValid) {
      this.elements.filterDateError.classList.remove('hidden');
    } else {
      this.elements.filterDateError.classList.add('hidden');
    }

    // Update records counter
    const totalExpenses = state.expenses.length;
    const matchCount = filtered.length;
    this.elements.recordsCounter.textContent = `Showing ${matchCount} of ${totalExpenses} ${totalExpenses === 1 ? 'expense' : 'expenses'}`;

    // Handle Empty States
    if (totalExpenses === 0) {
      this.elements.transactionsTable.classList.add('hidden');
      this.elements.emptyStateNoData.classList.remove('hidden');
      this.elements.emptyStateNoMatches.classList.add('hidden');
      return;
    }

    if (matchCount === 0) {
      this.elements.transactionsTable.classList.add('hidden');
      this.elements.emptyStateNoData.classList.add('hidden');
      this.elements.emptyStateNoMatches.classList.remove('hidden');
      return;
    }

    // Show Table
    this.elements.transactionsTable.classList.remove('hidden');
    this.elements.emptyStateNoData.classList.add('hidden');
    this.elements.emptyStateNoMatches.classList.add('hidden');

    // Render Table Rows (all fields displayed: Date, Title & Note, Category, Amount, Actions)
    const tbody = this.elements.transactionsTbody;
    tbody.innerHTML = filtered.map(exp => {
      const cat = Utils.getCategoryMeta(exp.category);
      const displayDate = Utils.formatDisplayDate(exp.date);
      const relativeDate = Utils.getRelativeDateLabel(exp.date);
      const formattedAmount = Utils.formatINR(exp.amount);
      const hasNote = exp.note && exp.note.trim() !== '';

      return `
        <tr data-id="${exp.id}">
          <td class="tx-date-cell">
            <strong>${displayDate}</strong>
            ${relativeDate ? `<span class="tx-date-relative">${relativeDate}</span>` : ''}
          </td>
          <td>
            <div class="tx-title-content">
              <span class="tx-title">${Utils.escapeHTML(exp.title)}</span>
              ${hasNote ? `<span class="tx-note">${Utils.escapeHTML(exp.note)}</span>` : '<span class="tx-note text-slate-400">—</span>'}
            </div>
          </td>
          <td>
            <span class="badge cat-badge-${cat.id}">
              <span>${cat.emoji}</span>
              <span>${cat.label}</span>
            </span>
          </td>
          <td class="text-right">
            <span class="tx-amount">${formattedAmount}</span>
          </td>
          <td>
            <div class="tx-actions-group">
              <button 
                type="button" 
                class="btn-icon-only btn-icon-primary btn-edit-expense" 
                data-id="${exp.id}" 
                title="Edit expense"
                aria-label="Edit expense ${Utils.escapeHTML(exp.title)}"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button 
                type="button" 
                class="btn-icon-only btn-icon-danger btn-delete-expense" 
                data-id="${exp.id}" 
                title="Delete expense"
                aria-label="Delete expense ${Utils.escapeHTML(exp.title)}"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  updateFilterControlsState() {
    const hasActive = FilterService.hasActiveFilters(state.filters);
    this.elements.btnClearFilters.disabled = !hasActive;

    if (state.filters.search && state.filters.search.trim() !== '') {
      this.elements.btnClearSearch.classList.remove('hidden');
    } else {
      this.elements.btnClearSearch.classList.add('hidden');
    }
  }
};

// ============================================================================
// 9. FORM & VALIDATION SERVICE
// ============================================================================
const FormService = {
  init() {
    // Set max date constraint on form-date so future dates cannot be picked
    const today = Utils.getTodayDateString();
    RenderService.elements.formDate.setAttribute('max', today);

    // Character counter for notes
    RenderService.elements.formNote.addEventListener('input', (e) => {
      const len = e.target.value.length;
      RenderService.elements.formNoteCounter.textContent = `${len} / 250`;
    });

    // Real-time error clearance on input
    ['form-title', 'form-amount', 'form-category', 'form-date', 'form-note'].forEach(fieldId => {
      const el = document.getElementById(fieldId);
      if (el) {
        el.addEventListener('input', () => this.clearFieldError(fieldId));
        el.addEventListener('change', () => this.clearFieldError(fieldId));
      }
    });

    // Today shortcut button
    const btnToday = document.getElementById('btn-shortcut-today');
    if (btnToday) {
      btnToday.addEventListener('click', () => {
        RenderService.elements.formDate.value = Utils.getTodayDateString();
        this.clearFieldError('form-date');
      });
    }
  },

  clearFieldError(fieldId) {
    const baseName = fieldId.replace('form-', '');
    const group = document.getElementById(`form-group-${baseName}`);
    const errorEl = document.getElementById(`error-${baseName}`);
    if (group) group.classList.remove('has-error');
    if (errorEl) errorEl.textContent = '';
  },

  setFieldError(fieldId, message) {
    const baseName = fieldId.replace('form-', '');
    const group = document.getElementById(`form-group-${baseName}`);
    const errorEl = document.getElementById(`error-${baseName}`);
    if (group) group.classList.add('has-error');
    if (errorEl) errorEl.textContent = message;
  },

  clearAllErrors() {
    ['title', 'amount', 'category', 'date', 'note'].forEach(field => {
      const group = document.getElementById(`form-group-${field}`);
      const errorEl = document.getElementById(`error-${field}`);
      if (group) group.classList.remove('has-error');
      if (errorEl) errorEl.textContent = '';
    });
  },

  validate(data) {
    this.clearAllErrors();
    let isValid = true;

    // 1. Title Validation: required short text (max 100)
    if (!data.title || data.title.trim() === '') {
      this.setFieldError('form-title', 'Please provide an expense title.');
      isValid = false;
    } else if (data.title.trim().length > 100) {
      this.setFieldError('form-title', 'Title cannot exceed 100 characters.');
      isValid = false;
    }

    // 2. Amount Validation: valid positive number in INR
    const amountNum = Number(data.amount);
    if (data.amount === '' || isNaN(amountNum)) {
      this.setFieldError('form-amount', 'Please enter a valid amount.');
      isValid = false;
    } else if (amountNum <= 0) {
      this.setFieldError('form-amount', 'Amount must be a positive number greater than ₹0.');
      isValid = false;
    } else if (amountNum > 100000000) {
      this.setFieldError('form-amount', 'Amount exceeds the maximum permissible limit.');
      isValid = false;
    }

    // 3. Category Validation: Food, Transport, Shopping, Bills, Entertainment, Other
    const validCategories = CONFIG.CATEGORIES.map(c => c.id);
    if (!data.category || !validCategories.includes(data.category)) {
      this.setFieldError('form-category', 'Please select a valid expense category.');
      isValid = false;
    }

    // 4. Date Validation: must be valid calendar date & not in the future
    const today = Utils.getTodayDateString();
    if (!data.date || !Utils.isValidDateString(data.date)) {
      this.setFieldError('form-date', 'Please select a valid date (YYYY-MM-DD).');
      isValid = false;
    } else if (data.date > today) {
      this.setFieldError('form-date', 'Date cannot be in the future. Expense must have occurred today or earlier.');
      isValid = false;
    }

    // 5. Note Validation: optional, max 250 characters
    if (data.note && data.note.length > 250) {
      this.setFieldError('form-note', 'Note cannot exceed 250 characters.');
      isValid = false;
    }

    return isValid;
  },

  openAddModal() {
    state.editingId = null;
    this.clearAllErrors();
    RenderService.elements.formExpenseId.value = '';
    RenderService.elements.formTitle.value = '';
    RenderService.elements.formAmount.value = '';
    RenderService.elements.formCategory.value = '';
    RenderService.elements.formDate.value = Utils.getTodayDateString();
    RenderService.elements.formNote.value = '';
    RenderService.elements.formNoteCounter.textContent = '0 / 250';

    RenderService.elements.modalTitle.textContent = 'Add New Expense';
    RenderService.elements.modalSubtitle.textContent = 'Enter transaction details to track your spending';
    RenderService.elements.btnSaveExpenseText.textContent = 'Save Expense';

    RenderService.elements.expenseModalBackdrop.classList.remove('hidden');
    RenderService.elements.formTitle.focus();
  },

  openEditModal(id) {
    const expense = state.expenses.find(e => e.id === id);
    if (!expense) {
      ToastService.show('Error', 'Expense record not found for editing.', 'error');
      return;
    }

    state.editingId = id;
    this.clearAllErrors();
    RenderService.elements.formExpenseId.value = expense.id;
    RenderService.elements.formTitle.value = expense.title;
    RenderService.elements.formAmount.value = expense.amount;
    RenderService.elements.formCategory.value = expense.category;
    RenderService.elements.formDate.value = expense.date;
    RenderService.elements.formNote.value = expense.note || '';
    RenderService.elements.formNoteCounter.textContent = `${(expense.note || '').length} / 250`;

    RenderService.elements.modalTitle.textContent = 'Edit Expense';
    RenderService.elements.modalSubtitle.textContent = `Modifying record: ${expense.title}`;
    RenderService.elements.btnSaveExpenseText.textContent = 'Update Expense';

    RenderService.elements.expenseModalBackdrop.classList.remove('hidden');
    RenderService.elements.formTitle.focus();
  },

  closeModal() {
    RenderService.elements.expenseModalBackdrop.classList.add('hidden');
    state.editingId = null;
    this.clearAllErrors();
  }
};

// ============================================================================
// 10. DELETE MODAL SERVICE
// ============================================================================
const DeleteService = {
  open(id) {
    const expense = state.expenses.find(e => e.id === id);
    if (!expense) return;

    state.deletingId = id;
    RenderService.elements.deleteTargetTitle.textContent = `"${expense.title}"`;
    RenderService.elements.deleteTargetAmount.textContent = Utils.formatINR(expense.amount);
    RenderService.elements.deleteModalBackdrop.classList.remove('hidden');
  },

  close() {
    RenderService.elements.deleteModalBackdrop.classList.add('hidden');
    state.deletingId = null;
  },

  confirm() {
    if (!state.deletingId) return;

    const target = state.expenses.find(e => e.id === state.deletingId);
    const title = target ? target.title : 'Expense';

    // Remove from state
    state.expenses = state.expenses.filter(e => e.id !== state.deletingId);
    StorageService.save(state.expenses);

    this.close();
    RenderService.renderAll();
    ToastService.show('Expense Deleted', `"${title}" has been removed from your records.`, 'info');
  }
};

// ============================================================================
// 11. APP CONTROLLER & EVENT LISTENERS
// ============================================================================
const App = {
  init() {
    // 1. Initialize DOM elements & Toast Service
    RenderService.cacheElements();
    ToastService.init();
    FormService.init();

    // 2. Set default active month to current month
    state.activeMonth = Utils.getCurrentMonthString();

    // 3. Load stored expenses from localStorage
    state.expenses = StorageService.load();

    // 4. Bind DOM Event Listeners
    this.bindEvents();

    // 5. Initial Render
    RenderService.renderAll();
  },

  bindEvents() {
    const { elements } = RenderService;

    // Open Add Modal
    document.getElementById('btn-open-add-modal').addEventListener('click', () => FormService.openAddModal());
    document.getElementById('btn-empty-add').addEventListener('click', () => FormService.openAddModal());

    // Close Modal buttons
    document.getElementById('btn-close-expense-modal').addEventListener('click', () => FormService.closeModal());
    document.getElementById('btn-cancel-expense-modal').addEventListener('click', () => FormService.closeModal());

    // Close on backdrop click (click outside modal card)
    elements.expenseModalBackdrop.addEventListener('click', (e) => {
      if (e.target === elements.expenseModalBackdrop) {
        FormService.closeModal();
      }
    });

    elements.deleteModalBackdrop.addEventListener('click', (e) => {
      if (e.target === elements.deleteModalBackdrop) {
        DeleteService.close();
      }
    });

    // Close on ESC key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!elements.expenseModalBackdrop.classList.contains('hidden')) {
          FormService.closeModal();
        }
        if (!elements.deleteModalBackdrop.classList.contains('hidden')) {
          DeleteService.close();
        }
      }
    });

    // Delete Modal Actions
    document.getElementById('btn-cancel-delete').addEventListener('click', () => DeleteService.close());
    document.getElementById('btn-confirm-delete').addEventListener('click', () => DeleteService.confirm());

    // Expense Form Submission (Add or Edit)
    elements.expenseForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const formData = {
        title: elements.formTitle.value.trim(),
        amount: elements.formAmount.value.trim(),
        category: elements.formCategory.value,
        date: elements.formDate.value,
        note: elements.formNote.value.trim()
      };

      if (!FormService.validate(formData)) {
        return;
      }

      const numericAmount = Math.round(Number(formData.amount) * 100) / 100;

      if (state.editingId) {
        // Edit existing record (allow editing every expense field)
        const index = state.expenses.findIndex(exp => exp.id === state.editingId);
        if (index !== -1) {
          state.expenses[index] = {
            ...state.expenses[index],
            title: formData.title,
            amount: numericAmount,
            category: formData.category,
            date: formData.date,
            note: formData.note,
            updatedAt: new Date().toISOString()
          };

          StorageService.save(state.expenses);
          FormService.closeModal();
          RenderService.renderAll();
          ToastService.show('Expense Updated', `"${formData.title}" was updated successfully.`, 'success');
        }
      } else {
        // Add new record
        const newExpense = {
          id: Utils.generateId(),
          title: formData.title,
          amount: numericAmount,
          category: formData.category,
          date: formData.date,
          note: formData.note,
          createdAt: new Date().toISOString()
        };

        state.expenses.unshift(newExpense);
        StorageService.save(state.expenses);

        FormService.closeModal();
        RenderService.renderAll();
        ToastService.show('Expense Added', `"${newExpense.title}" for ${Utils.formatINR(newExpense.amount)} added.`, 'success');
      }
    });

    // Transaction Actions (Event Delegation for Edit & Delete buttons)
    elements.transactionsTbody.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.btn-edit-expense');
      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        FormService.openEditModal(id);
        return;
      }

      const deleteBtn = e.target.closest('.btn-delete-expense');
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        DeleteService.open(id);
        return;
      }
    });

    // Month Selector in Summary Bar
    elements.summaryMonthSelect.addEventListener('change', (e) => {
      state.activeMonth = e.target.value;
      RenderService.renderFinancialMetrics();
      RenderService.renderCategoryBreakdown();
      const currentMonth = Utils.getCurrentMonthString();
      const activeDisplay = Utils.formatMonthLabel(state.activeMonth);
      elements.activeMonthLabel.textContent = state.activeMonth === currentMonth
        ? `${activeDisplay} (Current Month)`
        : activeDisplay;
    });

    // Filter Controls: Real-time search & filters
    elements.filterSearchInput.addEventListener('input', (e) => {
      state.filters.search = e.target.value;
      RenderService.renderTransactionsList();
      RenderService.updateFilterControlsState();
    });

    elements.btnClearSearch.addEventListener('click', () => {
      elements.filterSearchInput.value = '';
      state.filters.search = '';
      RenderService.renderTransactionsList();
      RenderService.updateFilterControlsState();
      elements.filterSearchInput.focus();
    });

    elements.filterCategorySelect.addEventListener('change', (e) => {
      state.filters.category = e.target.value;
      RenderService.renderTransactionsList();
      RenderService.updateFilterControlsState();
    });

    elements.filterDateFrom.addEventListener('change', (e) => {
      state.filters.fromDate = e.target.value;
      RenderService.renderTransactionsList();
      RenderService.updateFilterControlsState();
    });

    elements.filterDateTo.addEventListener('change', (e) => {
      state.filters.toDate = e.target.value;
      RenderService.renderTransactionsList();
      RenderService.updateFilterControlsState();
    });

    elements.filterSortSelect.addEventListener('change', (e) => {
      state.filters.sortBy = e.target.value;
      RenderService.renderTransactionsList();
      RenderService.updateFilterControlsState();
    });

    // Clear Filters Action
    const clearAllFilters = () => {
      state.filters = {
        search: '',
        category: 'ALL',
        fromDate: '',
        toDate: '',
        sortBy: 'date-desc'
      };
      elements.filterSearchInput.value = '';
      elements.filterCategorySelect.value = 'ALL';
      elements.filterDateFrom.value = '';
      elements.filterDateTo.value = '';
      elements.filterSortSelect.value = 'date-desc';
      RenderService.renderTransactionsList();
      RenderService.updateFilterControlsState();
      ToastService.show('Filters Reset', 'All search filters have been cleared.', 'info');
    };

    elements.btnClearFilters.addEventListener('click', clearAllFilters);
    document.getElementById('btn-empty-clear-filters').addEventListener('click', clearAllFilters);

    // Reset Storage in Footer
    document.getElementById('btn-reset-storage').addEventListener('click', () => {
      if (confirm('Are you sure you want to wipe all stored expenses and reset storage?')) {
        StorageService.clear();
        state.expenses = [];
        state.activeMonth = Utils.getCurrentMonthString();
        clearAllFilters();
        RenderService.renderAll();
        ToastService.show('Storage Reset', 'All expense data has been wiped.', 'info');
      }
    });

    // Export JSON in Footer
    document.getElementById('btn-export-json').addEventListener('click', () => {
      if (state.expenses.length === 0) {
        ToastService.show('Export Info', 'No expenses to export yet.', 'info');
        return;
      }
      try {
        const jsonStr = JSON.stringify(state.expenses, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pennywise-expenses-${Utils.getTodayDateString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        ToastService.show('Backup Exported', 'Expenses exported successfully as JSON.', 'success');
      } catch (err) {
        console.error('Export error:', err);
        ToastService.show('Export Failed', 'Could not export JSON backup.', 'error');
      }
    });
  }
};

// ============================================================================
// 12. BOOTSTRAP APPLICATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
