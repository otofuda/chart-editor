# Chart Editor V2 for Otofuda Format

Chart Editor V2 is a Vue.js 2.7 + TypeScript web application for creating and editing music charts in the Otofuda format. The application uses RSBuild (replacement for Webpack/Vue CLI), Vuetify 2.x for UI components, and provides a comprehensive chart editing interface with note placement, timing controls, and multiple difficulty levels.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Prerequisites and Setup
- Node.js 22.x is required (specified in .node-version file and volta config)
- The project uses NPM for package management
- RSBuild is used for bundling (modern replacement for Vue CLI/Webpack)

### Bootstrap and Build Process
Run these commands in sequence:
```bash
cd /home/runner/work/chart-editor/chart-editor
npm install  # Takes ~17 seconds, ignore deprecation warnings
npm run build  # Takes ~5 seconds - FAST BUILD. NEVER CANCEL
```

**BUILD TIMING**: Build is very fast (~5 seconds) due to RSBuild. No special timeout needed.

### Development Server
```bash
npm run serve  # Starts dev server in ~3 seconds
```
- **Local URL**: http://localhost:3000/chart-editor/
- **NEVER CANCEL**: Dev server starts quickly (~3 seconds) but keep it running for testing
- **Base Path**: Application is configured to run under `/chart-editor/` path (for GitHub Pages deployment)

### Code Quality and Validation
```bash
npx tsc --noEmit  # TypeScript type checking - WORKS, takes ~2 seconds
```

**ESLint Issues**: The project has ESLint configured but missing TypeScript config. ESLint fails with:
```
Error: ESLint couldn't find the config "@vue/typescript" to extend from
```
Do NOT attempt to fix ESLint configuration unless specifically needed. TypeScript checking works fine with `npx tsc --noEmit`.

### Production Build and Preview
```bash
npm run build    # Production build - ~5 seconds
npm run preview  # Serves production build on http://localhost:3000/chart-editor/
```

## Validation Scenarios

### Essential User Workflow Testing
After making changes, ALWAYS test this complete scenario:

1. **Start the application**: `npm run serve` and navigate to http://localhost:3000/chart-editor/
2. **Modify chart settings**: 
   - Change BPM from 120 to 140 (should update "現在のハイスピードの速度値" immediately)
   - Change difficulty level using the colored buttons (RAKU/EASY/NORMAL/HARD/EXTRA)
3. **Place notes**:
   - Click "ノートを仮配置" (Place note temporarily)
   - Verify heading changes to "ノートの挿入（仮配置：1個）"
   - Verify note appears in preview area as "#1"
   - Click "挿入する" (Insert) to commit notes
4. **Verify UI responsiveness**: All controls should respond immediately

### Expected Application Behavior
- **Chart data persistence**: Changes to BPM, difficulty, and notes should persist during the session
- **Real-time preview**: Note placement appears immediately in the preview area
- **Multi-difficulty support**: Five difficulty levels with separate note tracks
- **Audio integration**: Audio file upload and volume controls (external audio loading may fail in restricted environments)

## Common Tasks

### Repository Structure
```
/home/runner/work/chart-editor/chart-editor/
├── README.md
├── package.json              # NPM scripts and dependencies
├── rsbuild.config.ts         # Build configuration
├── tsconfig.json            # TypeScript configuration
├── vue.config.js            # Legacy Vue CLI config (still used)
├── babel.config.js          # Babel configuration
├── .node-version            # Node.js 22.19.0
├── src/
│   ├── App.vue             # Main application component (~65KB, complex)
│   ├── main.ts             # Application entry point
│   ├── types.d.ts          # TypeScript type definitions
│   ├── env.d.ts            # Environment type definitions
│   ├── components/         # Vue components
│   │   ├── Preview.vue     # Chart preview component (31KB)
│   │   ├── Note.vue        # Note rendering
│   │   ├── Measure.vue     # Musical measure component
│   │   └── EndForm.vue     # Note ending controls
│   ├── mixins/            # Vue mixins
│   │   ├── noteTypes.ts   # Note type definitions and options
│   │   └── noteCheck.ts   # Note validation logic
│   └── plugins/
│       └── vuetify.ts     # Vuetify configuration
├── public/                # Static assets
│   ├── index.html
│   ├── favicon.png
│   ├── logo.png
│   ├── guide.mp3          # Audio guide file
│   └── manifest.webmanifest
└── .github/
    └── workflows/
        └── build.yml      # GitHub Actions CI/CD
```

### NPM Scripts Reference
```bash
npm run serve    # Development server with hot reload
npm run build    # Production build to ./dist/
npm run preview  # Serve production build locally
```

### Key Application Features
- **Multi-difficulty editing**: Supports 5 difficulty levels (RAKU, EASY, NORMAL, HARD, EXTRA)
- **Note types**: Multiple note types including normal notes, long notes, special effects
- **BPM and timing controls**: Real-time BPM changes, offset settings, beat subdivision
- **Preview system**: Live preview of chart with visual note placement
- **File operations**: JSON import/export for chart data
- **Audio integration**: Music file upload with volume controls and playback

### Build Warnings (Expected)
The build produces extensive Sass deprecation warnings from Vuetify components (~200+ warnings):
```
⚠ Module Warning: Deprecation Warning on line X: Using / for division outside of calc() is deprecated
⚠ Module Warning: Global built-in functions are deprecated and will be removed in Dart Sass 3.0.0
```
These warnings are **EXPECTED and HARMLESS** - they come from Vuetify 2.x dependencies, not the application code. The build succeeds despite these warnings.

### External Dependencies Note
The application attempts to load external resources that may fail in restricted environments:
- Google Fonts (fonts.googleapis.com)
- Material Design Icons (cdn.jsdelivr.net)
- Chart assets (otofuda.github.io)
- Texture database (otofuda.microcms.io)

These failures do NOT prevent the application from functioning - they only affect visual styling and optional features.

### Browser Console Warnings (Expected)
These console warnings are normal and do not indicate problems:
```
[WARNING] [Vuetify] Translation key "noDataText" not found, falling back to default
[WARNING] [Vuetify] Translation key "badge" not found, falling back to default
TypeError: Failed to fetch (from external API calls)
```

## Important Notes for Development

### Chart Data Format
The application works with Otofuda format charts containing:
- Five difficulty levels: raku, easy, normal, hard, extra
- Note timing in measures/beats with precise positioning
- Special note types with customizable options (speed, orbit, width, etc.)
- Chart metadata: version, BPM, beat signature, offset

### Key Files for Common Changes
- **src/App.vue**: Main application logic, chart editing, note placement (~1200 lines)
- **src/types.d.ts**: Type definitions for chart data structures
- **src/mixins/noteTypes.ts**: Note type configurations and options
- **rsbuild.config.ts**: Build configuration, base path, asset handling
- **package.json**: Dependencies, scripts, project metadata

### TypeScript Configuration
The project uses TypeScript with relaxed settings (`"strict": false`) for Vue 2.x compatibility. Type checking is available but not enforced strictly.

### Vue.js Version
Uses Vue 2.7 (latest Vue 2.x) with Composition API backport, not Vue 3. Component syntax and patterns follow Vue 2.x conventions.

Always run the complete validation scenario after making any changes to ensure the chart editing functionality works correctly.