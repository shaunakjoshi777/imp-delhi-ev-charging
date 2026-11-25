# LayerChip

Turns one method's stations on or off on the map.

- **Provide:** the method (Grid, K-means or MCLP) and whether it is on. Always in that order. All on by default.
- **Spec:** method colour dot (`grid`, `kmeans`, `mclp`), the name, and a tick. On: `raised` fill, `ink` border, tick shown. Off: no fill, hollow dot, no tick. State is never shown by colour alone.
- Use `aria-pressed`. Never order or highlight chips to suggest one method matters more.
