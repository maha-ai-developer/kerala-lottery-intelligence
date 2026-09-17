# Contributing & Engineering Conventions

## Branching Model
- `main`: Production release branch. Only merged via reviewed Pull Requests with passing CI.
- `develop`: Primary integration branch.
- `feature/<name>`: Feature branches.
- `fix/<name>`: Bug fix branches.
- `experiment/<name>`: Statistical or ML experiment branches.

---

## Commit Message Conventions
Every commit must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` A new feature or user-facing capability.
- `fix:` A bug fix.
- `docs:` Documentation changes only.
- `refactor:` Code restructuring that neither fixes bugs nor adds features.
- `test:` Adding or updating tests.
- `chore:` Maintenance, package dependencies, configuration.
- `perf:` Performance optimizations.
- `security:` Security fixes, credential handling, rule updates.

**Rule**: Never make giant unstructured commits. Prefer small, atomic, and understandable commits.

---

## Code Style & Invariants
1. **Canonical Lottery Numbers**: Always type as `string`. Never parse into `number` directly. Example: `"0276"` must remain `"0276"`.
2. **Layer Separation**: Code must strictly respect layer boundaries:
   `SOURCE -> DATA -> KNOWLEDGE -> STATISTICS -> EXPERIMENT -> AI`.
3. **Deterministic Tests**: Every statistical function must be accompanied by unit tests in Vitest.
4. **No Direct Production Database Writes**: Database mutations must route through domain repositories and record audit logs.
