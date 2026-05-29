# Requirements Document

## Introduction

MediScan AI is a premium, cinematic, full-screen hero landing page for an AI-powered healthcare assistant platform (medical diagnosis, prescription scanning, report analysis, and smart healthcare insights). The landing page delivers a login-first, immersive experience built on a "liquid glass morphism" aesthetic layered over a looping medical-tech background video. The visual language fuses Apple Vision Pro UI cues, futuristic healthcare dashboards, and a strict grayscale luxury palette.

This document defines the requirements for the landing page itself: its visual system, layout, authentication-gating behavior, animations, accessibility, and performance characteristics. The page is implemented with Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion, and lucide-react icons. Backend authentication services (real credential validation, session persistence, Google OAuth completion) are out of scope for this document except where the landing page must trigger or display their states.

## Glossary

- **Landing_Page**: The complete MediScan AI single-page hero experience rendered in the browser.
- **Background_Video**: The full-viewport, autoplaying, muted, looping video element rendered behind all UI content.
- **Overlay**: The semi-transparent dark layer placed between the Background_Video and the UI content to improve text readability.
- **Liquid_Glass_System**: The CSS component layer defining the `.liquid-glass` and `.liquid-glass-strong` classes that produce translucent, blurred, borderless glass surfaces.
- **Hero_Panel**: The single large centered floating glass card that contains the primary landing content.
- **Brand_Header**: The top region of the Hero_Panel containing the logo, platform name, menu control, and user identity area.
- **Hero_Content**: The vertically centered region of the Hero_Panel containing the headline, supporting text, primary CTA, and feature pills.
- **Primary_CTA**: The "Get Started" call-to-action button within the Hero_Content.
- **Feature_Pills**: The three labeled glass pills ("AI Diagnosis", "Prescription Scanner", "Medical Report Analysis") displayed beneath the Primary_CTA.
- **Bottom_Quote_Area**: The lower region of the Hero_Panel containing the label, brand quote, and author line.
- **Auth_Modal**: The centered, cinematic authentication popup containing email/password fields and Google sign-in.
- **Menu_Control**: The glass pill button in the Brand_Header that uses the lucide-react Menu icon.
- **User**: A person visiting the Landing_Page.
- **Guest_State**: The application state in which no User is signed in.
- **Authenticated_State**: The application state in which a User is signed in.
- **Protected_Action**: Any interaction intended to access platform functionality, including the Primary_CTA, any Feature_Pill, and any dashboard-bound control.
- **Viewport**: The visible browser rendering area.
- **Reduced_Motion_Preference**: The operating-system or browser setting `prefers-reduced-motion: reduce`.

## Requirements

### Requirement 1: Cinematic Background Video

**User Story:** As a visitor, I want an immersive looping medical-tech background, so that the page feels cinematic and premium from the first moment.

#### Acceptance Criteria

1. WHEN the Landing_Page completes loading, THE Background_Video SHALL begin playing automatically within 2 seconds.
2. THE Background_Video SHALL play in a muted state at all times.
3. WHEN the Background_Video reaches its end, THE Background_Video SHALL restart from the beginning within 100 milliseconds so that playback loops continuously without a visible gap or black frame.
4. THE Background_Video SHALL cover the entire Viewport using object-fit cover, regardless of Viewport aspect ratio, so that no empty space appears around the video.
5. THE Background_Video SHALL be rendered at stacking layer z-0.
6. THE Landing_Page SHALL render all UI content at stacking layer z-10 so that UI content appears above the Background_Video.
7. THE Overlay SHALL render a dark layer with opacity between 40% and 60% positioned between the Background_Video (z-0) and the UI content (z-10).
8. THE Background_Video SHALL load from the source URL `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260315_073750_51473149-4350-4920-ae24-c8214286f323.mp4`.
9. IF the Background_Video fails to load within 5 seconds OR returns a load error, THEN THE Landing_Page SHALL replace the Background_Video with a solid grayscale background color from the defined palette so that the UI content remains readable.
10. WHILE the grayscale fallback background is displayed, THE Landing_Page SHALL continue to render all UI content at stacking layer z-10 with the Overlay applied.

### Requirement 2: Strict Grayscale Color System

**User Story:** As a brand owner, I want a strictly grayscale palette, so that the experience reads as luxurious, restrained, and futuristic.

#### Acceptance Criteria

