# Chart Editor V2 for Otofuda Format

Chart Editor V2 is a **Vue 3 + TypeScript** web application for creating and editing music charts in the Otofuda format. The application uses **Vite 8** for bundling, **Vuetify 4** for UI components, and **Vitest** for unit testing. Chart logic is organized into 8 Composition API composables.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Prerequisites and Setup
- Node.js 22.x is required (specified in `.node-version`)
- The project uses NPM for package management
- Vite 8 is used for bundling and development server

### Bootstrap and Build Process
```bash
cd /home/mtsgi/workspace/chart-editor
npm install        # Install dependencies
npm run build      # Production build (~1 second, very fast)
```

**BUILD TIMING**: Build completes in ~1 second due to Vite 8 + Rolldown. Never cancel mid-build.

### Development Server
```bash
npm run dev        # Starts dev server (or: npm run serve)
```
- **Local URL**: http://localhost:5173/ (Vite default)
- **Base Path**: `/chart-editor/` for GitHub Pages deployment (configured in `vite.config.ts`)

### Code Quality and Validation
```bash
npx tsc --noEmit   # TypeScript type checking (~2 seconds, 0 errors expected)
npx vitest run     # Run all 38 unit tests
```

**No ESLint config**: The project does not have a working ESLint setup. Use `npx tsc --noEmit` for type validation only.

### Production Build and Preview
```bash
npm run build    # Production build to ./dist/
npm run preview  # Serves production build locally
```

## Repository Structure

```
/home/mtsgi/workspace/chart-editor/
├── package.json              # NPM scripts and dependencies
├── vite.config.ts            # Vite 8 build configuration (ESM, base: '/chart-editor/')
├── vitest.config.ts          # Vitest test configuration (environment: jsdom)
├── tsconfig.json             # TypeScript configuration (strict: false, moduleResolution: bundler)
├── .node-version             # Node.js 22.x
├── src/
│   ├── App.vue               # Main application component (~1000 lines, <script setup>)
│   ├── main.ts               # Application entry point (createApp + vuetify)
│   ├── types.d.ts            # TypeScript type definitions (ExtendedNoteData, ColorObject, etc.)
│   ├── env.d.ts              # Vite client types + *.vue module declaration
│   ├── components/
│   │   ├── Preview.vue       # Chart preview / playback component
│   │   ├── Note.vue          # Single note rendering and editing
│   │   ├── LongNote.vue      # Long note (hold) rendering
│   │   ├── Measure.vue       # Musical measure component
│   │   ├── NoteShadow.vue    # Note shadow/ghost rendering
│   │   ├── ObjectBasedMeasure.vue  # Object-based measure editor
│   │   └── EndForm.vue       # Note endpoint controls (recursive)
│   ├── composables/
│   │   ├── injectionKeys.ts  # Typed InjectionKey<T> for provide/inject
│   │   ├── useNoteTypes.ts   # Note type constants and option generation
│   │   ├── useNoteCheck.ts   # Note validation and duplicate detection (pure functions)
│   │   ├── useChartData.ts   # Chart data, measureData, beatHeight reactive state
│   │   ├── useNoteEditor.ts  # Note staging, insertion, move, copy
│   │   ├── useSelection.ts   # Multi-note bulk selection and modification
│   │   ├── useFileIO.ts      # JSON read/write, audio file loading
│   │   ├── useTextureDB.ts   # Texture DB fetch and application
│   │   ├── useBackup.ts      # Backup save/restore and analysis
│   │   └── __tests__/        # Vitest unit tests (38 tests, Japanese test names)
│   └── plugins/
│       └── vuetify.ts        # Vuetify 4 createVuetify({...}) configuration
├── public/                   # Static assets (index.html, favicon, guide.mp3)
└── .github/
    └── workflows/
        └── build.yml         # GitHub Actions CI/CD (builds and deploys to GitHub Pages)
```

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `vue` | ^3.5.0 | Vue 3 framework |
| `vuetify` | ^4.0.0 | UI component library |
| `chart-types` | ^2.0.2 | Shared Otofuda chart data types (NoteData, etc.) |
| `vite` | ^8.0.10 | Build tool |
| `@vitejs/plugin-vue` | ^6.0.6 | Vue SFC support for Vite |
| `vite-plugin-vuetify` | ^2.0.0 | Vuetify 4 tree-shaking for Vite |
| `vitest` | ^4.x | Unit testing framework |
| `@vue/test-utils` | ^2.4.0 | Vue component testing utilities |
| `vue-tsc` | ^2.0.0 | TypeScript type checking for Vue SFCs |
| `typescript` | ^5.4.0 | TypeScript compiler |

## Architecture

### Composition API Pattern
All application logic is in `<script setup lang="ts">` components and composables. No Options API or mixins are used.

