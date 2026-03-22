## ADDED Requirements

### Requirement: Visible loading during publish and unpublish

While **Publish** or **Unpublish** is in progress for a schema, the UI MUST show a clear loading state beyond only disabling the button—e.g. a **spinner** on or next to the control and/or a **busy overlay** on the schema row or card—until the operation completes or fails.

#### Scenario: Publishing shows loading

- **WHEN** the user clicks Publish and the request is in flight
- **THEN** a spinner or overlay (or both) indicates work in progress until completion

#### Scenario: Unpublishing shows loading

- **WHEN** the user clicks Unpublish and the request is in flight
- **THEN** a spinner or overlay (or both) indicates work in progress until completion
