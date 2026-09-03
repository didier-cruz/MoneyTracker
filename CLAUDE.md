# MoneyTracker

## Overview

Offline-first personal finance tracker for iOS and Android. Users record income and expenses against accounts, move money between accounts (transfers), budget with envelopes and per-category monthly limits, and view analytics on where their money goes.

**There is no backend.** No API, no authentication, no network requests, no user accounts. Everything lives in a local SQLite database on the device. Treat any suggestion involving a server, a session, or a remote fetch as out of scope unless explicitly asked for.

The app is bilingual (English / Spanish) via i18next, with full key parity between locales.

## Tech Stack

- **Language:** TypeScript 5.0.4, `strict: true` (passes clean — keep it that way)
- **Framework:** React Native 0.77, **New Architecture enabled** (`newArchEnabled=true`), Hermes
- **UI runtime:** React 18.3.1
- **Database:** SQLite via `react-native-sqlite-storage` 6.0.1 (legacy bridge module — see Areas of Caution)
- **Navigation:** React Navigation 7 (drawer → bottom tabs → stacks → material top tabs)
- **i18n:** i18next 26 + react-i18next 17, language persisted in AsyncStorage
- **Charts:** `react-native-gifted-charts`
- **Testing:** Jest 29 with the `react-native` preset
- **Package manager:** Yarn (`nodeLinker: node-modules`)

## Getting Started

### Prerequisites

- Node >= 18 (developed against v20)
- Yarn
- Ruby + Bundler (CocoaPods is managed via the `Gemfile`)
- Xcode (iOS) / Android Studio + JDK 17 (Android)

### Setup

```bash
yarn install

# iOS only
bundle install
cd ios && bundle exec pod install && cd ..

# Run
yarn start            # Metro
yarn ios              # or: yarn android
```

### Environment Variables

**None.** There is no `.env`, no `.env.example`, and no runtime configuration. The only external-ish value in the codebase is a hardcoded Firebase Storage image URL for the drawer avatar (`src/navigation/DrawerNav/CustomDrawer.tsx:31`), which should be replaced with a bundled asset.

## Common Commands

| Command | Description |
|---------|-------------|
| `yarn start` | Start the Metro bundler |
| `yarn android` | Build and run on an emulator/device — **the only platform that currently runs** |
| `yarn ios` | Compiles, but the app shows a blank screen — see Known Issues |
| `yarn test` | Run all tests — **currently exits 1 even when tests pass** (see Known Issues) |
| `npx jest __tests__/App-test.tsx` | Run a single test file |
| `yarn lint` | ESLint (`@react-native` config) — currently 0 errors, 48 warnings |
| `npx tsc --noEmit` | Type check — **currently passes; there is no `typecheck` script yet, add one** |
| `npx prettier --write "src/**/*.{ts,tsx}"` | Format (no `format` script exists) |
| `cd ios && bundle exec pod install` | Reinstall native iOS pods after a dependency change |
| `cd android && ./gradlew clean` | Clean Android build artifacts |

There is **no build/release script, no CI pipeline, and no migration CLI** — schema migrations run automatically at app startup (see Architecture).

## Project Structure

```
├── index.js                 Entry point — imports @i18n FIRST (order matters, see below)
├── App.tsx                  Registers icons, hydrates language, calls initDatabase()
├── src/
│   ├── components/          Atomic design
│   │   ├── atoms/           Text, Card, Spacer, containers, indicators, items
│   │   ├── molecules/       Cards, Headers, Selects
│   │   ├── organisms/       Charts, Lists, feedback (ActionSheet/BottomSheet/ConfirmDialog)
│   │   └── templates/       ScreenTemplate, FragmentSection
│   ├── screens/             One folder per screen + local partials/ + mappers.ts
│   ├── hooks/               One use<Screen>Screen / use<Entity>Form hook per screen
│   ├── db/                  The ONLY place SQL exists
│   │   ├── db.ts            Connection singleton + migration runner
│   │   ├── creation/        v1 schema (DbTables)
│   │   ├── migrations/      002–005, version-gated on PRAGMA user_version
│   │   └── queries/         All read/write functions, one file per domain
│   ├── navigation/          Drawer → HomeBottomTabs → StackNav → top tabs
│   ├── constants/           colors, dimensions, global styles
│   ├── utils/               currency (cents math), dateFormat, responsive
│   ├── i18n/                config + locales/{en,es}.json
│   ├── interfaces/          common.d.ts — GLOBAL ambient types (no import needed)
│   ├── context/             ThemeContext — DEAD, see Known Issues
│   ├── layout/ playground/  DEAD, see Known Issues
│   └── data/                Static icon list used by the icon pickers
├── __tests__/               One smoke test
├── __mocks__/               Hand-written SQLite driver mock
├── android/  ios/           Native projects
```

