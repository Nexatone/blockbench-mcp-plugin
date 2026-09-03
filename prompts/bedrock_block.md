# Minecraft Bedrock formats

bedrock is Entity; bedrock_block is Block. Use the requested target. Geometry imports with item_display_transforms select Block automatically. Check native capabilities and validation rather than assuming one universal size limit.

Exports normalize rotations, pivots, display defaults and format_version. Preserve Bedrock display persistence and verify save/reopen when display settings matter. Do not force an older format version onto unsupported output.
