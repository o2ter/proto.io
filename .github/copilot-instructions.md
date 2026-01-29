# AI Coding Agent Instructions

## AI Agent Guidelines

### Development Best Practices

#### File Header and License Requirements
**CRITICAL:** Always use the correct license header format for all source and test files.
- **Every new file** (source code, tests, configuration) must include the full MIT License header
- **License format**: Use the exact same format as existing files in the project
- **Before creating any new file**: Check an existing file in the same directory to confirm the exact license format
- **When updating license**: If you notice a file with an incomplete license header, update it to match the full format above
- **Never use shortened versions**: Always use the complete MIT License text, not abbreviated versions

#### Test Execution and Verification Responsibility
**CRITICAL:** The agent must always write and run the tests by itself. Never ask the user to test the code or verify correctness. The agent is responsible for:
- Writing appropriate tests for new or modified code
- Running the tests automatically after making changes
- Verifying that all tests pass and the code is correct before considering the task complete
- Only reporting results to the user after self-verification

**Never delegate testing or verification to the user.**

### Deprecated APIs
**CRITICAL:** Never use deprecated APIs or methods.
- Do not use deprecated functions, classes, or properties in new code.
- Replace deprecated usages with the current, supported API when available.
- If no replacement exists, document the reason, open an issue for a supported alternative, and add tests demonstrating the chosen approach.
- During refactors, remove or replace deprecated usages and run the test suite to ensure behavior is preserved.

### Deep Thinking and Hypothesis Before Coding
**CRITICAL:** Before writing any code, agents must:
1. **Think deeply about the problem:** Analyze requirements, constraints, and possible edge cases.
2. **Formulate hypotheses:** Predict how the code should behave, including possible failure modes and success criteria.
3. **Check existing code to verify hypotheses:** Inspect relevant source files, tests, polyfills, and documentation to confirm assumptions before implementing. Look for related utilities, existing patterns, and any previous fixes that affect your approach.
3. **List out proof steps:** Plan how to simulate or reason about the result in mind before implementation. This includes outlining the logic, expected outcomes, and how each part will be validated.
4. **Write code only after planning:** Only begin coding once the above steps are clear and the approach is well-structured.
5. **Verify by running tests or scripts:** After implementation, always validate the code using relevant tests or scripts to ensure correctness and expected behavior.

**Why this matters:**
- Prevents shallow or rushed solutions that miss critical details
- Reduces bugs and rework by catching issues in the planning phase
- Ensures code is written with clear intent and validation strategy
- Improves reliability and maintainability of the codebase

**Example workflow:**
1. Read and analyze the requirements
2. Brainstorm possible approaches and edge cases
3. Write out hypotheses and expected results
4. Plan proof steps (how to test, what to check)
5. Implement the code
6. Run tests/scripts to confirm behavior
7. Refine as needed based on results

### Code Reuse and Dead Code
- **Refactor repeating code**: When you find the same or similar code in multiple places, extract it into a small, well-named, reusable function or utility module. Reuse reduces bugs, improves readability, and makes testing easier. Prefer composition over duplication.
- **Keep abstractions pragmatic**: Don't over-abstract. If code repeats but has meaningful differences, prefer a focused helper with clear parameters rather than a complex, one-size-fits-all abstraction.
- **Remove unused code**: Always delete dead code, unused functions, and commented-out blocks before committing. Unused code increases maintenance burden, hides real behavior, and can mask broken assumptions. If you must keep something experimental, move it to a clearly labeled experimental file or the `.temp/` area and document why it remains.
- **Verify after removal**: After deleting code, run the build and tests to ensure nothing relied on the removed code. Update documentation and examples that referenced the previous implementation.

### Temporary debug code — remove before committing

**CRITICAL:** Always remove all temporary debug code and artifacts before committing or opening a pull request. This includes but is not limited to:
- ad-hoc print/log statements (e.g., `print`, `console.log`),
- temporary debug flags or switches left enabled,
- throwaway test harness scripts placed outside the proper `tests/` directory,
- helper files placed in `.temp/` that were only intended for local debugging, and
- large commented-out blocks or shortcuts that were added solely to debug an issue.

If durable debugging helpers are necessary, extract them into clearly documented utility modules, gate them behind explicit feature flags, and add a note in the changelist documenting why they remain. Never leave transient debug code in main branches or release builds.

## Temporary Files for Testing
When creating temporary files to test code, place all test scripts under `<project_root>/.temp/` to keep the workspace organized and avoid conflicts with the main codebase.
- **Test Case Verification**: Always examine the actual content of test cases to ensure they're testing what they're supposed to test:
  - Read test files completely to understand test logic and assertions
  - Verify that test descriptions match what the test actually does
  - Check that assertions are testing the correct behavior and edge cases
  - Ensure mocks and test data are appropriate for the scenario being tested
  - Look for missing test cases or gaps in coverage for critical functionality
  - Validate that tests would actually fail if the implementation was broken
  - **NEVER use fallback methods to bypass test cases** - if tests are failing, fix the implementation or the tests, don't circumvent them
  - **No test shortcuts or workarounds** - all tests must pass legitimately through proper implementation

## **Important:** Task Execution Guidelines
When running any command or task as an AI agent:

### Command Execution Best Practices
- **Always wait** for the task to complete before proceeding with any subsequent actions
- **Never use timeouts** to run commands - it's always failure-prone and unreliable
- **Never repeat or re-run** the same command while a task is already running
- **CRITICAL: Never start a new task before the previous one has completely finished**
  - Wait for explicit confirmation that the previous task has completed successfully or failed
  - Do not assume a task is finished just because you don't see output for a while
  - Multiple concurrent tasks can cause conflicts, resource contention, and unpredictable behavior
