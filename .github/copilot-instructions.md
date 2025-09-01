# AI Coding Agent Instructions

## Temporary Files for Testing
When creating temporary files to test code, place all test scripts under `<project_root>/.temp/` to keep the workspace organized and avoid conflicts with the main codebase.

### AI Agent Test Execution Guidelines
When running tests as an AI agent:
- Wait for the test task to complete before proceeding
- If you cannot see the output or the task appears to be still running, the agent is required to ask the user to confirm the task has completed or stuck
- If the task is stuck, the agent should ask the user to terminate the task and try again
- Don't make assumptions about the task status
- Never repeat or re-run the test command while a test task is already running
- Only proceed with next steps after test completion confirmation
- Never assume a task has completed successfully without confirmation
- Never use timeouts to guess task completion