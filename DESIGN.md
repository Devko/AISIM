---
name: Exposure Race
description: A ruled document with a measuring instrument in its margin.
colors:
  ink: "#F6F8F7"
  panel: "#FFFFFF"
  sunk: "#E9EFED"
  rule: "#D3DFDB"
  rule-strong: "#7F9490"
  track: "#CBD8D5"
  txt: "#0A1514"
  muted: "#536B67"
  dim: "#5C726E"
  defender-teal: "#0A7A69"
  attacker-vermilion: "#C4400F"
  compromise-crimson: "#C11834"
  pre-patch-violet: "#7029CC"
  assumed-amber: "#8A6008"
typography:
  display:
    fontFamily: "Newsreader, ui-serif, Georgia, Times New Roman, serif"
    fontSize: "clamp(33px, 5.1vw, 60px)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.016em"
  display-em:
    fontFamily: "Newsreader, ui-serif, Georgia, serif"
    fontStyle: italic
    fontWeight: 500
  title:
    fontFamily: "Newsreader, ui-serif, Georgia, serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.22
    letterSpacing: "-0.005em"
  readout:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "clamp(28px, 2.4vw, 34px)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  readout-dock:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "19px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  readout-clock:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "17px"
    fontWeight: 500
    letterSpacing: "-0.02em"
  body:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
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
  caption-xs:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.45
  preset:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.3
  toc:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.4
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
    letterSpacing: "0.14em"
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
  lg: "9px"
  xl: "14px"
  full: "50%"
spacing:
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "18px"
  xl: "22px"
  xxl: "30px"
  chapter: "42px"
motion:
  ease: "cubic-bezier(.22, .61, .36, 1)"
  state: "140ms"
  dock: "260ms"
  settle: "320ms"
  reveal: "500ms"
  reorder: "320ms"
  race: "700ms"
components:
  button:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.txt}"
    rounded: "{rounded.md}"
    padding: "6px 11px"
    typography: "{typography.caption}"
  button-hover:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.defender-teal}"
  button-on:
    backgroundColor: "{colors.defender-teal}"
    textColor: "{colors.ink}"
  button-near:
    backgroundColor: "transparent"
    textColor: "{colors.defender-teal}"
    borderStyle: dashed
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.txt}"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.txt}"
    rounded: "{rounded.md}"
    padding: "5px 9px"
    typography: "{typography.label-btn}"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.txt}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
  chapter:
    backgroundColor: "transparent"
    borderTop: "1px solid {colors.rule-strong}"
    padding: "20px 0 0"
    marginBottom: "{spacing.chapter}"
  readout-bank:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.xl}"
    padding: "16px 18px 17px"
  dock:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.txt}"
    padding: "10px 24px"
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
    padding: "10px 17px"
---

# Design System: Exposure Race

## Overview

**Creative North Star: "The Ruled Document"**

A page with a thesis, ten numbered chapters and eight figures — ruled, not
boxed — with a measuring instrument standing in the margin beside it.

The product carries two jobs that pull against each other: it is an argument
that has to survive being retold to a board, and it is a tool a reader
configures and reads their own numbers off. The system resolves that by making
the two halves **different materials** rather than the same material at
different sizes.

The **argument is a document**. The results column has no card, no radius, no
fill and no shadow. Chapters are separated by a single `--rule2` hairline and
42px of air, numbered `01`–`10` in monospace, and headed in a serif. Nothing in
that column is a surface, because nothing in it is a control.

The **instrument is an object**. The control rail and the readout bank are the
only raised surfaces on the page: `--panel` on `--ink`, 14px radius, a hairline
border, and in light mode a shadow. They look like things you operate because
they are.

Type splits three ways with one job each, and that split is the thesis in
miniature — an opinionated voice making claims, resting on instrumentation that
is conspicuously not trying to persuade anyone:

- **Newsreader**, a text serif, carries the argument: the headline, the clause
  where it turns, and every chapter title.
- **IBM Plex Sans** carries the prose, the control labels and the interface.
- **IBM Plex Mono** carries every measurement: the four headline figures, the
  docked readout, the masthead clock, slider values, table figures, structural
  labels and provenance tags.

The four headline numbers moved from the display face to the monospace on
purpose. They resimulate on every parameter change; they are readouts, not
headlines, and they belong to the instrument. Monospace figures are also
tabular by construction, so the bank cannot twitch sideways while a slider is
dragged.

