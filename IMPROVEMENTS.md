# Codenames Repository Improvements

## Implementation Plan

This document tracks the improvements being made to the Codenames repository.

### Phase 1: Code Quality & Bug Fixes ✓

- [ ] Fix unreachable return statements in `gameServer.ts`
- [ ] Replace console.* statements with structured logging
- [ ] Fix name change race condition bug (multiple users changing names simultaneously)

### Phase 2: Developer Experience

- [ ] Set up ESLint/Prettier for all packages
- [ ] Add environment configuration (.env support)
- [ ] Update CI pipeline (reorder steps, optimize)

### Phase 3: Reliability

- [ ] Implement WebSocket reconnection with exponential backoff
- [ ] Add heartbeat mechanism for connection health

### Phase 4: Testing

- [ ] Add unit tests for `game` package (Codenames class methods)
- [ ] Add unit tests for `api` package (gameServer WebSocket handling)
- [ ] Add tests for web hooks (useCodenames, useWebsocket)
- [ ] Ensure CI runs all tests and they pass

### Phase 5: Documentation

- [ ] Expand README with setup instructions
- [ ] Add WebSocket protocol documentation
- [ ] Add architecture overview

---

## Bug Fixes

### Name Change Race Condition

**Problem**: When multiple players change their names simultaneously, updates overwrite each other's pending changes.

**Root Cause**: The game state updates are not properly merged - each update replaces the entire player object.

**Solution**: Implement proper state merging in the backend to handle concurrent updates.

---

## Testing Strategy

### Game Package Tests
- Player join/leave scenarios
- Team assignment logic
- Turn advancement
- Word reveal mechanics
- Win/loss conditions
- Spymaster role management

### API Package Tests
- WebSocket connection handling
- Command validation and execution
- State persistence
- Broadcasting logic
- Error handling

### Web Hooks Tests
- Game state synchronization
- Command sending
- WebSocket reconnection
- State parsing and validation

---

## Progress Tracking

**Started**: 2025-11-23
**Status**: In Progress
**Completion**: 0/14 items
