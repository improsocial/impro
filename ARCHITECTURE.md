# Architecture

_Note: this document was written by Claude Opus 4.5 and reviewed by the project owner._

## Overview

Impro is a single-page application (SPA) that communicates with Bluesky's ATProto API.

The architecture is organized into the following layers:

- **Views** - Page-level components for each route
- **Templates** - Reusable static UI elements
- **Components** - Reusable interactive UI elements
- **Services** - Background tasks and cross-cutting concerns
- **Data Layer** - State management and caching
- **API** - HTTP client, authentication, ATProto

## Layers

### Views

`/src/js/views/`

Views are page-level components that render content for specific routes. Each view receives a context object containing the API client, data layer, and router. Views are responsible for fetching data, rendering templates, setting up event listeners, and handling pagination.

### Templates

`/src/js/templates/`

Templates are pure functions that return lit-html `TemplateResult` objects. They handle presentation logic without side effects, making them easy to test and compose. Icon SVGs are also defined as templates.

### Components

`/src/js/components/`

Interactive UI elements are implemented as web components (custom elements). These handle user interactions like post composition, text input with autocomplete, media playback, and infinite scrolling.

### Services

`/src/js/*Service.js`

Services handle background tasks and cross-cutting concerns. For example:

- **Notification polling** - Periodically checks for new notifications
- **Chat polling** - Checks for unread messages
- **Post composition** - Manages the post creation modal state

### Data Layer

`/src/js/dataLayer/`

The data layer manages application state with an architecture optimized for optimistic updates:

- **DataStore** - Canonical storage for normalized posts, profiles, and feeds
- **Requests** - Functions for fetching data from the API
- **PatchStore** - Temporary patches for optimistic updates
- **Selectors** - Functions for querying data with hydration (merging patches into canonical data)
- **Mutations** - Functions for updating state with side effects (likes, follows, etc.)

### API Layer

`/src/js/api.js`, `/src/js/auth.js`, `/src/js/oauth.js`, `/src/js/atproto.js`

- **API Client** - HTTP client for Bluesky's xRPC API with automatic session refresh
- **Authentication** - Supports both app passwords and OAuth 2.0 with DPoP
- **ATProto Utilities** - Handle/DID resolution and service endpoint discovery

## Routing

The router handles client-side navigation with support for path parameters (e.g., `/profile/:handle`). Routes are defined in the main HTML file and mapped to view classes. The router caches recently rendered pages with their scroll positions.

## Styling

All styles use CSS custom properties for theming. The `light-dark()` function enables automatic theme switching based on system preference, with manual override support.

## Build System

Eleventy serves as both the development server and production build tool. External libraries are pre-bundled with esbuild and included as standalone files.

## Testing

Jest with jsdom provides unit testing for the data layer and template rendering. Test fixtures contain sample API responses.
