# Gen Compare

Static site for showcasing image generations from different LLMs. The interface fetches the trial prompts from `index.csv`, filters models that can produce images via `models.csv`, and then discovers corresponding assets underneath `/images/<MODEL>/<ID>.<ext>`.

## Usage

1. Serve the folder locally (for example `python -m http.server 8080`) or push it to GitHub Pages.
2. Visit `/index.html` and use the dropdowns to filter by trial or model.

### Updating data

- **Add prompts**: append new rows to `index.csv`. Keep the `ID` column in sync with the image filenames.
- **Add images**: drop new assets into `images/<MODEL>` using the trial ID as the filename. PNG, JPG/JPEG, and WebP are detected automatically.
- **Add/Remove models**: edit `models.csv` and set `generate_image` to `Yes` for any model that should appear in the UI. The script automatically filters to the supported ones on load.

Once committed, everything is static and ready to host on GitHub or any other static host.