### Key Directories

- `src/db/queries/` — every SQL statement in the application. Nothing outside this directory should contain SQL.
- `src/hooks/` — every data fetch and mutation. Screens never call `@db/queries` directly.
- `src/screens/*/mappers.ts` — pure functions converting DB rows into component-shaped view models.
- `src/interfaces/common.d.ts` — ambient global types (`ICategory`, `TransactItem`, `CatalogCard`, `IDrawer`, …). These are available everywhere without an import; check here before defining a new shared shape.

## Architecture

### Patterns

**Screen / Hook / Mapper / Query.** This is the load-bearing convention and it holds everywhere:

```
Screen (.tsx)        renders; owns only local UI state (modals, dialogs)
  └─ use<Screen>()   owns data fetching, mutations, loading/error status
       └─ @db/queries   owns SQL
  └─ mappers.ts      pure DB-row → view-model transforms
```

Follow it for any new screen. Do not call `@db/queries` from a component, and do not put SQL anywhere but `src/db/queries/`.

### Data Flow

1. `index.js` imports `@i18n` **before anything else** — this ordering is deliberate and load-bearing. Importing it later meant tab labels rendered as raw keys (`resumen.title`) on cold start. Do not reorder.
2. `App.tsx` registers FontAwesome icons, hydrates the stored language, then `await initDatabase()`.
3. `initDatabase()` opens the shared connection, sets `PRAGMA foreign_keys = ON`, and runs every migration whose version exceeds `PRAGMA user_version`.
4. Each screen's hook fires `useFocusEffect` and re-queries SQLite.

**There is no cache and no invalidation bus.** Freshness depends entirely on `useFocusEffect` refiring when a screen regains focus. `FormScreen` navigates to `'Resumen'` after saving specifically to force that focus event (`src/screens/FormScreen/FormScreen.tsx:82-86`). If you add a mutation, think about which screens need to see it and how they will find out.

### Key Abstractions

- **`getDbConnection()`** (`src/db/db.ts:83`) — the shared `SQLiteDatabase` singleton. Open it through this; never call `openDatabase` directly, and never call `.close()` on the returned handle (use `closeDbConnection`, for teardown/tests only).
- **`isFiniteInteger()`** (`src/db/queries/numberGuards.ts`) — must be called on every caller-supplied money value before it reaches SQL. Every existing write path does this; new ones must too.
- **`@utils/currency`** — `parseAmountToCents`, `parseInitialBalanceToCents`, `formatCentsToCurrency`. All money conversion goes through here.
- **`useNoticeDialog`** (`src/hooks/useNoticeDialog.ts`) — the shared success/error dialog state, reused by every form hook.
- **`ScrollContainer`** (`src/components/atoms/containers/ScrollContainer/`) — the scroll wrapper that allows nested `FlatList`/`SectionList`. Read its doc comment before touching it; the `ListHeaderComponent`-as-element detail fixes a real keyboard-dismissal bug.
- **`ScreenTemplate`** — the standard screen shell used by 5 screens.

### Database Schema

Six tables. Money is **always signed integer cents**, never a float, never dollars.

