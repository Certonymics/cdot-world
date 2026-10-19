import { defineCliConfig } from 'sanity/cli'

export default defineCliConfig({
  api: {
    // Same project id as sanity.config.js and ../src/data/blog.mjs.
    projectId: 'upmwu9hm',
    dataset: 'production',
  },
  // The Studio's address: https://<studioHost>.sanity.studio. Must be unique on
  // sanity.studio; `sanity deploy` asks for another if this one is taken.
  studioHost: 'cdot-world',
})
