# Agentic Coding Best Practices

A comprehensive guide to using Claude Code agents for systematic, high-quality software development.

## 🎯 Overview

Agentic coding leverages specialized AI agents to handle different aspects of software development systematically. This approach ensures consistent quality, reduces errors, and provides structured workflows for complex development tasks.

---

## 🧪 Test-Driven Development (TDD)

### **Purpose**
Write tests before implementation to ensure code quality, prevent regressions, and create living documentation.

### **When to Use**
- **Trigger**: User says "Test-Driven Development: [feature description]"
- **Best For**: New features, bug fixes, API endpoints, complex business logic
- **Benefits**: Higher code quality, better test coverage, fewer bugs, clear requirements

### **The Five-Phase TDD Pattern**

| Phase | Action | Tools/Agents | Deliverable |
|-------|--------|--------------|-------------|
| **📝 Test Design** | Write comprehensive tests BEFORE implementation | `test-engineer`, `Write` | Complete test suite |
| **❌ Verify Failures** | Confirm all tests fail (red state) | `npm test`, bash commands | Failing tests confirmed |
| **✅ Implement** | Write minimal code to make tests pass | `backend-implementer`, `ui-engineer` | Passing implementation |
| **🔄 Iterate** | Code iteratively until all tests green | Continue implementation | All tests green |
| **✨ Verify Quality** | Review implementation and test coverage | `code-reviewer` | Quality-verified code |

### **TDD Workflow Commands**
```bash
# Phase 1: Always start with tests
"Test-Driven Development: Add user authentication with JWT tokens"

# Phase 2: Verify red state  
"Run tests to confirm they fail as expected"

# Phase 3-4: Implementation
"Implement minimal code to make all tests pass"

# Phase 5: Quality assurance
"Review TDD implementation for quality and coverage"
```

### **TDD Best Practices**
- **Tests First**: Never write implementation before tests
- **Minimal Implementation**: Write only enough code to make tests pass
- **Red-Green-Refactor**: Ensure tests fail, make them pass, then refactor
- **Comprehensive Coverage**: Test edge cases, error conditions, and happy paths
- **Living Documentation**: Tests should clearly explain expected behavior

---

## 🤔 Task Think Workflow

### **Purpose**
Systematic approach for complex development tasks requiring analysis, planning, and careful implementation.

### **When to Use**
- **Trigger**: User says "Task Think" or tasks involve multiple files/components
- **Best For**: Complex features, refactoring, architectural changes, unfamiliar codebases
- **Benefits**: Context awareness, reduced errors, better solutions, systematic progress

### **The Four-Phase Pattern**

| Phase | Action | Tools/Keywords | Deliverable |
|-------|--------|----------------|-------------|
| **🔍 Explore** | Read relevant files, understand codebase context | `Read`, `Glob`, `Grep` | Context understanding |
| **📋 Plan** | Think through solution with appropriate depth | `sequential-thinking` | Detailed implementation plan |
| **⚡ Implement** | Code the planned solution based on analysis | `Edit`, `Write`, `MultiEdit` | Working implementation |
| **🚀 Integration** | Commit changes, create PRs, verify functionality | `Bash (git)`, tests, linting | Integrated feature |

### **Task Think Commands**
```bash
# Trigger the workflow
"Task Think: Refactor authentication system to support multiple providers"

# Optional depth modifiers
"Task Think harder: Implement complex data synchronization between microservices"
```

### **Task Think Best Practices**
- **No Premature Coding**: Always explore and plan before implementing
- **Use TodoWrite**: Track progress through each phase
- **Deep Analysis**: Read existing code to understand patterns and conventions
- **Sequential Planning**: Use structured thinking to reason through solutions
- **Context Preservation**: Maintain understanding of the broader system impact

---

## 🎯 Task Router Agent

### **Purpose**
Automatically analyze tasks and assign them to the most appropriate specialized agent for optimal results.

### **When to Use**
- **Trigger**: "Route this task" or when unsure which agent to use
- **Best For**: Complex tasks that might need multiple agents, ambiguous requirements
- **Benefits**: Optimal agent selection, reduced cognitive overhead, systematic task breakdown

### **Router Decision Matrix**

| Task Type | Primary Agent | Supporting Agents | Use Case |
|-----------|---------------|-------------------|----------|
| **Frontend UI** | `ui-engineer` | `test-engineer`, `code-reviewer` | React components, styling, interactions |
| **Backend Logic** | `backend-implementer` | `test-engineer`, `security-specialist` | APIs, data processing, services |
| **Database Work** | `firebase-specialist` | `security-specialist`, `performance-optimizer` | Schema, queries, migrations |
| **Testing** | `test-engineer` | `debugger`, `performance-optimizer` | Test suites, coverage, mocking |
| **Performance** | `performance-optimizer` | `debugger`, `code-reviewer` | Optimization, profiling, bottlenecks |
| **Security** | `security-specialist` | `code-reviewer`, `test-engineer` | Vulnerability analysis, secure coding |
| **DevOps** | `devops-engineer` | `security-specialist` | Deployment, CI/CD, infrastructure |
| **Planning** | `planner-agent` | `task-router` | Feature breakdown, estimation |
| **Code Review** | `code-reviewer` | `security-specialist`, `test-engineer` | Quality assurance, best practices |

