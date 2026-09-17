import type { Attachment, LibraryItem, Prompt } from './models';

function libraryItem(
  id: string,
  title: string,
  body: string,
  position: number,
  icon: string,
  baseTime: number,
  tags: string[] = [],
): LibraryItem {
  return { id, title, body, position, icon, tags, createdAt: baseTime, updatedAt: baseTime };
}

export function createSeedData(): {
  prompts: Prompt[];
  quickPrompts: LibraryItem[];
  snippets: LibraryItem[];
  attachments: Attachment[];
} {
  const baseTime = Date.now() - 24 * 60_000;
  const prompts: Prompt[] = [
    {
      id: 'sample-prompt-implement',
      title: 'Implement the changes we discussed',
      body: "Please implement the changes we discussed earlier. Focus on keeping the code clean and well-structured. Don't modify any unrelated parts of the codebase.",
      position: 0,
      createdAt: baseTime,
      updatedAt: baseTime + 24 * 60_000,
      tags: ['development', 'frontend'],
      archivedAt: null,
    },
    {
      id: 'sample-prompt-review',
      title: 'Now review the implementation',
      body: 'Please review the implementation carefully. Check for edge cases, potential bugs, and suggest any improvements. Be thorough but concise.',
      position: 1,
      createdAt: baseTime + 60_000,
      updatedAt: baseTime + 18 * 60_000,
      tags: ['review', 'quality'],
      archivedAt: null,
    },
    {
      id: 'sample-prompt-tests',
      title: 'Add tests',
      body: 'Please add comprehensive tests for the new functionality. Include unit tests and integration tests where relevant.',
      position: 2,
      createdAt: baseTime + 2 * 60_000,
      updatedAt: baseTime + 10 * 60_000,
      tags: ['testing', 'automation'],
      archivedAt: null,
    },
    {
      id: 'sample-prompt-docs',
      title: 'Update documentation',
      body: 'Please update the documentation to reflect the changes. Include examples and any important notes for future reference.',
      position: 3,
      createdAt: baseTime + 3 * 60_000,
      updatedAt: baseTime + 4 * 60_000,
      tags: ['docs', 'writing'],
      archivedAt: null,
    },
  ];

  const quickPrompts = [
    libraryItem('sample-quick-review', 'Review my changes', 'Please review the following changes for correctness, maintainability, and unintended side effects.', 0, 'magnifying-glass', baseTime),
    libraryItem('sample-quick-explain', 'Explain this code', 'Please explain what this code does, including its main control flow and important assumptions.', 1, 'lightbulb', baseTime),
    libraryItem('sample-quick-issues', 'Find potential issues', 'Look for potential bugs, edge cases, security problems, and confusing behavior in this code.', 2, 'warning', baseTime),
    libraryItem('sample-quick-refactor', 'Refactor this', 'Please refactor this code to make it clearer and easier to maintain while preserving its behavior.', 3, 'arrows-clockwise', baseTime),
    libraryItem('sample-quick-errors', 'Add error handling', 'Add appropriate error handling and useful user-facing failure states to this code.', 4, 'shield', baseTime),
    libraryItem('sample-quick-performance', 'Improve performance', 'Suggest and implement measured performance improvements without sacrificing clarity.', 5, 'trend-up', baseTime),
    libraryItem('sample-quick-tests', 'Write tests', 'Write focused tests for the important behavior and likely edge cases in this code.', 6, 'flask', baseTime),
    libraryItem('sample-quick-docs', 'Update documentation', 'Update the documentation so it accurately describes the current behavior and usage.', 7, 'file-text', baseTime),
  ];

  const snippets = [
    libraryItem('sample-snippet-standards', 'Coding standards', 'Keep the implementation focused, readable, and consistent with the existing codebase. Avoid unrelated refactors.', 0, 'file-text', baseTime, ['development']),
    libraryItem('sample-snippet-commit', 'Commit message format', 'Use an imperative subject line under 72 characters. Explain the reason for the change in the body when needed.', 1, 'file-text', baseTime, ['git']),
    libraryItem('sample-snippet-common', 'Common instructions', 'Preserve existing behavior, handle meaningful edge cases, and summarize any remaining limitations.', 2, 'file-text', baseTime),
  ];

  const note = new Blob(['Review focus:\n- correctness\n- edge cases\n- accessibility\n'], { type: 'text/plain' });
  const outline = new Blob(['# Documentation outline\n\n- Overview\n- Usage\n- Examples\n- Limitations\n'], { type: 'text/markdown' });
  const sampleFile = (id: string, promptId: string, filename: string, content: string): Attachment => {
    const data = new Blob([content], { type: 'text/markdown' });
    return { id, promptId, filename, mimeType: 'text/markdown', size: data.size, data, createdAt: baseTime };
  };
  const attachments: Attachment[] = [
    sampleFile('sample-attachment-requirements', 'sample-prompt-implement', 'requirements.md', '# Implementation brief\n\n- Follow existing project conventions.\n- Keep the scope focused on the requested change.\n- Preserve accessibility and existing behavior.\n'),
    sampleFile('sample-attachment-context', 'sample-prompt-implement', 'project-context.md', '# Project context\n\nReplace this sample with useful background, design notes, or links before copying your prompt.\n'),
    sampleFile('sample-attachment-test-checklist', 'sample-prompt-tests', 'test-checklist.md', '# Test checklist\n\n- Happy path\n- Invalid input\n- Empty state\n- Persistence after reload\n- Keyboard interaction\n'),
    {
      id: 'sample-attachment-review-notes',
      promptId: 'sample-prompt-review',
      filename: 'review-notes.txt',
      mimeType: 'text/plain',
      size: note.size,
      data: note,
      createdAt: baseTime + 18 * 60_000,
    },
    {
      id: 'sample-attachment-doc-outline',
      promptId: 'sample-prompt-docs',
      filename: 'docs-outline.md',
      mimeType: 'text/markdown',
      size: outline.size,
      data: outline,
      createdAt: baseTime + 4 * 60_000,
    },
  ];

  return { prompts, quickPrompts, snippets, attachments };
}