```ts
// App.vue — composable usage pattern
const chartData = useChartData()
const { chartObject, currentDifficulty, measureData, ... } = chartData
const { placeNotes, appendNotes, ... } = useNoteEditor(chartData, showSnackbar, scrollToMeasure)
const { readFile, readAudioFile, saveFile } = useFileIO(chartData, showSnackbar)
```

### Provide/Inject with Typed Keys
Child components receive callbacks via typed `InjectionKey<T>` (defined in `injectionKeys.ts`), not string keys:

```ts
// App.vue
provide(deleteNotesKey, deleteNotes)
provide(showSnackbarKey, showSnackbar)

// Note.vue / Measure.vue
const deleteNotes = inject(deleteNotesKey)!
```

### Chart Data Format (Otofuda)
- Five difficulty levels: `raku`, `easy`, `normal`, `hard`, `extra`
- Each difficulty is a `NoteData[]` array
- Note fields: `type`, `lane` (1–4 as `LaneType`), `measure`, `position`, `split`, `option[]`, `end[]`
- Chart metadata in `chartObject.value.info`: `version`, `bpm`, `beat`, `offset`

## Vuetify 4 Patterns

### Activator slot (v-menu, v-tooltip, v-dialog)
```html
<!-- CORRECT (Vuetify 4) -->
<v-menu>
  <template v-slot:activator="{ props }">
    <v-btn v-bind="props">Open</v-btn>
  </template>
</v-menu>

<!-- WRONG (Vuetify 2 - do not use) -->
<template v-slot:activator="{ on, attrs }">
  <v-btn v-bind="attrs" v-on="on">Open</v-btn>
</template>
```

### File input change event
```html
<!-- CORRECT: use @update:model-value, not @change -->
<v-file-input @update:model-value="readFile" />
```
`readFile` receives `File | File[] | null | undefined` (not a DOM Event).

### Sparkline
```html
<!-- CORRECT (Vuetify 4) -->
<v-sparkline :model-value="values" :smooth="3" />

<!-- WRONG (Vuetify 2) -->
<v-sparkline :value="values" smooth="3" />
```

### Removed / renamed props
- `v-menu` does NOT support `rounded` prop — use CSS class instead
- `:menu-props="{ rounded: 'lg' }"` → `:menu-props="{}"`
- `v-badge :value` → `:model-value`
- `hide-details=""` → `hide-details` (boolean attribute)
- `v-tabs-items` / `v-tab-item` → `v-window` / `v-window-item`
- `v-simple-table` → `v-table`
- `v-list-item-content` → removed (children go directly inside `v-list-item`)
- `v-expansion-panel-header` → `v-expansion-panel-title`
- `v-expansion-panel-content` → `v-expansion-panel-text`
- `background-color=` (v-text-field) → `bg-color=`

## Common Pitfalls

### structuredClone with Vue reactive objects
Vue reactive objects are Proxy instances. `structuredClone(reactiveObj)` throws `DOMException: Proxy object could not be cloned`.

```ts
// CORRECT: unwrap Proxy before cloning
import { toRaw } from 'vue'
structuredClone(toRaw(note))

// WRONG
structuredClone(note)  // note is a reactive Proxy → DOMException
```

### TypeScript: LaneType cast in tests
`lane` must be typed as `LaneType` (not `number`) in test fixtures:
```ts
import { type LaneType } from 'chart-types'
const note = { lane: 1 as LaneType, ... }
```

### ESM config files (vite.config.ts, vitest.config.ts)
`__dirname` is not available in ESM. Use:
```ts
import { fileURLToPath, URL } from 'node:url'
'@': fileURLToPath(new URL('./src', import.meta.url))
```

## Validation After Changes

Run the complete validation sequence after any change:
```bash
npx tsc --noEmit        # Must produce 0 errors
npx vitest run          # Must show 38 tests passed
npm run build           # Must succeed
```

### Manual Testing Scenario (after `npm run dev`)
1. Navigate to http://localhost:5173/chart-editor/
2. Change BPM → verify "現在のハイスピードの速度値" updates
3. Click "ノートを仮配置" → verify note appears as "#1" in preview
4. Click "挿入する" → verify note is committed (no Proxy DOMException in console)
5. Switch difficulty levels (RAKU/EASY/NORMAL/HARD/EXTRA) → verify separate note tracks

## Build Warnings (Expected)
The build produces Sass deprecation warnings from Vuetify internals. These are **harmless**:
```
⚠ Module Warning: Deprecation Warning: Using / for division outside of calc() is deprecated
```

## External Resources (May Fail in Restricted Environments)
These failures do NOT break the app:
- Google Fonts (fonts.googleapis.com)
- Material Design Icons (cdn.jsdelivr.net)
- Otofuda chart assets (otofuda.github.io)
- Texture database (otofuda.microcms.io)

Always run the complete validation scenario after making any changes to ensure the chart editing functionality works correctly.