Colour is signal and nothing else. Five accents exist, each bound to a concept
in the model — attacker, defender, pre-patch, assumed, compromised — and none
of them appears for emphasis, rhythm, or brand warmth.

**Key Characteristics:**

- Two materials: a ruled document, and a raised instrument beside it
- A serif for argument, a grotesque for prose, a monospace for measurement
- Five semantic accents, zero decorative colour
- One palette definition; dark is a token-only override, never a separate design
- Hued near-monochrome — every neutral carries a green cast
- Provenance is visible ornament: every number is tagged `measured`,
  `reported`, or `assumed`
- Motion is one-shot, scroll-triggered, and never fires while a control is held

## Colors

A hued near-monochrome — every neutral carries a green cast, so the surface
reads as treated material rather than default grey — cut by five accents that
each mean exactly one thing.

The palette is normative in the frontmatter above as its light values, because
`css/app.css` defines the complete palette on `:root` in light and treats dark
as an override. The shipped page nevertheless opens in dark
(`<html data-theme="dark">`): light is the *definitional* baseline, dark is the
*default experience*.

### Primary

- **Defender Teal** (`--def`): the colour of things working. Measured
  provenance, the active state on every control, slider fills and thumbs, the
  masthead clock's figures, remediation figures in the actions list, and the
  focus ring. It is the single most load-bearing accent and the only one that
  appears on interactive chrome.

### Secondary

- **Attacker Vermilion** (`--att`): the adversary side of every opposition.
  Threat-environment card headings, the emphasised clause in the headline, and
  the attacker series in charts. Where it appears on a control card, that
  card's slider fills, thumbs and values invert to it — the panel changes
  sides, via a single `--accent` alias set on `.card.att`.

### Tertiary

- **Pre-Patch Violet** (`--zero`): the day-zero boundary. It draws the vertical
  patch-availability line, shades the region where exploitation precedes any
  patch, and labels both. It doubles as the `reported` provenance tag.
- **Assumed Amber** (`--warn`): judgement rather than measurement. The `assumed`
  provenance tag, and the mid-tier band in severity charts.
- **Compromise Crimson** (`--bad`): outcomes gone wrong. The two probability
  readouts and their credible-interval rails, the worst severity band, and
  highlighted rows in the evidence table.

### Neutral

- **Ink** (`--ink`): the page ground, and the ground every chart now draws on.
  Paper rather than white in light; near-black-green in dark.
- **Panel** (`--panel`): the two raised surfaces — the control rail's cards and
  the readout bank. Nothing in the results column uses it.
- **Sunk** (`--sunk`): recessed fills. Chart tracks, and inline code.
- **Rule** (`--rule`) and **Rule Strong** (`--rule2`): the hairline vocabulary.
  Rule for dividers within content; Rule Strong for anything that reads as an
  edge a reader can act on or a boundary between chapters.
- **Text** (`--txt`), **Muted** (`--mut`), **Dim** (`--dim`): the three-step
  reading ramp. Muted carries all secondary prose; Dim is reserved for chart
  interiors, source notes and ordinals.

### Contrast

Every text token clears 4.5:1 against both `--ink` and `--panel` in both
themes. The tightest pairs are `--dim` and `--att` at 4.82 on light ink, and
`--bad` at 5.30 on dark panel. On `--sunk` — which only ever backs chart tracks
and inline code — `--dim` and `--att` sit at 4.41; that is the one place the
ramp does not clear AA, it is 10px chart type, and it is an improvement on the
4.11 the previous palette carried there.

`--rule2` clears the 3:1 non-text threshold on both surfaces in both themes
(3.21 / 3.01 light, 3.06 / 3.40 dark). It did not before: control borders sat
at 1.55:1, which meant the only thing identifying a button was invisible.
`--rule` is deliberately below that and is only ever used where something else
already carries the boundary.

No formal WCAG level is claimed — `PRODUCT.md` leaves that an open decision —
but the numbers above are the floor a change must not regress, and
`tools/check-contrast.js` enforces them in CI alongside the calibration and
dist-freshness gates. It also enforces the Single Definition Rule directly: the
two dark blocks must carry identical values, and no token may be defined only
in one of them.

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
into the SVG layer as literal strings, so a theme change repaints the charts
from one source. Never hardcode a hex into chart code, and never leave a
`var()`, `color-mix()` or `light-dark()` unresolved in a token — it exports to
PNG as nothing at all.