| Table | Purpose | Notes |
|---|---|---|
| `accounts` | cash / bank / credit_card / receivable | balance = `initialBalance + SUM(finances.amount)`, **derived, never stored** |
| `finances` | every transaction and transfer leg | `amount` signed (+in/−out); `idCategory` NULL for transfer legs; `transferGroupId` shared by exactly 2 rows |
| `categories` | income / expense categories | 11 seeded by migration 003 |
| `envelopes` | fund / debt budget envelopes | balance = `SUM(envelope_movements.amount)`, **derived** |
| `envelope_movements` | assign / withdraw against an envelope | signed, `CHECK (amount <> 0)` |
| `category_budgets` | monthly spend ceiling per category | `UNIQUE (idCategory, period)`, period is `'YYYY-MM'` |

Dropped by migrations and no longer present: `types` (v2), `icons` (v3).

Fourteen indexes exist, each mapped to a specific query — read the migration files before adding one, they are documented.

### Adding a Migration

1. Create `src/db/migrations/00N_description.ts` exporting a `string[]` of statements.
2. Register it in the `migrations` array in `src/db/db.ts` with an incremented `version`.
3. **Never edit a migration that has already shipped** — installs that already ran it will not re-run it, silently diverging old and new installs.
4. Each statement is executed individually (`executeSql` compiles only the first statement of a string).
5. Prefer `IF NOT EXISTS` and idempotent guards — the migration runner is not currently transactional (see Known Issues).

## Conventions

### Code Style

- **Money is integer cents everywhere.** Never `parseFloat` an amount, never `amount * 100`. Use `@utils/currency`.
- **All SQL values are bound `?` parameters.** The only acceptable interpolation into SQL is a column name drawn from a hardcoded whitelist.
- **Balances are derived, never stored.** Do not add a `balance` column to `accounts` or `envelopes`.
- **Every hook exposes `status` + `errorMessage`;** every screen renders loading / error+retry / success.
- **Prettier config:** single quotes, no bracket spacing, trailing commas, `arrowParens: 'avoid'`, `bracketSameLine: true`.
- **Path aliases** are declared in *both* `tsconfig.json` and `babel.config.js` — adding one means editing both. Available: `@components @constants @data @hooks @assets @context @api @screens @utils @icons @navigation @db @i18n`.
- **`react-native-reanimated/plugin` must be the last entry** in `babel.config.js` plugins. Moving it broke drawer and tab rendering once already.
- **Extensive doc comments are the house style.** Non-obvious decisions carry a written rationale explaining what was tried and rejected. Match this when you change something non-obvious — and read the existing comment before overriding a choice, it usually explains itself.

### File Naming

- Components: `PascalCase/PascalCase.tsx` with a sibling `index.ts` barrel (`export {X} from './X'`), plus optional `types.ts` / `styles.ts`.
- Hooks: `camelCase.ts` (`useAccountsScreen.ts`).
- Screen-local sub-components live in `partials/`.
- Feature-scoped navigation/screen folders use bracket names: `[home]`, `[categories]`, `[accounts]`, `[budgets]`.
- `src/components/` uses **named** exports; `src/screens/` inconsistently uses `export default`. Prefer named exports for new code.

### Git Conventions

Conventional Commits with a scope, message body in Spanish for recent work:
`feat(budgets): sobres y limites mensuales por categoria`, `fix(nav): barra de tabs mas baja y FAB centrado de verdad`

Scopes in use: `db`, `ui`, `nav`, `i18n`, `form`, `budgets`, `accounts`, `categories`, `analytics`, `dashboard`, `balance`, `chore`.

Work happens on feature branches (`feat/core-features-and-i18n`) and merges to `main`.

## Known Issues & Caveats

See `PROJECT_EVALUATION.md` for the full audit. The ones that will bite you while working:

