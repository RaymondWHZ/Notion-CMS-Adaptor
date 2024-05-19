# Notion-CMS-Adaptor

*“The Ultimate Type-Safe Notion Database Toolbox You Need to Use Notion as a Headless CMS”*

# Introduction

Notion CMS Adaptor aim to provide a convenient way for developers to build website using Notion as a CMS. It solves the most significant obstacle when using Notion as a CMS: type safety and conversion between tedious notion types and native JavaScript types. It provides a clean interface and a bunch of pre-defined handlers for most common conversions. It also supports automatic database discovery and provides convenient query functions that suits the need of a typical CMS.

# Features

- **📋 Standard**: built on top of official JavaScript SDK provided by Notion
- **🚚 Straightforward type-safety**: define Notion types and conversion rules, leave the framework to infer types for you
- **🔎 Auto-discovery**: give the framework only the id of the root page, it will discover all databases reside under it
- **📦 Minimal**: only necessary wrap around underlying Notion API while exposing necessary official structures, like RichTextResponse
- **🏂 Flexible**: framework comes with nice defaults but all conversion rules are customizable
- **👍 Ergonomic**: syntax similar to traditional database wrappers, aiming to offer a database-client-like experience while fitting unique features of notion

# Installation

```bash
npm install notion-cms-adaptor
# or yarn add notion-cms-adaptor
# or pnpm install notion-cms-adaptor
# or bun add notion-cms-adaptor
```

# Basic Usage

```tsx
import {
  __id, createDBSchemas, createNotionDBClient, DBObjectTypesInfer, files,
  formula, multi_select, rich_text, rollup, status, title
} from 'notion-cms-adaptor';

const dbSchemas  = createDBSchemas({
  projects: {
    _id: __id(),
    tags: multi_select().stringEnums('personal', 'work', 'backlog'),
    name: title().plainText(),
    description: rich_text().raw(),
    cover: files().singleNotionImageUrl(),
    images: files().notionImageUrls(),
    status: status().stringEnum('in-progress', 'done'),
    active_tasks: formula().numberDefaultZero(),
    task_status: rollup().handleArrayUsing((value): string[] => {
      return value.reduce((acc, item) => {
        if (item.type === 'status' && item.status) {
          return acc.concat(item.status.name)
        }
        return acc
      }, [] as string[])
    }),
  },
  projects__overview: {  // Another view pointing to the same projects database
    _id: __id(),
    tags: multi_select().stringEnums('personal', 'work', 'backlog'),
    name: title().plainText(),
    description: rich_text().plainText(),  // Types can be different
    cover: files().singleNotionImageUrl(),
  },
});

type DBObjectTypes = DBObjectTypesInfer<typeof dbSchemas>
export type Project = DBObjectTypes['projects']  // Automatically infer the type after conversion
// type Project = {
//   _id: string,
//   tags: ('personal' | 'work' | 'backlog')[]
//   name: string
//   description: RichTextResponse[]
//   cover: string
//   images: string[]
//   status: 'in-progress' | 'done'
//   active_tasks: number
//   task_status: string[]
// }
export type ProjectOverview = DBObjectTypes['projects__overview']
// type ProjectOverview = {
//   _id: string,
//   tags: ('personal' | 'work' | 'backlog')[]
//   name: string
//   description: string
//   cover: string
// }

const client = createNotionDBClient({
  notionToken: process.env.NOTION_TOKEN!,  // Replace with your Notion API token
  dbPageId: process.env.NOTION_CMS_ENTRY_PAGE_ID!,  // Replace with the ID of the page containing all databases
  dbSchemas,
});

export async function fetchProjects(): Promise<Project[]> {
  return await client.query('projects', {
    // Raw Notion API query parameters
    // Only without database_id and filter_properties as they are managed by framework
    sorts: [{
      property: 'name',
      direction: 'ascending'
    }],
    filter: {
      property: 'status',
      status: {
        does_not_equal: 'hidden'
      }
    }
  })  // Conversion and strict type checks happen before return
}

export async function addProject(): Promise<Project> {
  return await client.insertEntry('projects', {
    tags: ['work'],  // Type definition will prevent adding invalid tags
    name: 'New Project',
    description: [{ type: 'text', text: { content: 'Description' } }],
    status: 'in-progress',
    // You may optionally omit cover and images
    // Type definition prevents adding non-mutable fields: _id, active_tasks, task_status
  })
}
```

# Auto-Discovery

It is rare that a CMS system require only one collection, so Notion CMS Adaptor provides a handy functionality that allows databases to be automatically discovered, without the need to copy and paste ID for each.

You only need to provide the framework with the ID of the page that contains all your databases **on top level**, with each database having a name starting with “db: ” (the prefix can be configured). Then, you can reference each database by their name without the prefix when using other functions.

In the example, the database in notion in fact has the name “db: projects”. It can be referenced as “projects” in subsequent usages of the framework.

# Client Functions

- `query`: simply query a database, optionally accept query parameters to be sent to Notion API, return a list of  converted objects
- `queryOneWithContent`: query one page using its ID, put the content of the page into a designated field, useful in many blog article scenarios
- `queryKV`: convert the content of a database into a key-value pair using designated key and value fields, useful in cases where you want to store some metadata
- `queryText`: query contents of a page in a database using its title, useful in cases where you want to conveniently store some rich texts
- `insertEntry`: insert a new page into a database, can only specify properties that are mutable
- `updateEntry`: update a page in a database with its ID, can only specify properties that are mutable (safe-guards that the page is in the database)
- `deleteEntry`: delete a page in a database with its ID (safe-guards that the page is in the database)

# Supported schema types and conversions