### **Router Commands**
```bash
# Let router decide optimal approach
"Route this task: Build a real-time chat system with end-to-end encryption"

# Router with specific constraints
"Route this task with security focus: Implement user file upload functionality"

# Multi-phase routing
"Route this complex task: Migrate from REST to GraphQL with zero downtime"
```

### **Router Best Practices**
- **Trust the Router**: Let it analyze and assign rather than pre-selecting agents
- **Provide Context**: Give detailed task descriptions for better routing decisions
- **Sequential Routing**: Complex tasks may need multiple agents in sequence
- **Cross-Agent Coordination**: Router ensures agents work together effectively
- **Quality Gates**: Router includes appropriate review and testing agents

---

## 🔄 Combining Methodologies

### **TDD + Task Think**
```bash
"Task Think with Test-Driven Development: Implement OAuth2 authentication flow"
```
1. **Explore**: Analyze existing auth patterns
2. **Plan**: Design OAuth2 integration approach  
3. **Test Design**: Write comprehensive OAuth2 tests
4. **Implement**: Build to pass tests
5. **Integration**: Deploy and verify

### **Router + TDD**
```bash
"Route this TDD task: Build payment processing with Stripe integration"
```
1. **Route Analysis**: Router selects backend-implementer + security-specialist + test-engineer
2. **Test Design**: test-engineer creates payment tests
3. **Security Review**: security-specialist reviews payment handling
4. **Implementation**: backend-implementer builds Stripe integration
5. **Quality Review**: code-reviewer verifies final implementation

### **All Three Combined**
```bash
"Task Think with TDD routing: Redesign user dashboard with real-time analytics"
```
1. **Exploration**: Analyze current dashboard and analytics requirements
2. **Routing**: task-router assigns ui-engineer + performance-optimizer + test-engineer
3. **Planning**: Sequential thinking through dashboard redesign approach
4. **Test Design**: Comprehensive test suite for new dashboard
5. **Implementation**: Build dashboard with real-time features
6. **Performance**: Optimize for real-time data handling
7. **Integration**: Deploy with monitoring and verification

---

## 📋 Implementation Guidelines

### **Choosing the Right Methodology**

| Scenario | Recommended Approach | Reasoning |
|----------|---------------------|-----------|
| **New feature development** | TDD | Ensures quality and clear requirements |
| **Complex refactoring** | Task Think | Requires deep analysis and planning |
| **Uncertain task scope** | Task Router | Optimal agent selection and task breakdown |
| **Critical system changes** | Task Think + TDD | Analysis + quality assurance |
| **Multi-domain features** | Router + TDD | Specialized agents + quality focus |
| **Legacy code work** | Task Think + Router | Understanding + appropriate expertise |

### **Quality Assurance Integration**
- **Always include code-reviewer** for final quality verification
- **Use test-engineer proactively** for comprehensive test coverage
- **Include security-specialist** for sensitive operations
- **Apply performance-optimizer** for data-heavy or real-time features

### **Documentation and Communication**
- **TodoWrite tracking**: Use for all multi-phase workflows
- **Clear trigger phrases**: Consistent command patterns for reproducible results
- **Context preservation**: Maintain understanding across agent transitions
- **Deliverable focus**: Each phase should produce clear, measurable outcomes

---

## 📊 Success Metrics

### **Code Quality Indicators**
- ✅ Test coverage above 80%
- ✅ All linting and type-checking passes
- ✅ Security vulnerabilities addressed
- ✅ Performance benchmarks met
- ✅ Code review approval

### **Process Efficiency Metrics**
- ✅ Reduced debugging time through TDD
- ✅ Faster feature delivery through Task Think planning
- ✅ Optimal agent utilization through routing
- ✅ Fewer production bugs through systematic approaches
- ✅ Improved code maintainability through structured development

### **Team Benefits**
- **Consistency**: Reproducible development processes
- **Quality**: Higher code standards through systematic approaches  
- **Efficiency**: Reduced cognitive overhead through specialized agents
- **Knowledge**: Living documentation through tests and structured planning
- **Confidence**: Systematic verification at each development phase

---

*This document serves as the definitive guide for agentic coding practices. Follow these methodologies for consistent, high-quality software development outcomes.*