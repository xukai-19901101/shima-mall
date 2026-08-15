# HTML Prototypes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two responsive, interactive, pure HTML prototypes for the platform admin and enterprise points mini program.

**Architecture:** Each prototype is a standalone HTML document with embedded CSS and JavaScript. Both documents share the same design tokens and icon style while using information density appropriate to desktop and mobile.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, Node.js built-in test runner.

## Global Constraints

- No frontend framework or external runtime dependency.
- Admin prototype targets desktop and remains usable at narrower viewport widths.
- Mini-program prototype targets a 390px mobile viewport and remains centered on desktop.
- API supply has no visual client; its orders appear in the unified admin order view.
- Use the same color, typography, icon, radius, and status language in both files.

---

### Task 1: Prototype Contract

**Files:**
- Create: `tests/prototype.test.js`
- Create: `admin.html`
- Create: `miniapp.html`

**Interfaces:**
- Produces: DOM contracts for navigation, page switching, tables, pagination, mobile tabs, and commerce flow.

- [ ] Write tests for the required page structure and shared design tokens.
- [ ] Run the tests and confirm they fail because the HTML files do not exist.
- [ ] Implement `admin.html` with five modules, nine submenus, dashboard cards, lists, and pagination.
- [ ] Implement `miniapp.html` with home, category list, orders, enterprise center, product detail, confirmation, and result views.
- [ ] Run the test suite and confirm it passes.
- [ ] Run browser-level interaction and responsive visual verification.
