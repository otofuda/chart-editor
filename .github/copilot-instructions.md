# Chart Editor V2

Chart Editor V2 is a Vue 2.6.11 + TypeScript + Vuetify 2.x web application for creating and editing charts for the Otofuda format (Japanese music game charts). The application is a single-page application that runs in the browser and allows users to create, edit, and export chart files in JSON format.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Bootstrap, build, and test the repository:
- Install dependencies: `yarn install` -- takes 30-60 seconds (clean install). NEVER CANCEL. Set timeout to 120+ seconds.
- Build for production: `yarn build` -- takes 20-25 seconds. NEVER CANCEL. Set timeout to 60+ seconds.
- Run linter: `yarn lint` -- takes 2-3 seconds. Always run this before committing changes.
- Start development server: `yarn serve` -- takes 15-20 seconds to start. NEVER CANCEL. Set timeout to 60+ seconds.

### Running the application:
- Development: `yarn serve` then navigate to `http://localhost:8080/chart-editor/`
- The development server runs on port 8080 with the path `/chart-editor/` (configured in vue.config.js)
- Production build outputs to `dist/` directory
- The application is deployed to GitHub Pages at https://otofuda.github.io/chart-editor/

### Environment requirements:
- Node.js 20.16.0 (specified in .node-version and package.json volta config)
- Yarn 1.22.22+ package manager
- Modern web browser for testing (no headless browser testing available)

## Validation

### Manual validation requirements:
- ALWAYS manually validate any new code by running the development server and testing in a browser
- ALWAYS run through at least one complete end-to-end scenario after making changes:
  1. Start the dev server with `yarn serve`
  2. Navigate to `http://localhost:8080/chart-editor/`
  3. Verify the Chart Editor V2 interface loads correctly
  4. Test basic functionality: change difficulty (RAKU/EASY/NORMAL/HARD/EXTRA buttons)
  5. Test note insertion: select note type, set measure/position, click "ノートを仮配置" (Add note to staging)
  6. Test file operations: use "名前をつけて保存" (Save as) to export a chart
  7. Verify the chart preview area displays correctly on the right side
- You can build and run the application successfully but cannot interact with automated UI testing
- Always run `yarn lint` before committing or the CI (.github/workflows/build.yml) will fail

### CI/CD validation:
- GitHub Actions workflow (.github/workflows/build.yml) builds and deploys to gh-pages
- Workflow runs on push to master branch
- Uses Node.js 20.x, caches node_modules, runs `yarn install` and `yarn build --mode=production`
- Build artifacts are deployed to gh-pages branch

## Common tasks

### Development workflow:
1. Make code changes in src/ directory
2. Test locally with `yarn serve` 
3. Run `yarn lint` to check for issues
4. Run `yarn build` to verify production build works
5. Manually test the application functionality
6. Commit changes (CI will automatically deploy if on master branch)

### Key directories and files:
- `src/App.vue` - Main application component with chart editing logic
- `src/components/` - Vue components (Note, Measure, Preview, etc.)
- `src/mixins/` - Reusable mixins (noteTypes.ts, noteCheck.ts)
- `src/types.d.ts` - TypeScript type definitions
- `public/` - Static assets (index.html, favicon, audio files)
- `vue.config.js` - Vue CLI configuration (sets publicPath to "/chart-editor/")
- `.github/workflows/build.yml` - CI/CD configuration

### Important project details:
- Uses Vuetify 2.x for UI components (Material Design)
- Chart data format based on "chart-types" package version 2.0.2
- Supports 5 difficulty levels: raku, easy, normal, hard, extra
- Supports multiple note types: normal, long, flick (left/right/up/down), sound notes
- Exports charts as JSON files compatible with Otofuda format
- Japanese UI language (interface text in Japanese)
- No unit tests - rely on manual testing only

### Troubleshooting:
- If yarn install fails: Ensure Node.js 20.16.0 is installed
- If build warnings about deprecated Sass API: These are expected from Vuetify 2.x dependencies
- If development server fails to start: Check that port 8080 is available
- If application doesn't load: Verify you're accessing `/chart-editor/` path, not just `/`
- Build asset size warnings are expected due to Vuetify bundle size

### Common commands reference:
```bash
# Development
yarn serve              # Start dev server (15-20s)
yarn build             # Production build (20-25s) 
yarn lint              # Run ESLint (2-3s)

# Installation
yarn install           # Install dependencies (30-60s clean install)

# Verification
curl http://localhost:8080/chart-editor/  # Test dev server (should return 200)
ls -la dist/           # Check build output
```

### Final validation checklist:
After making any changes, ALWAYS perform these validation steps:
1. `yarn lint` - Ensure no linting errors
2. `yarn build` - Ensure production build succeeds
3. `yarn serve` - Start development server
4. Navigate to `http://localhost:8080/chart-editor/` - Verify app loads
5. Test basic chart editor functionality (select difficulty, add notes)
6. Verify no console errors in browser developer tools

### Build timing expectations:
- `yarn install`: 30-60 seconds (clean install) - NEVER CANCEL, use 120+ second timeout
- `yarn build`: 20-25 seconds - NEVER CANCEL, use 60+ second timeout  
- `yarn serve`: 15-20 seconds to start - NEVER CANCEL, use 60+ second timeout
- `yarn lint`: 2-3 seconds - use 30+ second timeout

Always wait for builds to complete fully. The Sass deprecation warnings are expected and do not indicate build failure.