- **`yarn test` exits 1 even when tests pass.** A `Batchinator` timer from `@react-native/virtualized-lists` fires after Jest tears down the environment and crashes Node. Any CI added today fails on its first run for this reason alone.
- **No backup, export, or encryption.** All financial data sits in one unencrypted SQLite file with `android:allowBackup="false"`. Device loss means total data loss.
- **Release builds are signed with the debug keystore** (`android/app/build.gradle:109-113`). Cannot be shipped as-is.
- **`targetSdkVersion` is 34**, below the current Play Store floor. `compileSdkVersion` is 35.
- **Periods are bucketed in UTC, not local time.** `periodToRange` (`src/db/queries/period.ts:32-47`) and every `dateCreated` are UTC, but the display layer groups by *local* date (`src/utils/dateFormat.ts:60-68`). A non-UTC user's late-evening transaction can land in the next month's budget.
- **Out-of-order response race.** `loadFinances(accountId)` writes results unconditionally with no check that the selection is still current — `src/hooks/useAccountsScreen.ts:105-127` and `src/hooks/useCategoriesScreen.ts:119-141`. Fast-tapping accounts can show the wrong list.
- **No unmount guards anywhere.** No `isMounted`, no `AbortController`, in any hook.
- **Background-refetch and pagination failures are invisible.** Suppressed to `console.warn` by design; the user sees stale data or a list that stops growing, with no indication.
- **Effectively zero test coverage.** One smoke test for 240 source files. Money math, queries, and migrations are all untested.
- **No CI.** `eas.json` exists but is a 0-byte file.
- **Dead code still in the tree:** `src/playground/`, `src/context/ThemeContext/` (its palette is literal placeholders — `primary: 'red'`, `text: 'pink'`), `src/layout/Component/`, `src/screens/FirstRun.tsx`, `src/components/atoms/items/CategoryItem/`, `src/navigation/[home]/HomeBottomTabs/CustomTabBarButton.tsx`, `src/data/varOutcomes.ts`. `src/screens/DashboardScreen/` is a placeholder but is a *live registered route*.
- **Unused dependencies:** `add`, `yarn`, `react-native-virtualized-view`, `react-native-modal`, `react-native-linear-gradient`, `@fortawesome/free-regular-svg-icons`. Also `library.add(fab, ...)` in `src/icons/index.ts` bundles ~450 brand icons, none of which are used.
- **Zero `React.memo` in the codebase** despite 55 `useCallback`s — those callbacks currently buy nothing. Mappers are also called inline in JSX rather than memoized.
- **Mixed Spanish/English** comments, identifiers, and screen names throughout.

## Tribal Knowledge

Things that are true, cost real time to discover, and are not visible anywhere in the code.

### The quality gates do not tell you whether the app works

For months after the RN 0.77 upgrade, `tsc`, ESLint and Jest were all green while **the app did not launch at all** — the database layer created exactly one of its four tables and the error was swallowed by a `console.log`. Every serious bug found since was found by running the app, never by a gate: a header silently dropping words, a nested VirtualizedList, a button that had never once responded to a tap, a keyboard that closed after one digit.

**Verify on the Android emulator before claiming anything works.** `adb exec-out screencap -p > shot.png` for a look, `adb shell uiautomator dump` when you need to know whether a specific element is focused, enabled or on-screen. Pulling the database is often faster than reading through the UI:

```bash
adb shell run-as com.moneytracker cat databases/moneytracker.db > /tmp/mt.db
sqlite3 /tmp/mt.db "PRAGMA user_version; SELECT * FROM accounts;"
```

### iOS does not run

It compiles and installs, then shows a blank screen with `RCTEventEmitter.receiveEvent … Module has not been registered as callable`. An ErrorBoundary catches nothing, so no JS is throwing. The Babel/Reanimated plugin-order fix was applied and **confirmed not to be the cure** — Android works with that same fix in place. Do not assume an iOS build succeeded because the command exited 0: piping `xcodebuild` through `tail` returns tail's exit status and hides the failure.

### The design prototypes are not the source of truth for color

The HTML prototypes in the design scratchpad were drawn with a **white tab bar; the app's is indigo, and the app is right**. Three more places where the prototype was deliberately not followed, because following it would have reintroduced a contrast problem: the tab bar, the primary button (2.65:1) and the per-movement date (1.74:1). Do not "fix" the app to match the prototype in those four places.

### `@redshank/native` was removed, and why

