# Production-Grade Testing Strategy Document

## 1. Overview & Architecture
The **ikram-system** application is built as a decoupled dual-stack web application:
- **Backend**: Laravel 13 (PHP 8.3) RESTful API with Sanctum Authentication, Eloquent ORM, and Domain Services.
- **Frontend**: React 19 + Vite (JavaScript), TanStack React Query, Axios, React Hook Form, and TailwindCSS.

This document establishes the testing principles, coverage targets, pyramid structure, and mocking standards to maintain software reliability, prevent regressions, and enforce continuous delivery quality.

---

## 2. The Testing Pyramid & Domain Division

```
          / \
         /   \       End-to-End Tests (Smoke & Critical User Flows)
        /-----\
       /       \     Integration / Feature Tests (Controllers, Routes, DB, API Contracts)
      /---------\
     /           \   Unit Tests (Domain Services, Model Scopes, Pure Functions, UI Components)
    /-------------\
```

### 2.1 Backend (Laravel) Domain
- **Unit Tests (`tests/Unit`)**:
  - Focus: Domain service logic (`BeneficiaryClassificationService`), calculations, Model scopes, mutators, and accessors.
  - Characteristics: Blazing fast, memory-isolated, zero external dependencies.
- **Feature / Integration Tests (`tests/Feature`)**:
  - Focus: API Route validation, Sanctum authorization & role middleware, HTTP Status Codes, Eloquent database mutations, JSON structure assertion.
  - Environment: SQLite in-memory (`:memory:`) with `Illuminate\Foundation\Testing\RefreshDatabase`.

### 2.2 Frontend (React) Domain
- **Component Unit Tests (`frontend/src/**/*.test.jsx`)**:
  - Focus: Rendering states, conditional badges, buttons, form field inputs, event handlers.
  - Stack: Vitest + React Testing Library + `@testing-library/jest-dom` + `jsdom`.
- **Integration Tests**:
  - Focus: Auth Context provider, form submissions, custom hook data fetching success/failure states.

---

## 3. What to Test vs What NOT to Test

### DO Test:
- **Business Logic & Rules**: Income classification calculations (`citizen` vs `resident` threshold rules, special needs override).
- **Security & Authorization**: Unauthenticated request blocking (HTTP 401), Role-Based Access Control (HTTP 403 vs 200).
- **Database Contracts**: Creating, updating, deleting records, foreign key integrity, and cascade rules.
- **API Contracts**: Correct JSON shape (`id`, `name`, `status`), validation error messages (HTTP 422).
- **User Interactions**: Form validation error displays, modal triggers, confirmation callbacks.

### DO NOT Test:
- Framework internals (e.g., whether Laravel's router resolves paths, or whether React updates the DOM tree).
- Third-party library internals (e.g., verifying Axios headers or Lucide SVG output).
- Trivial getters/setters without logic.

---

## 4. Code Coverage Goals & Metrics

| Module / Layer | Target Coverage | Critical Areas |
| :--- | :--- | :--- |
| **Domain Services** | **$\ge 95\%$** | `BeneficiaryClassificationService` |
| **Eloquent Models** | **$\ge 90\%$** | Scopes, Relations, Accessors |
| **API Controllers & Routes** | **$\ge 85\%$** | Auth, Beneficiaries, Distributions, Inventory |
| **Frontend Utilities & Hooks** | **$\ge 85\%$** | Auth Context, API Client helpers |
| **Frontend UI Components** | **$\ge 80\%$** | Badges, Modals, Summary Cards |

---

## 5. Mocking & Isolation Strategy

### 5.1 Backend Mocking Standards
- **Database**: Use `RefreshDatabase` with SQLite in-memory (`:memory:`).
- **Laravel Fakes**: Use `Storage::fake()`, `Event::fake()`, `Queue::fake()`, and `Notification::fake()` to isolate side-effects.

### 5.2 Frontend Mocking Standards
- **Axios & API Requests**: Use `vi.spyOn(axios, 'get')` or MSW handlers to mock network calls deterministically.
- **Timers & Async Events**: Use `vi.useFakeTimers()` for debounce or delayed actions.

---

## 6. Execution Commands

### Backend Tests (PHPUnit):
```bash
php artisan test
```
To generate coverage report:
```bash
php artisan test --coverage
```

### Frontend Tests (Vitest):
```bash
cd frontend
npm test
npm run test:coverage
```
