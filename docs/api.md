# API / Data Contract

This is the source of truth for everything shared between the two parts of the app. Agree on it before you split up. If you change it, change it in the same PR as the code and tell your teammate.

Base URL (dev): `TODO e.g. http://localhost:8000`

## Data models

### TODO ModelName
```json
{
  "id": "string",
  "createdAt": "ISO-8601 string"
}
```

## Endpoints

### `GET /api/TODO`
Short description.

**Query params:** none

**Response 200**
```json
[]
```

**Errors:** `400` invalid input, `500` server error. Body: `{ "error": "message" }`

## Changelog
- v0: initial draft
