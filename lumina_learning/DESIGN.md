---
name: Lumina Learning
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#424754'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#727785'
  outline-variant: '#c2c6d6'
  surface-tint: '#005ac2'
  primary: '#0058be'
  on-primary: '#ffffff'
  primary-container: '#2170e4'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#855300'
  on-secondary: '#ffffff'
  secondary-container: '#fea619'
  on-secondary-container: '#684000'
  tertiary: '#994100'
  on-tertiary: '#ffffff'
  tertiary-container: '#c05400'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#ffdbca'
  tertiary-fixed-dim: '#ffb690'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#783200'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Lexend
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Lexend
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Lexend
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Lexend
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Lexend
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Lexend
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Lexend
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Lexend
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system is built to evoke an energetic, friendly, and motivating atmosphere suitable for language acquisition. It prioritizes clarity and encouragement, utilizing a style that sits at the intersection of **Modern Corporate** and **Playful Tactile**. 

The aesthetic focuses on high-legibility, vibrant feedback loops, and a sense of "soft-utility." It leverages generous whitespace and rounded geometric forms to reduce cognitive load and make the learning process feel approachable rather than academic. Visual cues are inspired by modern gamified platforms, ensuring that every interaction feels rewarding and distinct.

## Colors

The palette is anchored by a vibrant **Bright Blue** which signals intelligence and energy. The background strategy uses a tiered approach: a very light **Sky Blue** for the base page layer to reduce eye strain compared to pure white, while **Pure White** is reserved for interactive cards and containers to make them pop.

**Accents & Status:**
- **Amber & Orange:** Used exclusively for high-engagement actions, streak milestones, and secondary highlights to provide warmth against the cool blue base.
- **Success & Error:** These are highly saturated to provide immediate, unambiguous feedback during exercises and quizzes.

## Typography

This design system utilizes **Lexend** across all roles. Designed specifically to improve reading proficiency, its expanded character width and unique spacing make it ideal for an educational context.

- **Headlines:** Use Bold or Semi-Bold weights with slight negative letter-spacing for a punchy, modern look.
- **Body Text:** Standard weight is used for readability. Ensure a high contrast ratio against the white surface backgrounds.
- **Micro-copy:** Labels and captions use Medium or Semi-Bold weights to maintain legibility at smaller scales.

## Layout & Spacing

The layout follows a **Fluid Grid** model with strict maximum widths for content readability. A consistent 8px base unit drives all spatial decisions.

- **Desktop:** 12-column grid with 24px gutters. Use wide 40px outer margins to create a "floating" feel for the central content.
- **Tablet:** 8-column grid with 20px gutters.
- **Mobile:** 4-column grid with 16px gutters.
- **Rhythm:** Use "stack" variables to maintain vertical rhythm. Content blocks should be separated by `stack-lg` (32px) to ensure the interface feels "airy" and uncrowded.

## Elevation & Depth

To match the friendly and tactile nature of the brand, depth is achieved through **Ambient Shadows** and **Tonal Layering** rather than harsh borders.

- **Surface Levels:** 
  - Level 0: Sky Blue Page Background (#F0F9FF).
  - Level 1: White Surface Containers (#FFFFFF) with a soft shadow.
- **Shadow Style:** Use multi-layered shadows. A primary soft blur (Y: 4px, B: 12px, Opacity: 6% Primary Color) combined with a tight "organic" shadow (Y: 2px, B: 4px, Opacity: 4% Neutral Color).
- **Interactive States:** On hover, elements should lift slightly (increase Y-offset and blur) to provide a "squishy," physical response.

## Shapes

The design system employs a **Pill-shaped/Heavy Rounded** language to reinforce its friendly persona.

- **Base Radius:** 16px (1rem) for standard components like input fields and small buttons.
- **Large Radius (rounded-lg):** 32px (2rem) for primary action buttons and feature cards.
- **Extra Large Radius (rounded-xl):** 48px (3rem) for decorative elements or main container wrappers.
- **Interactive Elements:** Buttons should always feel "bouncy." Avoid sharp corners entirely to maintain a child-friendly and approachable safety aesthetic.

## Components

### Buttons
- **Primary:** Bright Blue background, white text. Bold weight. `rounded-lg` (32px). Include a 2px bottom "border-shade" in a slightly darker blue to give a 3D-pressable feel.
- **Secondary:** Amber or Orange background. Used for "Start Lesson" or "Claim Reward."
- **Tertiary/Ghost:** Transparent background with Primary Blue text.

### Cards
- Always Pure White (#FFFFFF).
- `rounded-xl` (48px) for major module cards.
- Subtle 1px border in a very light grey (#E2E8F0) to define edges against the Sky Blue background.

### Input Fields
- White background, 16px rounding.
- Focus state: 2px solid Bright Blue border with a 4px soft outer glow.

### Progress Bars
- Background: Light Blue (#DBEAFE).
- Fill: Vibrant Green (#10B981).
- Height: 12px minimum with fully rounded ends (pill).

### Feedback Toasts
- Success: Vibrant Green background with white icon/text. 
- Error: Coral Red background. 
- Positioned at the top-center to ensure visibility during active learning.

### Additional Components
- **Lesson Chips:** Small, highly rounded labels for difficulty levels (e.g., "Beginner", "A1").
- **Streak Counters:** Bold typography paired with a flame icon using the Orange/Amber gradient.