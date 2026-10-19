import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './schemaTypes/index.js'

export default defineConfig({
  name: 'default',
  title: 'cdot-world',
  // Paste the Sanity project id here, and in sanity.cli.js, and in
  // ../src/data/blog.mjs. `npm run check:seo` fails if they disagree.
  projectId: 'upmwu9hm',
  dataset: 'production',
  plugins: [structureTool(), visionTool()],
  schema: { types: schemaTypes },
})
