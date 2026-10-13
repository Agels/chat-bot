# DESIGN.md

> Direction for the chat bot frontend. Written by the agent from a three-answer brief, not by a designer.
> Agent-chosen style leans toward default AI taste, so treat every choice here as a starting point and overwrite anything that does not feel like yours.

## Brief (from the owner)

- **Product:** a chat bot that works as a personal finance assistant. It keeps a money notebook for the user (income, a savings goal, and expenses read from receipts or the chat) and answers from those numbers.
- **Audience:** general public, not technical, not finance professionals.
- **Mood:** warm and friendly.

## Identity

A patient friend who is good with money, sitting at the kitchen table with a notebook. Not a bank, not a trading app, not a tech demo.

- **Name and logo:** not decided. Use the product name as plain text until the owner supplies one. Do not invent a logo or mascot.
- **Language and currency:** not decided. Ask the owner before writing final copy.

## Personality

- Plain words over finance jargon. If a term is needed, it is explained in the same sentence.
- Calm about money. No urgency, no fear, no hype about returns.
- Honest about limits: the bot gives general information and is not a licensed advisor. This is said once, plainly, where the user will see it.
- Never shows numbers, rates, or statistics the bot did not get from the user or from a real source.

## Palette

Two core colors and one accent on warm neutrals. Paper and ink instead of white and grey, because the reference is a household notebook, not a dashboard.

| Role | Light | Dark | Used for |
|---|---|---|---|
| Background | `#FBF6EC` | `#1C1A17` | Page |
| Surface | `#F1E8D8` | `#2A2622` | Bot messages, input field |
| Ink | `#2A2420` | `#F3EBDD` | Body text |
| Muted ink | `#6B5F55` | `#B8AC9E` | Timestamps, hints |
| Core: ledger green | `#1F5A4A` | `#8FCDB6` | User messages, links, focus ring |
| Accent: terracotta | `#B4472B` | `#F0A489` | The send button, error text, and an over-budget or over-plan amount. Nothing else |

Contrast, checked against WCAG AA (4.5:1 for normal text):

- Light: ink on background 14.2, ink on surface 12.6, muted on background 5.8, muted on surface 5.1, background on green 7.4, background on terracotta 5.0.
- Dark: ink on background 14.7, ink on surface 12.7, muted on background 7.8, muted on surface 6.7, background on green 9.6, background on terracotta 8.6.

Text on the green and terracotta fills uses the background color of the same theme.

No gradients, no glow, no glass. A finance assistant for the general public has no strong reason for a fixed theme, so ship a working light and dark toggle, with light as the default.

## Typography

- **Body and UI:** Atkinson Hyperlegible. Chosen because its digits and look-alike letters (0 and O, 1 and l) are hard to confuse, which matters when people read amounts of money.
- **Product name and headings:** Lora. A bookish serif that carries the notebook warmth, used only for the name and any heading.
- **Amounts:** tabular figures (`font-variant-numeric: tabular-nums`) so numbers line up in lists.
- Body size 16px minimum, line height about 1.5. No uppercase labels with wide tracking, no monospace.

## Shape and space

- Radius: 14px on message bubbles, 10px on the input and buttons. Bubbles are not pills.
- One shadow at most, on the input bar where it floats over the conversation. Everything else sits flat on the paper.
- The conversation column is narrow (about 640px) so lines stay easy to read.

## Identity motif

The ledger line: when the bot lists amounts, each row is a label, a dotted leader, and a right-aligned amount in tabular figures, like a handwritten budget. It is the one repeated gesture, and it appears only where there are real amounts to show.

## Motion

- New messages ease in over about 150ms so the eye can follow who spoke.
- A quiet typing indicator while the bot is answering.
- Nothing loops when the app is idle. Respect `prefers-reduced-motion`.

## Dials

Dial: ENERGY 2 / RHYTHM 2 / MOTION 2
