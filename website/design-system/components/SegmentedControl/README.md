# SegmentedControl

Picks one option from a short set: scenario, view, grid square size, coverage distance, MCLP candidate list.

- **Provide:** a label (for screen readers), the options in a fixed order, the chosen one.
- **Spec:** `raised` track with a 1px `border`, `radius-control`. The active segment is `accent` with `on-accent` text. Text in the `ui` style.
- **Disabled options:** a combination not present in the data is disabled and gives a short reason (as a title or note). Never hide it.
- **Real options:** Scenario "A: new network" (default) / "B: build on today's 98 chargers". View "One map" (default) / "Side by side" / "Shared sites". Grid 3 km (default) / 2 km / 1 km. Coverage 1.5 / 2.1 (default) / 3 km, labelled "distance used to count coverage". MCLP candidates: 206 points on the 3 km grid (default) or 1,570 square centres.
- Keyboard: arrow keys move between segments; 2px `accent` focus ring.
