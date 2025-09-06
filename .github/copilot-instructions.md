# AI Coding Agent Instructions

## Temporary Files for Testing
When creating temporary files to test code, place all test scripts under `<project_root>/.temp/` to keep the workspace organized and avoid conflicts with the main codebase.
- **Test Case Verification**: Always examine the actual content of test cases to ensure they're testing what they're supposed to test:
  - Read test files completely to understand test logic and assertions
  - Verify that test descriptions match what the test actually does
  - Check that assertions are testing the correct behavior and edge cases
  - Ensure mocks and test data are appropriate for the scenario being tested
  - Look for missing test cases or gaps in coverage for critical functionality
  - Validate that tests would actually fail if the implementation was broken

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
- **Always use provided tools when available** for running tests instead of terminal commands
- Use the `runTests` tool for unit test execution - it provides better integration and output formatting
- The `runTests` tool supports:
  - Running specific test files by providing absolute file paths
  - Running specific test suites, classes, or cases by name
  - Running all tests when no parameters are provided
- **Prefer tool-based test execution** over manual `yarn test` or `npm test` commands
- Only use terminal commands for test execution when the `runTests` tool is not available or insufficient

### Error Handling
- If a command fails, read the error output completely before suggesting fixes
- Don't retry failed commands without understanding and addressing the root cause
- Ask for user confirmation before attempting alternative approaches
- **Never run alternative commands while a failed task is still running or in an unknown state**
