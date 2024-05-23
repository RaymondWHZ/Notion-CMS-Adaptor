import {
  createDBSchemas,
  createNotionDBClient, status,
  DBObjectTypesInfer, rich_text, title,
  multi_select, __id, files, formula, rollup, unique_id
} from "../src";
import { expectType } from "./utils";

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
    description: rich_text().plainText(),
  },
  users: {
    id: unique_id().number(),
  }
});

type DBObjectTypes = DBObjectTypesInfer<typeof dbSchemas>
type Project = DBObjectTypes['projects']

const client = createNotionDBClient({
  notionToken: '',
  dbPageId: '',
  dbSchemas,
});

expectType<Promise<Project[]>>(client.query('projects', {
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
}))

void client.queryOneByUniqueId('users', 123)
// @ts-expect-error
void client.queryOneByUniqueId('projects', 123)

void client.queryText('projects', '123')
// @ts-expect-error
void client.queryText('users', '123')

type KV = {
  name1: string[]
  name2: string[]
}
expectType<Promise<KV>>(client.queryKV('projects', '_id', 'images'))
// @ts-expect-error
void client.queryKV('projects', 'description', 'images')

expectType<Promise<Project>>(client.insertEntry('projects', {
  status: 'in-progress'
}))

void client.insertEntry('projects', {
  // @ts-expect-error
  status: 'ip'
})
