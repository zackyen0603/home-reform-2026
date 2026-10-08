# Cabinet Designer (MVP)

Open `cabinet-designer.html` via GitHub Pages or local HTTP server. Choose a floor and room from `floorplan.yaml`, edit cabinet dimensions and module count, preview 2D elevation/plan and 3D, then select **儲存並加入住宅**. Return to `#floorplan`; designed cabinets appear in the existing furniture 2D/3D layers, including floor filtering and placement editing.

Data is persisted in browser localStorage under `home-reform:designed-cabinets:v1`, separate from the existing `furniture.yaml`. Use **匯出 YAML** to back up designs. This is browser-local, not cross-device synchronization and does not commit YAML to GitHub. No existing furniture records are modified.

Coordinates and dimensions are in **cm** to match `floorplan.yaml` and `furniture.yaml`; the furniture 3D bridge maps `[x,y,z]` to Three.js `[x,z,y]`. The editor stores center-positioned furniture footprints and rotation in degrees.

Current limitations: uniform-width bays, basic carcass and hinged-door preview, no shelf/drawer editor, no cutting list, no machining drawings, no wall snap or collision verification. Before manufacturing, verify site dimensions and joinery. The existing floorplan renderer may require a refresh after returning from the editor.

Smoke test: open page, create 4F cabinet, save, return to floorplan and toggle 2D/3D; select and move the new cabinet, refresh and confirm persistence; export YAML and inspect `items`. Test mobile width and check console for exceptions.
