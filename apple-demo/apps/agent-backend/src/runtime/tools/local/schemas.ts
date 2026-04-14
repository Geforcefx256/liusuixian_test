const FIND_FILES_DEFAULT_LIMIT = 100
const FIND_FILES_MAX_LIMIT = 500
const GREP_DEFAULT_LIMIT = 50
const GREP_MAX_LIMIT = 200
import { QUESTION_MIN_OPTIONS } from './questionContract.js'

export const readFileInputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: true,
  properties: {
    path: {
      type: 'string',
      description: 'Exact workspace-relative file path to read. Use the path returned by find_files when you only knew a filename or glob pattern.'
    },
    offset: {
      type: 'integer',
      minimum: 0,
      description: 'Optional zero-based line offset. Omit this to read from the beginning. Use it when you already know which section you need.'
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: FIND_FILES_MAX_LIMIT,
      description: 'Optional max lines to return. Omit this when you want the default full read for a normal-sized file.'
    }
  },
  required: ['path']
}

export const listDirectoryInputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: true,
  properties: {
    path: {
      type: 'string',
      description: 'Workspace-relative directory path to list.'
    }
  },
  required: ['path']
}

export const findFilesInputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pattern: {
      type: 'string',
      description: 'Filename or glob pattern to find, for example "CONTEXT.md", "*.ts", or "**/CONTEXT.md". Use this when you do not know the exact path yet.'
    },
    basePath: {
      type: 'string',
      description: 'Optional workspace-relative directory to search from. Default ".". Use this to narrow the search when you already know the area.'
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: FIND_FILES_MAX_LIMIT,
      description: `Optional max number of matches. Default ${FIND_FILES_DEFAULT_LIMIT}, max ${FIND_FILES_MAX_LIMIT}.`
    }
  },
  required: ['pattern']
}

export const grepInputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pattern: {
      type: 'string',
      description: 'Text or regex pattern to search for in file contents. Prefer grep for search tasks; use literal=true for fixed text and literal=false for regex.'
    },
    basePath: {
      type: 'string',
      description: 'Optional workspace-relative directory to search from. Default ".". Use this to keep searches focused.'
    },
    glob: {
      type: 'string',
      description: 'Optional file glob filter such as "*.ts" or "src/**/*.tsx". Default "**/*".'
    },
    ignoreCase: {
      type: 'boolean',
      description: 'Optional flag for case-insensitive search.'
    },
    literal: {
      type: 'boolean',
      description: 'Optional flag to treat pattern as plain text instead of regex. Set this to true when you want an exact text search.'
    },
    context: {
      type: 'integer',
      minimum: 0,
      description: 'Optional number of context lines to include before and after each match.'
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: GREP_MAX_LIMIT,
      description: `Optional max number of matches. Default ${GREP_DEFAULT_LIMIT}, max ${GREP_MAX_LIMIT}.`
    }
  },
  required: ['pattern']
}

export const writeFileInputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    path: {
      type: 'string',
      description: 'Relative path inside project/ without the leading project/ prefix, for example "notes.txt" or "drafts/plan.md". Use this only to create a file or replace the entire file.'
    },
    content: {
      type: 'string',
      description: 'Complete text content for the target file. This must be the full file body, not a partial patch.'
    }
  },
  required: ['path', 'content']
}

export const editFileInputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    file_path: {
      type: 'string',
      description: 'Existing file path inside project/. Accepts either the project/... path returned by read_file, such as "project/notes.txt", or the same relative form used by write, such as "notes.txt".'
    },
    old_string: {
      type: 'string',
      minLength: 1,
      description: 'Exact current text to replace, copied from read_file output and excluding any line-number prefix. Use the smallest uniquely identifying block. Must match exactly once unless replace_all is true.'
    },
    new_string: {
      type: 'string',
      description: 'Replacement text for the matched old_string. Use an empty string to delete the matched content.'
    },
    replace_all: {
      type: 'boolean',
      description: 'Replace every exact match in the file. Defaults to false, which requires old_string to identify exactly one location.'
    }
  },
  required: ['file_path', 'old_string', 'new_string']
}

export const questionInputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      description: 'Optional question id. If omitted, a random id is generated.'
    },
    title: {
      type: 'string',
      description: 'Optional heading text shown above the prompt.'
    },
    prompt: {
      type: 'string',
      description: 'Prompt text shown to the user.'
    },
    label: {
      type: 'string',
      description: 'Label for the select field.'
    },
    required: {
      type: 'boolean',
      description: 'Whether the question requires an answer. Default true. Fields without an explicit required value inherit this setting.'
    },
    placeholder: {
      type: 'string',
      description: 'Placeholder label for the empty option when required is false.'
    },
    fields: {
      type: 'array',
      description: 'Optional list of input fields (select or text). Prefer this for multi-field questions. Use text for open-ended values like column indexes, file names, paths, or versions. If question.required is true, any optional field must set required to false explicitly.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          label: {
            type: 'string',
            description: 'Field label shown to the user. Do not encode optional or required markers here.'
          },
          type: { type: 'string', enum: ['select', 'text'] },
          placeholder: { type: 'string' },
          required: {
            type: 'boolean',
            description: 'Optional. If omitted, this field inherits question.required. Set to false explicitly for optional fields under a required question.'
          },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                value: {}
              },
              required: ['label', 'value'],
              additionalProperties: false
            },
            minItems: QUESTION_MIN_OPTIONS
          }
        },
        required: ['label', 'type']
      }
    },
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          value: {}
        },
        required: ['label', 'value'],
        additionalProperties: false
      },
      minItems: QUESTION_MIN_OPTIONS,
      description: 'List of selectable options. Use this for closed choices. If the value is open-ended, use a text field instead.'
    }
  },
  required: ['prompt'],
  anyOf: [
    { required: ['options'] },
    { required: ['fields'] }
  ]
}
