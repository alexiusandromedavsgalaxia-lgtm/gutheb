# GutHeb

GutHeb is an independent GitHub-style developer platform.

## Features

- Accounts and profiles
- Repository creation and browsing
- Pinned repositories
- README and license metadata
- Language statistics
- Issues and pull requests
- Actions, Projects, Discussions and Packages areas
- Marketplace and Explore
- Built-in GutHeb AI workspace assistant
- Responsive dark interface

## Development

`npm install`

`npm run dev`

`npm run build`

## Architecture

The current frontend is a React + Vite application. Real multi-user authentication, Git hosting, secure repository writes, package publishing, Actions execution and AI model access should be connected through a server-side backend. The browser UI does not pretend that localStorage is a secure production identity system.
