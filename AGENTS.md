<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# UI Guidelines & Component Conventions

## Custom Select Dropdowns
- **Always** use the custom `Select` component (`@/components/ui/Select`) instead of native HTML `<select>` tags across all forms, filters, tables, and modal dialogs.
- Native `<select>` elements are strictly prohibited in ZahraOS interfaces to maintain design system consistency (custom card-styled popover menu, consistent typography, focus rings, and accessible keyboard navigation).
