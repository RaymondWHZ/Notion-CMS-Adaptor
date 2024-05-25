import { expect, test, mock } from "bun:test";
import { Client } from "@notionhq/client";
import { __id, createDBSchemas, createNotionDBClient, multi_select } from "../src";

const TEST_DB_ID = '0000';
const TEST_PAGE_ID = '0001';
const TEST_PAGE_RESPONSE = {
  id: TEST_PAGE_ID,
  object: "page",
  url: "",  // necessary for the check 'isFullPage'
  properties: {
    tags: {
      type: 'multi_select',
      multi_select: [{
        name: 'personal',
      }]
    }
  }
}

const dbSchema = createDBSchemas({
  projects: {
    _id: __id(),
    tags: multi_select().stringEnums('personal', 'work', 'backlog'),
  },
})
const mockClient = {
  databases: {
    query: mock(async () => {
      return {
        results: [TEST_PAGE_RESPONSE]
      }
    }),
  },
  pages: {
    create: mock(async () => {
      return TEST_PAGE_RESPONSE;
    }),
  }
} as unknown as Client;
const client = createNotionDBClient({
  notionClient: mockClient,
  dbSchemas: dbSchema,
  dbMap: {
    projects: TEST_DB_ID
  }
});

test("query", async () => {
  // @ts-expect-error
  mockClient.databases.query.mockClear()
  const res = await client.query('projects', {
    filter: {
      property: 'tags',
      multi_select: {
        contains: 'personal'
      }
    }
  })
  expect(mockClient.databases.query).toBeCalledTimes(1)
  expect(mockClient.databases.query).toBeCalledWith({
    database_id: TEST_DB_ID,
    filter: {
      property: 'tags',
      multi_select: {
        contains: 'personal'
      }
    },
    sorts: undefined
  })
  expect(res).toBeArrayOfSize(1)
  expect(res[0]._id).toBe(TEST_PAGE_ID)
  expect(res[0].tags).toContain('personal')
});

test("insert", async () => {
  // @ts-expect-error
  mockClient.pages.create.mockClear()
  const res = await client.insertEntry('projects', {
    tags: ['personal']
  });
  expect(mockClient.pages.create).toBeCalledTimes(1)
  expect(mockClient.pages.create).toBeCalledWith({
    parent: {
      database_id: TEST_DB_ID
    },
    properties: {
      tags: [{
        name: 'personal'
      }]
    }
  })
  expect(res._id).toBe(TEST_PAGE_ID)
  expect(res.tags).toContain('personal')
});
