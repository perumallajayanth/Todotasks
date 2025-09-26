/**
 * script.js
 * Modular vanilla JS To-Do App (Add, Edit, Delete, Filter, Search, Persist)
 * Author: (You)
 *
 * Key structure:
 * - TaskManager class handles state & persistence
 * - UI module handles rendering & event wiring
 * - Uses localStorage key: 'todo.tasks.v1' and body[data-theme] for theme
 */

(() => {
  "use strict";

  /** ---------- Utilities ---------- */
  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const ID = () => '_' + Math.random().toString(36).slice(2, 9);

  /** ---------- Task Manager (state + persistence) ---------- */
  class TaskManager {
    constructor(storageKey = "todo.tasks.v1") {
      this.storageKey = storageKey;
      this.tasks = this.load();
    }

    load() {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed;
      } catch (e) {
        console.error("Failed to load tasks:", e);
        return [];
      }
    }

    save() {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.tasks));
      } catch (e) {
        console.error("Failed to save tasks:", e);
      }
    }

    addTask(text) {
      const task = {
        id: ID(),
        text: String(text).trim(),
        completed: false,
        createdAt: Date.now()
      };
      if (!task.text) return null;
      this.tasks.unshift(task); // newest on top
      this.save();
      return task;
    }

    updateTask(id, updates = {}) {
      const t = this.tasks.find(x => x.id === id);
      if (!t) return false;
      Object.assign(t, updates);
      this.save();
      return true;
    }

    removeTask(id) {
      const before = this.tasks.length;
      this.tasks = this.tasks.filter(t => t.id !== id);
      if (this.tasks.length !== before) {
        this.save();
        return true;
      }
      return false;
    }

    clearCompleted() {
      const before = this.tasks.length;
      this.tasks = this.tasks.filter(t => !t.completed);
      if (this.tasks.length !== before) {
        this.save();
      }
    }

    getRemainingCount() {
      return this.tasks.filter(t => !t.completed).length;
    }

    getAll() {
      return this.tasks;
    }
  }

  /** ---------- UI Module ---------- */
  const UI = (() => {
    // Elements
    const el = {
      form: qs("#task-form"),
      input: qs("#task-input"),
      addBtn: qs("#add-btn"),
      list: qs("#task-list"),
      remaining: qs("#remaining-count"),
      themeToggle: qs("#theme-toggle")
    };

    // Icons (inline SVG)
    const icons = {
      edit: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 21h4l12-12a2.5 2.5 0 0 0-3.5-3.5L4 17v4z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      trash: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 6h18M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6M10 6V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      check: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    };

    function createTaskElement(task) {
      const li = document.createElement("li");
      li.className = "task-item";
      li.dataset.id = task.id;
      li.setAttribute("role", "listitem");

      // Left part (checkbox + text)
      const left = document.createElement("div");
      left.className = "item-left";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !!task.completed;
      checkbox.setAttribute("aria-label", task.completed ? "Mark as pending" : "Mark as completed");
      checkbox.tabIndex = 0;

      const text = document.createElement("div");
      text.className = "task-text";
      text.textContent = task.text;
      text.title = "Double-click or click edit to change text";
      if (task.completed) text.classList.add("completed");
      text.tabIndex = 0; // make focusable for keyboard edit

      left.appendChild(checkbox);
      left.appendChild(text);

      // Actions
      const actions = document.createElement("div");
      actions.className = "item-actions";

      const editBtn = document.createElement("button");
      editBtn.className = "action-btn edit";
      editBtn.innerHTML = icons.edit;
      editBtn.title = "Edit task";
      editBtn.setAttribute("aria-label", "Edit task");

      const delBtn = document.createElement("button");
      delBtn.className = "action-btn delete";
      delBtn.innerHTML = icons.trash;
      delBtn.title = "Delete task";
      delBtn.setAttribute("aria-label", "Delete task");

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      li.appendChild(left);
      li.appendChild(actions);

      // Hook events for this item (delegation is also fine; local binding is clearer)
      // Toggle complete
      checkbox.addEventListener("change", () => {
        task.completed = checkbox.checked;
        if (task.completed) text.classList.add("completed");
        else text.classList.remove("completed");
        // Update accessible label
        checkbox.setAttribute("aria-label", task.completed ? "Mark as pending" : "Mark as completed");
        App.tasks.updateTask(task.id, { completed: task.completed });
        updateRemaining();
      });

      // Delete
      delBtn.addEventListener("click", () => {
        if (!confirm("Delete this task?")) return;
        const removed = App.tasks.removeTask(task.id);
        if (removed) {
          li.remove();
          updateRemaining();
        }
      });

      // Edit in place: double-click text OR click edit button
      function enableEditMode() {
        text.contentEditable = "true";
        text.setAttribute("aria-label", "Edit task text");
        text.focus();
        // move caret to end
        document.execCommand("selectAll", false, null);
        document.getSelection().collapseToEnd();
      }

      editBtn.addEventListener("click", enableEditMode);
      text.addEventListener("dblclick", enableEditMode);

      // Save edits on blur or Enter
      text.addEventListener("blur", () => {
        if (text.isContentEditable) {
          text.contentEditable = "false";
          const newText = text.textContent.trim();
          if (!newText) {
            // revert or delete if empty
            if (confirm("Task is empty. Delete it?")) {
              App.tasks.removeTask(task.id);
              li.remove();
            } else {
              text.textContent = task.text;
            }
          } else {
            task.text = newText;
            App.tasks.updateTask(task.id, { text: newText });
          }
        }
      });

      text.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          text.blur();
        }
        if (ev.key === "Escape") {
          // cancel edit
          text.textContent = task.text;
          text.blur();
        }
      });

      return li;
    }

    function render(tasks) {
      el.list.innerHTML = "";
      if (tasks.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.style.padding = "1rem";
        empty.style.textAlign = "center";
        empty.style.color = "var(--muted)";
        empty.textContent = "No tasks found.";
        el.list.appendChild(empty);
        return;
      }
      const frag = document.createDocumentFragment();
      tasks.forEach(task => frag.appendChild(createTaskElement(task)));
      el.list.appendChild(frag);
    }

    function updateRemaining() {
      const rem = App.tasks.getRemainingCount();
      el.remaining.textContent = `${rem} task${rem !== 1 ? "s" : ""} left`;
    }

    function refresh() {
      const tasks = App.tasks.getAll();
      render(tasks);
      updateRemaining();
    }

    /** ---------- Event wiring ---------- */
    function initEventHandlers() {
      // Add new task
      el.form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = el.input.value.trim();
        if (!text) return;
        const added = App.tasks.addTask(text);
        if (added) {
          el.input.value = "";
          // re-render all tasks
          refresh();
          // Focus input for quick add
          el.input.focus();
        }
      });

      // Theme toggle
      el.themeToggle.addEventListener("click", () => {
        const isDark = document.body.dataset.theme === "dark";
        setTheme(isDark ? "light" : "dark");
      });

      // Keyboard accessibility: Enter in input enables add button appearance
      el.input.addEventListener("input", () => { el.addBtn.disabled = !el.input.value.trim(); });
      // initialize disabled state
      el.addBtn.disabled = true;
    }

    /** Theme handling (persisted) */
    function setTheme(name) {
      document.body.dataset.theme = name === "dark" ? "dark" : "light";
      localStorage.setItem("todo.theme.v1", document.body.dataset.theme);
      el.themeToggle.setAttribute("aria-pressed", document.body.dataset.theme === "dark");
      el.themeToggle.textContent = document.body.dataset.theme === "dark" ? "☀️" : "🌙";
    }
    function loadTheme() {
      const saved = localStorage.getItem("todo.theme.v1");
      if (saved) setTheme(saved);
      else {
        // default to user's system preference
        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        setTheme(prefersDark ? "dark" : "light");
      }
    }

    return {
      init(app) {
        loadTheme();
        initEventHandlers();
        refresh();
      },
      refresh // expose for external calls
    };
  })();

  /** ---------- App glue ---------- */
  const App = {
    tasks: new TaskManager(),
    start() {
      UI.init(this);
      // initial render
      UI.refresh();
    }
  };

  // Start application on DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    App.start();
  });

  // Expose for debug (optional)
  window.TodoApp = App;
})();
