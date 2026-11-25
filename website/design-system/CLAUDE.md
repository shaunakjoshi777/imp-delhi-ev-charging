# Design system: Delhi EV Charger Siting

Use this folder to build the site in `website/index.html`. Read in this order:

1. `README.md`: the brand book. The rules there are required, above all "The one rule" (never compare or rank methods) and "Never invent stations, numbers or place names".
2. `Delhi_EV_Siting_Design_System_Brief.pdf`: the full brief. Section 4 has all page text in order; section 6 describes the data.
3. `tokens.json`: every colour, type style, spacing step, radius and size, with a note on where each is used.
4. `components/<Name>/README.md`: rules for each component. `components/<Name>/preview.html` shows its markup.
5. `gallery.html`: open in a browser to see every component in dark and light.

## How to build with it

- Link `tokens.css` and `components/bundle.css` from the page. Load Forum from fonts/Forum-Regular.ttf (the @font-face is already in tokens.css; regular weight only, never bold) and Source Sans 3 (400, 500, 600) from Google Fonts.
- Use only the CSS variables from `tokens.css` (`--bg`, `--ink`, `--accent`, `--grid`, `--space-16`, `--radius-panel` and so on). Do not add new colours or font sizes.
- Put `data-theme="dark"` on `<html>` by default. The theme toggle switches it to `light`.
- Reuse the `dx-` classes in `components/bundle.css` (`dx-topbar`, `dx-seg`, `dx-chip`, `dx-toggle`, `dx-stepper`, `dx-stat`, `dx-card`, `dx-table`, `dx-tip`, `dx-shared`, `dx-tbd`, `dx-cite`, `dx-kicker`). Copy the markup patterns from the previews.
- Type classes: `display`, `h2`, `h3`, `body`, `ui`, `caption`, `kicker`, `figure`. They switch to phone sizes under 600px.
- Logo: `assets/Logos/delhi-study-area-outline-dark.svg` on dark, `-light.svg` on light. There is no three-dot mark artwork yet.
- Data comes from `../explorer_data.json`. Where a value is missing, use `<span class="dx-tbd">[TBD: ...]</span>`.
- The `components/Cover/` folder is only the design system's cover picture. Do not use it on the site.

## Before you finish

Go through the review checklist at the end of section 5 of the brief, in both themes, at 1440px and 375px.