**The Chart Ground Rule.** Charts draw on `--ink`, because the results column
has no panel. `exportOpts` in `js/app.js` therefore renders PNGs on `--ink`
too, and any chart element that needs to punch out of its background strokes
with `pal.ink`. A chart that assumes `--panel` behind it is a chart that
assumes a card the design no longer has.

**The Browser Surface Rule.** The surfaces the page does not draw are themed
from the palette too. `::selection` takes Defender Teal with ink text, and
`color-scheme` is declared alongside the tokens in every theme block so
scrollbars and form controls follow the page's explicit choice rather than the
OS.

## Typography

**Display Font:** Newsreader (with `ui-serif`, Georgia, Times New Roman)
**Body Font:** IBM Plex Sans (with `ui-sans-serif`, `system-ui`, `-apple-system`)
**Readout / Label Font:** IBM Plex Mono (with `ui-monospace`, SFMono-Regular, Menlo)
**Chart Font:** system stack only, and set in `js/charts.js` rather than in the
stylesheet — see The PNG Rule

**Character:** A text serif with real editorial authority at 500, paired with
the most institutionally neutral technical superfamily available. Plex Sans and
Plex Mono are siblings, so the prose and the instrumentation sit on one set of
proportions and the serif is the only voice that stands apart — which is
exactly the hierarchy the page wants. All three fallback chains are genuinely
usable, so a reader who never receives the webfonts gets a correct-looking
document rather than a broken one.

### Hierarchy

- **Display** (Newsreader 500, `clamp(33px, 5.1vw, 60px)`, 1.02, −0.016em): the
  page headline only, capped at 16ch with `text-wrap: balance` so it breaks as
  a masthead rather than a paragraph.
- **Display em** (Newsreader italic): the clause where the argument turns. It
  keeps Attacker Vermilion, but the italic is what carries it — a colour-only
  distinction disappears in greyscale, in print, and for a colour-blind reader.
- **Title** (Newsreader 600, 21px, −0.005em): chapter headings.
- **Readout** (Plex Mono 600, `clamp(28px, 2.4vw, 34px)`, −0.035em): the four
  headline figures. Units sit alongside in the body face at 12px so the numeral
  keeps the whole weight.
- **Body** (Plex Sans 400, 15px, 1.55): all prose. Measure is capped — 66ch for
  the standfirst and footer notes, 74ch for chapter leads.
- **Label** (Plex Mono 600, 10.5px, 0.16em, uppercase): every structural label.
  Tracking runs 0.04em–0.18em depending on size; the smaller the type, the
  wider the tracking.

Beneath those sit the secondary steps — `lead` 13.5, `control` 13, `caption`
12, `caption-sm` 11.5, `label-btn` 11, `label-micro` 10, `label-min` 9.5, and
the mono readouts `readout-dock` 19, `readout-clock` 17 and `value-sm` 12.5.
They are all in the frontmatter; treat that as the closed set and add a step
only by documenting it there first.

### Named Rules

**The Three Voices Rule.** Serif argues, sans explains, mono measures. A number
the model produced is set in the mono, at whatever size its importance
requires. A heading is set in the serif. Everything a reader operates or reads
as prose is set in the sans. Nothing is set in the serif because it is
important; importance is expressed in size and position.

**The No-Faded-Text Rule.** Chart labels carry no `fill-opacity`. Two of them
used to pass one and `txt()` silently dropped it; wiring it up put 10px type at
3.8:1 in dark and 3.0:1 in light, under the floor the palette section states
and `tools/check-contrast.js` enforces — and under a floor a token-level check
cannot see, because the token is fine and the alpha is not. Chart text is
de-emphasised by choosing a quieter token, never by fading a loud one.

**The PNG Rule.** Chart text is a pure system stack, never a webfont, and every
`<text>` node carries its font-family as an *attribute* — set from the `SANS`
and `MONO` constants at the top of `js/charts.js`. Charts export to PNG by
serialising to a standalone SVG where no stylesheet applies, so a label without
an explicit family rasterises in the renderer's default serif. There is
deliberately no `.chart text` rule in the stylesheet: it would win on screen and
lose in the export, which is exactly what it did — every mono chart label
rendered in the sans stack on the page and in the mono stack in the image it was
supposed to match. The one hard-coded colour in the system lives in the same
place and for the same reason: `toPNG`'s three fallbacks, used only by a caller
that passes no palette at all.

**The Long Label Rule.** Uppercase with wide tracking is a device for labels of
two or three words. The readout labels are 40-character sentences, and caps
plus tracking removes the word shapes a reader navigates by — so they are set
in the body face, sentence case, at 11.5px.