- **Monitor task status** carefully and don't make assumptions about completion

### Task Status Verification
- If you cannot see the output or the task appears to be still running, you are **required** to ask the user to confirm the task has completed or is stuck
- If the task is stuck or hanging, ask the user to terminate the task and try again
- **Never assume** a task has completed successfully without explicit confirmation
- Always ask the user to confirm task completion or termination if the status is unclear
- **Sequential execution is mandatory:** Do not queue or pipeline tasks - complete one fully before starting the next
- **Never try to get the terminal output using a different approach or alternative method** always wait for the result using the provided tools and instructions. Do not attempt workarounds or alternate output retrieval.

### Test Execution
- **CRITICAL:** Tests in this project can ONLY be run using the `./scripts/test` script
- The test script automatically sets up and runs a real PostgreSQL instance in Docker
- **Never use** the `runTests` tool, `yarn test`, `npm test`, or any other test commands
- The `./scripts/test` script:
  - Starts a PostgreSQL container with the required configuration
  - Runs the test suite against the live database
  - Cleans up the environment after tests complete
- Always wait for the script to complete before checking results or making changes
- If tests fail, analyze the output carefully before making fixes

### Error Handling
- If a command fails, read the error output completely before suggesting fixes
- Don't retry failed commands without understanding and addressing the root cause
- Ask for user confirmation before attempting alternative approaches
- **Never run alternative commands while a failed task is still running or in an unknown state**

---
## ⚠️ CRITICAL: File Reading After Major Changes

**ALWAYS READ THE WHOLE FILE AGAIN AFTER MASSIVE CHANGES OR IF THE FILE IS BROKEN**

- After making large edits, refactors, or if a file appears corrupted, always re-read the entire file to ensure context is up-to-date and to verify integrity.
- Do not rely on partial reads or previous context after major changes—full file reading is required to avoid missing new errors or inconsistencies.
- This applies to source code, documentation, configuration, and resource files.
- If a file is broken or unreadable, re-read the whole file before attempting further fixes or analysis.
- This practice helps catch parsing errors, incomplete changes, and ensures all tools and agents operate on the latest file state.

## Always Check and Understand the Project Structure

**CRITICAL:** Before writing any code, agents must:
1. **Understand the Project Structure:** Thoroughly review the project structure and understand how it works. This includes analyzing the folder hierarchy, key files, and their purposes.
2. **Avoid Premature Questions:** Do not ask unnecessary questions before completing the job. Use the available tools and context to gather information independently.
3. **Plan Before Work:** Always create a clear plan before starting any task. For complex tasks, consider creating a structured todo list to break down the work into manageable steps.

## PostgreSQL Storage Adapter Type Mapping

**CRITICAL:** When working with the PostgreSQL storage adapter, always use the correct type mappings between application data types and PostgreSQL column types.

### Type Mapping Reference
The following mappings are defined in `src/adapters/storage/postgres/client/pool.ts` in the `_pgType` method:

| Application Type | PostgreSQL Type | Notes |
|-----------------|-----------------|-------|
| `boolean` | `BOOLEAN` | Standard boolean type |
| `number` | `DOUBLE PRECISION` | 64-bit floating point |
| `decimal` | `DECIMAL` | Arbitrary precision numeric |
| `string` | `TEXT` | Variable-length text |
| `string[]` | `TEXT[]` | Array of text values |
| `date` | `TIMESTAMP(3) WITH TIME ZONE` | Timestamp with millisecond precision and timezone |
| `object` | `JSONB` | Binary JSON format for efficiency |
| `array` | `JSONB[]` | Array of JSONB objects |
| `vector` | `DOUBLE PRECISION[]` | Numeric vector for embeddings/ML |
| `pointer` | `TEXT` | Reference to another object (stored as ID) |
| `relation` | `TEXT[]` | Array of object IDs for relations |

### Important Notes
- **Vector types**: Use `DOUBLE PRECISION[]` for vector storage. The pgvector extension is enabled automatically if available for optimized vector operations.
- **JSONB over JSON**: Always use JSONB for object and array storage as it provides better query performance and indexing capabilities.
- **Timestamp precision**: Dates use millisecond precision (3 decimal places) to match JavaScript Date precision.
- **Timezone awareness**: All timestamps include timezone information to prevent timezone-related bugs.
- **Relations and pointers**: Both are stored as text/text arrays containing object IDs, but have different semantic meanings in the application layer.
- **Shape type flattening**: Shape types are automatically flattened into separate columns using dot notation. For example:
  ```typescript
  preferences: schema.shape({
    theme: schema.string('light'),
    notifications: schema.boolean(true),
  })
  ```
  Creates two columns: `preferences.theme` (TEXT) and `preferences.notifications` (BOOLEAN). When querying, you can access these as: `SELECT username, "preferences.theme", "preferences.notifications" FROM "User"`. The flattening is handled by the `_fields` method in the PostgreSQL adapter.
- **Pointer flattening when populated**: When populating pointers (includes/joins), all fields from the target class are flattened into separate columns, including any shape type fields. For example, if you include a `user` pointer where the User class has fields `username`, `email`, and a `preferences` shape type with `theme` and `notifications`, the query will select: `"user.username"`, `"user.email"`, `"user.preferences.theme"`, `"user.preferences.notifications"`, etc. This ensures complete data retrieval for all nested structures when joining related objects.

### When Modifying Type Mappings
- **Update tests**: Any changes to type mappings must include corresponding test updates
- **Migration path**: Consider existing data when changing mappings - may require data migration
- **Index implications**: Type changes can affect index types (GIN vs B-tree) and query performance
- **Backward compatibility**: Ensure type changes don't break existing queries or data integrity
