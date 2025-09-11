# AI Assistant Instructions for Scheduler2

## Project Context
You are working on **Scheduler2**, a production-ready bus route scheduling application built with React 19, TypeScript 5.9, and Material-UI v7. Always refer to `CLAUDE.md` for complete project context and guidelines.

## Spec-Driven Development Workflow

### 1. Feature Request Analysis
When a new feature is requested:
1. **Read existing specifications** in `.specify/specs/`
2. **Analyze dependencies** with current features
3. **Create detailed specification** using `.specify/spec-template.md`
4. **Get user approval** before implementation

### 2. Implementation Approach
For each feature:
1. **Follow TDD patterns** when appropriate
2. **Use existing type system** (discriminated unions, interfaces)
3. **Maintain security standards** (XSS prevention, input validation)
4. **Follow code conventions** from existing components

### 3. Quality Gates
Before marking any feature complete:
- [ ] TypeScript compilation passes (`npx tsc --noEmit`)
- [ ] Tests written and passing (`npm test`)
- [ ] Code review completed
- [ ] Security review for sensitive features
- [ ] Documentation updated

## Project-Specific Guidelines

### Architecture Patterns
- **Event System**: Use `WorkspaceEvent` discriminated unions
- **Context Providers**: Follow existing patterns in `AuthContext`
- **Service Layer**: Maintain Firebase and localStorage separation
- **Component Structure**: Check `src/components/` for patterns

### Security Requirements
- **Always validate inputs** using existing `inputSanitizer`
- **Never bypass type safety** with `any` types
- **File uploads** must use existing validation patterns
- **XSS prevention** is mandatory for all user inputs

### Performance Standards
- **Auto-save optimization** use centralized config
- **Large datasets** require virtualization (500+ items)
- **Memory management** follow existing patterns
- **Bundle optimization** maintain current standards

## Specification Creation Process

### For New Features:
1. Copy `.specify/spec-template.md` to `.specify/specs/{feature-name}.md`
2. Fill out all sections thoroughly
3. Include technical implementation details
4. Add testing requirements
5. Consider security implications
6. Plan documentation updates

### For Bug Fixes:
1. Create issue specification with:
   - Current behavior description
   - Expected behavior description  
   - Steps to reproduce
   - Technical root cause analysis
   - Fix approach and testing plan

### For Refactoring:
1. Document current architecture
2. Specify desired architecture
3. Plan migration strategy
4. Include backward compatibility considerations

## AI Agent Collaboration

### Use Specialized Agents When:
- **ui-engineer**: Frontend components, React patterns
- **test-engineer**: Test implementation and strategy
- **security-specialist**: Security reviews and validation
- **performance-optimizer**: Large dataset optimization
- **firebase-specialist**: Database operations

### Multi-Agent Coordination:
- **planner-agent**: Complex feature breakdown
- **code-reviewer**: Quality assurance
- **context-manager**: Large multi-file changes

## Development Commands
```bash
# Essential commands for this project
npm start          # Development server
npm test           # Run tests
npm run typecheck  # TypeScript validation
npm run build      # Production build
```

Remember: **Always read CLAUDE.md first** for complete context, then use these spec-driven development practices to ensure high-quality implementations.