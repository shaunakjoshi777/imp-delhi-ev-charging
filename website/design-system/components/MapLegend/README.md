# MapLegend

The key for the map's marks and demand layer. Built from the brief's data colours.

- **Marks:** Grid, K-means and MCLP stations are filled circles in `grid`, `kmeans`, `mclp`, each with a 2px `surface` ring (`station-ring`). Existing four-wheeler chargers are an × in `existing`. Shared sites are a double open ring in `consensus`.
- **Demand:** five steps, `demand-1` to `demand-5`. Caption: brighter squares in dark theme (darker in light) carry more estimated demand.
- Keep the legend on the map at all times, with a 5 km scale bar. Identity never relies on colour alone.
