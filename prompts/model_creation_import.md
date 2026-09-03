# Import workflow

from_geo_json accepts one Minecraft Bedrock geometry object as inline JSON, a local path, an application/json data URL or HTTP(S), bounded to 16 MiB. Geometry containing item_display_transforms uses Bedrock Block; other modern geometry uses Entity. Existing projects are preserved.

Use open_project for native .bbmodel input; it opens an isolated tab and returns its UUID. Use select_project to switch existing tabs. Imports return structured project identities; include_preview: false avoids an image on from_geo_json.

Inspect the imported project with get_project_info and query_model, then validate_model. Export with the native codec; codec_id: project writes .bbmodel. Native codecs normalize values and format versions, so verify semantic fidelity rather than byte equality.
