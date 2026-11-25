# StepperSlider

Chooses a number of stations. Snaps only to values present in the data.

- **Provide:** the list of available values for the current scenario and method, and the current value.
- **Spec:** the current value is always shown as text (tabular numerals). Tick labels in `caption`, `ink-2`. Track and thumb in `accent`.
- **Values from the write-up:** Scenario A, K-means and MCLP (1,570 sites): 104, 157, 178, 206, 404. Grid at 3 / 2 / 1 km gives 104 / 157 / 404. Scenario B: 98 existing + 59 new, or 98 existing + 104 new. Default 104.
- Set `aria-valuetext` to the real number, not the step index.
