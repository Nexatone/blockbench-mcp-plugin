# Efficient model workflow

1. Inspect get_project_info and get_project_capabilities. Use the requested native format and preserve existing projects. select_project activates an existing UUID.
2. Inspect only what is needed: query_model returns bounded pages; get_element reads one compact element. Carry UUIDs and revision forward. Avoid raw nodes:// resources and bitmap reads for metadata.
3. Plan locally. apply_model_batch creates groups, cubes and complete meshes with faces/UVs, patches properties and removes elements in one Undo entry. Supply project_uuid and expected_revision. Parent @ref refers to a group created in that batch; mesh vertices use explicit local keys.
4. Give retryable batches a unique operation_id and resend identical arguments after an uncertain response. Changed arguments require a new key. On STALE_REVISION, inspect again and prepare a new operation.
5. Existing place_cube, batch_keyframe_operations and set_vertex_weights_batch also accept grouped work. Use them before individual calls, eval or UI clicks.
6. Inspect one final viewport screenshot, run validate_model and export with export_model. codec_id: project writes .bbmodel. With a requested file path, max_content_length: 0 avoids unnecessary response content. Verify save/reopen when fidelity matters.

Tools share one editor queue. Human edits can still change the project; finish pending editor operations before retrying. Cursors require identical filters and an unchanged project revision. Retrieve geometry, images and pixels only when needed.
