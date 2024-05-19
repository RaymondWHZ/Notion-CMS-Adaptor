import {
  __id,
  createDBSchemas, DBMutateObjectTypesInfer,
  DBObjectTypesInfer,
  files,
  formula,
  multi_select,
  rich_text,
  rollup,
  status,
  title
} from "../src";
import {expect, expectError, typesAssignable, typesEqual} from "./utils";
import {RichTextItemResponse} from "@notionhq/client/build/src/api-endpoints";

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
});

type DBObjectTypes = DBObjectTypesInfer<typeof dbSchemas>

type Project = DBObjectTypes['projects']
expect<typesEqual<Project, {
  _id: string,
  tags: ('personal' | 'work' | 'backlog')[]
  name: string
  description: RichTextItemResponse[]
  cover: string
  images: string[]
  status: 'in-progress' | 'done'
  active_tasks: number
  task_status: string[]
}>>()

type ProjectOverview = DBObjectTypes['projects__overview']
expect<typesEqual<ProjectOverview, {
  _id: string,
  tags: ('personal' | 'work' | 'backlog')[]
  name: string
  description: string
}>>()

type DBMutateObjectTypes = DBMutateObjectTypesInfer<typeof dbSchemas>

type ProjectOverviewMutate = DBMutateObjectTypes['projects__overview']
expect<typesEqual<ProjectOverviewMutate, {
  _id?: undefined
  tags?: ('personal' | 'work' | 'backlog')[]
  name?: string
  description?: string
}>>()
expect<typesAssignable<ProjectOverviewMutate, {
  name: string
}>>()
expectError<typesAssignable<ProjectOverviewMutate, {
  name: number
}>>()