---
name: Orval Zod compatibility
description: The generated API validation package must match the workspace Zod major version.
---

Orval's generated Zod schemas can emit Zod 4-only helpers such as `email()`, `int()`, and `url()` even when the workspace is using Zod 3.

**Why:** Code generation completes successfully, but the chained workspace typecheck fails afterward if the generated syntax targets a newer Zod major.

**How to apply:** When the workspace catalog uses Zod 3, set Orval's Zod output override to version 3 before running API codegen; revisit this if the catalog is upgraded.