**The 10px Floor.** No text below 10px. 9.5px survives only in provenance tags
and segment labels, where the type sits on a bordered element already doing the
de-emphasis.

## Layout

A two-column grid — a 322px control rail beside a fluid results column —
capped at **1240px** with 24px gutters. The cap is deliberate and lower than it
was: the charts are drawn at their container's true pixel width, and past
roughly 900px of column the sparse ones (survival, sweep, volume) become mostly
empty plot area.

The three grid children (rail, stats, results) are placed explicitly rather
than flowing, precisely so the single column can reorder them.

The masthead runs its own two-column grid: the headline and standfirst left,
and the three measured figures the argument rests on right. That column exists
because the headline is capped at 16ch and was otherwise leaving half a screen
of empty paper beside itself.

The rail is sticky at `top: 16px`, its own scroll container bounded to
`calc(100vh - 32px)`, with a deliberately visible thin scrollbar: a wheel
gesture landing on the rail must not read as a dead page. When the docked
readout is up, the rail steps down to `top: 74px` so it does not scroll behind
it.

Breakpoints, each with a specific job rather than a device name:

- **1040px** — grid collapses to one column and the stat bank moves *ahead* of
  the controls.
- **420px** — the page gutter tightens from 24px to 16px, which is what keeps
  the chapter toolbar on the row at 320px.
- **1040–700px** — the rail stops being a rail and would otherwise inherit the
  whole page width, so the console splits into two columns: the environment
  card down the left, the threat card and the contents stacked beside it. Left
  full-width it gave a 20-character chip 730px to sit in and stretched a slider
  to 1,470px, where a 5% change needs a 70px gesture.
- **940px, and again between 1041 and 1180** — paired chart chapters stack.
  Two ranges rather than one, because the width that matters is the results
  column: between 1041 and 1180 the rail is still taking 352px of it.
- **900px** — the masthead's measured figures fall below the standfirst.
- **860px** — the anchors list and the footer notes go single-column.
- **1040px** — the readout bank also drops its 1.14/0.86 ranking for four
  equal columns: once it spans the full page rather than a results column,
  the width difference reads as an alignment error rather than a hierarchy.
- **780px** — the readout bank drops to two columns and its dividing rules
  re-form as a 2×2.
- **720px** — the docked readout sheds its interval and estate summary.

Chapter headings and their tools share one intrinsic row: the title holds a
260px flex basis and the row is allowed to wrap, so the tools drop beneath the
heading exactly when holding them inline would squeeze it. No breakpoint
governs this.

Rhythm: 42px between chapters, 30px across the column gap, 18px inside cards
and between rail cards, 34px under the readout bank.

### Named Rules

**The Answer First Rule.** Below 1040px the readout bank is ordered before the
control rail. The page exists to show a number, and burying it under a full
screen of inputs made every phone visitor pay for the controls before seeing
the answer. Any future reflow keeps the answer above the instrument.

**The Answer Stays Rule.** The page is roughly 7,000px tall and the rail is
sticky, so a reader adjusting a slider two thousand pixels down had no sight of
the number they were moving. The docked readout carries it — the compromise
probability, its band and the current estate — and appears only once the real
bank has scrolled away.

**The Measured Width Rule.** `width(id)` in `js/app.js` measures the SVG's own
laid-out box, not its parent's border box. Measuring the parent included the
panel's padding and border, so every chart was drawn ~34px wider than it was
displayed and then uniformly shrunk by `preserveAspectRatio` — 11px labels
rendering at 10.4px, with dead letterbox bands top and bottom that were quietly
saving several charts from clipping their own edge labels. Anything that
changes a chart's container changes its drawing width exactly, with no slack.

## Elevation & Depth

Depth marks **material, not importance**. Three surfaces are raised — the two
control cards, the readout bank, and the docked readout, which is the bank in
another position — and they are raised because they are the instrument.
Everything in the results column sits directly on the ground.

Within that, depth is **asymmetric by design**. In light, `--shadow` is a
two-layer lift: a 1px contact shadow plus a wide, heavily-negative-spread
ambient, tinted with the ink hue rather than neutral black. In dark it is set
explicitly to `none`, and surfaces separate by tonal step — panel `#101D1B`
against ink `#07100F` — plus a 1px `--rule` hairline. On a near-black ground a
shadow reads as grime rather than lift.

