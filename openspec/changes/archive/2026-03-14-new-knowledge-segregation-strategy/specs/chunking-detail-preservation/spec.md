## ADDED Requirements

### Requirement: Chunking preserves concrete detail verbatim

The chunking process SHALL preserve URLs, email addresses, phone numbers, and other concrete identifiers verbatim in both the chunk `content` and the `originalReference`. The system MUST NOT summarize or drop these details when producing chunks. Chunks SHALL remain factual and self-contained.

#### Scenario: URL preserved in chunk

- **WHEN** source schema content contains a URL (e.g. `https://example.com/docs`)
- **THEN** at least one chunk's `content` or `originalReference` contains that URL verbatim

#### Scenario: Email preserved in chunk

- **WHEN** source schema content contains an email address (e.g. `support@example.com`)
- **THEN** at least one chunk's `content` or `originalReference` contains that email verbatim

#### Scenario: Phone number preserved in chunk

- **WHEN** source schema content contains a phone number (e.g. `+1-555-123-4567`)
- **THEN** at least one chunk's `content` or `originalReference` contains that phone number verbatim

#### Scenario: Chunks remain self-contained

- **WHEN** chunking produces chunks from schema content
- **THEN** each chunk's `content` is a discrete, factual unit understandable without additional context
