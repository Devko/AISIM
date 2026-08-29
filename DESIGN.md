---
name: Exposure Race
description: An argument typeset with a masthead, running on a measuring device's chassis.
colors:
  ink: "#FBFCFC"
  panel: "#FFFFFF"
  sunk: "#F1F5F4"
  rule: "#DDE6E4"
  rule-strong: "#C4D3D0"
  txt: "#0B1615"
  muted: "#5A716D"
  dim: "#657B77"
  defender-teal: "#0A7A69"
  attacker-vermilion: "#D0451B"
  compromise-crimson: "#C81E3C"
  pre-patch-violet: "#7A2FD6"
  assumed-amber: "#96670A"
typography:
  display:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(30px, 5.4vw, 58px)"
    fontWeight: 800
    lineHeight: 0.96
    letterSpacing: "-0.032em"
  headline:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  lead:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.55
  control:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
  caption-sm:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "10.5px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.16em"
  label-micro:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.1em"
  label-min:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "9.5px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.14em"
  label-btn:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.04em"
  value:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.3
  value-sm:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  marker: "2px"
  xs: "3px"
  sm: "4px"
  thumb: "5px"
  md: "7px"
  lg: "8px"
  xl: "12px"
  full: "50%"
spacing:
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "16px"
  xl: "22px"
components:
  button:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.txt}"
    rounded: "{rounded.md}"
    padding: "6px 11px"
    typography: "{typography.body}"
  button-hover:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.defender-teal}"
  button-on:
    backgroundColor: "{colors.defender-teal}"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.txt}"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.txt}"
    rounded: "{rounded.md}"
    padding: "5px 8px"
    typography: "{typography.label}"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.txt}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
  stat:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.compromise-crimson}"
    rounded: "{rounded.xl}"
    padding: "13px 14px 12px"
  tag-measured:
    backgroundColor: "transparent"
    textColor: "{colors.defender-teal}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  tag-reported:
    backgroundColor: "transparent"
    textColor: "{colors.pre-patch-violet}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  tag-assumed:
    backgroundColor: "transparent"
    textColor: "{colors.assumed-amber}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  toast:
    backgroundColor: "{colors.txt}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "9px 16px"
---

# Design System: Exposure Race

## Overview

**Creative North Star: "The Instrumented Broadsheet"**

An argument typeset with a masthead, running on a measuring device's chassis.
The page has a thesis and states it in display type at the top of the screen —
then hands the reader an instrument and lets them try to break it. Neither half
is decoration for the other. The masthead earns the instrument; the instrument
is why the masthead is believable.

The proportions are deliberate and worth preserving. The display face appears in
exactly three roles — the headline, panel titles, and the four stat values.
Everything structural is monospace, uppercase, tracked wide at 9.5–10.5px:
eyebrow, card headings, segment labels, table headers, provenance tags, anchor
values. That makes the instrument engraving the majority surface and the
editorial voice the punctuation. When display type does appear it carries real
weight — 800, tracked to −0.032em, leading at 0.96, capped at 17ch so it breaks
as a masthead rather than a paragraph.

Colour is signal and nothing else. Five accents exist, each bound to a concept
in the model — attacker, defender, pre-patch, assumed, compromised — and none of
them appears for emphasis, rhythm, or brand warmth. The one place the display
face turns colour is `h1 em`, on the clause where the argument turns. Density is
high and unapologetic: this reader is defending a policy position and does not
need progressive disclosure of things they already know.

**Key Characteristics:**

- Instrument substrate in monospace; editorial voice in a heavyweight grotesque
- Five semantic accents, zero decorative colour
- One palette definition; dark is a token-only override, never a separate design
- Near-black-green ground rather than neutral grey — the whole system is hued
- Hairline rules and tonal steps do the structural work that shadows usually do
- Provenance is visible ornament: every number is tagged `measured`, `reported`,
  or `assumed`

## Colors

A hued near-monochrome — every neutral carries a green cast, so the surface
reads as a treated material rather than default grey — cut by five accents that
each mean exactly one thing.