1. THE Landing_Page SHALL define its grayscale color variables using exactly the HSL values `0 0% 100%`, `0 0% 90%`, `0 0% 70%`, `0 0% 50%`, `0 0% 20%`, and `0 0% 10%`, and SHALL NOT define any additional color variable whose HSL saturation differs from 0%.
2. THE Landing_Page SHALL render every text element using exactly one of the opacity tiers `text-white`, `text-white/80`, `text-white/60`, or `text-white/50`, and SHALL NOT apply any other text color tier.
3. THE Landing_Page SHALL restrict all foreground, background, border, shadow, and icon/vector-fill colors to colors whose HSL saturation equals 0%.
4. IF any rendered element applies a color whose HSL saturation is greater than 0%, THEN THE Landing_Page SHALL be considered non-compliant with the grayscale design system.

### Requirement 3: Typography System

**User Story:** As a visitor, I want elegant, intentional typography, so that the headline feels visionary and trustworthy.

#### Acceptance Criteria

1. THE Landing_Page SHALL load the Poppins font from Google Fonts for display and body text.
2. THE Landing_Page SHALL load the Source Serif 4 font from Google Fonts for serif accent text.
3. THE Landing_Page SHALL render headings using Poppins at font-weight 500.
4. THE Landing_Page SHALL render body text using Poppins at font-weight 400.
5. WHERE a word within a heading is marked as emphasized, THE Landing_Page SHALL render that word using Source Serif 4 in italic style.
6. THE Landing_Page SHALL apply Source Serif 4 exclusively to emphasized highlighted words and SHALL apply Poppins to all other text.
7. IF the Poppins font fails to load from Google Fonts within 3 seconds, THEN THE Landing_Page SHALL render the affected text using a sans-serif fallback typeface while preserving the specified font weights.
8. IF the Source Serif 4 font fails to load from Google Fonts within 3 seconds, THEN THE Landing_Page SHALL render emphasized words using a serif fallback typeface while preserving italic styling.

### Requirement 4: Liquid Glass Component System

**User Story:** As a designer, I want a reusable liquid glass surface system, so that all panels share a consistent translucent, borderless, depth-rich appearance.

#### Acceptance Criteria

1. THE Liquid_Glass_System SHALL define a `.liquid-glass` class with background color `rgba(255, 255, 255, 0.01)` and a backdrop blur of 4px.
2. THE Liquid_Glass_System SHALL render the `.liquid-glass` class with an inset highlight effect, rounded corners using a uniform non-zero corner radius applied to all four corners, and a reflection effect.
3. THE Liquid_Glass_System SHALL define a `.liquid-glass-strong` class with a backdrop blur of 50px and reflection, shadow, and depth effects whose shadow blur radius and spread are greater than those applied to the `.liquid-glass` class.
4. THE Liquid_Glass_System SHALL render edge outlines for both the `.liquid-glass` and `.liquid-glass-strong` surfaces using a pseudo-element gradient glow as the primary edge outline method rather than a CSS border property.
5. IF the pseudo-element gradient glow is unavailable, THEN THE Liquid_Glass_System SHALL render glass surfaces with their defined background color and backdrop blur intact and without any edge outline.
6. THE Liquid_Glass_System SHALL define both `.liquid-glass` and `.liquid-glass-strong` classes within the `@layer components` layer.

### Requirement 5: Login-First Page Layout

**User Story:** As a first-time visitor, I want a focused, centered entry experience, so that the page feels immersive and guides me toward signing in.

#### Acceptance Criteria

1. WHILE the application is in the Guest_State, THE Landing_Page SHALL display the Hero_Panel as the only primary foreground content element and SHALL NOT display any additional content panel, sidebar, or navigation region outside the Hero_Panel.
2. THE Landing_Page SHALL position the Hero_Panel centered both horizontally and vertically within the Viewport.
3. WHERE the Viewport width is 768 pixels or greater, THE Hero_Panel SHALL occupy between 68% and 72% of the Viewport width.
4. WHERE the Viewport width is less than 768 pixels, THE Hero_Panel SHALL stack its content vertically.
5. THE Hero_Panel SHALL render with rounded corners of 3rem radius.
6. THE Hero_Panel SHALL render using the liquid glass aesthetic defined by the Liquid_Glass_System.
7. WHERE the Viewport width is less than 768 pixels, THE Hero_Panel SHALL render with inner padding smaller than the padding applied at Viewport widths of 768 pixels or greater.
8. WHERE the Viewport width is less than 768 pixels, THE Hero_Panel SHALL constrain its content to fit within the Viewport width without producing horizontal scrolling.

### Requirement 6: Brand Header

**User Story:** As a visitor, I want clear branding and navigation controls at the top of the panel, so that I understand the product identity and my session state.

#### Acceptance Criteria