| Type               | Mutability (can be include in create/update or not)          | Supported conversions                                                                                                                                                                                                                                                                                                                                                                                          |
|--------------------|:-------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| checkbox           | ✅ Mutable                                                    | `boolean`: use a boolean value to indicate whether the checkbox is checked (same as raw)                                                                                                                                                                                                                                                                                                                         |
| created_by         | ❌ Not Mutable                                                | `name`: use name of either the user or bot                                                                                                                                                                                                                                                                                                                                                                       |
| created_time       | ❌ Not Mutable                                                | `timeString`: use the time string (same as raw)                                                                                                                                                                                                                                                                                                                                                                  |
| date               | ✅ Mutable                                                    | `dateRange`: use an object with the form { start: string, end: string }, defaults to empty strings                                                                                                                                                                                                                                                                                                               |
| email              | ✅ Mutable                                                    | `string`: use the string version of the email (same as rawWithDefault with default value '')                                                                                                                                                                                                                                                                                                                     |
| files              | 🚧 Mutate using raw value (only forward conversion provided) | `urls`: use an array of url to each file<br/>`singleUrl`: use only the first url, ignoring others<br/>`notionImageUrls`: (🚧 Experimental) assume all urls are images stored in Notion, convert url to use Notion’s image optimization<br/>`singleNotionImageUrl`: (🚧 Experimental) assume all urls are images stored in Notion, convert and return the first url to use Notion’s image optimization, ignoring others |
| formula            | ❌ Not Mutable                                                | `string`: convert any type to string<br/>`numberDefaultZero`: attempt to convert to number, default 0<br/>`booleanDefaultFalse`: attempt to convert to boolean, default false<br/>`dateRange`: same as dateRange for date type                                                                                                                                                                                         |
| last_edited_by     | ❌ Not Mutable                                                | `name`: use name of either the user or bot                                                                                                                                                                                                                                                                                                                                                                       |
| last_edited_time   | ❌ Not Mutable                                                | `timeString`: use the time string (same as raw)                                                                                                                                                                                                                                                                                                                                                                  |
| multi_select       | ✅ Mutable                                                    | `strings`: use an array of names of selected options<br/>`stringEnums`: allow only names in the list                                                                                                                                                                                                                                                                                                               |
| number             | ✅ Mutable                                                    | `numberDefaultZero`: simply use the number (same as rawWithDefault with default value 0)                                                                                                                                                                                                                                                                                                                         |
| people             | 🚧 Mutate using raw value (only forward conversion provided) | `names`: use an array of names as string                                                                                                                                                                                                                                                                                                                                                                         |
| phone_number       | ✅ Mutable                                                    | `string`: use the string version of the phone number (same as rawWithDefault with default value '')                                                                                                                                                                                                                                                                                                              |
| relation           | ✅ Mutable                                                    | `ids`: use an array of IDs of pages references<br/>`singleId`: use only the first ID and ignore others, infers to a single string type                                                                                                                                                                                                                                                                             |
| rollup             | ❌ Not Mutable                                                | `dateRange`: same as dateRange for date type<br/>`numberDefaultZero`: same as numberDefaultZero for formula type<br/>`handleArrayUsing`: assume this rollup is of array type, cast the type and let a provided handler to handle                                                                                                                                                                                     |
| rich_text          | ✅ Mutable                                                    | `plainText`: use the plain text version of the field                                                                                                                                                                                                                                                                                                                                                             |
| select             | ✅ Mutable                                                    | `string`: use name of selected option, defaults to empty string<br/>`stringEnum`: allow only names in the list                                                                                                                                                                                                                                                                                                     |
| status             | ✅ Mutable                                                    | `string`: use name of selected status<br/>`stringEnum`: allow only names in the list                                                                                                                                                                                                                                                                                                                               |
| title              | ✅ Mutable                                                    | `plainText`: use plaintext version of the title                                                                                                                                                                                                                                                                                                                                                                  |
| url                | ✅ Mutable                                                    | `string`: use the string version of the URL (same as rawWithDefault with default value '')                                                                                                                                                                                                                                                                                                                       |
| unique_id          | ❌ Not Mutable                                                | `number`: use only the number part of the field, defaults to zero<br/>`stringWithPrefix`: use concatenated string with prefix, same as the one shown in Notion                                                                                                                                                                                                                                                     |
| verification       | ❌ Not Mutable                                                | Supports only default conversions.                                                                                                                                                                                                                                                                                                                                                                             |
| __id               | ❌ Not Mutable                                                | A special type indicating using the native ID of the page in Notion. No need to specify conversion.                                                                                                                                                                                                                                                                                                            |

Meanwhile, all types (except for `__id`) include the following default conversions:

- `raw`: use the native Notion page property type returned by Notion API
- `rawWithDefault`: same as `raw` except making the inferred type non-nullable by accepting a default value
- `handleUsing`: convert the value using a supplied handling function (will make mutable types immutable since composer is not provided)
- (Only for mutable types) `handleAndComposeUsing`:  convert the value using a supplied handling function and convert the value back to Notion type using a supplied compose function

# Useful Type Utilities

- `DBInfer`: Pass it the type of the schema of a DB for it to infer converted types for the DB.
- `DBObjectTypesInfer`: Pass it the type of the whole schema for it to infer converted types for all DBs.
- `DBMutateInfer`: Pass it the type of schema of a DB for it to infer viable input type for creating/updating records in the DB.
- `DBMutateObjectTypesInfer`: Pass it the type of the whole schema for it to infer viable input types for creating/updating records in all DBs.

# Next Steps

This documentation is not complete yet. Please reference the source code for more detailed information.

# Development

To develop based on this project, you can clone this repository and run:

```bash
bun install
```

To run tests:

```bash
bun run test
```

To build the project:

```bash
bun run build
```
