---
name: TradePilot A+C
description: A bright global-trade control system with a focused media-production studio.
colors:
  control-cobalt: "#1769E0"
  operational-emerald: "#12805C"
  studio-orange: "#E85B32"
  graphite-navigation: "#17212B"
  primary-text: "#12202C"
  secondary-text: "#637181"
  control-canvas: "#F4F7FA"
  surface: "#FFFFFF"
  structural-line: "#DCE3EA"
  warning: "#B75C13"
  danger: "#C9383E"
typography:
  headline:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
  title:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.control-cobalt}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: "38px"
    padding: "0 14px"
  card-control:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input-control:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.md}"
    height: "38px"
    padding: "0 12px"
---

# Design System: TradePilot A+C

## Overview

**Creative North Star: "The Global Trade Bridge"**

The default product surface is a bright, precise control room: compact navigation, explicit hierarchy, tabular business data, and restrained cobalt and emerald signals. The product-video and media-production surfaces become a focused graphite studio, but operational content always returns to a high-contrast light canvas.

Premium quality comes from proportion, typography, stable layout, and meaningful feedback. The system explicitly rejects low-contrast dark administration screens, interchangeable component-library cards, purple gradients, decorative glass, and landing-page composition.

**Key Characteristics:**

- Bright operational canvas with a compact graphite navigation layer.
- Dense, border-led information architecture rather than floating card mosaics.
- Cobalt actions, emerald healthy states, orange media-production progress.
- Motion that explains navigation, progress, selection, and completion.

## Colors

The palette combines cool operational neutrals with three narrowly assigned accents.

### Primary

- **Control Cobalt** (#1769E0): Primary actions, current navigation, focus, links, and selected controls.

### Secondary

- **Operational Emerald** (#12805C): Connected services, successful fulfillment, positive business movement.

### Tertiary

- **Studio Orange** (#E85B32): Active media rendering, production milestones, and studio-only primary actions.

### Neutral

- **Graphite Navigation** (#17212B): Desktop navigation and focused media-production surfaces.
- **Primary Text** (#12202C): Headings, data, and body text on light surfaces.
- **Secondary Text** (#637181): Supporting labels and metadata on light surfaces.
- **Control Canvas** (#F4F7FA): Main application background.
- **Surface** (#FFFFFF): Tables, tools, forms, menus, and repeated records.
- **Structural Line** (#DCE3EA): Dividers, field borders, and section boundaries.

### Named Rules

**The Bright Operations Rule.** Daily CRM, settings, lists, and forms stay light. Graphite is reserved for navigation and media-production context.

**The Three Signals Rule.** Cobalt means action or selection, emerald means healthy or complete, and orange means active media production. Do not use them as decoration.

## Typography

**Display Font:** Inter (with PingFang SC and system sans fallback)
**Body Font:** Inter (with PingFang SC and system sans fallback)

**Character:** Neutral, highly legible, and compact enough for repeated operational scanning. Numeric business data uses tabular figures.

### Hierarchy

- **Headline** (700, 26px, 1.25): Page titles and studio statements only.
- **Title** (650, 16px, 1.4): Section and panel headings.
- **Body** (400, 14px, 1.55): Forms, descriptions, and workflow content.
- **Label** (650, 12px, normal letter spacing): Controls, metadata, and table headings.

### Named Rules

**The Fixed Scale Rule.** Do not scale application typography with viewport width and do not use negative letter spacing.

## Elevation

The system is flat by default. Borders and tonal layering establish structure; shadows appear only for menus, dialogs, sticky bars, and interactive hover elevation.

### Shadow Vocabulary

- **Ambient Low** (`0 7px 22px rgb(31 45 61 / 5%)`): Operational panels that need separation from the canvas.
- **Overlay** (`0 24px 80px rgb(9 16 24 / 28%)`): Command palette and dialogs.
- **Action Lift** (`0 8px 20px rgb(23 105 224 / 24%)`): Hovered primary action only.

### Named Rules

**The Flat-By-Default Rule.** A static section does not earn a shadow merely because it has a background.

## Components

### Buttons

- **Shape:** Compact 6px corners, at least 32px high; primary commands use 38px.
- **Primary:** Control cobalt with white text; studio primary uses orange only inside media-production context.
- **Hover / Focus:** Color shift and small shadow; active state uses a subtle scale or translate transform. Focus ring is always visible.
- **Secondary / Ghost:** White or transparent surfaces with structural borders and high-contrast labels.

### Chips

- **Style:** 4-6px corners, tinted semantic background, text label plus optional status dot.
- **State:** Selection uses cobalt; health uses emerald; warning and danger always include text or icons.

### Cards / Containers

- **Corner Style:** 8px maximum.
- **Background:** White on the operational canvas; graphite layers only in studio context.
- **Shadow Strategy:** Flat by default, ambient low only when separation is required.
- **Border:** 1px structural line.
- **Internal Padding:** 16-20px for tools, 10-14px for records.

### Inputs / Fields

- **Style:** White, 1px structural border, 6px corners, stable 38px height.
- **Focus:** Cobalt border and a low-opacity 3px focus halo.
- **Error / Disabled:** Error includes text and icon; disabled remains readable and does not rely on opacity alone.

### Navigation

Desktop navigation groups features into overview, business, growth, and system. Active state uses a graphite tonal surface plus a cobalt indicator. Mobile uses a stable bottom navigation for primary destinations and a drawer for the full hierarchy.

### Production Pipeline

The studio pipeline uses a graphite field with high-contrast text. Orange identifies the current rendering stage, emerald identifies completed stages, and motion travels only along the active progress path.

## Do's and Don'ts

### Do:

- **Do** keep daily operations on #F4F7FA and #FFFFFF with #12202C primary text.
- **Do** use tabular numbers for money, rates, counts, dates, and percentages.
- **Do** animate transform and opacity in 150-350ms state transitions and honor reduced motion.
- **Do** expose service health, readiness, errors, and recovery actions directly in the workflow.
- **Do** keep desktop information dense and make responsive behavior structural.

### Don't:

- **Don't** build an all-dark administration interface with low-contrast text.
- **Don't** ship a default component-library demo with interchangeable cards and generic spacing.
- **Don't** use purple gradients, decorative blobs, excessive glassmorphism, or neon cyber styling.
- **Don't** turn operational pages into marketing landing pages or oversized hero compositions.
- **Don't** add decorative page-load choreography that delays access to work.
- **Don't** put cards inside cards or exceed an 8px surface radius.
