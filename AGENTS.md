# Architecture Decisions

- Notebook pages are child records authorized through their parent notebook; this avoids duplicating ownership and keeps access rules centralized.
- Notebook page content is stored as simple TipTap HTML on the page row; this reuses the existing editor while avoiding a premature block model.