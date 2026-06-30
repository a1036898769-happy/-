import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'daily-plan-lite'

// https://vite.dev/config/
export default defineConfig({
  base: `/${repositoryName}/`,
  plugins: [react()],
})
