A night-time observatory of Delhi's charging network: deep forest surfaces, one charge-green accent, a large map, and serif headings that read like a journal. Built for a one-page explorer of proposed public EV charger sites from three siting methods (grid rule, weighted K-means, MCLP).

## The one rule

The site shows proposed locations and never says which method is better. This rule wins over any design choice.

- Never rank, score, highlight or sort methods, or list their strengths and weaknesses.
- Never put the methods' figures against each other in one table or chart. Figures show one method at a time, chosen by tabs in the order Grid, K-means, MCLP.
- Never write "best", "better", "outperforms", "winner", "comparative analysis" or "comparison of methods".
- Never invent stations, numbers, place names, quotes or logos. Where a value is missing, show a `TbdLabel` with `[TBD: ...]`.
- No stock photos, testimonials, marketing patterns, monument drawings, skylines or leaf clip art.
- Borrow the layout pattern of a public data observatory only. Use no other brand's name, logo, colour or assets.

## Content and voice

- Calm and academic. Short, plain sentences. Write "we" for the team, "you" for the reader.
- Sentence case everywhere. The `kicker` style is the only uppercase text.
- Figures carry units, sources and captions. Citations stay visible inline as (Author, year) in `ink-2`.
- Distances are straight-line unless marked "road".
- Real copy, for tone: "Where could Delhi's public EV chargers go?" · "Station locations are proposals from a model, not confirmed plots. Demand is estimated, not measured."
- No emoji.

## Colour

Dark is the default theme. Light is a full theme behind a toggle. Both must work.

- Page on `bg`; panels, cards and the map plate on `surface`; controls, tooltips and table headers on `raised`.
- Divide with 1px `border`. Flat surfaces only: no shadows, no glass, no gradients.
- Main text in `ink`, secondary text and captions in `ink-2`. Both pass 4.5:1 on `bg`, `surface` and `raised` in both themes.
- `accent` is for links, the active control and the focus ring only. Text on an accent fill uses `on-accent`.
- `tbd` marks missing values, always with a dashed border.

### Data colours

No method uses green, so stations are never mistaken for buttons or the demand layer.

- Grid rule: `grid`, filled circle. Weighted K-means: `kmeans`, filled circle. MCLP: `mclp`, filled circle.
- Existing four-wheeler chargers: `existing`, drawn as an ×.
- Shared site: `consensus` (same as `ink`), a double open ring.
- Every station dot has a 2px ring in `surface` so it stays visible on dense cells.
- Demand layer: `demand-1` (low) to `demand-5` (high). Brighter squares in dark, darker in light, carry more estimated demand.
- Never rely on colour alone: keep labels and legends, and keep the × for existing chargers.

## Type

- Headings in Forum, regular (400) only: `display` (hero), `h2` (sections), `h3` (cards). Forum has no bold, so never set it heavier than 400.
- Everything else in Source Sans 3: `body` for reading, `ui` for controls and tables, `caption` for notes, `kicker` above headings, `figure` for big numbers with tabular numerals.
- At 375px use the Phone styles: `display-phone`, `h2-phone`, `h3-phone`, `body-phone`, `figure-phone`. `ui`, `caption` and `kicker` stay the same size.
- Forum ships as `fonts/Forum-Regular.ttf` with its licence in `fonts/OFL.txt`. Source Sans 3 loads from Google Fonts. Both are under the SIL Open Font License. Fall back to Georgia for serif and system-ui for sans.
- Formulas use KaTeX.

## Space, shape and layout

- Spacing steps: `space-4`, `space-8`, `space-12`, `space-16`, `space-24`, `space-32`, `space-48`, `space-72`.
- Corners: `radius-control` (6px) on controls, `radius-panel` (10px) on panels and cards. No pill-shaped cards.
- Reading column at most `reading-max` (720px). Explorer at most `explorer-max` (1360px).
- Generous space; 1px borders.
- Motion: 150 to 200ms fades only. Respect reduced motion.

### Page order

1. Sticky top bar
2. Short intro (under half the screen height, so the explorer's top shows on load)
3. Explorer, with shared sites and site list
4. Why public chargers
5. How demand is estimated
6. The three methods
7. Scenarios and station numbers
8. Data and limitations
9. References and team
10. Footer

### Explorer on desktop

- Control bar: scenario (A: new network, B: build on existing chargers), number of stations, grid square size, coverage distance.
- Method layers: three `LayerChip`s (Grid, K-means, MCLP), all on by default.
- View switch: One map (default, layers overlaid), Side by side (three linked maps), Shared sites (only overlaps, others faded).
- Left, about 62%: large map of Delhi with demand cells, outline, stations, legend, 5km scale bar, zoom and pan.
- Right, about 38%: panel with three tabs, Figures, Shared sites, Site list.
- Under the map: toggles for demand layer, coverage rings and existing chargers, and a Reset button. Then the footnote.

### Explorer behaviour

- Changing any control updates the maps, figures, shared sites and site list together.
- A control offers only combinations present in the data. Others are disabled with a short reason.
- The address bar keeps the current settings so a view can be shared.
- Phone: controls in a bottom sheet, then map, then panel. Side-by-side maps stack.

## Accessibility

- Every control works by keyboard and shows a solid 2px `accent` focus ring (8.5:1 or more on every surface in dark, 5.6:1 or more in light).
- Each map has `role="img"`, an `aria-label` and a text summary that updates. The site list is the text alternative to the map.
- Toggles and table rows are at least `touch-target` (44px) tall.
- Layout works at 375px with no sideways scroll.
- Keep the OpenStreetMap attribution: "Map data © OpenStreetMap contributors (ODbL)."

## Identity

- The real study-area outline of Delhi (the 250 MCD wards) is the identity mark. The top bar pairs a three-dot mark with the title "Delhi EV Charger Siting".
- The outline is in Logos: `delhi-study-area-outline-dark.svg` on the dark theme, `delhi-study-area-outline-light.svg` on the light theme. Never redraw it.
- The three-dot mark has no artwork yet. Until it does, set the title in plain type and leave the mark out.
- No icon set is defined. Use the data marks (dot, ×, double ring) and plain text labels.
