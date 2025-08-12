# TranscriptIQ Code Style and Conventions

## JavaScript/JSX Style
- **ES6+** modern JavaScript features
- **Functional components** for React (hooks-based)
- **Arrow functions** preferred for callbacks and methods
- **Destructuring** for props and state
- **Async/await** for asynchronous operations
- **Template literals** for string interpolation

## Formatting Rules (Prettier)
- **Semicolons**: Always use semicolons
- **Quotes**: Single quotes for strings
- **Tab width**: 2 spaces
- **Trailing comma**: ES5 style (only where valid in ES5)

## ESLint Rules
- **No unused variables**: Error (except variables starting with `_`)
- **Prefer const**: Use const for variables that aren't reassigned
- **React hooks rules**: Enforced via eslint-plugin-react-hooks

## Naming Conventions
- **Files**: camelCase for regular files, PascalCase for React components
- **Components**: PascalCase (e.g., `MeetingSidebar.jsx`)
- **Functions**: camelCase (e.g., `handleNewMeeting`)
- **Constants**: camelCase for local, UPPER_SNAKE_CASE for global constants
- **Event handlers**: Prefix with `handle` (e.g., `handleClick`)

## React Patterns
- **State management**: useState and useRef hooks
- **Side effects**: useEffect with proper cleanup
- **Custom hooks**: Prefix with `use` (e.g., `useElectronBridge`)
- **Conditional rendering**: Ternary operators and && operators
- **Key props**: Always provide unique keys for list items

## File Organization
- Components in `frontend/src/components/`
- Backend services in `backend/services/`
- API routes in `backend/routes/`
- Utilities in respective `utils/` directories

## Error Handling
- Try/catch blocks for async operations
- Proper error logging with winston
- User-friendly error messages in UI
- WebSocket reconnection logic

## Security Practices
- Environment variables for sensitive data
- API key redaction in logs
- Context isolation in Electron
- Input validation and sanitization

## Performance Considerations
- React.memo for expensive components
- Debouncing for frequent operations
- Proper cleanup in useEffect
- Connection pooling for database