POP — Design System
Utility Studio · v1.0

Neo-brutalist, high-energy, flat-color design language. Everything is loud onpurpose: thick ink borders, hard offset shadows, chunky uppercase type, springymotion. If an element doesn't cast a hard shadow or move when you touch it,it's not POP.

1. Principles
   Borders over soft shadows. Every interactive surface gets a 2.5px inkborder. Depth is faked with offset ink shadows — never blur.
   Motion is feedback. Hover = element lifts, shadow grows. Press = elementsinks, shadow shrinks. Every interactive element does both. No exceptions.
   Flat color only. No gradients, no glows, no glassmorphism. One flataccent color per component, max.
   Loud but legible. Display type is uppercase and oversized; body type isquiet, plain Inter. Never shout in body copy.
   Chunky rhythm. Generous padding inside, tight gaps between. Cards sitclose together like objects on a desk.
2. Color
   Surfaces & ink
   Token Hex Usage
   paper #FBEEE0 Page background (always with dot texture, §6)
   surface #FFFFFF Cards, inputs, pills, buttons
   ink #141414 Borders, shadows, primary buttons, display type
   ink-soft #4A4237 Secondary body text on paper
   ink-muted #5C554A Card descriptions, helper text
   ink-faint #A89F8D Decorative only (index numbers, timestamps)
   highlight #FFD23F Stickers, emphasis fills, celebratory selection
   Accent ramp
   Assign one accent per component via --acc. Accents fill icon tiles,badges, and tags — they are never used for body text.

Token Hex Icon glyph on fill
blue #3B82F6 white
indigo #6366F1 white
purple #A855F7 white
rose #F43F5E white
green #10B981 ink
sky #0EA5E9 ink
cyan #06B6D4 ink
amber #F59E0B ink
The glyph column is a hard rule (contrast ≥ 3:1). White on amber fails —don't eyeball it, follow the table.

