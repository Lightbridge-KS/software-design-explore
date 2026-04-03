# Software Design Exploration Book

An educational software design & architecture Book that show various software architecture and system design with real-word case studies

## Stack

- **Framework:** Astro + Starlight
- **Diagrams:** `astro-mermaid` (mermaid code blocks in Markdown)
- **Deploy:** Netlify (static output, config in `netlify.toml`)
- **Package manager:** pnpm

## Content

- Pages live in `src/content/docs/`
- Sidebar is configured manually in `astro.config.mjs`
- When adding a new page, wire it in the `sidebar` array in `astro.config.mjs`