The palette is normative in the frontmatter above as its light values, because
`css/app.css` defines the complete palette on `:root` in light and treats dark
as an override. Note that the shipped page nevertheless opens in dark
(`<html data-theme="dark">`): light is the *definitional* baseline, dark is the
*default experience*. Dark equivalents live in `.impeccable/design.json`.

### Primary

- **Defender Teal** (`--def`): the colour of things working. Measured
  provenance, the active state on every control, slider fills and thumbs, the
  "good" stat value, remediation figures in the actions list, and the focus
  ring. It is the single most load-bearing accent and the only one that appears
  on interactive chrome.

### Secondary

- **Attacker Vermilion** (`--att`): the adversary side of every opposition.
  Threat-environment card headings, the emphasised clause in the headline, and
  the attacker series in charts. Where it appears on a control card, the card's
  slider thumbs and values invert to it — the panel changes sides.

### Tertiary

- **Pre-Patch Violet** (`--zero`): the day-zero boundary. It draws the vertical
  patch-availability line, shades the region where exploitation precedes any
  patch, and labels both. It doubles as the `reported` provenance tag.
- **Assumed Amber** (`--warn`): judgement rather than measurement. The `assumed`
  provenance tag, and the mid-tier band in severity charts.
- **Compromise Crimson** (`--bad`): outcomes gone wrong. The default stat value,
  the worst severity band, and highlighted rows in the evidence table.

### Neutral

- **Ink** (`--ink`): the page ground. Near-white in light, near-black-green in
  dark.
- **Panel** (`--panel`): every raised surface — cards, panels, stat tiles.
- **Sunk** (`--sunk`): recessed fills; inline code in the footer.
- **Rule** (`--rule`) and **Rule Strong** (`--rule2`): the hairline vocabulary.
  Rule for dividers inside content, Rule Strong for control borders, table head
  underlines, and the scrollbar thumb.
- **Text** (`--txt`), **Muted** (`--mut`), **Dim** (`--dim`): the three-step
  reading ramp. Muted carries all secondary prose; Dim is reserved for chart
  interiors and hover states.

### Named Rules

**The Single Definition Rule.** The complete palette is defined once, on
`:root`. Dark is a token-only override applied by *both* `prefers-color-scheme`
and `[data-theme="dark"]`, with identical values in each. No colour is ever
defined only inside a media query — an explicit toggle must be able to win in
both directions.

**The Semantic-Only Rule.** A colour carries a meaning from the model or it does
not appear. There is no decorative accent, no brand colour, and no palette entry
whose job is visual interest. If a new element needs colour, it needs a reason
first.

**The Palette Bridge Rule.** Charts do not carry their own colours. `js/app.js`
reads the same custom properties off the document at draw time and passes them
into the SVG layer, so a theme change repaints the charts from one source. Never
hardcode a hex into chart code.

**The Browser Surface Rule.** The surfaces the page does not draw are themed
from the palette too. `::selection` takes Defender Teal with ink text (5.1:1 in
light, 10.7:1 in dark), and `color-scheme` is declared alongside the tokens in
every theme block so scrollbars and form controls follow the page's explicit
choice rather than the OS. A light scrollbar on a near-black page is the tell
that a theme was only half implemented.

## Typography

**Display Font:** Bricolage Grotesque (with `ui-sans-serif`, `system-ui`)
**Body Font:** IBM Plex Sans (with `ui-sans-serif`, `system-ui`, `-apple-system`)
**Label/Mono Font:** IBM Plex Mono (with `ui-monospace`, `SFMono-Regular`, Menlo)
**Chart Font:** system stack only — deliberately no webfont

**Character:** A variable grotesque with real personality at heavy weights,
paired with the most institutionally neutral technical family available. The
pairing is the thesis in miniature: an opinionated voice making claims, resting
on instrumentation that is conspicuously not trying to persuade anyone.

### Hierarchy

- **Display** (800, `clamp(30px, 5.4vw, 58px)`, 0.96, −0.032em): the page
  headline only. Capped at 17ch so it breaks like a masthead.
- **Headline** (800, 34px, 1.05, −0.03em): the four stat values. Units are set
  alongside in the body face at 12px so the numeral keeps the whole weight.
