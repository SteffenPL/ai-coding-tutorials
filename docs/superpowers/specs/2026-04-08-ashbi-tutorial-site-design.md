# ASHBi Coding Tutorial Site - Design Specification

**Date:** 2026-04-08
**Project:** ASHBi Coding Tutorial Repository
**Scope:** Homepage + Blog Post Page HTML Design Drafts

---

## Project Overview

A public-facing educational website hosting bioinformatics, data analysis, and image analysis tutorials for ASHBi (Kyoto University Institute of Human Biology) researchers. The site will eventually grow into a full Svelte webapp, but begins with standalone HTML design drafts.

**Audience:** ASHBi researchers + general public
**Content Type:** Primarily video-based tutorials with some code-only documentation
**Repository Structure:** Svelte webpage hosted alongside Git submodules for individual tutorial code examples

---

## Design Goals

- **Modern, clean, precise** — minimalist aesthetic without sacrificing clarity
- **Accessible and scannable** — readers quickly find what they need
- **Bilingual from day one** — English + Japanese with fallback to English
- **Dark/Light mode support** — built into the design system
- **Shark blue theme** — primary color for accents, CTAs, and interactive elements

---

## Page Designs

### 1. Homepage

**Purpose:** Welcome users, direct them to start their first tutorial, display all available tutorials.

#### Layout Structure (top to bottom)

##### Hero Section
- Full-width banner at top
- Headline: "ASHBi Coding Tutorials" (or localized equivalent)
- Brief subheading explaining the purpose (e.g., "Learn bioinformatics, data analysis, and image processing with practical tutorials")
- Primary CTA button in shark blue: "Start Your First Tutorial" → links to or scrolls to the first/featured post
- Clean background (solid color or subtle gradient, responds to dark/light mode)

##### Post List Section
- Grid of tutorial posts displayed as minimal **horizontal rows** (one post per row)
- Each row contains:
  - **Square preview image** (left side, ~120-150px): SVG, PNG, GIF, or video thumbnail
  - **Content area** (right side):
    - **Title** (prominent, dark text / light text in dark mode)
    - **Tags** (e.g., "python", "image-analysis", "beginner") — shark blue background or outline
    - **Brief metadata** (e.g., "5 min read", "Updated: April 2026")
- Row is clickable; clicking navigates to the full blog post
- Subtle hover effect: light background shift or shadow increase
- Responsive: On mobile, may stack or adjust preview image size

#### Header/Navigation (persistent across site)
- Logo or site title (left)
- Language switcher (center or right): dropdown or toggle for English/日本語
- Dark/Light mode toggle (right)
- Clean, minimal navbar

---

### 2. Blog Post Page

**Purpose:** Display a single tutorial with video, resources, and markdown content.

#### Layout Structure (top to bottom)

##### Navigation & Header
- Back link or breadcrumb to homepage (top left)
- Post title as main page heading
- Language switcher and dark/light mode toggle (top right, consistent with homepage)

##### Post Content Flow
1. **Title** — Large, prominent heading
2. **Video** (conditional) — Full-width or slightly constrained video embed (if tutorial includes video)
   - Responsive iframe for YouTube, Vimeo, or self-hosted video
3. **Links & Metadata**
   - GitHub repository link (if available): "Code: [GitHub Repository]" with icon
   - Other resources or links (if applicable)
   - Tags displayed with shark blue styling
4. **Main Text** — Markdown-formatted content
   - Readable line length (not too wide, typically 65-80 characters or ~600-700px)
   - Proper heading hierarchy (H2, H3, etc.)
   - Code blocks with syntax highlighting and copy button
   - **LLM Prompt Environment**: Special styled box for ChatGPT/LLM prompts
     - Distinct background color (shark blue tint or subtle box)
     - Optional icon or label (e.g., "💬 Try this prompt:")
     - Monospace or slightly styled font to distinguish from regular text

#### Design Principles
- **Minimal:** No sidebar, no table of contents, no "related posts" section
- **Linear reading experience:** Content flows naturally from top to bottom
- **No next/previous navigation:** Use homepage to browse other tutorials

---

## Color & Styling System

### Color Palette

**Primary Color:**
- **Shark Blue:** The main brand color, used for CTAs, buttons, link accents, tag backgrounds, and LLM prompt boxes
  - Light Mode: `#0077BE` (or similar shark blue hex)
  - Dark Mode: Slightly lighter or brighter shark blue for contrast (`#00A8E8` or similar)

**Light Mode:**
- Background: Clean white (`#FFFFFF`) or off-white (`#FAFAFA`)
- Text: Dark gray/black (`#222222` or `#333333`)
- Secondary text: Medium gray (`#666666`)
- Borders/dividers: Light gray (`#E0E0E0` or `#D9D9D9`)
- Tags: Shark blue background with white text