1. THE Brand_Header SHALL display the medical logo icon loaded from `/logo.png` in the top-left region of the Hero_Panel.
2. THE Brand_Header SHALL display the platform name "MediScan AI" using semibold weight, text-2xl size, tight letter tracking, and white color.
3. THE Brand_Header SHALL display the Menu_Control as a glass pill button containing the lucide-react Menu icon in the top-right region of the Hero_Panel.
4. WHILE the application is in the Guest_State, THE Brand_Header SHALL display the user identity area with the text "Guest User" in text-white/50.
5. WHILE the application is in the Authenticated_State, THE Brand_Header SHALL display the current User identifier in the user identity area, truncating any identifier longer than 32 characters with a trailing ellipsis.
6. IF the medical logo icon fails to load, THEN THE Brand_Header SHALL display the platform name "MediScan AI" as a text fallback in the top-left region of the Hero_Panel.
7. WHILE the application is in the Authenticated_State, IF no User identifier is available, THEN THE Brand_Header SHALL display the text "Guest User" in the user identity area.
8. WHEN the Menu_Control is activated, THE Brand_Header SHALL display a visible pressed or focused state on the Menu_Control within 100 milliseconds.

### Requirement 7: Hero Content and Primary CTA

**User Story:** As a visitor, I want a bold headline and a clear primary action, so that I understand the product vision and how to begin.

#### Acceptance Criteria

1. THE Hero_Content SHALL display the primary headline "Reinventing the future of intelligent healthcare." followed by the second line "Where AI meets precision diagnosis."
2. THE Hero_Content SHALL render the headline using large display typography at text-6xl on large viewports with letter tracking of -0.05em in white.
3. THE Hero_Content SHALL render the emphasized words within the headline using Source Serif 4 italic styling.
4. THE Hero_Content SHALL display the supporting text "Analyze prescriptions, decode medical reports, detect health risks, and receive AI-powered insights instantly." in text-white/70 with a maximum width of the xl size and relaxed line spacing.
5. THE Hero_Content SHALL display the Primary_CTA as a "Get Started" button styled with `.liquid-glass-strong` and fully rounded corners.
6. THE Primary_CTA SHALL contain exactly one lucide-react icon (ArrowRight or Sparkles) inside a circular icon container with background bg-white/15.
7. WHEN a User moves the pointer onto the Primary_CTA, THE Primary_CTA SHALL apply a visible hover state with a distinct change from its default appearance, completing the transition within 300 milliseconds.
8. WHEN the pointer leaves the Primary_CTA, THE Primary_CTA SHALL revert to its default appearance within 300 milliseconds.
9. WHILE a User is pressing the Primary_CTA, THE Primary_CTA SHALL apply a visible active state distinct from both its default and hover appearance.
10. WHEN a User activates the Primary_CTA, THE Hero_Content SHALL navigate the User to the product start/onboarding destination.

### Requirement 8: Feature Pills

**User Story:** As a visitor, I want to see the core capabilities at a glance, so that I quickly understand what the platform does.

#### Acceptance Criteria

1. THE Feature_Pills SHALL display exactly three pills, labeled "AI Diagnosis", "Prescription Scanner", and "Medical Report Analysis" in that left-to-right order, positioned directly beneath the Primary_CTA.
2. THE Feature_Pills SHALL render each pill using the `.liquid-glass` class with fully rounded corners, text-xs size, and text-white/80 color.
3. WHILE a User hovers the pointer over a Feature_Pill, THE Feature_Pill SHALL apply a glow hover state that visibly increases the pill's luminosity, with the visual transition completing within 300 milliseconds.
4. WHEN the pointer leaves a Feature_Pill, THE Feature_Pill SHALL return to its default non-glow appearance within 300 milliseconds.
5. WHEN a Feature_Pill receives keyboard focus, THE Feature_Pill SHALL apply the same glow state used for hover so that the focused pill is visually distinguishable from the other pills.

### Requirement 9: Protected Action Gating

**User Story:** As a guest, I want to be prompted to authenticate when I try to use a feature, so that access to the platform stays secure.

#### Acceptance Criteria

1. WHILE the application is in the Guest_State, WHEN a User activates a Protected_Action, THE Landing_Page SHALL open the Auth_Modal.
2. WHILE the application is in the Authenticated_State, WHEN a User activates a Protected_Action, THE Landing_Page SHALL proceed with the requested action without opening the Auth_Modal.
3. THE Landing_Page SHALL treat the Primary_CTA, each Feature_Pill, and each dashboard-bound control as a Protected_Action.

### Requirement 10: Authentication Modal

**User Story:** As a guest, I want a clean, secure-feeling sign-in popup, so that I can access my healthcare workspace with confidence.

#### Acceptance Criteria