- **Title** (700, 19px, −0.015em): panel headings.
- **Body** (400, 15px, 1.55): all prose. Measure is capped — 76ch for the
  standfirst, 78ch for panel leads.
- **Label** (600, 10.5px, 0.16em, uppercase, mono): every structural label.
  Tracking runs 0.08em–0.18em depending on size; the smaller the type, the wider
  the tracking.

Beneath those five sit nine secondary steps — `lead` 13.5, `control` 13,
`caption` 12, `caption-sm` 11.5, `label-btn` 11, `label-micro` 10, `label-min`
9.5, and the mono readouts `value` 14 and `value-sm` 12.5. Fourteen steps is a
dense ramp, and that density is the design rather than drift: an instrument with
this much simultaneous labelling needs finer gradation than an editorial page,
and the steps are what keep four levels of subordinate text legible inside a
330px rail. They are all in the frontmatter; treat that as the closed set and
add a step only by documenting it there first.

### Named Rules

**The PNG Rule.** Chart text uses `--chart` — a pure system stack — never a
webfont. Charts export to PNG, and a webfont that has not loaded at export time
silently changes the output. This is why the system runs three typefaces on
screen and a fourth inside the charts.

**The Long Label Rule.** Uppercase with wide tracking is a device for labels of
two or three words. The stat labels are 40-character sentences, and caps plus
tracking removes the word shapes a reader navigates by — so they are set in the
body face, sentence case, at 11.5px. Reach for the mono label style only when
the label is genuinely a label.

**The 10px Floor.** No text below 10px. 9.5px survives only in tags and segment
labels where the type sits on a panel with a border already doing the
de-emphasis; 9px was tested against the card and could not clear AA in either
theme.

## Layout

A two-column grid — a 330px control rail beside a fluid results column —
capped at 1340px with 20px gutters. The three grid children (rail, stats,
results) are placed explicitly rather than flowing, precisely so the single
column can reorder them.

The rail is sticky at `top: 14px`, its own scroll container bounded to
`calc(100vh - 28px)`, with a deliberately visible thin scrollbar: a wheel
gesture landing on the rail must not read as a dead page.

Three breakpoints, each with a specific job rather than a device name:

- **1040px** — grid collapses to one column and the stat row moves *ahead* of
  the controls.
- **940px** — paired chart panels stack.
- **860px / 780px** — the anchors list goes single-column; the stat grid drops
  from four columns to two.

Panel headings and their tools share one intrinsic row: the title holds a 260px
flex basis and the row is allowed to wrap, so the tools drop beneath the heading
exactly when holding them inline would squeeze it. No breakpoint governs this —
a panel with one small tool button keeps it inline at every width, while a
four-button toolbar steps down on a phone.

Rhythm is tight and consistent: 14px between stacked cards, 22px across the
column gap, 16px inside cards, 13–14px inside stat tiles. A print stylesheet
drops the rail, tools, and topbar, and resets the explicit grid placement so the
first column is not left empty.

### Named Rules

**The Answer First Rule.** Below 1040px the stat row is ordered before the
control rail. The page exists to show a number, and burying it under a full
screen of inputs made every phone visitor pay for the controls before seeing the
answer. Any future reflow keeps the answer above the instrument.

## Elevation & Depth

Depth is **asymmetric by design, and the asymmetry is the rule rather than an
oversight**. In light, `--shadow` is a two-layer lift: a 1px contact shadow plus
a wide, heavily-negative-spread ambient. In dark it is set explicitly to `none`,
and surfaces separate by tonal step — panel `#0D1817` against ink `#080F0E` —
plus a 1px `--rule` hairline. On a near-black ground a shadow reads as grime
rather than lift, so the system stops using them entirely.

This makes the hairline rule, not the shadow, the primary structural device
across the whole system: card borders, table underlines, list dividers, the
header rule, the footer rule, and the `::after` rule that runs off the end of
the eyebrow.

### Shadow Vocabulary

- **Surface lift** (`box-shadow: 0 1px 2px rgba(11,22,21,.06), 0 8px 24px -12px rgba(11,22,21,.18)`):
  light mode only, applied to cards, panels, and stat tiles. Note the shadow is
  tinted with the ink hue, not neutral black.