This makes the hairline rule the primary structural device across the whole
system: chapter rules, card borders, the readout bank's dividers, table
underlines, list dividers, and the `::after` rule that runs off the end of the
eyebrow.

### Named Rules

**The Two Materials Rule.** A surface is raised if and only if it is part of the
instrument. Do not put a chapter on a card, and do not flatten the rail into the
page — the distinction is what stops ten sections reading as ten widgets.

**The Asymmetric Depth Rule.** Shadow is a light-mode device. Dark mode carries
`--shadow: none` and separates surfaces tonally. Never introduce a shadow that
survives into dark, and never compensate for the missing shadow with a heavier
border.

**The State-Is-Not-Elevation Rule.** No control lifts on hover, nothing rises on
focus, and nothing casts a shadow to indicate interactivity. State is signalled
by colour and border alone.

## Shapes

A radius ladder scaled to element size: 2px on the trait chip's checkbox
marker, the legend swatches and the interval rail, 3px on focus rings and
segment hints, 4px on provenance tags, 5px on the rail's scrollbar thumb, 7px
on buttons, 9px on the toast, 14px on the two card types and the readout bank.
The only full radius in the system is the range thumb.

**The results column has no radius at all.** Chapters are ruled, not boxed.

Borders are uniformly 1px and never doubled. Two weights only: `--rule` for
dividers within content, `--rule2` for anything that reads as an edge a reader
can act on — control borders, chapter rules, table head underlines, the chip
marker, the scrollbar thumb.

Provenance tags take their border from `currentColor`, so the tag's outline and
its text are always the same accent and a new provenance class needs one colour
declaration rather than two.

### Named Rules

**The Hairline Rule.** Every border that separates content is 1px. Weight is
expressed by choosing `--rule` or `--rule2`, never by thickening the stroke. Two
borders are not separators and are exempt: the range thumb's 2px `--panel` ring,
which punches the thumb out of the track it sits on, and the rail scrollbar
thumb's 3px `--ink` border, which is inset padding drawn as a border because
that is the only way to inset a scrollbar thumb.

## Components

### Buttons

- **Shape:** gently rounded (7px), 1px `--rule2` border, 12.5px type.
- **Rest:** panel fill, body text colour, no accent whatsoever.
- **Hover:** border and text both shift to Defender Teal. Background does not
  change. Transitions are 140ms on background, border-colour and colour.
- **Selected (`.on`):** teal fill, teal border, ink text, weight 600 — the only
  state that reverses the figure and ground.
- **Derived (`.near`):** teal text and a *dashed* teal border on a transparent
  fill. Used for the detection posture the sliders imply rather than one the
  reader chose, and it reports `aria-pressed="false"`, because it is a match
  and not a decision.
- **Ghost:** transparent background, otherwise identical.
- **Icon button:** mono face, 11px, tighter 5px/9px padding. Used for the
  topbar and chapter tools. All of them are words — there is no glyph button in
  the system.

### Selector grids

Three grammars, each legible without a word of explanation:

- **Trait chips (`#sel-profile`, multi-select):** a two-column grid, so eight
  labels of 8–25 characters sit in four rows of equal width rather than a
  ragged flex-wrap. Each carries a 9px `::before` marker at 2px radius which
  fills with `currentColor` when selected — so the marker inherits whichever
  accent the surrounding card is using.
- **Maturity ladder (`#sel-maturity`, one-of-4):** three equal columns with the
  fourth option spanning the full width. BOD 26-04 is a mandated regime rather
  than a rung on the ladder, and the layout says so.
- **Detection ladder (`#sel-detection`, one-of-5):** two columns with the fifth
  spanning, which completes a five-rung ladder without a ragged row.

Every option carries a description slot beneath it. Maturity gained one in this
redesign — it was the only control on the page whose label could not be guessed
from the label.

### Cards / Containers

- **Corner style:** 14px. **Background:** `--panel` on `--ink`. **Border:** 1px
  `--rule`. **Shadow:** `--shadow`, light only. **Padding:** 18px.
- **Heading:** mono, 10.5px, 0.16em, uppercase, weight 600. A `.d` or `.a`
  modifier tints the heading Defender Teal or Attacker Vermilion, which is how
  a card declares which side of the model it belongs to — and that choice
  cascades to the card's slider fills, thumbs and values through `--accent`.

### Chapters

- No fill, no border, no radius, no shadow. A 1px `--rule2` top rule, 20px of
  padding above the ordinal, 42px below the chapter.