**Dark Mode:**
- Background: Dark gray (`#1A1A1A`) or charcoal (`#2A2A2A`)
- Text: Light gray (`#E0E0E0`) or off-white (`#F5F5F5`)
- Secondary text: Medium gray (`#B0B0B0`)
- Borders/dividers: Dark gray (`#444444` or `#555555`)
- Shark blue accents: Brighter variant for visibility
- LLM prompt boxes: Shark blue background with light text

**Code Blocks:**
- Dark background with syntax highlighting
- Copy button in shark blue
- Maintains readability in both light and dark modes

### Typography

- **Font Family:** Modern sans-serif
  - Option 1: System fonts (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`)
  - Option 2: Open-source web font (e.g., Inter, Poppins, IBM Plex Sans)
- **Hierarchy:**
  - Page heading (H1): Large, prominent
  - Section headings (H2, H3): Clear distinction, reasonable spacing
  - Body text: 16-18px, good readability
  - Code/monospace: `monospace` or `Courier New`

### Spacing & Layout

- **Generous whitespace:** Avoid cramped layouts
- **Consistent padding/margins:** Maintain visual rhythm
- **Max-width for content:** Typically 800-900px for blog posts (readable line length)
- **Responsive design:**
  - Desktop: Full layout
  - Tablet: Adjusted spacing and widths
  - Mobile: Single column, optimized touch targets

---

## Content Handling

### Conditional Elements
- **Video:** If a tutorial includes video, display after title. If no video, skip to links & text.
- **GitHub Link:** Display only if the tutorial has an associated repository. Fallback: no link shown.
- **Japanese Content:** If Japanese translation is available, show it. Otherwise, fallback to English.

### Markdown Rendering
- Headers, lists, blockquotes rendered with appropriate styling
- Links styled in shark blue
- Bold and italic text clearly distinguished
- Images in content: responsive, centered or full-width

### Special Elements

**LLM Prompt Box:**
- Visual container (box with distinct background, subtle border, or background color change)
- Small icon or label: "💬 Try this prompt:" or similar
- Content inside: monospace or lightly styled for clarity
- Example:
  ```
  💬 Try this prompt:
  "Analyze this CSV file and identify outliers using Python pandas"
  ```

---

## Bilingual Strategy

**Language Switcher:**
- Located in header (top-right or top-center)
- Toggle or dropdown: English / 日本語
- Persists across pages (URL slug or localStorage)
- Fallback behavior: If Japanese translation missing, show English

**URL Structure (future Svelte implementation):**
- English: `/tutorials/post-slug` or `/en/tutorials/post-slug`
- Japanese: `/ja/tutorials/post-slug`

**Current HTML Draft:**
- Separate HTML files for demonstration:
  - `index-en.html` (English homepage)
  - `index-ja.html` (Japanese homepage)
  - `post-en.html` (English blog post template)
  - `post-ja.html` (Japanese blog post template)

---

## Deliverables

### Phase 1: Design Drafts (Current)
1. **Homepage Design** (`index-draft.html`)
   - Hero section with CTA
   - Post list (3-5 example posts with mock data)
   - Shark blue theme with light/dark mode toggle
   - Language switcher (English/Japanese) with sample Japanese text
   - Responsive layout demo

2. **Blog Post Template** (`post-draft.html`)
   - Mock post with title, video (responsive iframe), links, tags
   - Markdown-style content with headings, lists, code blocks
   - LLM prompt box styled example
   - Language switcher and dark/light mode toggle
   - Responsive layout demo

### Phase 2: Full Svelte Webapp (Future)
- Convert HTML designs to Svelte components
- Integrate with database/CMS for posts
- Dynamic language switching
- Submodule linking and GitHub integration

---

## Success Criteria

- [ ] Homepage design communicates tutorial purpose clearly
- [ ] Post list is scannable and visually organized
- [ ] Blog post page is readable and distraction-free
- [ ] Shark blue theme is applied consistently
- [ ] Light/dark mode toggle works and looks good in both modes
- [ ] Design is responsive (desktop, tablet, mobile)
- [ ] LLM prompt boxes are visually distinct
- [ ] Language switcher demonstrates bilingual capability

---

## Notes

- The HTML drafts will use hardcoded example data for demonstration
- CSS will be organized for easy translation to Svelte (BEM naming or Tailwind utility classes)
- Responsive design will use CSS media queries or CSS Grid/Flexbox
- Future Svelte implementation will replace hardcoded data with dynamic content from a data source