- **Control ring** (`box-shadow: 0 0 0 1px var(--def)`): the range thumb only —
  a hairline halo that keeps a 15px circle legible against both the track and
  the panel it overlaps.

### Named Rules

**The Asymmetric Depth Rule.** Shadow is a light-mode device. Dark mode carries
`--shadow: none` and separates surfaces tonally. Never introduce a shadow that
survives into dark, and never compensate for the missing shadow with a heavier
border — the tonal step plus one hairline is the whole vocabulary.

**The State-Is-Not-Elevation Rule.** Depth marks *what a surface is*, never what
it is doing. No control lifts on hover, nothing rises on focus, and nothing
casts a shadow to indicate interactivity. State is signalled by colour and
border alone.

## Shapes

A radius ladder scaled to element size: the smaller the element, the tighter the
corner. 2px on the trait chip's checkbox marker, 3px on focus rings and segment
hints, 4px on provenance tags, legend swatches, and inline code, 5px on the
rail's scrollbar thumb, 7px on buttons, 8px on the toast, 12px on every card,
panel, and stat tile. The only full radius in the system is the range thumb
(`50%`).

Borders are uniformly 1px and never doubled. Two weights only: `--rule` for
dividers within content, `--rule2` for anything that reads as an edge a user can
act on — control borders, table head underlines, the chip marker, the scrollbar
thumb.

Provenance tags take their border from `currentColor`, so the tag's outline and
its text are always the same accent and a new provenance class needs one colour
declaration rather than two.

### Named Rules

**The Hairline Rule.** Every border in the system is 1px. Weight is expressed by
choosing `--rule` or `--rule2`, never by thickening the stroke.

## Components

### Buttons

- **Shape:** gently rounded (7px), 1px `--rule2` border, 12px type.
- **Rest:** panel fill, body text colour, no accent whatsoever.
- **Hover:** border and text both shift to Defender Teal. Background does not
  change. Transitions are 0.12s on background, border-colour, and colour.
- **Selected (`.on`):** teal fill, teal border, ink text, weight 600 — the only
  state that reverses the figure and ground.
- **Ghost:** transparent background, otherwise identical.
- **Icon button:** mono face, 11px, 0.04em tracking, tighter 5px/8px padding.
  Used for the theme, share, and reset controls in the eyebrow, and for panel
  tools.

### Chips (trait selection)

- **Style:** built from the button base, with `padding-left: 20px` and a 9px
  `::before` square marker at 2px radius, `--rule2` border.
- **State:** when selected, the marker fills with `currentColor` — so the marker
  inherits whichever accent the surrounding card is using rather than
  hardcoding teal.
- **Why:** traits are multi-select and had to stop reading as one-of-N. The
  checkbox affordance is doing semantic work, not decoration.

### Cards / Containers

- **Corner style:** 12px.
- **Background:** `--panel` on `--ink`.
- **Shadow strategy:** `--shadow` — light only. See Elevation & Depth.
- **Border:** 1px `--rule`.
- **Internal padding:** 16px, with 14px bottom margin between stacked cards.
- **Heading:** mono, 10.5px, 0.16em, uppercase, weight 600. A `.d` or `.a`
  modifier tints the heading Defender Teal or Attacker Vermilion, which is how a
  card declares which side of the model it belongs to — and that choice cascades
  to the card's slider values and thumbs.

### Stat tiles

- **Structure:** flex column with the label set to `flex: 1`, so the value is
  pushed to the bottom of the tile rather than sitting under a guessed
  `min-height`. Grid stretches tiles to equal height, so values align across the
  row regardless of how many lines each label wraps to.
- **Label:** body face, 11.5px, no tracking, `--mut`. See The Long Label Rule.
- **Value:** display face, 800, 34px, Compromise Crimson by default;
  `.good` switches it to Defender Teal, `.plain` to body text. Figures are
  tabular — these four resimulate on every parameter change, and Bricolage's
  proportional digits varied 41px across four characters, twitching the row
  sideways on every slider drag.
- **Unit:** body face, 12px, 500, `--mut`, inline after the numeral.
- **Interval:** mono, 10.5px, `--mut`, directly beneath.

### Range inputs