The UI library is gone as of the `refactor(ui)` commits. It caused four silent failures — `Text` applied `numberOfLines` after spreading props so only its own `lines` prop worked; `style` went to the inner text while `containerStyle` went to the outer view; `Card isPressable` wrapped children in a ripple with `pointerEvents="box-only"` that discarded every nested touch; and its `Modal` drew its close button with an Ionicons glyph this app does not register. Its replacements live in `src/components/atoms/{text/Text,text/Title,Card,SegmentedControl}` and `src/components/organisms/feedback/`. `useTheme()`/`ThemeProvider` went with it — `@constants/colors` is now the only source of color.

### Open product decisions, never validated with the owner

Implemented one way, but nobody has signed off: an envelope **sets money aside** rather than moving it between accounts; over-allocating **warns rather than blocks**; the third analytics user story was interpreted, not specified; currency is fixed to `en-US` regardless of the UI language. Several color tokens (`accent[3]`, `primary[1]`, `info[1]`, `overlay`, `text`) were added out of necessity while removing the old theme, not chosen by design.

### Deliberately dormant code

`PieChart` (`src/components/organisms/Charts/PieChart/`) is wired to real data via `mapCashFlowToPieChart` but **commented out** in `ResumenScreen`: with realistic data the savings slice is invisible next to income and expense. It is kept on purpose, not dead code — uncomment the block and its two imports to bring it back.

## Areas of Caution

- `src/db/db.ts` — the migration runner. Changing the ordering, the `user_version` gating, or the `PRAGMA foreign_keys` placement affects every existing install's data. Read the file's doc comments first; they explain why each line is where it is. Each migration now runs inside one `db.transaction()` with its `user_version` bump, so it commits whole or rolls back whole. Two consequences: the transaction scope must stay **synchronous** (same trap as the transfer insert below), and a `PRAGMA foreign_keys` toggle can never go in a migration's statement list — SQLite ignores it inside a transaction. Use the `requiresForeignKeysOff` flag instead.
- `src/db/migrations/*` — **never edit a shipped migration.** Add a new one.
- `src/db/queries/transfersQueries.ts:260-279` — the transfer insert's transaction callback is **deliberately synchronous**. Adding an `await` between the two `tx.executeSql` calls lets leg A commit alone, creating money out of nothing. The reasoning is documented at lines 153-174.
- `babel.config.js` — the reanimated plugin must stay last. This has broken the app before.
- `index.js` — `import '@i18n'` must stay first.
- `src/components/atoms/containers/ScrollContainer/ScrollContainer.tsx` — the `ListHeaderComponent` must be passed as a JSX *element*, not a function. Passing a function remounts the whole subtree every render and drops keyboard focus mid-typing.
- `jest.config.js` `transformIgnorePatterns` — any new node_modules package published as untranspiled ESM/TS must be added here or Jest fails with a `SyntaxError`.
- `react-native-sqlite-storage` — ships no TurboModule spec while `newArchEnabled=true`, so the entire persistence layer runs through the legacy interop layer. Migrating to `op-sqlite` or `expo-sqlite` is the long-term plan; treat any change here as high-risk.
- `src/constants/dimensions/Dimensions.ts` — captures screen size once at module load. Values never update on rotation or fold. Prefer `useWindowDimensions()` in new code.
- `src/hooks/useAnalysisScreen.ts:53-88` — issues one query per fund envelope on every screen focus. Do not add more per-item queries here.

## External Services & Integrations

Effectively none — this is a fully offline application.

| Service | Purpose | Config Location |
|---------|---------|-----------------|
| Firebase Storage (public URL) | Hardcoded drawer avatar image — the only network request the app makes | `src/navigation/DrawerNav/CustomDrawer.tsx:31` |
| Device AsyncStorage | Persists the selected language only | `src/i18n/index.ts` (`@moneytracker/language`) |
| Local SQLite | All application data | `moneytracker.db`, opened in `src/db/db.ts` |

The `INTERNET` permission in `android/app/src/main/AndroidManifest.xml:3` exists solely for that one avatar image; replacing it with a bundled asset would let the app drop the permission entirely.
