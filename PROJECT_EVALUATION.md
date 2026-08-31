# Project Evaluation Report

> **Project:** MoneyTracker
> **Date:** 2026-08-31
> **Tech Stack:** React Native 0.77 (New Architecture) · TypeScript 5.0 (strict) · SQLite (react-native-sqlite-storage) · React Navigation 7 · i18next
> **Evaluated by:** Claude Code Agent
> **Commit at time of audit:** `9ea2313` on branch `feat/core-features-and-i18n`

---

> **Addendum — two findings have since been fixed.** This report is a snapshot taken at `9ea2313`; the following sections no longer describe the code:
>
> - **Lockfiles not committed** — fixed in `88d4a99`. `yarn.lock` and `ios/Podfile.lock` are versioned; `package-lock.json` stays ignored because npm is not used here.
> - **Migrations not transactional** — fixed in `42ac9a8`, though not the way this report suggests. Adding `IF NOT EXISTS` to the `finances_v2`/`finances_v3` creates would have made the retry *worse*, not better: creation would be skipped and the copy `INSERT` would run a second time against a table that already held the rows. Each migration now runs inside one `db.transaction()` together with its `user_version` bump, so an interrupted migration rolls back whole and a retry starts from the same place the first attempt did. That also closes the two related consequences this report lists — migration 003's seed guard and migration 004's duplicate account. Verified on the emulator by injecting a failure mid-migration and confirming the database came back untouched.
>
> Everything else in this report still stands, including `yarn test` exiting 1, the debug keystore, the UTC/local period bug and the absence of backup or export.

---

## Executive Summary

MoneyTracker is an offline-first personal finance tracker for iOS and Android: accounts, transactions, transfers, envelope budgeting, per-category monthly limits, and analytics — all persisted to a local SQLite database with no backend, no network calls, and no user accounts. The application layer is in noticeably better shape than most projects of this age: TypeScript runs `strict` and passes clean, ESLint reports zero errors, money is handled as integer cents end-to-end with a guard enforced at every write boundary, pagination is keyset-based, indexes are deliberately designed, and the inline documentation is genuinely exceptional — nearly every non-trivial decision carries a written rationale explaining what was tried and why it was rejected.

