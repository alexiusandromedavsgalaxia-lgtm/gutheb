# GutHeb

GutHeb is a GitHub-style developer platform built with React + Vite.

## Included

- Sign in and account registration UI
- Demo account flow
- Home dashboard
- Repository list and repository creation
- Repository browser and public GitHub API tree/file loading
- Issues and issue creation
- Pull requests
- Actions/workflows area
- Projects board
- Discussions
- Codespaces area
- Marketplace
- Explore
- Notifications
- Profile editing
- Account and preference settings
- Responsive mobile/tablet/desktop layout
- Dark GitHub-style interface
- Local account/profile persistence in the browser

## Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- Framework: Vite

## Important

This is a GitHub-style application, not a copy of GitHub's private backend. Real multi-user authentication, permissions, repository writes, billing, OAuth, database storage, Git hosting, Actions execution, and other server-side services require a backend and secure server-side credentials. The frontend is structured so those services can be connected later without pretending that a static browser page can safely provide them.
