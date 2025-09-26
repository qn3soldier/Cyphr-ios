# Cyphr iOS — UI Redesign Plan (Living)

Owner: Daniil + Codex
Updated: 2025-09-24
Scope: Turn current UI into a modern, premium, brand‑true interface. No re‑paint. Systemic redesign: theme tokens, glass components, refined layouts, brand logo.

## Vision
- Premium, minimal, “quantum‑tech” feel: dark night surfaces, liquid‑glass panels, subtle neon accents (not candy gradients), precise typography.
- Zero distraction: no duplicate controls, no heavy bars; content first.

## Brand System (Tokens)
- Colors
  - Background0: #070A12 (base), Background1: #0C1220 (raised)
  - TextPrimary: #EAF0FF, TextSecondary: #A6B1C2
  - AccentBlue: #00D1FF, AccentViolet: #7B61FF (sparingly)
  - Success: #35F2A0, Warning: #FFB020, Danger: #FF4D4F
- Gradients
  - bgGradient: radial/diagonal mix (Background0→Background1)
  - brandGradient: AccentViolet→AccentBlue, low intensity
- Radii/Stroke/Shadow
  - Radius: 14 / 20 / 24; Stroke: #FFFFFF 6–8% alpha; Glow: soft 8–24 pt
- Motion/Haptics: 0.2–0.3s spring; light impact for primary actions

## Components
- GlassBar (Tab/Top bars): ultraThinMaterial + stroke + inner shadow
- GlassCard (Sections/Cells): glass surface, thin divider grid
- GlassField (Search/Input): glass, custom placeholder (no grey)
- FAB (Floating Action Button): compact glass “+” with glow
- NeonIcon wrapper: subtle aura (theme‑colored)
- BadgeSecured: tiny, non‑distracting “Quantum Secured” chip

## Screens (First Pass)
- Chats
  - Remove header/duplicate icons entirely
  - Search = GlassField; Placeholder custom white alpha
  - Empty state = logo or shield with soft aura; compact CTA or FAB
  - List rows = tighter spacing, precise typography, minimal status icons
- ChatDetail
  - Bubble “drops”, soft brand rim for own messages
  - Input = GlassField; attachments = small neon icons
- Profile/Settings
  - Section groups on GlassCard; typography hierarchy; consistent toggles
- Splash
  - LaunchScreen uses CyphrLogo centered, dark background; no text

## Implementation Phases
1) Theme.swift + Glass components (Bar/Card/Field/Neon/Badge)
2) Replace system TabBar with custom GlassDock (if needed)
3) Refactor Chats (remove header, search glass, empty state, FAB)
4) Refactor Settings/Profile to GlassCard
5) Refine ChatDetail (bubbles/inputs)
6) Icons: SF Symbols tuned → custom set next iteration

## DoD (Definition of Done)
- No grey slabs anywhere; only dark bg + glass surfaces
- Chats has no top bar; search is glass; CTA/FAB neat; dock is glass
- Splash shows CyphrLogo; no fallback text screen appears
- All colors/metrics from Theme.swift; one source of truth

## Open Questions
- FAB vs CTA button on empty Chats (final choice)
- Degree of neon (how bold vs subtle)
- Iconography pack (phase 2)

## Status (2025‑09‑24)
- Foundation applied: launch uses CyphrLogo; tab bar glass (system); chats header removed; search converted to glass placeholder; CTA tuned.
- Next in queue (P0): dedicated GlassDock; Theme.swift tokens; Settings/Profile to GlassCard; ChatDetail bubbles.

