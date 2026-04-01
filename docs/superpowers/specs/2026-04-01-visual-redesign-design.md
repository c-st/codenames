# Codenames Visual Redesign & Tutorial

## Overview

Redesign the codenames game with a **cozy & playful** aesthetic, **chunky tactile** word cards, and an **interactive mini-game tutorial** with emoji animal characters. Add a **splash screen** as the new entry point.

## Design Decisions

- **Vibe:** Cozy & playful — rounded shapes, warm gradients, bouncy animations, friendly emoji accents
- **Cards:** Chunky & tactile — thick bottom-shadows for depth, satisfying bounce animations, feels like physical board game tiles
- **Tutorial:** Interactive mini-game — 3x3 practice board with animal characters who react to your moves
- **Entry point:** Splash screen with logo, Play button, and Learn to Play button

## App Flow

```
Splash Screen → Tutorial (opt-in) → Lobby → Game Board → Results
                                      ↑                     │
                                      └─────────────────────┘
```

- **Direct URL with session** (e.g. `codenam.es?session=abc`): skips splash, goes to lobby
- **Root URL** (`codenam.es`): shows splash screen
- Tutorial is always opt-in via "Learn to play" button

## 1. Splash Screen

New page/component shown at root URL when no session param is present.

**Layout:** Centered vertically and horizontally.
- Row of animal emojis: 🦊 🦉 🐱 🐶 🐼
- Logo: `codenam.es` — "code" in white, "nam" in accent purple (#a070e0), "." in warm rose (#ffa0c0), "es" in accent purple (#a070e0)
- Tagline: "A word guessing game for clever animals"
- Two buttons side by side:
  - **Play** (primary gradient button) — creates session and redirects to lobby
  - **Learn to play** (outlined button) — opens the tutorial

**Background:** Radial gradient from elevated purple center to dark base.

## 2. Color Palette

Replace the current pure black + DaisyUI night theme with a warm purple-based palette.

### Base Colors
| Token | Value | Usage |
|-------|-------|-------|
| `bg-base` | `#0f0f1a` | Page background |
| `bg-surface` | `#1a1530` | Card/container backgrounds |
| `bg-elevated` | `#2a1f48` | Elevated elements, modals |
| `primary` | `#8060c0` | Primary buttons, active states |
| `accent` | `#a070e0` | Accents, links, highlights |

### Team Colors (gradient pairs)
| Team | From | To |
|------|------|----|
| Purple (0) | `#9060d0` | `#b080f0` |
| Green (1) | `#40b080` | `#60d0a0` |
| Pink (2) | `#d06080` | `#f080a0` |
| Blue (3) | `#4080d0` | `#60a0f0` |

### Card Colors
| Card State | Style |
|------------|-------|
| Unrevealed | `#f5f0ff` background, `#1a1530` text (off-white, not pure white) |
| Team word | Gradient using team colors, white text |
| Neutral | `#3a3550` background, `#8078a0` text |
| Assassin | `#d04050` → `#e06070` gradient, white text |

### Card Depth Shadows
Each card type has a matching thick bottom shadow for the "raised tile" effect:
- Unrevealed: `box-shadow: 0 6px 0 #d0c0e0, 0 8px 16px rgba(0,0,0,0.3)`
- Team purple: `box-shadow: 0 6px 0 #6040a0, 0 8px 16px rgba(0,0,0,0.3)`
- Team green: `box-shadow: 0 6px 0 #308060, 0 8px 16px rgba(0,0,0,0.3)`
- Neutral: `box-shadow: 0 6px 0 #2a2540, 0 8px 16px rgba(0,0,0,0.3)`
- Assassin: `box-shadow: 0 6px 0 #a03040, 0 8px 16px rgba(0,0,0,0.3)`

## 3. Word Cards — Chunky & Tactile

Replace the current flat white cards with raised, tactile tiles.

**Visual properties:**
- `border-radius: 14px` (up from current `rounded-lg`)
- Thick bottom shadow (see shadows above) — gives the illusion of physical depth
- Gradient backgrounds for revealed team cards
- Off-white (`#f5f0ff`) for unrevealed instead of pure white

**Animations:**
- **Hover:** `translateY(-3px)` — card lifts slightly
- **Click/reveal:** Spring bounce animation (scale down then up)
- **Enter:** Fade in + slide up from below (keep current, adjust spring params)

**Spymaster view:** Unrevealed cards at 0.5 opacity (keep current behavior), team colors visible through them.

## 4. Team Badges

Redesign team info display with gradient backgrounds instead of flat solid colors.

**Layout:** Horizontal strip at the top of the game board.
- Each team gets a rounded badge with gradient background (using team gradient colors)
- Contents: Team name, emoji player avatars (letter-spaced row), remaining word count (large, bold)
- Current turn indicator: Yellow pill badge "Guessing!" on active team

## 5. Logo Update

Update the Logo component:
- "code" in white
- "nam" in accent purple (`#a070e0`)
- "." in warm rose (`#ffa0c0`)
- "es" in accent purple (`#a070e0`)
- Keep existing font weight (bold) and tracking (tighter)

## 6. Interactive Tutorial Mini-Game

A self-contained tutorial component with a simplified 3x3 board. No server connection needed — all state is local.

### Characters
- **Spymaster Owl** 🦉 — gives hints via speech bubbles
- **You (Cat)** 🐱 — the player
- **Teammate Dog** 🐶 — reacts to your moves

### Board
- 3x3 grid using the same chunky card style as the real game
- Pre-defined words and assignments (not random)
- Same visual treatment as the real board (gradient colors, depth shadows)

### Tutorial Steps (6 total, shown via step progress dots)

**Step 1 — Meet the team:**
- Show the 3 animal characters
- Speech bubble from Owl: "Welcome, Agent Cat! You and Dog are operatives. I'm your Spymaster — I can see which words belong to our team!"
- Tap to continue

**Step 2 — How hints work:**
- Owl gives hint: "Fruit, 2"
- Speech bubble explains: the word is the clue, the number is how many cards match
- Correct cards pulse with a highlight border
- Player taps APPLE → card reveals as team color, Dog cheers
- Player taps CHERRY → card reveals, both animals celebrate 🎉

**Step 3 — Wrong guess:**
- New hint from Owl: "Sky, 1"
- Player taps RIVER (wrong) → card reveals as opponent color
- Dog looks worried 😰
- Speech bubble: "Oops! That word belongs to the other team. Your turn is over."

**Step 4 — The assassin:**
- Highlight the assassin card with a red glow
- Speech bubble: "See this card? Never tap it — instant game over for your team!"
- No interaction needed, tap to continue

**Step 5 — Winning:**
- Skip ahead to endgame state — all team words revealed
- Animals celebrate with emoji confetti effect 🎊
- Speech bubble: "You found all your team's words! You win!"

**Step 6 — Ready:**
- Speech bubble: "You're ready, Agent Cat! Time for the real thing."
- Big "Start playing" button that navigates to the lobby (creates session)

### UI Elements
- **Speech bubbles:** Rounded container with arrow pointing to speaker, `bg-elevated` background, `border: 2px solid #4a3070`
- **Step progress:** Row of small dots at bottom, active dot in accent purple
- **Character display:** Emoji + label below, centered

## 7. General Style Changes

### Border Radius
- Cards: `14px`
- Containers/badges: `16px`
- Buttons: `16px`
- Overall rounder feel throughout

### Buttons
- Primary: Gradient fill (`#8060c0` → `#a070e0`), `box-shadow: 0 8px 24px rgba(128, 96, 192, 0.4)`, white text
- Secondary/outlined: `bg-elevated` background, `border: 2px solid #4a3070`, accent purple text
- Destructive: Keep red but match the warmer palette

### Typography
- Keep Geist Sans/Mono fonts
- No changes to font sizes or weights — just color adjustments to match new palette

### Animations
- Keep all existing Motion animations
- Add: card bounce on reveal (spring with stiffness: 400, damping: 10)
- Add: hover lift on cards (translateY -3px)
- Add: emoji confetti on game win (simple emoji particles floating up)

### Tailwind Config
- Replace DaisyUI "night" theme or customize it to match new palette
- Update safelist with new gradient classes if needed
- May need to extend theme with custom colors

## 8. What NOT to Change

- Game logic, WebSocket communication, schemas — untouched
- Component structure and hooks — keep existing architecture
- Responsive behavior — keep existing breakpoints
- Player card drag-to-reorder in lobby — keep as is
- Timer component — keep countdown, just restyle colors
- Session URL sharing — keep existing flow
