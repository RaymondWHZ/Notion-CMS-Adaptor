import { expect, test, spyOn } from "bun:test";
import { Client } from "@notionhq/client";
import { __id, createDBSchemas, createNotionDBClient, multi_select } from "../src";
import {PageObjectResponse, QueryDatabaseResponse} from "@notionhq/client/build/src/api-endpoints";

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
const notionClient = new Client();
const client = createNotionDBClient({
  notionClient,
  dbSchemas: dbSchema,
  dbMap: {
    projects: TEST_DB_ID
  }
});

test("query", async () => {
  const query = spyOn(notionClient.databases, 'query')
  query.mockImplementation(async () => {
    return {
      results: [TEST_PAGE_RESPONSE]
    } as unknown as QueryDatabaseResponse
  })

  const res = await client.query('projects', {
    filter: {
      property: 'tags',
      multi_select: {
        contains: 'personal'
      }
    }
  })
  expect(notionClient.databases.query).toBeCalledTimes(1)
  expect(notionClient.databases.query).toBeCalledWith({
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

  query.mockRestore()
});

test("insert", async () => {
  const create = spyOn(notionClient.pages, 'create')
  create.mockImplementation(async () => {
    return TEST_PAGE_RESPONSE as unknown as PageObjectResponse
  })

  const res = await client.insertEntry('projects', {
    tags: ['personal']
  });
  expect(notionClient.pages.create).toBeCalledTimes(1)
  expect(notionClient.pages.create).toBeCalledWith({
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

  create.mockRestore()
});
