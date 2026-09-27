# Xreoct GitHub Web

A React + Vite GitHub-style web client for the Xreoct repository.

## Cloudflare Pages

- Build command: npm run build
- Output directory: dist
- Framework: Vite

## Features

- GitHub-style repository navigation
- Live public GitHub tree/file loading
- Search/filter
- Code viewer with line numbers
- Xreoct-aware parser for .rs and .rsx
- Run panel for browser-safe Xreoct inspection
- JavaScript/JSX inspection runner
- Responsive mobile layout

The runner deliberately does not claim to execute arbitrary server-side repository code. Cloudflare Pages is a static browser runtime, so language-specific execution needs a corresponding browser-safe runtime.