Rules
Ink (#141414) is the only border/shadow color in the entire system.
highlight yellow is for celebration (stickers, badges, special states) —never as a large surface.
ink-faint text is decorative. Anything that must be read uses ink-mutedor darker. 3. Typography
Role Font Spec
Display Space Grotesk 700, uppercase, clamp(52px, 9vw, 104px), line-height 0.92, ls -0.03em
H2 / H3 Space Grotesk 700, uppercase, 16–24px, line-height 1.1
Label Space Grotesk 700, 10–12px, uppercase, letter-spacing .1–.18em
Body Inter 400/500, 13–16px, line-height 1.55–1.6
Emphasis Inter 600–700 (still sentence case)
--font-display: 'Space Grotesk', sans-serif;--font-body: 'Inter', system-ui, sans-serif;
Casing rules
Display, headings, buttons, pills, badges, kickers → UPPERCASE.
Descriptions, body copy, toasts, inputs → sentence case.
Never uppercase anything longer than ~5 words besides the display headline.
Special treatments
Outlined display word: color: transparent; -webkit-text-stroke: 2.5px var(--ink);
Numbered items (#01, #02…): Space Grotesk 700, 11px, ink-faint. 4. Borders, radius, elevation
Border widths
Token Value Usage
bw 2.5px Default — every component
bw-lg 3px Emphasis (hero frames) — rare
Radius
Token Value Usage
r-pill 999px Buttons, pills, badges
r-card 14px Cards, panels
r-tile 12px Icon tiles, inputs, toast
Elevation — hard shadows only
Shadows are always ink, zero blur, positive offset. The shadow is theinteraction model:

Token Value State
sh-1 2px 2px 0 ink small elements at rest
sh-2 3px 3px 0 ink icon tiles, stickers
sh-3 4px 4px 0 ink buttons / pills at rest
sh-4 6px 6px 0 ink cards at rest / buttons hover
sh-5 10px 10px 0 ink card hover
press 1px 1px 0 ink any element being pressed
The interaction contract (memorize this table)
State Transform Shadow
rest none its token
hover translate(-2px,-2px) buttons · (-4px,-4px) cards one step up
active translate(2px,2px) buttons · (1px,1px) cards press 5. Spacing & layout
Base unit: 4px. Work in 4 / 8 / 12 / 16 / 18 / 24 / 36 / 64.
Card padding: 18px. Section vertical rhythm: 36–64px.
Container: max-width: 1060px, padding-inline: 28px (20px on mobile).
Tool grid: repeat(auto-fill, minmax(235px, 1fr)), gap 18px.
Filter row: wraps, gap 10px, sits 36px below headline, 28px above grid. 6. Texture & background
The paper background is never flat — it always carries the dot grid:

background: var(--paper);background-image: radial-gradient(rgba(20, 20, 20, .08) 1.2px, transparent 1.2px);background-size: 22px 22px;
Marquee ticker (top of page or section divider): ink bar, paper text,Space Grotesk 700 12px, letter-spacing .18em, uppercase,22s linear infinite. Content duplicated once, animated totranslateX(-50%). Pause on hover.
Sticker: highlight-yellow chip, ink border + sh-2, rotated 6deg,absolutely positioned near the headline. Max one per page. 7. Iconography
Library: Lucide, stroke width 2, round caps and joins.
Sizes: 22px in tiles, 13–17px inline.
Icon tile: 46×46px, radius r-tile, fill --acc, bw border, sh-2,glyph color per the accent table (§2).
Hover inside a card: rotate(-7deg) scale(1.08) with spring easing. 8. Motion
Tokens
--spring: cubic-bezier(.34, 1.6, .5, 1); /_ overshoot — entrances, tiles _/--smooth: cubic-bezier(.2, .8, .2, 1); /_ lifts, presses _/--t-fast: 150ms; /_ press, color swaps _/--t-med: 300ms; /_ hover lifts, tiles _/--t-pop: 500ms; /_ entrances _/
Catalog
Animation Spec
Card entrance scale(.7) rotate(-3deg) → 1, --t-pop, spring, staggered 50ms/item
Page entrance fade + translateY(14px) → 0, 600ms, smooth
Hover lift see interaction contract (§4)
Tile wiggle rotate(-7deg) scale(1.08), --t-med, spring
Arrow nudge translateX(4px), 200ms
Sticker debut rotate(-20deg) scale(0) → rotate(6deg) scale(1), 600ms spring, 300ms delay
Rules
Only springs may overshoot. Lifts and presses always use --smooth.
Stagger comes from position: animation-delay: calc(var(--i) \* 50ms).
Everything collapses under prefers-reduced-motion (durations → 0.01ms). 9. Components
Reference implementation (pop.css) — import after tokens.css:

/_ ---------- page ---------- _/.pop-page { background: var(--paper); background-image: radial-gradient(rgba(20,20,20,.08) 1.2px, transparent 1.2px); background-size: 22px 22px; color: var(--ink); font-family: var(--font-body);}.pop-container { max-width: 1060px; margin-inline: auto; padding-inline: 28px; }.pop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(235px, 1fr)); gap: 18px; }::selection { background: var(--highlight); }:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }/_ ---------- type helpers ---------- _/.pop-display { font: 700 clamp(52px, 9vw, 104px)/.92 var(--font-display); letter-spacing: -.03em; text-transform: uppercase;}.pop-outline { color: transparent; -webkit-text-stroke: 2.5px var(--ink); }.pop-kicker { font: 700 11px var(--font-display); letter-spacing: .14em; text-transform: uppercase; }.pop-num { font: 700 11px var(--font-display); color: var(--ink-faint); }/_ ---------- button ---------- _/.pop-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border: var(--bw) solid var(--ink); border-radius: var(--r-pill); background: var(--surface); box-shadow: var(--sh-3); cursor: pointer; font: 700 13px/1 var(--font-display); letter-spacing: .06em; text-transform: uppercase; transition: transform var(--t-fast) var(--smooth), box-shadow var(--t-fast) var(--smooth);}.pop-btn:hover { transform: translate(-2px,-2px); box-shadow: var(--sh-4); }.pop-btn:active { transform: translate(2px,2px); box-shadow: 1px 1px 0 var(--ink); }.pop-btn--primary { background: var(--ink); color: var(--paper); }.pop-btn--accent { background: var(--acc, var(--highlight)); color: var(--ink); }/_ ---------- filter pill ---------- _/.pop-pill { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border: var(--bw) solid var(--ink); border-radius: var(--r-pill); background: var(--surface); box-shadow: var(--sh-3); cursor: pointer; font: 700 12.5px var(--font-display); letter-spacing: .04em; text-transform: uppercase; transition: transform var(--t-fast) var(--smooth), box-shadow var(--t-fast) var(--smooth), background var(--t-fast);}.pop-pill:hover { transform: translate(-2px,-2px); box-shadow: var(--sh-4); }.pop-pill:active { transform: translate(2px,2px); box-shadow: 1px 1px 0 var(--ink); }.pop-pill[aria-pressed="true"] { background: var(--ink); color: var(--paper); }.pop-pill sup { font-size: 10px; opacity: .55; margin-left: 3px; }/_ ---------- card ---------- _/.pop-card { position: relative; width: 100%; text-align: left; padding: 18px; cursor: pointer; border: var(--bw) solid var(--ink); border-radius: var(--r-card); background: var(--surface); box-shadow: var(--sh-4); transition: transform .18s var(--smooth), box-shadow .18s var(--smooth);}.pop-card:hover { transform: translate(-4px,-4px); box-shadow: var(--sh-5); }.pop-card:active { transform: translate(1px,1px); box-shadow: var(--sh-2); }/_ ---------- icon tile ---------- _/.pop-tile { width: 46px; height: 46px; display: grid; place-items: center; border: var(--bw) solid var(--ink); border-radius: var(--r-tile); background: var(--acc); color: #fff; box-shadow: var(--sh-2); transition: transform var(--t-med) var(--spring);}.pop-card:hover .pop-tile { transform: rotate(-7deg) scale(1.08); }.pop-tile--ink-text { color: var(--ink); } /_ REQUIRED on green/sky/cyan/amber _//_ ---------- badge / tag ---------- _/.pop-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border: var(--bw) solid var(--ink); border-radius: var(--r-pill); background: var(--surface); font: 700 10px var(--font-display); letter-spacing: .1em; text-transform: uppercase;}.pop-badge i { width: 7px; height: 7px; border-radius: 50%; background: var(--acc); }/_ ---------- input ---------- _/.pop-input { display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 14px; border: var(--bw) solid var(--ink); border-radius: var(--r-tile); background: var(--surface); box-shadow: var(--sh-3); cursor: text; transition: transform var(--t-fast) var(--smooth), box-shadow var(--t-fast) var(--smooth);}.pop-input:focus-within { transform: translate(-2px,-2px); box-shadow: var(--sh-4); }.pop-input input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font: 500 14px var(--font-body); color: var(--ink); }.pop-input input::placeholder { color: var(--ink-faint); }/_ ---------- marquee ---------- _/.pop-marquee { background: var(--ink); color: var(--paper); overflow: hidden; white-space: nowrap; padding: 10px 0; }.pop-marquee > div { display: inline-block; font: 700 12px var(--font-display); letter-spacing: .18em; text-transform: uppercase; animation: pop-marquee 22s linear infinite; }.pop-marquee:hover > div { animation-play-state: paused; }@keyframes pop-marquee { to { transform: translateX(-50%); } }/_ ---------- sticker ---------- _/.pop-sticker { display: inline-block; padding: 8px 14px; transform: rotate(6deg); border: var(--bw) solid var(--ink); border-radius: 10px; background: var(--highlight); box-shadow: var(--sh-2); font: 700 11px var(--font-display); letter-spacing: .12em; text-transform: uppercase;}/_ ---------- toast ---------- _/.pop-toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); padding: 10px 18px; border-radius: var(--r-tile); background: var(--ink); color: var(--paper); box-shadow: var(--sh-3); font: 600 13px var(--font-body); z-index: 100;}/_ ---------- entrance ---------- _/@keyframes pop-in { from { opacity: 0; transform: scale(.7) rotate(-3deg); } }.pop-in { animation: pop-in var(--t-pop) var(--spring) backwards; animation-delay: calc(var(--i, 0) _ 50ms); }/_ ---------- reduced motion ---------- _/@media (prefers-reduced-motion: reduce) { _, _::before, _::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }}
Usage examples
Tool card

<button class="pop-card pop-in" style="--i:2; --acc:var(--rose)"> <div style="display:flex; justify-content:space-between; align-items:center"> <span class="pop-badge" style="--acc:var(--rose)"><i></i>Design</span> <span class="pop-num">#06</span> </div> <span class="pop-tile" style="margin-top:14px"><!-- lucide icon --></span> <h3 style="font:700 16px var(--font-display); text-transform:uppercase; margin-top:14px"> Gradient Studio </h3> <p style="font-size:12.5px; color:var(--ink-muted); margin-top:4px"> Craft, preview and export CSS gradients. </p></button>
Filters

<div role="group" aria-label="Filter by category" style="display:flex; gap:10px; flex-wrap:wrap">  <button class="pop-pill" aria-pressed="true">All<sup>8</sup></button>  <button class="pop-pill" aria-pressed="false">Design<sup>2</sup></button></div>
10. Accessibility
Focus: :focus-visible → 3px solid ink, offset 3px. Never remove it.
Contrast: ink on paper ≈ 13:1, paper on ink ≈ 17:1. Follow the accentglyph table (§2) — amber/sky/cyan/green tiles use ink glyphs.
Hit areas: interactive elements ≥ 40px tall (pills 40px, cards 46px+).
Motion: all animation collapses under prefers-reduced-motion.
State: selection uses aria-pressed (pills) — color is never the onlysignal; the fill flips to ink.
ink-faint is for decorative text only (indexes); never for copy thatmust be read.
11. Do / Don't
Do

✅ Give every interactive element the hover-lift / press-sink contract.
✅ One accent per card, chosen from the 8-color ramp.
✅ Uppercase + letterspace all labels; keep descriptions quiet.
✅ Number things (#01) — it's part of the charm.
✅ Communicate elevation state through increasing ink-shadow size.
Don't

❌ Soft/blurry shadows, gradients, glows, glass blur — anywhere.
❌ Accent-colored body text or thin (1px) borders.
❌ More than one sticker or marquee per view.
❌ White icons on amber/sky/cyan/green fills.
❌ New colors outside the ramp without updating this doc first. 12. Adoption checklist (new screen)
Wrap the page in .pop-page + .pop-container.
Headline = .pop-display (optionally one .pop-outline word) + optional sticker.
Controls use .pop-pill / .pop-btn / .pop-input — no bespoke inputs.
Content in a .pop-grid of .pop-cards, each with --acc + --i stagger.
Every card/section gets a .pop-in entrance.
Feedback via .pop-toast; verify the hover/press contract on anything clickable.
Appendix A — Token sheet (tokens.css)
:root { /_ surfaces & ink _/ --paper: #FBEEE0; --surface: #FFFFFF; --ink: #141414; --ink-soft: #4A4237; --ink-muted: #5C554A; --ink-faint: #A89F8D; --highlight: #FFD23F; /_ accent ramp _/ --blue: #3B82F6; --green: #10B981; --indigo: #6366F1; --sky: #0EA5E9; --cyan: #06B6D4; --purple: #A855F7; --rose: #F43F5E; --amber: #F59E0B; /_ structure _/ --bw: 2.5px; --r-pill: 999px; --r-card: 14px; --r-tile: 12px; /_ elevation _/ --sh-1: 2px 2px 0 var(--ink); --sh-2: 3px 3px 0 var(--ink); --sh-3: 4px 4px 0 var(--ink); --sh-4: 6px 6px 0 var(--ink); --sh-5: 10px 10px 0 var(--ink); /_ motion _/ --spring: cubic-bezier(.34, 1.6, .5, 1); --smooth: cubic-bezier(.2, .8, .2, 1); --t-fast: 150ms; --t-med: 300ms; --t-pop: 500ms; /_ fonts _/ --font-display: 'Space Grotesk', sans-serif; --font-body: 'Inter', system-ui, sans-serif;}
Appendix B — Tailwind v4 mapping (@theme)
@theme { --color-paper: #FBEEE0; --color-surface: #FFFFFF; --color-ink: #141414; --color-ink-soft: #4A4237; --color-ink-muted: #5C554A; --color-ink-faint: #A89F8D; --color-highlight: #FFD23F; --color-acc-blue: #3B82F6; --color-acc-green: #10B981; --color-acc-indigo: #6366F1; --color-acc-sky: #0EA5E9; --color-acc-cyan: #06B6D4; --color-acc-purple: #A855F7; --color-acc-rose: #F43F5E; --color-acc-amber: #F59E0B; --font-display: "Space Grotesk", sans-serif; --font-body: "Inter", system-ui, sans-serif; --radius-card: 14px; --radius-tile: 12px; --shadow-brut-1: 2px 2px 0 #141414; --shadow-brut-2: 3px 3px 0 #141414; --shadow-brut-3: 4px 4px 0 #141414; --shadow-brut-4: 6px 6px 0 #141414; --shadow-brut-5: 10px 10px 0 #141414; --ease-spring: cubic-bezier(.34, 1.6, .5, 1); --ease-smooth: cubic-bezier(.2, .8, .2, 1);}
Tailwind card example:

class="border-[2.5px] border-ink rounded-card bg-surface shadow-brut-4 hover:shadow-brut-5 hover:-translate-x-1 hover:-translate-y-1 active:translate-x-0.5 active:translate-y-0.5 transition-[transform,box-shadow] ease-smooth"
How to use it:

Save the block above as design.md (docs folder or repo root).
Copy Appendix A into tokens.css and §9 into pop.css — import both and the component classes work immediately, no build step needed.
If your app is Tailwind v4, use Appendix B instead of tokens.css and the utility classes (border-ink, shadow-brut-4, etc.) become available.
Two implementation notes baked into the doc: the accent/glyph contrast table in §2 fixes the white-on-amber icon issue from the prototype, and the §4 "interaction contract" table is the single most important thing to enforce in code review — it's what makes the whole system feel coherent.
