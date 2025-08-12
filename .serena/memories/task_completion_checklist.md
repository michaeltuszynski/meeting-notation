# TranscriptIQ Task Completion Checklist

## When Completing Any Task

### 1. Code Quality Checks
```bash
npm run lint              # Check for linting errors
npm run lint:fix          # Auto-fix linting issues if any
npm run format            # Format code with Prettier
```

### 2. Test Your Changes
```bash
npm test                  # Run all tests
npm run test:perf         # Run performance tests if relevant
npm run perf:check        # Verify latency targets if touching real-time features
```

### 3. Verify Functionality
- Start development environment: `npm run dev`
- Test the feature manually in the browser
- Check browser console for errors
- Verify WebSocket connections are stable
- Test with both microphone and Electron audio sources if relevant

### 4. Check Performance Impact
- Ensure <2 second end-to-end latency is maintained
- Monitor memory usage if making significant changes
- Check for any memory leaks with `npm run debug:memory`

### 5. Update Documentation
- Update PROJECT_STATUS.md if adding new features
- Update CLAUDE.md if changing development workflow
- Add inline comments for complex logic (only if necessary)

### 6. Database Considerations
- Run any necessary database migrations
- Verify PostgreSQL connections are working
- Check Redis caching is functioning properly

### 7. Before Committing
- Review all changes carefully
- Ensure no API keys or secrets are exposed
- Verify no debug console.log statements remain
- Check that error handling is comprehensive

## Special Considerations

### For Frontend Changes
- Test in different viewport sizes
- Verify shadcn/ui components render correctly
- Check dark mode compatibility

### For Backend Changes
- Verify WebSocket events are properly handled
- Check API endpoint responses
- Ensure proper error responses

### For Electron Changes
- Test system audio capture
- Verify meeting app detection
- Check system tray functionality

### For AI/LLM Changes
- Monitor token usage and costs
- Verify API rate limits are respected
- Check caching is working to reduce API calls