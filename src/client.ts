import type {
  CreatePageParameters, DatabaseObjectResponse,
  PageObjectResponse, PartialDatabaseObjectResponse, PartialPageObjectResponse,
  QueryDatabaseParameters
} from "@notionhq/client/build/src/api-endpoints";
import {Client, isFullPage} from "@notionhq/client";
import type {
  DBInfer, DBMutateInfer,
  DBSchemasType,
  DBSchemaType,
  DBSchemaValueDefinition, NotionPageContent,
  NotionPropertyTypeEnum, ValueComposer,
  ValueHandler,
  ValueType
} from "./types";

function isAllFullPage(results: Array<PageObjectResponse | PartialPageObjectResponse | DatabaseObjectResponse | PartialDatabaseObjectResponse>): results is Array<PageObjectResponse> {
  return results.every(isFullPage);
}

function processRow<T extends DBSchemaType>(
  result: PageObjectResponse,
  schema: T,
): DBInfer<T> {
  const transformedResult = {} as DBInfer<T>;
  for (const [key, def] of Object.entries(schema) as [keyof T, DBSchemaValueDefinition][]) {
    if (def === '__id') {
      transformedResult[key] = result.id as any;
      continue;
    }
    const type: NotionPropertyTypeEnum = def.type;
    const [name, option] = key.toString().split('__', 2);
    if (!(name in result.properties)) {
      throw Error(`Property ${name} is not found`);
    }
    const property = result.properties[name];
    if (property.type !== type) {
      throw Error(`Property ${name} type mismatch: ${property.type} !== ${type}`);
    }
    // @ts-ignore
    const value: ValueType<typeof type> = property[type];
    const handler = def.handler as ValueHandler<typeof type>;
    transformedResult[key] = handler(value, option ?? '', result.id);
  }
  return transformedResult;
}

function processRows<T extends DBSchemaType>(
  results: Array<PageObjectResponse>,
  schema: T
): DBInfer<T>[] {
  return results.map(result => processRow(result, schema));
}

function processKVResults<
  T extends DBSchemaType,
  K extends keyof T,
  V extends keyof T
>(processedResults: DBInfer<T>[], keyProp: K, valueProp: V) {
  const result: Record<string, DBInfer<T>[V]> = {};
  for (const processedResult of processedResults) {
    const key = processedResult[keyProp]
    if (typeof key !== 'string') {
      throw Error('Key is not a string');
    }
    result[key] = processedResult[valueProp];
  }
  return result;
}

function createMutateData<T extends DBSchemaType>(
  data: DBMutateInfer<T>,
  schema: T
): CreatePageParameters['properties'] {
  const transformedData = {} as CreatePageParameters['properties'];
  for (const [key, value] of Object.entries(data) as [keyof T, any][]) {
    const def: DBSchemaValueDefinition = schema[key];
    if (def === '__id') {
      throw Error('Cannot mutate __id');
    }
    if (!('composer' in def)) {
      throw Error('Cannot mutate without composer');
    }
    const type: NotionPropertyTypeEnum = def.type;
    const [name] = key.toString().split('__', 1);
    const composer = def.composer as ValueComposer<typeof type>;
    transformedData[name] = composer(value);
  }
  return transformedData;
}

export interface NotionDBClientOptions<DBS extends DBSchemasType> {
  notionToken: string;
  dbPageId: string;
  dbSchemas: DBS;
  dbPrefix?: string;
}

export type NotionDBQueryParameters = Omit<QueryDatabaseParameters, 'database_id' | 'filter_properties'>
export type TypeWithContent<T, C extends string> = T & Record<C, NotionPageContent>

export function createNotionDBClient<
  DBS extends DBSchemasType,