- **Track:** 3px, `--track`, 2px radius.
- **Thumb:** 15px circle, Defender Teal fill, 2px `--panel` border, plus a 1px
  teal ring. On an Attacker Vermilion card, fill and ring both invert to
  vermilion.
- **Cursor:** `grab`, becoming `grabbing` while active.
- **Hit area:** 24px tall, clearing the AA target minimum. The thumb offset is
  measured from the track rather than the box, so the box height can change
  without decentring it.

### Disclosure (`details.more`)

- **Summary:** mono, 12px, uppercase, 0.08em, `--mut`, native marker removed.
- **Marker:** a teal `+` that becomes `−` when open, generated from
  `::before` content.
- **Separation:** a `--rule` top border with 10px of padding above.

### Provenance tags

- **Style:** mono, 9.5px, 0.1em, uppercase, 2px/6px padding, 4px radius, border
  from `currentColor`, transparent fill.
- **Variants:** `.m` measured (Defender Teal), `.r` reported (Pre-Patch Violet),
  `.a` assumed (Assumed Amber).
- **Signature:** this is the system's most distinctive component. It is the
  visual form of the product's central commitment, and it should appear anywhere
  a number does.

### Toast

- **Style:** fixed, bottom-centre, inverted — `--txt` background on `--ink`
  text — 8px radius, 13px/500.
- **Motion:** opacity and a 12px translate, 0.18s.
- **Semantics:** carries `role="status"` and `aria-live`.

### Named Rules

**The Quiet Control Rule.** No control carries an accent at rest. Panel fill,
hairline border, body text. Defender Teal arrives only on hover, focus, or
selection. An interface with no opinion until you touch it is what lets a
five-colour semantic palette stay readable as signal.

**The Card Declares Its Side Rule.** A control card's `.d` / `.att` modifier
tints its heading, values, and slider thumbs together. Never mix accents within
one card — the card belongs to the defender or to the attacker.

## Do's and Don'ts

### Do:

- **Do** define every new colour on `:root` first, then override it in *both*
  the `prefers-color-scheme` block and the `[data-theme="dark"]` block.
- **Do** give a new accent a meaning from the model before giving it a hex.
- **Do** pass chart colours through `palette()` in `js/app.js` so they follow
  the theme.
- **Do** set chart text in `--chart`, the system stack, so PNG export is
  deterministic.
- **Do** set labels longer than three words in the body face, sentence case.
- **Do** keep the answer above the instrument on narrow viewports.
- **Do** tag every number with its provenance — `measured`, `reported`, or
  `assumed`.
- **Do** keep prose measures capped (76–78ch) and figures `tabular-nums`,
  including any display-face number that updates live.
- **Do** theme the browser's own surfaces from the palette — selection, focus
  ring, scrollbars, and `color-scheme` — rather than shipping UA defaults.
- **Do** preserve the accessibility floor already in place: `:focus-visible`
  rings at 2px Defender Teal, `prefers-reduced-motion` killing transitions,
  `aria-label` on every chart, and `role="status"` on the toast.

### Don't:

- **Don't** build anything that reads as a security-vendor dashboard: threat
  gauges, alert-red panels, glowing gradient heroes, radar sweeps, or a large
  frightening number in a circle. That is the visual grammar of the marketing
  this page argues against, and adopting it would undercut the argument.
- **Don't** adopt BI-tool chrome: heavy panel framing competing with the data,
  toolbars, chart junk, or a default categorical palette whose colours carry no
  meaning. Every series colour here is semantic.
- **Don't** hardcode a hex anywhere outside the `:root` blocks in
  `css/app.css` — chart code included.
- **Don't** introduce a shadow that survives into dark mode, and don't thicken a
  border to compensate for its absence.
- **Don't** use elevation to signal state. Colour and border do that.
- **Don't** set uppercase tracked type below 9.5px, or any type below 10px
  outside the two bordered exceptions.
- **Don't** apply caps plus wide tracking to sentence-length labels.
- **Don't** mix Defender Teal and Attacker Vermilion inside a single card.
- **Don't** add a decorative accent, gradient, or illustration. If it does not
  carry a value from the model, it does not belong on the page.