1. THE Auth_Modal SHALL render using the `.liquid-glass-strong` class with rounded corners of 2rem radius.
2. WHEN the Auth_Modal opens, THE Auth_Modal SHALL animate using a combined fade-in and scale-in transition over a backdrop-blurred overlay.
3. THE Auth_Modal SHALL display the title "Welcome to MediScan AI" and the subtitle "Secure access to your intelligent healthcare workspace."
4. THE Auth_Modal SHALL display an Email Address input field and a Password input field, each styled as a borderless glass input with soft white placeholder text.
5. WHEN a User focuses an Auth_Modal input field, THE Auth_Modal SHALL apply a glowing focus state to that field.
6. THE Auth_Modal SHALL display a primary sign-in button labeled "Continue Securely" styled as a large glass button.
7. THE Auth_Modal SHALL display an "OR" divider between the sign-in button and the Google authentication button.
8. THE Auth_Modal SHALL display a "Continue with Google" button containing a white Google icon and glass styling.
9. WHEN a User hovers over the "Continue with Google" button, THE "Continue with Google" button SHALL apply a scale hover effect.
10. WHEN a User requests to close the Auth_Modal, THE Auth_Modal SHALL close and return focus to the control that opened it.

### Requirement 11: Bottom Quote Area

**User Story:** As a visitor, I want an inspiring closing statement, so that the page leaves an emotional, mission-driven impression.

#### Acceptance Criteria

1. THE Bottom_Quote_Area SHALL display the label "INTELLIGENT HEALTHCARE" in uppercase with widest letter tracking in text-white/50.
2. THE Bottom_Quote_Area SHALL display the quote "We imagined a world where medical intelligence becomes universally accessible." using a mix of Poppins display text and Source Serif 4 italic emphasis.
3. THE Bottom_Quote_Area SHALL display the author line "MEDISCAN AI LABS" accompanied by decorative horizontal lines.

### Requirement 12: Animations and Motion

**User Story:** As a visitor, I want smooth, refined motion, so that the interface feels alive, premium, and high-performing.

#### Acceptance Criteria

1. THE Landing_Page SHALL apply floating motion and opacity fade animations to the Hero_Panel content on initial render.
2. WHEN a User hovers over a button or card, THE Landing_Page SHALL apply a scale transition to that element.
3. THE Landing_Page SHALL implement animations using Framer Motion.
4. THE Landing_Page SHALL target a render rate of 60 frames per second for all transitions.
5. WHILE the Reduced_Motion_Preference is enabled, THE Landing_Page SHALL disable non-essential motion animations and present content in a static state.

### Requirement 13: Iconography

**User Story:** As a designer, I want a consistent icon system, so that all icons match the futuristic medical aesthetic.

#### Acceptance Criteria

1. THE Landing_Page SHALL source all icons from the lucide-react icon library.
2. THE Landing_Page SHALL render each icon container at width 2rem (w-8) and height 2rem (h-8) with fully rounded corners, background bg-white/10, and centered flex alignment.

### Requirement 14: Responsive Layout

**User Story:** As a mobile visitor, I want the page to adapt to my screen, so that the experience stays elegant on any device.

#### Acceptance Criteria

1. WHERE the Viewport width corresponds to a mobile layout, THE Landing_Page SHALL stack the Hero_Panel content vertically.
2. WHERE the Viewport width corresponds to a mobile layout, THE Landing_Page SHALL reduce panel padding and scale typography to fit the Viewport width.
3. THE Landing_Page SHALL render responsive typography that scales across mobile, tablet, and desktop layouts.

### Requirement 15: Accessibility

**User Story:** As a visitor who relies on assistive technology, I want the page to be navigable and labeled, so that I can use it with a keyboard and screen reader.

#### Acceptance Criteria

1. THE Landing_Page SHALL use semantic HTML elements for page structure and interactive controls.
2. THE Landing_Page SHALL provide descriptive aria labels for the Menu_Control, Primary_CTA, Feature_Pills, and Auth_Modal controls.
3. WHEN the Auth_Modal is open, THE Auth_Modal SHALL confine keyboard focus to elements within the Auth_Modal.
4. WHEN a User presses the Escape key while the Auth_Modal is open, THE Auth_Modal SHALL close.
5. WHEN the Auth_Modal opens, THE Auth_Modal SHALL move keyboard focus to the first interactive element within the Auth_Modal.

### Requirement 16: Performance

**User Story:** As a visitor, I want the page to load and run smoothly, so that the premium experience is never interrupted by lag.

#### Acceptance Criteria

1. THE Landing_Page SHALL defer non-critical animation work until after the initial content render.
2. THE Background_Video SHALL load using an optimized loading strategy that prioritizes initial UI content rendering.
3. WHEN the Landing_Page renders transitions, THE Landing_Page SHALL maintain smooth motion targeting 60 frames per second.
