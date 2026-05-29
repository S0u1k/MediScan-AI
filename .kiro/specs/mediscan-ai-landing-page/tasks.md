# Implementation Plan: MediScan AI Landing Page

## Overview

This plan builds the MediScan AI login-first hero landing page incrementally. It starts by scaffolding the Next.js + TypeScript + Tailwind project and test tooling, then implements the shared visual system (grayscale palette, fonts, and the liquid glass `@layer components` contract). Next it builds the pure-logic core (identity resolution, gating, color validation) with fast-check property tests, followed by state hooks. Components are built bottom-up (background, panel, header, content, pills, quote, modal) and finally wired together in the `LandingPage` root with integration tests. Each task references specific requirements for traceability, and test sub-tasks are marked optional with `*`.

The implementation language is **TypeScript** (per the design's technology decisions).

## Tasks

- [ ] 1. Scaffold project and testing tooling
  - [ ] 1.1 Initialize Next.js (App Router) + TypeScript + Tailwind CSS project
    - Create the project structure: `app/`, `components/landing/`, `hooks/`, `lib/`, `public/`
    - Configure `tsconfig.json`, `next.config`, `tailwind.config`, and `postcss.config`
    - Install runtime dependencies: `framer-motion`, `lucide-react`
    - Add a `public/logo.png` asset reference for the brand logo
    - _Requirements: 12.3, 13.1_

  - [ ] 1.2 Set up Vitest, React Testing Library, and fast-check
    - Install `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, and `fast-check`
    - Create the Vitest config (jsdom environment) and a test setup file
    - Add a `test` script that runs once with `--run` (no watch mode)
    - _Requirements: Test harness supporting the design's Testing Strategy (property, unit, CSS-contract, accessibility, and integration tests)_

- [ ] 2. Implement configuration, constants, and fonts
  - [ ] 2.1 Create `lib/config.ts` with constants and palette
    - Define `CONFIG` (video URL, `videoTimeoutMs`, `fontTimeoutMs`, `featurePills`, headline/supporting/quote copy strings)
    - Define the `GRAYSCALE` palette using the exact required HSL tiers and `TEXT_OPACITY_TIERS`
    - _Requirements: 1.8, 2.1, 7.1, 7.4, 8.1, 11.1, 11.2, 11.3_

  - [ ] 2.2 Create `lib/fonts.ts` with `next/font/google` configuration
    - Configure Poppins (weights 400 and 500) and Source Serif 4 (italic) with `display: swap` and system fallback stacks
    - Export font variables for use in the root layout
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7, 3.8_

- [ ] 3. Implement global styles and the liquid glass system
  - [ ] 3.1 Create `app/globals.css` with grayscale variables and the glass component layer
    - Add Tailwind directives and grayscale CSS variables matching the required HSL tiers (saturation 0%)
    - Define `.liquid-glass` (bg `rgba(255,255,255,0.01)`, 4px backdrop blur, uniform non-zero radius, inset highlight, `::after` reflection)
    - Define `.liquid-glass-strong` (50px backdrop blur, larger shadow blur/spread than `.liquid-glass`)
    - Implement edge outlines with a `::before` gradient-glow pseudo-element (no CSS `border`); ensure graceful degradation to background + blur only
    - Place both classes inside `@layer components`
    - _Requirements: 2.1, 2.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 3.2 Write CSS contract tests for the glass system and palette
    - Assert `.liquid-glass`/`.liquid-glass-strong` background, blur, radius, shadow ordering, `::before` edge (no `border`), and `@layer components` placement
    - Assert grayscale palette variables match the exact required HSL tiers
    - _Requirements: 2.1, 4.1, 4.2, 4.3, 4.4, 4.6_

- [ ] 4. Implement pure logic: grayscale color validation
  - [ ] 4.1 Create `lib/color.ts`
    - Implement `hslSaturation(color)` parsing `hsl()`, `rgb()`, and hex into saturation %
    - Implement `isGrayscale(color)` returning true iff saturation is 0
    - Implement an allowed-text-tier membership helper validating against `TEXT_OPACITY_TIERS`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 4.2 Write property test for grayscale color validation
    - **Property 1: Grayscale color validation**
    - **Validates: Requirements 2.1, 2.3, 2.4**
    - Generate arbitrary `hsl`/`rgb`/hex colors; assert `isGrayscale` is true iff saturation is 0; assert every `GRAYSCALE` entry passes; run min 100 iterations

  - [ ]* 4.3 Write property test for allowed text-opacity tier membership
    - **Property 2: Allowed text-opacity tier membership**
    - **Validates: Requirements 2.2**
    - Generate arbitrary class tokens (allowed tiers + arbitrary strings); assert acceptance iff in the allowed set; run min 100 iterations

- [ ] 5. Implement pure logic: identity resolution
  - [ ] 5.1 Create `lib/identity.ts`
    - Define the `Session` type and constants `GUEST_LABEL`, `MAX_IDENTIFIER_LENGTH`
    - Implement `truncateIdentifier(id, max)` (trailing ellipsis, length-bounded, prefix-preserving)
    - Implement `resolveUserIdentity(session)` returning "Guest User" for guest or null identifier, else the truncated identifier
    - _Requirements: 6.4, 6.5, 6.7_

  - [ ]* 5.2 Write property test for user identity resolution
    - **Property 3: User identity resolution**
    - **Validates: Requirements 6.4, 6.5, 6.7**
    - Generate arbitrary `Session` values; assert guest/null → "Guest User", else truncated identifier; assert result is never empty; run min 100 iterations

  - [ ]* 5.3 Write property test for identifier truncation
    - **Property 4: Identifier truncation bound and prefix preservation**
    - **Validates: Requirements 6.5**
    - Generate arbitrary strings (unicode, lengths around the 32 boundary); assert ≤32 returns unchanged, >32 yields ≤32-length result ending in ellipsis whose non-ellipsis portion is a prefix of the input; run min 100 iterations

- [ ] 6. Implement pure logic: protected-action gating
  - [ ] 6.1 Create `lib/gating.ts`
    - Define `GatingDecision` and implement `decideProtectedAction(session)` returning `open-modal` for guest and `proceed` for authenticated
    - _Requirements: 7.10, 9.1, 9.2, 9.3_

  - [ ]* 6.2 Write property test for the gating decision
    - **Property 5: Protected-action gating decision**
    - **Validates: Requirements 7.10, 9.1, 9.2, 9.3**
    - Generate arbitrary `(control, session)` pairs; assert guest → `open-modal`, authenticated → `proceed`, uniform across all protected controls; run min 100 iterations

- [ ] 7. Checkpoint - foundation and pure logic
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement state hooks
  - [ ] 8.1 Create `hooks/useAuth.ts`
    - Implement session state (`Guest_State` / `Authenticated_State`) with `signIn`, `signInWithGoogle`, `signOut`, optionally `sessionStorage`-backed
    - Derive identity display via `resolveUserIdentity`
    - _Requirements: 6.4, 6.5, 9.2_

  - [ ] 8.2 Create `hooks/useAuthModal.ts`
    - Implement `isOpen`, `openModal(triggerRef)`, `closeModal`, tracking the opener element for focus restoration
    - _Requirements: 10.10, 15.5_

  - [ ] 8.3 Create `hooks/useProtectedAction.ts`
    - Wrap `decideProtectedAction`; expose `requestProtectedAction(action)` that opens the modal as guest or runs the action when authenticated
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ]* 8.4 Write unit tests for the hooks
    - Test gating routing (guest opens modal, authenticated proceeds) and modal open/close + trigger tracking
    - _Requirements: 9.1, 9.2, 10.10_

- [ ] 9. Implement app shell
  - [ ] 9.1 Create `app/layout.tsx`
    - Render `html`/`body`, apply Poppins + Source Serif 4 font variables, set page metadata
    - _Requirements: 3.1, 3.2, 3.7, 3.8_

  - [ ] 9.2 Create `app/page.tsx` server shell
    - Render the `LandingPage` client root with minimal server markup to prioritize initial UI content
    - _Requirements: 16.1, 16.2_

- [ ] 10. Implement background layers
  - [ ] 10.1 Create `components/landing/BackgroundVideo.tsx`
    - Render a full-viewport `object-cover` video at `z-0` with `autoPlay muted loop playsInline preload="auto"` and the configured source URL
    - Implement a 5s load timeout and `onError` handling that switches to a solid grayscale fallback `div` while keeping overlay + `z-10` UI intact
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.8, 1.9, 1.10, 16.2_

  - [ ] 10.2 Create `components/landing/Overlay.tsx`
    - Render the dark grayscale overlay at 40–60% opacity positioned between video and UI
    - _Requirements: 1.7_

  - [ ]* 10.3 Write tests for video attributes and fallback
    - Assert video element attributes/source and z-stack ordering; simulate `error` and timeout and assert grayscale fallback with overlay + `z-10` UI
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.8, 1.9, 1.10_

- [ ] 11. Implement the hero panel
  - [ ] 11.1 Create `components/landing/HeroPanel.tsx`
    - Apply `.liquid-glass-strong` and `rounded-[3rem]`, center the panel, size to 68–72vw at ≥768px, stack vertically with reduced padding and no horizontal overflow below 768px
    - Add Framer Motion entrance/float animation gated by `useReducedMotion` (static final state when reduced motion is on)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 12.1, 12.5, 14.1, 14.2, 14.3_

  - [ ]* 11.2 Write responsive/snapshot tests for the hero panel
    - Render at desktop (≥768px) and mobile (<768px); assert width band, vertical stacking, reduced padding, no horizontal overflow; assert static motion props when reduced motion is mocked on
    - _Requirements: 5.3, 5.4, 5.7, 5.8, 12.5, 14.1, 14.2_

- [ ] 12. Implement the brand header
  - [ ] 12.1 Create `components/landing/BrandHeader.tsx`
    - Render `/logo.png` with `onError` text fallback, the "MediScan AI" name (semibold, text-2xl, tight tracking, white), and the glass-pill Menu control (lucide `Menu` icon) with a visible pressed/focus state
    - Render the identity area from `resolveUserIdentity(session)` ("Guest User" for guest/null, truncated identifier otherwise) with an `aria-label` on the Menu control
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 13.2, 15.2_

  - [ ]* 12.2 Write tests for the brand header
    - Test logo `onError` text fallback, identity text mapping, truncation display, and Menu control accessible name/pressed state
    - _Requirements: 6.4, 6.5, 6.6, 6.7, 6.8, 15.2_

- [ ] 13. Implement hero content and feature pills
  - [ ] 13.1 Create `components/landing/HeroContent.tsx`
    - Render the two-line headline (text-6xl, -0.05em tracking, white) with emphasized words in Source Serif 4 italic, supporting text in `text-white/70 max-w-xl`, and the `.liquid-glass-strong` fully-rounded "Get Started" Primary CTA
    - CTA contains one lucide icon (`ArrowRight`/`Sparkles`) in a `w-8 h-8 rounded-full bg-white/15` container, with hover/active/leave transitions ≤300ms and `aria-label`; activation routes through `requestProtectedAction`
    - _Requirements: 3.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 12.2, 13.2, 15.2_

  - [ ] 13.2 Create `components/landing/FeaturePills.tsx`
    - Render exactly three `.liquid-glass` pills ("AI Diagnosis", "Prescription Scanner", "Medical Report Analysis") in order, fully rounded, `text-xs`, `text-white/80`, beneath the CTA
    - Apply the same glow state on hover and keyboard focus (transition ≤300ms); each pill activation routes through `requestProtectedAction` with an accessible name
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 12.2, 15.2_

  - [ ]* 13.3 Write tests for hero content and pills
    - Assert CTA single-icon/container structure, headline serif-italic emphasis vs Poppins, and three pills in required order with required classes
    - _Requirements: 7.3, 7.6, 8.1, 8.2_

- [ ] 14. Implement the bottom quote area
  - [ ] 14.1 Create `components/landing/BottomQuote.tsx`
    - Render the uppercase widest-tracking label in `text-white/50`, the mixed Poppins + Source Serif 4 italic quote, and the "MEDISCAN AI LABS" author line with decorative horizontal rules
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ]* 14.2 Write test for quote structure and emphasis
    - Assert label, mixed-font quote emphasis, and author line render correctly
    - _Requirements: 11.2_

- [ ] 15. Implement the authentication modal
  - [ ] 15.1 Create `components/landing/AuthModal.tsx`
    - Render `.liquid-glass-strong` `rounded-[2rem]` modal with fade + scale entrance over a backdrop-blurred overlay
    - Include title/subtitle, borderless glass email + password inputs with glowing focus, "Continue Securely" button, "OR" divider, and a "Continue with Google" button (white Google icon, glass styling, scale hover); add `aria-label`s
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 13.2, 15.2_

  - [ ] 15.2 Implement focus management in `AuthModal.tsx`
    - Trap Tab focus within the modal, move focus to the first interactive element on open, close on Escape, and restore focus to the opener on close
    - _Requirements: 10.10, 15.3, 15.4, 15.5_

  - [ ]* 15.3 Write accessibility/interaction tests for the modal
    - Test focus trap, Escape-to-close, first-element focus on open, and focus restoration to the opener
    - _Requirements: 10.10, 15.3, 15.4, 15.5_

- [ ] 16. Checkpoint - components complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Wire the landing page together
  - [ ] 17.1 Create `components/landing/LandingPage.tsx`
    - Compose the z-stack (`BackgroundVideo` z-0, `Overlay`, `HeroPanel` z-10, conditional `AuthModal`) and provide the auth/modal/protected-action context to children
    - Use semantic landmarks (`header`, `main`) and connect protected controls to gating so guests open the modal and authenticated users proceed
    - _Requirements: 1.5, 1.6, 5.1, 9.1, 9.2, 9.3, 12.1, 15.1_

  - [ ]* 17.2 Write integration tests for the wired page
    - Assert guest activation of CTA/pill opens the modal while authenticated proceeds, z-stack ordering, and presence of semantic landmarks and accessible names
    - _Requirements: 1.5, 1.6, 9.1, 9.2, 9.3, 15.1_

- [ ] 18. Final checkpoint - all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; they cover property, unit, CSS-contract, accessibility, and integration tests.
- Each task references specific requirements for traceability.
- Checkpoints ensure incremental validation at the foundation, component, and final stages.
- Property tests validate the five universal correctness properties from the design using `fast-check` (min 100 iterations each); unit/example tests validate concrete behavior and edge cases.
- Performance targets (60fps, animation deferral) are validated via manual profiling per the design and are not automated tasks.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "2.2", "3.1", "4.1", "5.1", "6.1"] },
    { "id": 3, "tasks": ["3.2", "4.2", "5.2", "6.2", "8.1", "8.2", "8.3", "9.1", "10.1", "10.2", "11.1", "12.1", "13.1", "13.2", "14.1", "15.1"] },
    { "id": 4, "tasks": ["4.3", "5.3", "8.4", "10.3", "11.2", "12.2", "13.3", "14.2", "15.2"] },
    { "id": 5, "tasks": ["15.3", "17.1"] },
    { "id": 6, "tasks": ["9.2", "17.2"] }
  ]
}
```
