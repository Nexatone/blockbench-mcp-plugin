# Hytale attachments (optional integration)

Use hytale_list_attachments and hytale_list_attachment_pieces before hierarchy changes. Registered collections are hytale://attachments and hytale://pieces; item resources append /{id}. Use returned UUIDs to avoid name ambiguity.

Configure relationships with hytale_set_attachment_piece, respecting native hierarchy constraints. Keep attachment identity separate from display names. Validate and verify export with the actual Hytale plugin; renaming an ordinary group does not itself define a complete attachment.