- **Ordinal:** mono, 10px, 0.14em, `--dim`, a *sibling* of the heading and
  never a child — `js/app.js` reads the `h3`'s `textContent` for the exported
  PNG title, and a number folded into the heading would appear in every
  exported image.

### Readout bank

- One plate divided by 1px `--rule` verticals, not four floating tiles. Four
  separate cards read as a KPI row, which is the register the argument is
  trying to out-rank.
- **Ranked, not equal.** The two probability cells take `1.14fr` and the full
  readout size; the two count cells take `0.86fr` and a step down. Compromise
  and incident are a *pair* — the page's second finding is that detection
  changes nothing about being compromised and everything about whether it
  matters, so the two have to be read against each other — and the counts
  support them. The divider between the pair and the counts is the only one
  drawn at `--rule2`, because it is the only one that means something.
- **Structure:** flex column with the label set to `flex: 1`, so values are
  pushed to the bottom of each cell rather than sitting under a guessed
  `min-height`.
- **Label:** body face, 11.5px, sentence case, `--mut`. See The Long Label Rule.
- **Value:** mono 600, Compromise Crimson by default; `.plain` switches it to
  body text.
- **Interval rail (`.band`):** a 3px rail under the two probability readouts,
  drawn on a full 0–100% scale so a wide interval looks wide. Its `--lo` and
  `--hi` are written by `js/app.js` only on a pass that ran enough blocks for
  the interval to mean anything, and it transitions over 300ms so the band
  visibly settles rather than jumping.

### Docked readout

- Fixed to the top of the viewport, `--panel` on a 1px `--rule` bottom border,
  translated out of view until the readout bank leaves the viewport.
- Carries the compromise probability, its band, and the current estate summary.
  It is `aria-hidden` — the real bank is still in the document — and it slides
  in over 260ms.

### Range inputs

- **Track:** 4px, filled to the thumb with `--accent` via a two-stop gradient
  whose stop is written to `--fill` by `js/app.js` on every input event. A
  slider that shows only a thumb makes the reader estimate where in the range
  they are; filling the groove states it.
- **Thumb:** 15px circle, accent fill, 2px `--panel` border, plus a 1px accent
  ring. Scales to 1.18 while active.
- **Hit area:** 24px tall. The thumb offset is measured from the track rather
  than the box, so the box height can change without decentring it.

### Provenance tags

- Mono, 9.5px, 0.1em, uppercase, 2px/6px padding, 4px radius, border from
  `currentColor`, transparent fill.
- Variants: `.m` measured (Defender Teal), `.r` reported (Pre-Patch Violet),
  `.a` assumed (Assumed Amber).
- This is the system's most distinctive component. It is the visual form of the
  product's central commitment, and it should appear anywhere a number does —
  including the masthead clock.

### Selector metadata and trait notes

- **`.mtr`:** a mono 10px `--dim` line under each detection posture reporting
  the dwell time and coverage that posture writes (`10 d · 78%`), read from
  `M.DETECTION[k].p`. A console that does not show what its presets write is
  not a console.
- **`.trait-notes`:** each trait carries a paragraph explaining what it does to
  the estate, and it used to be reachable only by hovering a mouse over the
  chip — which is to say, not reachable on a touch screen or by keyboard at
  all. The descriptions of the traits *actually selected* are now listed in the
  rail beneath the estate summary, so the reasoning behind the numbers is on
  the page. The `title` attribute stays as a convenience, not as the only route.
- **`.seg-d`** carries a `min-height` floor, because these strings change
  length on every selection and without one the whole rail below them jumps on
  each click.

### Contents

A numbered list in the rail, below the threat card inside `.rail-side` —
a wrapper that exists so the two-column console between 700px and 1040px does
not stretch a short card to match a tall one — with
`counter-reset`/`counter-increment` supplying the ordinals so the markup
carries no numbering of its own. The current chapter is marked `.cur` in
Defender Teal by an IntersectionObserver.

### Named Rules

**The Quiet Control Rule.** No control carries an accent at rest. Panel fill,
hairline border, body text. Defender Teal arrives only on hover, focus, or
selection. An interface with no opinion until you touch it is what lets a
five-colour semantic palette stay readable as signal.

**The Card Declares Its Side Rule.** A control card's `.def` / `.att` modifier
sets `--accent`, which tints its heading, values, slider fills and thumbs
together. Never mix accents within one card.

**The Derived State Rule.** A value the interface inferred is never drawn like a
value the reader chose. Where the page lights a control because the numbers
resemble it, it says so — visually and to assistive technology.

