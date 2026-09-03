# Hytale model workflow (optional integration)

The Hytale plugin must be installed and active. Inspect hytale_get_format_info and get_project_capabilities; create hytale_character or hytale_prop when available. Do not substitute bedrock.

Build native groups/cubes with apply_model_batch, then use Hytale quad, property and stretch tools. Check actual mesh support before creating meshes. Block pixel density and texture image dimensions are different; choose image sizes for the model's UV layout.

Run hytale_validate_model and validate_model before export. Verify node limits, shading, attachments and stretch serialization against the installed Hytale version. Optional tools remain experimental; check the final model and exported results.