>({ notionToken, dbPageId, dbSchemas, dbPrefix = 'db: ' }: NotionDBClientOptions<DBS>) {

  type DBName = keyof DBS;
  type S = typeof dbSchemas;

  const client = new Client({
    auth: notionToken,
    notionVersion: '2022-06-28'
  });

  const databaseIdMap = new Map<string, string>();

  async function fillDatabaseIdMap() {
    const databases = await client.blocks.children.list({
      block_id: dbPageId
    });
    for (const database of databases.results) {
      if ('type' in database && database.type === 'child_database') {
        const title = database.child_database.title;
        if (title.startsWith(dbPrefix)) {
          databaseIdMap.set(title.slice(dbPrefix.length), database.id);
        }
      }
    }
  }

  function clearDatabaseIdMap() {
    databaseIdMap.clear();
  }

  async function getDatabaseId(rawName: string) {
    if (!databaseIdMap.has(rawName)) {
      await fillDatabaseIdMap();
    }
    return databaseIdMap.get(rawName) ?? '';
  }

  async function useDatabaseId<R>(name: DBName, callback: (id: string) => Promise<R>): Promise<R> {
    try {
      const rawName = (name as string).split('__')[0];
      const id = await getDatabaseId(rawName);
      return await callback(id);
    } catch (e) {
      clearDatabaseIdMap();
      throw e;
    }
  }

  return {

    async query<T extends DBName>(db: T, params: NotionDBQueryParameters = {}): Promise<DBInfer<S[T]>[]> {
      return useDatabaseId(db, async (id) => {
        const response = await client.databases.query({
          database_id: id,
          ...params
        });
        if (!isAllFullPage(response.results)) {
          throw Error('Not all results are full page');
        }
        return processRows(response.results, dbSchemas[db]);
      });
    },

    async queryOneById<T extends DBName>(db: T, id: string): Promise<DBInfer<S[T]>> {
      const response = await client.pages.retrieve({
        page_id: id
      });
      if (!isFullPage(response)) {
        throw Error('Not a full page');
      }
      return processRow(response, dbSchemas[db]);
    },

    async queryPageContentById(id: string): Promise<NotionPageContent> {
      const blockResponse = await client.blocks.children.list({
        block_id: id
      });
      return blockResponse.results;
    },

    async queryOneWithContentById<T extends DBName, C extends string>(
      db: T,
      id: string,
      contentProperty: C
    ): Promise<TypeWithContent<DBInfer<S[T]>, C>> {
      const [properties, content] = await Promise.all([
        this.queryOneById(db, id),
        this.queryPageContentById(id)
      ]);
      const append = {} as Record<C, NotionPageContent>;
      append[contentProperty] = content;
      return Object.assign(properties, append);
    },

    async queryOneWithContentByUniqueId<T extends DBName, C extends string>(
      db: T,
      unique_id: number,
      contentProperty: C
    ): Promise<TypeWithContent<DBInfer<S[T]>, C>> {
      return useDatabaseId(db, async (dbId) => {
        const uniqueIdProp = Object.entries(dbSchemas[db]).find(([_, type]) => type !== '__id' && type.type === 'unique_id')![0];
        const response = await client.databases.query({
          database_id: dbId,
          filter: {
            property: uniqueIdProp,
            unique_id: {
              equals: unique_id
            }
          }
        });
        if (response.results.length === 0) {
          throw Error('Not found');
        }
        const uniqueResult = response.results[0];
        if (!isFullPage(uniqueResult)) {
          throw Error('Not a full page');
        }
        const blockResponse = await client.blocks.children.list({
          block_id: uniqueResult.id
        });

        const result = processRow(uniqueResult, dbSchemas[db]);
        const append = {} as Record<C, NotionPageContent>;
        append[contentProperty] = blockResponse.results;
        return Object.assign(result, append);
      });
    },

    async queryKV<
      T extends DBName,
      DB extends DBInfer<S[T]>,
      F extends keyof DB,
      G extends keyof DB
    >(db: T, keyProp: F, valueProp: G): Promise<Record<string, DB[G]>> {
      return useDatabaseId(db, async (id) => {
        const response = await client.databases.query({
          database_id: id,
        });
        if (!isAllFullPage(response.results)) {
          throw Error('Not all results are full page');
        }
        const processedResults = processRows(response.results, dbSchemas[db]);
        return processKVResults(processedResults, keyProp as string, valueProp as string);
      });
    },

    async queryText<T extends DBName>(db: T, title: string): Promise<NotionPageContent> {
      return useDatabaseId(db, async (id) => {
        const titleProp = Object.entries(dbSchemas[db]).find(([_, type]) => type !== '__id' && type.type === 'title')![0];
        const response = await client.databases.query({
          database_id: id,
          filter: {
            property: titleProp,
            title: {
              equals: title
            }
          }
        });
        if (response.results.length === 0) {
          throw Error('Not found');
        }
        const uniqueResult = response.results[0];
        const blockResponse = await client.blocks.children.list({
          block_id: uniqueResult.id
        });
        return blockResponse.results;
      });
    },

    async insertEntry<T extends DBName>(db: T, data: DBMutateInfer<S[T]>): Promise<DBInfer<S[T]>> {
      return useDatabaseId(db, async (id) => {
        const result = await client.pages.create({
          parent: {
            database_id: id
          },
          properties: createMutateData(data, dbSchemas[db])
        });
        if (!('properties' in result)) {
          throw Error('Not a full page');
        }
        return processRow(result, dbSchemas[db]);
      });
    },

    async updateEntry<T extends DBName>(db: T, id: string, data: DBMutateInfer<S[T]>): Promise<DBInfer<S[T]>> {
      const result = await client.pages.update({
        page_id: id,
        properties: createMutateData(data, dbSchemas[db])
      });
      if (!('properties' in result)) {
        throw Error('Not a full page');
      }
      return processRow(result, dbSchemas[db]);
    }
  };
}
