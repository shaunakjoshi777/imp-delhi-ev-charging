# SiteListTable

Lists the stations of the chosen method. It is the text alternative to the map.

- **Provide:** the chosen method's stations from `explorer_data.json`: site ID, ward or area, latitude, longitude, shared (yes/no).
- **Spec:** sticky `raised` header, 44px rows (`touch-target`), tabular numerals, `ui` style. Sorted by site ID. A search box and a "Download CSV" button sit above it.
- **No highlighting of values.** The CSV must match the stations on the map.
- Until the final data arrives, label the table "Placeholder data" and never make up IDs, places or coordinates.