## Motion

Every animation is one-shot, gated on an `anim` class set before first paint,
and killed entirely by `prefers-reduced-motion`. The page is fully legible with
that class absent, so no content depends on an animation having run.

| What | Trigger | Property | Duration |
|---|---|---|---|
| Chapter reveal | IntersectionObserver, once per element | opacity + 10px rise | 500ms |
| Chart interiors | first time a chapter enters view | bars scale from `scaleX(0)` with a 45ms stagger; lines, areas and markers fade after a 100ms delay | 500ms bars, 550ms fades |
| The race | first appearance of chapter 01 only | the cumulative exploit curve draws by `stroke-dashoffset` at a constant rate; its day-zero marker and readout fade in as the curve reaches them | 700ms draw, 300ms marker |
| Readout settle | a discrete change, never a held control | the numeral counts to its new value, in the bank and in the dock alike | 320ms |
| Action reorder | a heavy pass that changes the ranking | surviving rows FLIP to their new positions; rows new to the list rise in | 320ms move, 300ms enter |
| Description settle | a selection that rewrites a console description | opacity on the new line | 180ms |
| Trait note | a trait chip being selected | opacity + 10px rise on the note that is new | 300ms |
| Interval rail | a pass whose band is reliable | the band's two edges | 300ms |
| Dock | the readout bank leaves the viewport | `translateY` | 260ms |
| Rail step-down | the dock arriving | `top`, `max-height` | 260ms |
| Selection, hover | click or pointer | background, border, colour | 140ms |
| Slider thumb | pointer down | `transform: scale(1.18)` | 120ms |
| Disclosure | `details` opening | opacity + rise on the revealed block | 280ms |
| Toast | `toast()` | opacity + `translateY` | 180ms |
| Skip link | focus | `top` | 160ms |

### Named Rules

**The Race Is Run Once Rule.** Chapter 01 is the thesis, so it is the one place
on the page that gets an authored entrance rather than a reveal: the cumulative
exploit curve is drawn instead of faded, and a reader watches where it stands by
the time it reaches the patch line. It runs at a *constant rate* and not on
`--ease`, because linear time makes elapsed animation equal elapsed distance —
which is what allows the day-zero marker to be timed off `--zt`, the fraction of
the drawing where day zero actually falls, rather than off a guess. An eased
draw would need the inverse of the easing curve to place it, which CSS cannot
express. This is the only linear timing in the system and the only chart that
does not simply fade in; a second one would make it a house style rather than an
argument.

**The Undoable Dash Rule.** The draw is expressed as `stroke-dasharray: 1`
against `pathLength="1"` on the path, so the dash is exactly one full-length
segment. Every way the animation can fail to run — no `anim` class, the
reduced-motion kill-switch, a cancelled `fresh` — leaves a solid curve rather
than a hidden one, and the PNG clone, which carries no dash attribute at all,
exports it whole. This is the shape any future draw-on animation must take.

**The Reorder Is A Finding Rule.** The prioritised actions are ranked by effect
at the current settings, so the list reorders whenever the estate does — and
that reordering is one of the page's claims, not a redraw. The rows are rebuilt
from scratch on every pass and therefore have no element to transition, so
`js/app.js` measures positions before and after, puts each survivor back where
it was, and releases it. Only `transform` moves. A ranking that changes without
being seen to change is a ranking the reader has to take on trust.

**The Settle Needs A Backstop Rule.** `requestAnimationFrame` is not merely
throttled but suspended outright in a background tab, an embedded pane or a
power-saving mode, and some of those still report the document visible — which
is why the redraw scheduler already carries a timer backstop. The numeral settle
carries the same one, and needs it more: a redraw that never runs repeats the
last chart, but a settle that never gets a frame leaves the previous reading on
screen for good, so the instrument would quietly display a figure the model has
already superseded. Any future tween that paints a measured value finishes on a
timer as well as on a frame.

**The Not-While-Working Rule.** Nothing animates while a control is being
operated. The model re-runs at up to sixty passes a second under a dragged
slider, and a held arrow key auto-repeats every few tens of milliseconds. A
tween there would display figures the model never produced and lag the truth by
its own duration, so `js/app.js` paints live values straight and reserves the
settle for discrete changes. The same flag drops any chart mid-reveal.

