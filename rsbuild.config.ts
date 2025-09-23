import { defineConfig } from '@rsbuild/core'
import { pluginVue2 } from '@rsbuild/plugin-vue2'
import { pluginSass } from '@rsbuild/plugin-sass'
import { VuetifyLoaderPlugin } from 'vuetify-loader'

export default defineConfig({
  plugins: [pluginVue2(), pluginSass()],
  source: {
    entry: {
      index: './src/main.js'
    }
  },
  html: {
    template: './public/index.html'
  },
  server: {
    base: '/chart-editor/',
  },
  output: {
    assetPrefix: '/chart-editor/'
  },
  tools: {
    rspack: (config, { appendPlugins }) => {
      appendPlugins([new VuetifyLoaderPlugin()])
    }
  }
})
