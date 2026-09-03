# Complete geometry batches

Check get_project_capabilities; meshes require a mesh-capable format. apply_model_batch runs in the active project, with a unique ref per new object. Parent @ref can name a group declared later in the same batch; cycles are rejected.

A mesh supplies a vertices record and faces of three or four keys, optional per-vertex UV pairs and optional texture UUIDs. Cubes use from/to model coordinates. Supply finite numbers. query_model kinds mesh_vertices and mesh_faces inspect geometry in pages.

Targets validate before one native Undo edit. The result maps refs to UUIDs without an implicit screenshot. Use expected_revision and operation_id for preconditions/retries and capture a viewport image after construction.