**The Export-Safe Animation Rule.** Chart animation is CSS-only, and every SVG
attribute always holds the *final* geometry. A PNG export deep-clones the SVG
and rasterises it where no stylesheet applies, so an animation expressed as an
attribute (`width="0"`, `opacity="0"`, a dash offset) would export half-drawn.
No SMIL, for the same reason: it renders at its initial value inside an
`<img>`. Give elements classes and animate the classes.

**The Reveal Must Be Undoable Rule.** The reveal hides its elements before
first paint, so it needs three separate ways back. The class that arms it is
only set when there is an `IntersectionObserver` to unset it; a `window` error
listener **in the capture phase** drops it, because a 404 or a blocked script
fires an error event on the element that never bubbles; and `js/app.js` stamps
`data-live` on the root as its first statement, against a 2.5s timer in the
pre-paint script that strips the class if the stamp never arrives. That last
one is the general case — a parse error, a CSP block, a throw before the
observers are wired. A page that hides content and then fails to show it again
is worse than a page with no animation, so this is checked by loading the page
with `js/app.js` 404ing and with it throwing on its first line.

**The Reduced-Motion Rule.** The kill-switch covers `animation`, `transition`
*and* `scroll-behavior`, on `*`, `*::before` and `*::after`, and restores the
opacity the reveal would otherwise have taken away. A rule that kills only
transitions is not a kill-switch once keyframes exist.

## Do's and Don'ts

### Do:

- **Do** define every new colour on `:root` first, then override it in *both*
  the `prefers-color-scheme` block and the `[data-theme="dark"]` block.
- **Do** give a new accent a meaning from the model before giving it a hex.
- **Do** pass chart colours through `palette()` in `js/app.js` so they follow
  the theme, and keep every token a literal, serialisable colour.
- **Do** set chart text in `--chart`, the system stack, as an attribute, so PNG
  export is deterministic.
- **Do** set a number the model produced in the monospace, and a heading in the
  serif.
- **Do** set labels longer than three words in the body face, sentence case.
- **Do** keep the answer above the instrument on narrow viewports, and on
  screen while the instrument is operated.
- **Do** tag every number with its provenance — `measured`, `reported`, or
  `assumed`.
- **Do** keep prose measures capped (66–74ch) and every live figure tabular.
- **Do** name a coefficient in prose. `breakoutMedian` is an identifier, not a
  label, and asking a reader to decode the source to read the provenance panel
  defeats the point of having one.
- **Do** preserve the accessibility floor: `:focus-visible` rings at 2px
  Defender Teal, `prefers-reduced-motion` killing animation *and* transition,
  `aria-label` on every chart, `aria-pressed` on every selected-state control,
  `aria-valuetext` on every slider, `aria-current` on the contents entry,
  `role="status"` on the toast, and a skip link that moves focus rather than
  only the viewport.
- **Do** give every state a second channel. The derived detection posture is a
  dashed border *and* a visually-hidden clause in the button's accessible name;
  the current contents entry is teal *and* semibold. A state carried by colour
  alone is a state half the readers do not have.

### Don't:

- **Don't** build anything that reads as a security-vendor dashboard: threat
  gauges, alert-red panels, glowing gradient heroes, radar sweeps, or a large
  frightening number in a circle. That is the visual grammar of the marketing
  this page argues against, and adopting it would undercut the argument.
- **Don't** adopt BI-tool chrome: heavy panel framing competing with the data,
  toolbars, chart junk, or a default categorical palette whose colours carry no
  meaning.
- **Don't** put a chapter on a card. Raised surfaces are the instrument.
- **Don't** hardcode a hex anywhere outside the `:root` blocks in
  `css/app.css` — chart code included.
- **Don't** introduce a shadow that survives into dark mode, and don't thicken a
  border to compensate for its absence.
- **Don't** use elevation to signal state. Colour and border do that.
- **Don't** animate anything that fires while a control is held.
- **Don't** express an animation's start state as an SVG attribute.
- **Don't** use a glyph or an emoji where a word will fit. The topbar and the
  chapter tools are words.
- **Don't** set uppercase tracked type below 9.5px, or any type below 10px
  outside the two bordered exceptions.
- **Don't** apply caps plus wide tracking to sentence-length labels.
- **Don't** mix Defender Teal and Attacker Vermilion inside a single card.
- **Don't** add a decorative accent, gradient, or illustration. There are
  exactly two gradients in the stylesheet and both state something the page
  actually draws: the slider fill, which encodes a parameter's position in its
  range, and the legend's hatch swatch, which reproduces the 48° hatch the race
  chart paints rather than approximating it with a solid block.
