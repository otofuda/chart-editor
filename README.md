# Chart Editor V2

[![build production](https://github.com/otofuda/chart-editor/actions/workflows/build.yml/badge.svg)](https://github.com/otofuda/chart-editor/actions/workflows/build.yml)

![license](https://flat.badgen.net/badge/license/MIT/green)
![commits](https://flat.badgen.net/github/commits/otofuda/chart-editor)
![last-commit](https://flat.badgen.net/github/last-commit/otofuda/chart-editor)

Chart editor (v2) for Otofuda format — built with **Vue 3 + Vite 8 + Vuetify 4 + TypeScript**.

### Open the App

[https://otofuda.github.io/chart-editor/](https://otofuda.github.io/chart-editor/)

### Compiles and hot-reloads for development

```sh
npm install
npm run dev
```

### Compiles and minifies for production

```sh
npm run build
```

### Run unit tests

```sh
npx vitest run
```

### Type checking

```sh
npx tsc --noEmit
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `/chart-editor/` | Base path for the application (e.g. `/` for local, `/chart-editor/` for GitHub Pages) |

```sh
BASE_URL=/ npm run dev     # Run locally at http://localhost:5173/
npm run build              # Build with default base /chart-editor/
BASE_URL=/ npm run build   # Build with base /
```