The problems are almost entirely at the edges of that core. **The project cannot currently be shipped or reliably rebuilt.** Neither `yarn.lock` nor `Podfile.lock` is tracked in git (both are explicitly listed in `.gitignore`), which makes every `yarn install` a fresh dependency resolution — this is the direct mechanical cause of the repeated "fix: upgrade libraries" / "fix: babel config conflicts" commits that dominate the recent history. Release builds are signed with the debug keystore, `targetSdkVersion` is 34 (below the Play Store's current floor), `yarn test` exits non-zero even when tests pass, and there is no CI pipeline of any kind.

Two correctness risks deserve immediate attention regardless of shipping plans. First, **schema migrations are not transactional**: each statement autocommits independently, so an app kill mid-migration can leave the database permanently half-seeded (silently) or in a state where the next launch throws `table finances_v3 already exists` and the app cannot boot at all. Second, **there is no backup, export, or encryption of any kind** — a user's entire financial history lives in one unencrypted file with `android:allowBackup="false"`, so a lost or reset device means total, unrecoverable data loss. For a personal finance product, that is a product-defining gap, not a nice-to-have.

Testing is effectively absent: one smoke test covering 240 source files, and zero tests on the money math, the query layer, or the migrations — the three areas where a bug silently corrupts a user's data.

### Overall Health Score

| Category | Score (1-10) | Status |
|----------|:---:|--------|
| Architecture | 7 | 🟡 Needs Improvement |
| Code Quality | 7 | 🟡 Needs Improvement |
| Performance | 5 | 🟡 Needs Improvement |
| Security | 5 | 🟡 Needs Improvement |
| Testing | 2 | 🔴 Critical |
| Dependencies | 4 | 🔴 Critical |
| Documentation | 6 | 🟡 Needs Improvement |
| **Overall** | **5** | **🟡 Needs Improvement** |

> Status: 8-10 Good, 5-7 Needs Improvement, 1-4 Critical

---

## End-User Pain Points Analysis

> **No end-user pain points were supplied for this audit.** This section is therefore *inferred*: it lists the code-level defects most likely to generate user complaints, so that when real reports arrive they can be matched against known root causes. These are not reported issues — they are predicted ones.

### Transactions land in the wrong month's budget
- **Predicted symptom:** "I logged a purchase on the 31st but it shows up in next month's budget."
- **Root cause:** Every timestamp is written as `new Date().toISOString()` (UTC), and every period boundary in `periodToRange` is computed with `Date.UTC`. Bucketing is therefore by UTC calendar month, not the user's local one. A user at UTC-5 logging a transaction at 8pm local on the 31st produces a `dateCreated` already in the next UTC month.
- **Location:** `src/db/queries/period.ts:32-47`, consumed by `src/db/queries/budgetsQueries.ts:182-263` and `src/db/queries/analyticsQueries.ts:88-157`
- **Severity:** High
- **Recommendation:** Decide explicitly whether periods are local or UTC. The cheapest correct fix is to store a local-date component alongside the UTC timestamp (a `localDateKey TEXT` column, `'YYYY-MM-DD'`) and bucket on that; the display layer already computes exactly this in `src/utils/dateFormat.ts:60-68` (`toLocalDateKey`), so display and aggregation currently disagree.
- **Effort:** Medium

### The wrong account's transactions appear after fast tapping
- **Predicted symptom:** "I tapped a different account and it briefly showed the other account's movements."
- **Root cause:** `loadFinances(accountId)` writes its result to state unconditionally with no check that `accountId` is still the selected one. Tapping account A then B, where A's query resolves last, leaves A's transactions rendered under B's selected header.
- **Location:** `src/hooks/useAccountsScreen.ts:105-127`; identical pattern in `src/hooks/useCategoriesScreen.ts:119-141`
- **Severity:** High
- **Recommendation:** Add a request-identity guard (compare the captured id against a ref holding the current selection before calling `setState`), ideally inside the shared loader hook proposed under Code Quality.
- **Effort:** Small

### Data silently stops updating with no error shown
- **Predicted symptom:** "The numbers looked stale / it stopped loading more and nothing happened."
- **Root cause:** Every hook deliberately suppresses the error state on non-first loads to avoid blanking valid data — but the suppressed path only calls `console.warn`, which no user sees. A failing background refetch, or a failing "load more" page, produces zero UI feedback.
- **Location:** `src/hooks/useAccountsScreen.ts:88-96,144-166`; `src/hooks/useCategoriesScreen.ts:158-179`; `src/hooks/useBudgetsScreen.ts:82-90,109-117`; `src/hooks/useAnalysisScreen.ts:136-142,163-169`; `src/hooks/useResumenScreen.ts:68-74`
- **Severity:** Medium
- **Recommendation:** Keep the "don't blank valid data" behavior, but surface a non-blocking toast/inline banner on silent-refetch and pagination failures.
- **Effort:** Small

### Total data loss on device change
- **Predicted symptom:** "I got a new phone and everything is gone."
- **Root cause:** No export, no backup, no sync. `android:allowBackup="false"` (correctly, for unencrypted financial data) means the OS will not back it up either.
- **Location:** `android/app/src/main/AndroidManifest.xml:10`; absence of any export path in `src/`
- **Severity:** Critical
- **Recommendation:** Ship a CSV/JSON export before any public release. See Critical Findings.
- **Effort:** Medium

### App fails to launch after an interrupted first run
- **Predicted symptom:** "It crashes on startup and reinstalling is the only fix" — rare, but unrecoverable when it happens.
- **Root cause:** Non-transactional migrations, detailed under Critical Findings.
- **Location:** `src/db/db.ts:142-160`
- **Severity:** Critical
- **Effort:** Small

---

## Strengths

These are real and should be preserved through any refactor.

- **Exceptional decision documentation.** Nearly every non-obvious choice carries a comment explaining what was tried, why it failed, and why the current approach was chosen — e.g. `src/db/queries/transfersQueries.ts:153-174` documents why the transaction callback must be synchronous, and `src/components/atoms/containers/ScrollContainer/ScrollContainer.tsx:6-24` documents the exact re-mount mechanism that caused a keyboard-dismissal bug. This is the single most valuable asset in the repository and it substantially lowers onboarding cost.
- **Disciplined money handling.** Money is integer cents in every column, in every type, and in every calculation. `src/utils/currency.ts:24-59` parses decimal input to cents using string arithmetic specifically to avoid `dollars * 100` float corruption, and `isFiniteInteger` (`src/db/queries/numberGuards.ts:10-11`) is applied at *every* write boundary — verified across `accountsQueries.ts:153,205`, `financesQueries.ts:174`, `transfersQueries.ts:218`, `envelopesQueries.ts:238,297,528,580`, `budgetsQueries.ts:118`.
- **No denormalized balances.** Account balances (`initialBalance + SUM(finances.amount)`) and envelope balances (`SUM(envelope_movements.amount)`) are derived at read time. There is structurally no stored-balance column that can drift out of sync with its movements — a whole class of finance-app bugs simply cannot occur here.
- **Correct, non-trivial transaction handling where it matters.** The two-leg transfer insert (`src/db/queries/transfersQueries.ts:260-279`) is genuinely atomic and avoids the common `async` callback trap that would let leg A commit alone.
- **Deliberate index design.** Fourteen indexes, including partial and covering ones, each mapped to a specific query. Keyset pagination (`LIMIT n+1`, no `OFFSET`) in `financesQueries.ts:254-362` and `envelopesQueries.ts:629-674`.
- **No SQL injection surface.** Every caller-supplied value is bound; the only string interpolation into SQL is column names drawn from hardcoded whitelists and an internal integer in a `PRAGMA`.
- **Quality gates pass cleanly.** `tsc --noEmit` exits 0 under `strict`; `eslint .` reports 0 errors (48 warnings).
- **Complete i18n parity.** 309 keys in both `en.json` and `es.json`, zero drift in either direction, with route names correctly kept as untranslated identifiers (`src/navigation/DrawerNav/router.tsx:9-11`).
- **Serious accessibility effort.** 153 accessibility props across 163 touchables — unusually high for a project this size.
- **Coherent component architecture.** Atomic design (atoms → molecules → organisms → templates), path aliases wired consistently in both `tsconfig.json` and `babel.config.js`, and consistent loading/error/retry states rendered on every main screen.
- **Minimal attack surface by design.** No network layer, no secrets, no authentication, no analytics SDK, no PII leaving the device.

---

## Critical Findings

### Dependency lockfiles are not tracked in version control
- **Severity:** Critical
- **Category:** Dependencies
- **Location:** `.gitignore:43-44`; `git ls-files` confirms neither `yarn.lock` nor `ios/Podfile.lock` is tracked
- **Description:** `.gitignore` explicitly excludes `yarn.lock` and `package-lock.json`, and `Podfile.lock` is likewise untracked. Every `yarn install` therefore re-resolves the entire dependency graph against whatever satisfies the semver ranges *at that moment*, and every `pod install` re-resolves the native graph. With 48 dependencies mostly pinned with caret ranges, two developers — or the same developer a week apart — get different native module versions. This is the mechanical cause of the recent commit history being dominated by `fix: upgrade thrid party libraries`, `fix: babel config conflicts`, `fix: updating packages for m2`, and `fix: complete RN 0.77 upgrade`. It also makes every bug report unreproducible and every regression un-bisectable.
- **Recommendation:** Remove lines 43-44 from `.gitignore`, commit the current `yarn.lock` and `ios/Podfile.lock`, and treat lockfile changes as reviewable diffs. This single change is the highest value-per-minute fix available in this repository.
- **Effort:** Small (minutes)

### Schema migrations are not atomic and can brick the app or silently lose data
- **Severity:** Critical
- **Category:** Architecture / Data Integrity
- **Location:** `src/db/db.ts:142-160`; `src/db/migrations/002_categoryTypeAndFinanceCleanup.ts:85`; `src/db/migrations/003_seedDefaultCategories.ts:122-188`; `src/db/migrations/004_accountsAndSignedFinances.ts:220,228`
- **Description:** `createTables` runs each migration statement as its own autocommit `db.executeSql` call, and only bumps `PRAGMA user_version` after all statements in a migration succeed. If the process is killed mid-migration, earlier statements are already durably committed but the version is unchanged, so the migration re-runs from the top against a partially-migrated database. Three concrete consequences:
  - **Unrecoverable boot failure.** `CREATE TABLE finances_v2` (`002:85`) and `CREATE TABLE finances_v3` (`004:228`) lack `IF NOT EXISTS`. If either temp table survived a failed attempt, the retry throws `table already exists`, `initDatabase` rejects, and the app can never get past startup. Only a reinstall (i.e. total data loss) recovers it.
  - **Silent permanent data loss.** Migration 3 snapshots "is the categories table empty" once into a `TEMP` table (`003:127`) and then runs 11 independently-committing guarded `INSERT`s. A kill after 6 inserts means the retry re-evaluates the guard, finds `cnt = 6`, and skips *all* remaining inserts — then drops `icons` and bumps the version. The user permanently has 6 of 11 default categories, with no error anywhere.
  - **Duplicate seed data.** `INSERT INTO accounts` (`004:220`) has no idempotency guard, so a retry can create a second default "Efectivo" account.
- **Recommendation:** Wrap each migration's statement list in a single `db.transaction()` — the same primitive `insertTransfer` already uses correctly. Add `IF NOT EXISTS` to the two temp-table creates as defence in depth, and make the account seed guarded (`WHERE NOT EXISTS (SELECT 1 FROM accounts)`). Note the driver's synchronous-callback requirement documented at `transfersQueries.ts:153-174`.
- **Effort:** Small

### No backup, export, or encryption of user financial data
- **Severity:** Critical
- **Category:** Security / Product
- **Location:** `android/app/src/main/AndroidManifest.xml:10` (`android:allowBackup="false"`); no export path exists anywhere in `src/`
- **Description:** A user's complete financial history — every account, transaction, transfer, and budget — lives in a single unencrypted SQLite file (`moneytracker.db`) on device storage. There is no export, no share, no cloud sync, and OS-level backup is disabled. Losing, resetting, or replacing the device destroys the data permanently, with no recovery path. Additionally, the file is readable by anyone with physical device access on a rooted/jailbroken device or via a filesystem-level backup on an unencrypted device profile. `allowBackup="false"` is the *correct* choice for unencrypted financial data — the problem is that no alternative was provided alongside it.
- **Recommendation:** Two separate workstreams. (1) Ship an export/import path (CSV for interoperability, JSON for full fidelity) before any public release — this is the minimum viable answer to "I got a new phone." (2) Evaluate at-rest encryption; SQLCipher via `react-native-sqlite-storage`'s SQLCipher build or a migration to `op-sqlite`/`expo-sqlite` (both of which also solve the New Architecture problem below) are the realistic options.
- **Effort:** Medium (export) / Large (encryption + driver migration)

### Release builds are signed with the debug keystore
- **Severity:** Critical
- **Category:** Security / Release
- **Location:** `android/app/build.gradle:109-113` — `release { signingConfig signingConfigs.debug }`
- **Description:** The release build type uses the debug signing config, whose keystore, alias, and passwords are committed in plaintext at `android/app/build.gradle:98-103` (`storePassword 'android'`). This is the unmodified React Native template default. An artifact built this way cannot be uploaded to Google Play, and if distributed outside the store, anyone can sign a malicious update that the OS will accept as a legitimate upgrade of the installed app.
- **Recommendation:** Generate a release keystore, store it outside the repository, and inject the credentials via `~/.gradle/gradle.properties` or CI secrets. Enable Play App Signing.
- **Effort:** Small

---

## Architecture Assessment

### Project Structure

The layout is layer-first with feature grouping inside each layer, and it is applied consistently:

```
src/
├── components/     atoms → molecules → organisms → templates (atomic design)
├── screens/        one folder per screen, with local partials/ and mappers.ts
├── hooks/          one use<Screen>/use<Entity>Form hook per screen
├── db/             creation/ · migrations/ · queries/  (the only SQL in the app)
├── navigation/     drawer → bottom tabs → stacks → top tabs
├── constants/ utils/ i18n/ context/ data/ interfaces/
```

The strongest architectural decision is the **screen / hook / mapper / query separation**. A screen renders; its `use<Screen>` hook owns fetching and mutation; a local `mappers.ts` converts DB rows into component-shaped view models; `@db/queries` owns all SQL. No component imports SQL, and no query file imports React. That boundary holds everywhere and is the main reason the codebase reads cleanly despite having no state-management library.

Four directories are vestigial and should be deleted rather than maintained: `src/playground/` (a theme-switcher demo screen, unreachable), `src/context/ThemeContext/` (referenced only by that playground screen; its palette is literal placeholder values — `primary: 'red'`, `text: 'pink'` — at `themeReducer.tsx:22-28`), `src/layout/Component/` (a `<Text>Component</Text>` stub), and `src/screens/FirstRun.tsx` (the RN template welcome screen).

### Design Patterns

- **Atomic design** for components — consistently applied, with `templates/ScreenTemplate` used by 5 screens.
- **Custom-hook-per-screen** as the state pattern. There is no Redux/Zustand/react-query; each hook owns its own `useState` + `useFocusEffect`. This is a reasonable choice for an offline single-writer app and keeps the code approachable, but it is the source of most of the duplication and every staleness issue (see below).
- **Version-gated migrations** on `PRAGMA user_version` — a good, dependency-free choice, undermined only by the atomicity gap.
- **Derived aggregates over stored state** for all balances — the single best data-modelling decision in the project.

### Coupling & Cohesion

Coupling is low and mostly correct. The one significant leak is that **`mappers.ts` files are invoked inline in JSX rather than memoized**, which couples render frequency to data-transformation cost (see Performance).

Cohesion within `src/hooks/` is weak — not because the hooks are wrong, but because the same 60-line state machine is reimplemented eight times (below).

### Scalability Concerns

- **No caching layer.** Every screen re-queries SQLite from scratch on every focus. A single Accounts → Budgets → Resumen → Accounts loop issues roughly 13 queries, none of which are deduplicated or reused.
- **O(N) query fan-out.** `useAnalysisScreen`'s `findMostRecentFundWithdrawal` (`src/hooks/useAnalysisScreen.ts:53-88`) issues one `getEnvelopeMovements` call *per fund envelope* on every focus. A user with 20 envelopes triggers 24 queries per visit to the Analysis tab.
- **No push-based invalidation.** Cross-screen freshness relies entirely on `useFocusEffect` refiring. `FormScreen` works around this by explicitly navigating to `'Resumen'` after a save (`src/screens/FormScreen/FormScreen.tsx:82-86`) purely to force a focus event. Any screen not visited after a mutation stays stale indefinitely.
- **Unbounded list queries.** `getCategories`, `getAccounts`, `getEnvelopes`, `getCategoryBudgets`, and `getCashFlowByMonth` have no `LIMIT`. Justified by "these tables stay small," which is true today and untrue for a user who creates a category per merchant.
- **`react-native-sqlite-storage` has no New Architecture support.** `newArchEnabled=true` (`android/gradle.properties:35`) while the SQLite driver ships no `codegenConfig` and no TurboModule spec — it runs through the legacy interop layer, which React Native has signalled it will eventually remove. The app's entire persistence layer depends on an unmaintained bridge module.

### Findings

| # | Finding | Severity | Location | Effort |
|---|---------|----------|----------|--------|
| 1 | Migrations are not transactional; retry can brick launch or silently half-seed | Critical | `src/db/db.ts:142-160` | Small |
| 2 | No caching/invalidation; full refetch on every screen focus | High | all `src/hooks/use*Screen.ts` | Medium |
| 3 | O(N) per-envelope queries on Analysis focus | High | `src/hooks/useAnalysisScreen.ts:53-88` | Small |
| 4 | SQLite driver unsupported on the enabled New Architecture | High | `package.json` + `android/gradle.properties:35` | Large |
| 5 | Cross-screen staleness worked around by forced navigation | Medium | `src/screens/FormScreen/FormScreen.tsx:82-86` | Medium |
| 6 | Unbounded `SELECT`s on user-authored tables | Medium | `categoriesQueries.ts:39`, `accountsQueries.ts:289`, `envelopesQueries.ts:354`, `budgetsQueries.ts:173` | Small |
| 7 | Dead layers: `playground/`, `context/ThemeContext/`, `layout/`, `FirstRun.tsx` | Medium | see paths | Small |
| 8 | `DashboardScreen` is a reachable placeholder route rendering a stub | Low | `src/screens/DashboardScreen/DashboardScreen.tsx:12-27`, registered at `src/navigation/StackNav/StackNav.tsx:16-23` | Small |
| 9 | No `RootParamList`; navigation calls fall back to `as never` casts | Low | `src/screens/FormScreen/FormScreen.tsx:84`; `src/screens/ResumenScreen/ResumenScreen.tsx:24-27` | Medium |

---

## Code Quality Assessment

### Style & Consistency

ESLint (`@react-native` config) and Prettier are both configured and `eslint .` exits 0 with 48 warnings — mostly `react-native/no-inline-styles`, of which 7 are in the dead playground screen. Formatting is consistent across the codebase apart from the vestigial directories, which predate the current conventions (4-space indent, double quotes, no trailing commas in `src/context/ThemeContext/`).

Two consistency gaps worth fixing:

- **Mixed comment and identifier languages.** Doc comments alternate between Spanish and English, sometimes within one file (`src/db/db.ts` is English, `src/i18n/index.ts` is Spanish, `src/screens/ResumenScreen/ResumenScreen.tsx` mixes both). Route and screen names do too — `ResumenScreen` sits beside `AccountsScreen` and `BudgetsScreen`. Pick one language for code and stick to it; the i18n bundle already handles user-facing text.
- **Default vs named exports.** `src/components/` uses named exports throughout; `src/screens/` uses `export default` in ~20 files. Thirteen component directories are missing the `index.ts` barrel their siblings have (`src/components/atoms/text/Headings/`, `src/navigation/[categories]/CategoriesNavigator/`, `src/screens/FormScreen/partials/AccountSelector/`, and 10 others).

### Type Safety

Strong. `tsc --noEmit` passes with `strict: true` and exits 0. There are 47 `any` occurrences, but 32 of them are `catch (e: any)` — unavoidable pre-TS-4.4 idiom, and harmless here since the value is immediately narrowed with `e?.message ?? e`. Only two `eslint-disable` comments exist and no `@ts-ignore` anywhere.

The genuine gaps are narrow and easy to close: `src/components/organisms/Charts/PieChart/types.ts:5` (`data: any`), `src/screens/[categories]/CreateCategory/partials/SymbolList/SymbolList.tsx:18-19`, `src/components/atoms/NavigationControl/types.ts:2-3` (`firstActionPress: any` — should be `() => void`), and `src/components/molecules/Selects/SelectPro/styles.ts:3`.

The larger structural type weakness is navigation: no `ReactNavigation.RootParamList` is declared, so cross-navigator `navigate()` calls are unchecked and one site resorts to `navigate('Resumen' as never)`.

### Error Handling

The database layer's error handling is good and deliberately so — the only `catch` in `src/db/` re-throws (`db.ts:142-160`), with a comment documenting that swallowing errors here previously caused tables to silently not exist for months. That lesson was learned and applied.

The hook layer has the opposite problem: **27 `console.warn`/`console.log` calls are the entire error-reporting strategy**. There is no crash reporter, no logging service, and no telemetry, so a production failure produces no signal at all. Three specific patterns:

- Silent-refetch failures are intentionally not surfaced (documented rationale: don't blank valid data) but also not surfaced *any other way* — see End-User Pain Points.
- Pagination failures produce no feedback whatsoever (`useAccountsScreen.ts:144-166`, `useCategoriesScreen.ts:158-179`).
- Archive mutations discard the underlying error and return `false`, so the UI can only show a generic message (`useAccountsScreen.ts:198-203`, `useBudgetsScreen.ts:206-208`).
- `src/navigation/[home]/HomeNavigator/HomeNavigator.tsx:7` contains a stray `console.log('render')` that fires on every render in production.

### Code Complexity

Reasonable overall — average file is 74 lines and only one file exceeds 400 (`src/db/queries/envelopesQueries.ts`, 674 lines, though much of that is doc comments). The files that warrant splitting on responsibility rather than length:

- `src/db/queries/envelopesQueries.ts` (674) — envelope CRUD, movements, and the assign/withdraw balance logic are three concerns in one file.
- `src/screens/AccountsScreen/AccountsScreen.tsx` (368) and `src/screens/BudgetsScreen/BudgetsScreen.tsx` (365) — each manages three or four independent modal/dialog states inline.

### Dead Code & Duplication

**Dead code** (verified unreferenced from any reachable entry point):

| Path | Note |
|---|---|
| `src/playground/screens/ChangeThemeScreen.tsx` | unreachable demo |
| `src/context/ThemeContext/` | only consumer is the playground screen; palette is placeholder colors |
| `src/layout/Component/` | `<Text>Component</Text>` stub |
| `src/screens/FirstRun.tsx` | RN template welcome screen; also the only deprecated-deep-import lint warning |
| `src/components/atoms/items/CategoryItem/` | `<Text>Icon</Text>` stub |
| `src/navigation/[home]/HomeBottomTabs/CustomTabBarButton.tsx` | superseded by the inline `tabBarButton` in `router.tsx:87-95` |
| `src/data/varOutcomes.ts` | only reference is a commented-out import |
| `src/screens/DashboardScreen/` | placeholder, but *registered as a live route* |

**Duplication**, in descending order of value to fix:

1. **The "silent background refetch" state machine is reimplemented 8 times** — `hasLoadedXRef` + `silent` flag + conditional `setStatus('loading')` + `console.warn` catch, near-identical across `useAccountsScreen` (×2), `useBudgetsScreen` (×2), `useAnalysisScreen` (×2), `useCategoriesScreen` (×2), `useResumenScreen`, and `useTransferScreen`. Extracting a single `useFocusRefetch` hook would collapse ~400 lines *and* give one place to add the missing unmount/race guard instead of eight.
2. **Keyset pagination duplicated verbatim** between `useAccountsScreen.ts:105-178` and `useCategoriesScreen.ts:119-191` — the comments even cross-reference each other.
3. **`centsToEditableAmountText` copy-pasted** between `useAccountForm.ts:28-29` and `useEnvelopeForm.ts:24-25`, with an explicit comment acknowledging the copy. Belongs in `@utils/currency`.
4. **`useAccountForm` and `useEnvelopeForm` are structurally identical** (load state machine, mode derivation, `canSave`, icon picker, save/notice flow) — candidates for a generic `useEntityForm<T>`.
5. **Three pairs of same-named, differently-implemented components**: `AmountCard` (`FormScreen/partials/` vs `AccountsScreen/Transfer/partials/`, 147 diff lines), `CategoryGrid` (`FormScreen/partials/` vs `[categories]/CategoriesScreen/partials/`, 223 diff lines), `KindField` (`BudgetsScreen/CreateEnvelope/partials/` vs `AccountsScreen/CreateAccount/partials/`). Each pair shares most of its structure with a different domain type.

### Findings

| # | Finding | Severity | Location | Effort |
|---|---------|----------|----------|--------|
| 1 | Silent-refetch state machine duplicated 8× | High | all `src/hooks/use*Screen.ts` | Medium |
| 2 | `console.warn` is the entire production error-reporting strategy | High | 27 sites across `src/hooks/`, `src/screens/` | Medium |
| 3 | 8 dead files/directories still in the tree | Medium | see table above | Small |
| 4 | Keyset pagination duplicated verbatim between two hooks | Medium | `useAccountsScreen.ts:105-178`, `useCategoriesScreen.ts:119-191` | Small |
| 5 | Mixed Spanish/English comments and identifiers | Medium | throughout | Medium |
| 6 | Three pairs of same-named divergent components | Medium | `AmountCard`, `CategoryGrid`, `KindField` | Medium |
| 7 | `console.log('render')` shipping in production | Low | `src/navigation/[home]/HomeNavigator/HomeNavigator.tsx:7` | Small |
| 8 | 13 component dirs missing the conventional `index.ts` barrel | Low | see Style section | Small |
| 9 | Default vs named export inconsistency between layers | Low | `src/screens/` vs `src/components/` | Small |

---

## Performance Assessment

### Frontend Performance

**Zero components are memoized.** `React.memo` appears 0 times across 91 `.tsx` files, while `useCallback` appears 55 times. Without `React.memo` on the receiving components, those 55 `useCallback`s provide no re-render benefit at all — they only stabilize hook dependency arrays. This is the highest-leverage performance fix available: memoizing the handful of list-row components (`TransactItem`, `CatalogCard`, `EnvelopeCard`, `CategoryLimitRow`, `CategoryTile`) would immediately convert that existing `useCallback` work into actual savings.

**Mappers run on every render, unmemoized.** `useMemo` appears only 6 times. Data transformations are invoked inline in JSX, so they re-run whenever *any* local state changes — including opening an unrelated dialog:

- `src/screens/AccountsScreen/AccountsScreen.tsx:239,243` — `mapAccountsToCatalogCards(accounts)` and `groupFinancesByDate(financeItems)` recompute every time `accountMenu`, `archiveConfirm`, or `notice` state changes.
- `src/screens/[categories]/CategoriesScreen/CategoriesScreen.tsx:70-71` — same pattern.
- `src/screens/AnalysisScreen/AnalysisScreen.tsx:67-70` — `toDebtSectorInputs`, `toFundSectorInputs`, and a `.reduce()` all inline.

**Bundle size** is inflated by three avoidable things:

- `src/icons/index.ts:3,9` registers the **entire FontAwesome brands pack** (`library.add(fab, ...)`) — roughly 450 icon definitions — and a codebase-wide grep confirms **not one brand icon is used anywhere**. Delete the `fab` import and the `@fortawesome/free-brands-svg-icons` dependency.
- **Two complete icon systems ship simultaneously**: `@fortawesome/react-native-fontawesome` (SVG, 29 usages) and `react-native-vector-icons/FontAwesome` (font glyphs, 10+ usages). Both the SVG payload and the `.ttf` files are bundled. Consolidating on one would cut both JS and native asset weight.
- **ProGuard/R8 is disabled** for release builds (`android/app/build.gradle:67` — `enableProguardInReleaseBuilds = false`) and `proguard-rules.pro` is empty, so no minification or shrinking happens. `reactNativeArchitectures` also still includes `x86,x86_64` (`android/gradle.properties:33`), which have no place in a store release APK.

**Layout**: `src/constants/dimensions/Dimensions.ts:3-6` captures `Dimensions.get(...)` at module load into four constants. These never update on rotation, split-screen, or foldable unfold. The manifest declares `configChanges` including `orientation|screenSize`, so the activity is *not* recreated — the stale values persist for the process lifetime. Use `useWindowDimensions()` in components instead.

**Virtualization** is mostly correct. `react-native-virtualized-view` was removed and replaced with a hand-rolled `ScrollContainer` (`src/components/atoms/containers/ScrollContainer/ScrollContainer.tsx`) that passes the header as a JSX *element* rather than a component factory — this fixed a real bug where the amount field lost focus after every keystroke. The remaining exception is `src/screens/[categories]/CategoriesScreen/partials/CategoryGrid/CategoryGrid.tsx:40-55`, a `FlatList` with `scrollEnabled={false}` nested inside the outer scroll container, which renders every row and gains nothing from virtualization — defensible for a small category list, but it is the same anti-pattern that was deliberately removed elsewhere.

### Database Performance

Query design is the strongest part of the codebase — see the index inventory under Architecture. **No N+1 patterns exist inside `src/db/`.** The performance problems are all in how the *hooks* call it:

- 13 queries per Accounts→Budgets→Resumen→Accounts navigation loop, none cached.
- `useAnalysisScreen`'s per-envelope fan-out (4 + N queries per focus).
- `getSpendingByCategory` / `getIncomeByCategory` (`analyticsQueries.ts:239-361`) range-scan all `finances` rows in the date window before filtering `idCategory IS NOT NULL` — correct, and correctly reasoned in the file's own comments, but it scales with total transaction volume rather than categorized volume.

### Findings

| # | Finding | Severity | Location | Effort |
|---|---------|----------|----------|--------|
| 1 | Zero `React.memo`; 55 `useCallback`s therefore yield no benefit | High | all `src/components/`, list rows especially | Medium |
| 2 | Mappers recomputed on every render, unmemoized | High | `AccountsScreen.tsx:239,243`; `CategoriesScreen.tsx:70-71`; `AnalysisScreen.tsx:67-70` | Small |
| 3 | Full FontAwesome brands pack bundled, zero usages | Medium | `src/icons/index.ts:3,9` | Small |
| 4 | Two parallel icon systems bundled simultaneously | Medium | `@fortawesome/*` vs `react-native-vector-icons` | Medium |
| 5 | ProGuard/R8 disabled; x86 archs in release builds | Medium | `android/app/build.gradle:67`; `android/gradle.properties:33` | Small |
| 6 | `Dimensions` captured once at module load | Medium | `src/constants/dimensions/Dimensions.ts:3-6` | Small |
| 7 | O(N) query fan-out on Analysis focus | Medium | `src/hooks/useAnalysisScreen.ts:53-88` | Small |
| 8 | Non-virtualized `FlatList` nested in a scroll container | Low | `[categories]/CategoriesScreen/partials/CategoryGrid/CategoryGrid.tsx:40-55` | Small |

---

## Security Assessment

This is an offline application with no backend, no authentication, no network requests, and no secrets. That eliminates the majority of the usual attack surface — and it means the findings below are almost entirely about **data-at-rest and release integrity** rather than remote exploitation.

### Authentication & Authorization

Not applicable — there are no accounts, sessions, or tokens. Worth noting for the roadmap: **there is no app-level lock** (no biometric or PIN gate). Anyone who picks up an unlocked phone sees the owner's complete financial history. Most finance apps in this category ship a biometric gate; it should be a tracked backlog item, not an oversight.

### Input Validation

Good. Every value reaching SQL is a bound `?` parameter; the only string interpolation into SQL is column names from hardcoded whitelists (`accountsQueries.ts:220`, `envelopesQueries.ts:312`) and an internal integer in a `PRAGMA` (`db.ts:126`). Numeric input is validated by `isFiniteInteger` at every write boundary, and amount parsing (`src/utils/currency.ts:24-59`) rejects anything not matching `/^\d+(\.\d+)?$/`. Schema-level `CHECK` constraints back this up on `accounts.kind`, `envelopes.kind`, `envelope_movements.amount`, `category_budgets.limitAmount`, and `category_budgets.period`. `PRAGMA foreign_keys = ON` is correctly re-applied per connection (`db.ts:88`) with a comment explaining why that placement is the only correct one.

One gap: `categories.type` has no `CHECK` constraint (`migrations/002:78-79` adds it as a plain `TEXT NOT NULL DEFAULT 'expense'`), so it is enforced only in application code — inconsistent with the other enum-like columns.

### Secrets Management

No API keys, tokens, or credentials in `src/`. The two exceptions are both in native config:

- The debug keystore password is committed in plaintext (`android/app/build.gradle:98-103`). Harmless in itself — it is the RN template's public debug key — but it becomes a real problem because the *release* build reuses it (see Critical Findings).
- `src/navigation/DrawerNav/CustomDrawer.tsx:31` hardcodes a **Firebase Storage URL with an access token** for the drawer's avatar image. It is a public read URL rather than a credential, but it means this otherwise-offline app makes a network request to a third-party bucket that nobody on this project appears to control, and the drawer will show a broken image whenever that link rots. Replace it with a bundled local asset.

### Exposed Sensitive Data

No logging of transaction amounts or account details was found — the `console.warn` calls log error messages only. `android:allowBackup="false"` correctly prevents financial data from reaching cloud backup. `android:usesCleartextTraffic` is not set (defaults to false on API 28+), and the only declared permission is `INTERNET`, which is now used solely by that one avatar URL — removing it would let the app drop the permission entirely, a meaningful trust signal for a finance app.

### Dependency Vulnerabilities

`npm audit` / `yarn audit` is not run anywhere, and cannot be run reproducibly at all without a committed lockfile. This must be part of the CI work.

### Findings

| # | Finding | Severity | Location | Effort |
|---|---------|----------|----------|--------|
| 1 | Release builds signed with the debug keystore | Critical | `android/app/build.gradle:109-113` | Small |
| 2 | Financial database unencrypted, with no backup or export path | Critical | `AndroidManifest.xml:10`; no export in `src/` | Medium–Large |
| 3 | No dependency vulnerability scanning (and no lockfile to scan) | High | absent | Small |
| 4 | No app-level biometric/PIN lock | Medium | absent | Medium |
| 5 | Third-party Firebase Storage URL hardcoded for the drawer avatar | Medium | `src/navigation/DrawerNav/CustomDrawer.tsx:31` | Small |
| 6 | `categories.type` lacks the `CHECK` constraint its sibling enums have | Low | `src/db/migrations/002_categoryTypeAndFinanceCleanup.ts:78-79` | Small |
| 7 | `INTERNET` permission retained for a single decorative image | Low | `android/app/src/main/AndroidManifest.xml:3` | Small |

---

## Testing Assessment

### Test Coverage

**One test file covers 240 source files.** `__tests__/App-test.tsx` renders `<App />` inside an async `act()` and asserts nothing beyond "did not throw." Effective coverage of business logic is zero.

The three areas with no tests are precisely the three where a bug silently corrupts user data:

- **Money parsing and formatting** (`src/utils/currency.ts`) — pure functions with well-defined edge cases (rounding at the third decimal, comma vs period separators, leading `.`, `Number.isSafeInteger` overflow). This is the single easiest, highest-value test suite to write; it needs no mocks and no native modules.
- **The query layer** (`src/db/queries/`, ~2,600 lines) — signed-amount aggregation, transfer-leg exclusion from income/expense totals, keyset pagination boundaries, envelope balance derivation. All testable against `better-sqlite3` or `sqlite3` in Node with the real schema.
- **Migrations** (`src/db/migrations/`) — including, specifically, the torn-migration scenarios described under Critical Findings, which are straightforward to reproduce in a Node harness by aborting between statements.

### Test Quality

The one existing test is a smoke test, and the mock infrastructure around it is actually well built: `__mocks__/react-native-sqlite-storage.js` is a thoughtful hand-written double that returns `user_version = 0` so migrations run against a no-op `executeSql`, and `jest.setup.js` correctly loads the gesture-handler and reanimated official test helpers with comments explaining why. `jest.config.js`'s `transformIgnorePatterns` list is maintained and correct. **The harness is in better shape than the test suite it serves** — the cost of writing the missing tests is lower than it looks.

### CI/CD Pipeline

**There is none.** No `.github/workflows/`, no `.gitlab-ci.yml`, no `Jenkinsfile`, no fastlane. `eas.json` exists but is a **0-byte file**, which would fail any `eas build` invocation outright — it should either be configured or deleted.

Critically, **`yarn test` currently exits 1 even though the test passes.** After Jest reports `Tests: 1 passed`, a `Batchinator` timer from `@react-native/virtualized-lists` fires after environment teardown and crashes Node:

```
ReferenceError: You are trying to `import` a file after the Jest environment has been torn down.
TypeError: _reactNative.InteractionManager.runAfterInteractions is not a function
```

Any CI pipeline added today would fail on its first run for a reason unrelated to code quality. Fix this before wiring up CI: unmount the renderer in a cleanup step, or add `jest.useFakeTimers()` / `--forceExit` as an interim measure.

Also missing from `package.json` scripts: no `typecheck`, no `format`, no `test:coverage`. `tsc --noEmit` currently passes, but nothing enforces that it keeps passing.

### Findings

| # | Finding | Severity | Location | Effort |
|---|---------|----------|----------|--------|
| 1 | `yarn test` exits 1 despite passing tests | Critical | `jest.config.js` + `__tests__/App-test.tsx` | Small |
| 2 | No CI/CD pipeline of any kind | Critical | absent | Medium |
| 3 | ~0% coverage; money math, queries, and migrations untested | Critical | `src/utils/currency.ts`, `src/db/` | Large |
| 4 | `eas.json` is an empty 0-byte file | Low | `eas.json` | Small |
| 5 | No `typecheck` / `format` / `test:coverage` scripts | Low | `package.json:5-11` | Small |

---

## Dependency Assessment

### Dependency Health

**Every direct dependency is behind, several by major versions.** Selected highlights from `npm-check-updates`:

| Package | Current | Latest | Gap |
|---|---|---|---|
| `react-native` | ^0.77.0 | ^0.87.1 | 10 minor releases |
| `react` | 18.3.1 | 19.2.8 | 1 major |
| `react-native-reanimated` | ~3.17.0 | ~4.6.0 | 1 major |
| `react-native-gesture-handler` | 2.22.0 | 3.2.1 | 1 major |
| `react-native-pager-view` | ^6.3.4 | ^9.0.2 | 3 majors |
| `@react-native-community/cli` | ^15.0.1 | ^20.2.0 | 5 majors |
| `react-native-vector-icons` | ^9.2.0 | ^10.3.0 | 1 major (now split into scoped packages) |
| `eslint` | ^8.19.0 | ^10.9.1 | 2 majors |
| `prettier` | ^2.8.8 | ^3.9.6 | 1 major |
| `jest` | ^29.2.1 | ^30.5.0 | 1 major |

Two dependencies are effectively unmaintained: `react-native-responsive-screen` (last published 2022) and `react-native-virtualized-view` (last published 2022 — and no longer used, see below).

The highest-risk entry is **`react-native-sqlite-storage@6.0.1`**. It ships no `codegenConfig` and no TurboModule spec, so with `newArchEnabled=true` it runs entirely through the legacy bridge interop layer. The app's persistence layer — the thing holding all user data — sits on an old module the React Native team has signalled it intends to stop supporting. `op-sqlite` and `expo-sqlite` are the maintained, New-Architecture-native alternatives, and either would also open the door to SQLCipher encryption.

### Dependency Count

48 direct dependencies is reasonable for the feature set, but **six of them are entirely unused** and can be deleted today:

| Package | Status |
|---|---|
| `add` | Junk — an accidental `yarn add add` |
| `yarn` | Junk — yarn installed as a project dependency |
| `react-native-virtualized-view` | Removed from the code; only doc-comment mentions remain |
| `react-native-modal` | Zero imports; `BottomSheet` uses RN's built-in `Modal` |
| `react-native-linear-gradient` | Zero imports |
| `@fortawesome/free-regular-svg-icons` | Zero imports |

Additionally, `@fortawesome/free-brands-svg-icons` is imported but unused (only `library.add(fab, ...)`), and `@rnx-kit/align-deps` is a build tool sitting in `dependencies` rather than `devDependencies`.

Removing these drops native pods and Gradle contributions as well as JS weight.

### License Compliance

No copyleft (GPL/AGPL) licenses were identified among the direct dependencies — the graph is MIT/Apache-2.0/BSD dominated, which is appropriate for a commercial release. The project itself carries an MIT `LICENSE`. A proper license audit cannot be performed without a committed lockfile; add `license-checker` to CI once lockfiles are tracked.

### Findings

| # | Finding | Severity | Location | Effort |
|---|---------|----------|----------|--------|
| 1 | No lockfiles tracked → non-reproducible installs | Critical | `.gitignore:43-44` | Small |
| 2 | SQLite driver unmaintained and not New-Arch native | High | `package.json` | Large |
| 3 | RN 10 minors behind; React, Reanimated, GH a major behind | High | `package.json` | Large |
| 4 | 6 unused dependencies, incl. junk `add` and `yarn` | Medium | `package.json:11-49` | Small |
| 5 | Full FA brands pack imported but unused | Medium | `src/icons/index.ts:3` | Small |
| 6 | `@rnx-kit/align-deps` in `dependencies` not `devDependencies` | Low | `package.json:32` | Small |
| 7 | `react-native-responsive-screen` unmaintained since 2022 | Low | used by `src/utils/responsive.ts` | Small |

---

## Prioritized Recommendations

### Immediate (This Sprint)

These are all small, and the first four unblock everything else.

1. **Commit `yarn.lock` and `ios/Podfile.lock`**; remove lines 43-44 from `.gitignore`. — Effort: Small
2. **Wrap each migration in `db.transaction()`**, add `IF NOT EXISTS` to the `finances_v2`/`finances_v3` creates, and guard the default-account seed. — Effort: Small
3. **Fix `yarn test` exiting 1** (unmount the renderer / fake timers), then add `typecheck`, `format`, and `test:coverage` scripts. — Effort: Small
4. **Generate a release keystore** and stop signing releases with the debug key. — Effort: Small
5. **Bump `targetSdkVersion` to 35** to meet the Play Store floor. — Effort: Small
6. **Delete the 6 unused dependencies** and the `fab` icon-pack import. — Effort: Small
7. **Delete the 8 dead files/directories** and the stray `console.log('render')`. — Effort: Small
8. **Add the request-identity guard** to `loadFinances` in `useAccountsScreen` and `useCategoriesScreen`. — Effort: Small

### Short-term (Next 2-4 Weeks)

1. **Stand up CI** (GitHub Actions): lint, `tsc --noEmit`, test, `yarn audit`, and an Android debug build on every PR. — Effort: Medium
2. **Write the `src/utils/currency.ts` test suite** — pure functions, no mocks, immediate value. Then the `src/db/queries/` suite against a real SQLite instance in Node. — Effort: Medium
3. **Resolve the UTC-vs-local period bug.** Decide the semantics, then align `period.ts` and `toLocalDateKey` so aggregation and display agree. — Effort: Medium
4. **Memoize the list-row components** (`TransactItem`, `CatalogCard`, `EnvelopeCard`, `CategoryLimitRow`, `CategoryTile`) with `React.memo`, and wrap the inline mapper calls in `useMemo`. — Effort: Small
5. **Surface silent failures** — a non-blocking banner or toast for background-refetch and pagination errors. — Effort: Small
6. **Enable ProGuard/R8** and drop `x86,x86_64` from release architectures. — Effort: Small
7. **Replace the remote Firebase avatar URL** with a bundled asset, then drop the `INTERNET` permission. — Effort: Small
8. **Ship CSV/JSON export.** The minimum viable answer to "I got a new phone." — Effort: Medium

### Medium-term (1-3 Months)

1. **Extract the shared `useFocusRefetch` hook** to collapse the 8 duplicated state machines, and use it as the single place to add unmount guards and request-identity checks. — Effort: Medium
2. **Introduce a lightweight query cache** (TanStack Query, or a hand-rolled invalidation bus) to end the refetch-on-every-focus pattern and the forced-navigation workaround in `FormScreen`. — Effort: Medium
3. **Fix the Analysis screen's O(N) fan-out** — replace the per-envelope loop with a single grouped query. — Effort: Small
4. **Consolidate on one icon system** and remove the other's native assets. — Effort: Medium
5. **Declare `ReactNavigation.RootParamList`** and eliminate the `as never` navigation casts. — Effort: Medium
6. **Pick one language for code** (comments, identifiers, screen names) and normalize. — Effort: Medium
7. **Add an app-level biometric/PIN lock.** — Effort: Medium
8. **Upgrade React Native toward 0.87**, in staged increments, now that lockfiles make each step reproducible and CI can verify it. — Effort: Large

### Long-term (3+ Months)

1. **Migrate off `react-native-sqlite-storage`** to `op-sqlite` or `expo-sqlite` — resolves the New Architecture risk and enables at-rest encryption in the same change. — Effort: Large
2. **Encrypt the database at rest** (SQLCipher), gated behind the driver migration. — Effort: Large
3. **Add crash/error reporting** (Sentry or equivalent) so production failures produce signal instead of invisible `console.warn` calls. — Effort: Medium
4. **Build out the query-layer and migration test suites** toward meaningful coverage of the data layer. — Effort: Large
5. **Evaluate optional encrypted cloud sync** — the natural product answer to multi-device and durability, and a prerequisite for most monetization paths. — Effort: Large

---

## Appendix

### Files Reviewed

**Configuration:** `package.json`, `tsconfig.json`, `babel.config.js`, `metro.config.js`, `jest.config.js`, `jest.setup.js`, `.eslintrc.js`, `.prettierrc.js`, `.gitignore`, `react-native.config.js`, `app.json`, `eas.json`, `Gemfile`, `.yarnrc.yml`

**Native:** `android/build.gradle`, `android/app/build.gradle`, `android/gradle.properties`, `android/app/src/main/AndroidManifest.xml`, `android/app/proguard-rules.pro`, `ios/Podfile`, `ios/MoneyTracker/Info.plist`, `ios/MoneyTracker.xcodeproj/project.pbxproj`

**Entry points:** `index.js`, `App.tsx`

**Data layer (read in full):** `src/db/db.ts`, `src/db/creation/*`, `src/db/migrations/002`–`005`, `src/db/queries/*` (accounts, analytics, budgets, categories, envelopes, finances, transfers, numberGuards, period, index)

**State layer (read in full):** all 11 files in `src/hooks/`, plus `src/screens/AccountsScreen/`, `BudgetsScreen/`, `AnalysisScreen/`, `ResumenScreen/`, `DashboardScreen/`, `FormScreen/`, `[categories]/CategoriesScreen/`, `AccountsScreen/Transfer/`

**Cross-cutting:** `src/i18n/index.ts` + locale bundles, `src/utils/*`, `src/constants/*`, `src/context/ThemeContext/*`, `src/interfaces/common.d.ts`, `src/icons/index.ts`, `src/navigation/**`, `src/components/atoms/containers/*`, `__tests__/App-test.tsx`, `__mocks__/react-native-sqlite-storage.js`

### Tools & Methods

- Static analysis: `tsc --noEmit` (exit 0), `eslint .` (exit 0, 48 warnings), `jest` (1 passed, **process exit 1**)
- Dependency analysis: `npm-check-updates`, `npm view <pkg> time.modified`, per-package import-site grep to detect unused dependencies
- Git forensics: `git log`, `git shortlog -sn`, `git ls-files` (lockfile tracking), commit-frequency-by-month
- Manual full reads of the data layer and state layer, with targeted greps for `any`, `console.*`, `@ts-ignore`, `TODO/FIXME/HACK`, `React.memo`/`useMemo`/`useCallback`, accessibility props, and i18n key parity (verified 309/309 in both locales via a Node script)
- Dead-code detection via a per-file reverse-import heuristic across `src/`, `App.tsx`, and `index.js`, with manual verification of each hit
