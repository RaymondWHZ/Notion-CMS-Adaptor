import type {
  DatabaseObjectResponse,
  PageObjectResponse, PartialDatabaseObjectResponse, PartialPageObjectResponse,
  QueryDatabaseParameters
} from "@notionhq/client/build/src/api-endpoints";
import {Client, isFullPage} from "@notionhq/client";
import type {
  DBInfer, DBMutateInfer,
  DBSchemasType,
  DBSchemaType,
  DBSchemaValueDefinition, NotionPageContent,
  NotionPropertyTypeEnum, NotionMutationProperties, ValueComposer,
  ValueHandler,
  ValueType, NotionMutablePropertyTypeEnum, KeysWithValueType
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
): NotionMutationProperties {
  const transformedData = {} as NotionMutationProperties;
  for (const [key, value] of Object.entries(data) as [keyof T, any][]) {
    const def: DBSchemaValueDefinition = schema[key];
    if (def === '__id') {
      throw Error('Cannot mutate __id');
    }
    if (!('composer' in def)) {
      throw Error('Cannot mutate without composer');
    }
    const type: NotionMutablePropertyTypeEnum = def.type;
    const [name] = key.toString().split('__', 1);
    const composer = def.composer as ValueComposer<typeof type>;
    transformedData[name] = composer(value);
  }
  return transformedData;
}

export interface NotionDBClientOptions<DBS extends DBSchemasType> {
  /**
   * The token for the Notion API client.
   */
  notionToken: string;
  /**
   * The ID of the page containing all databases.
   */
  dbPageId: string;
  /**
   * The schemas of all databases.
   */
  dbSchemas: DBS;
  /**
   * The prefix of the database titles. Will be omitted when querying databases.
   */
  dbPrefix?: string;
}

/**
 * Query parameters. Same as Notions API query parameters but without `database_id` and `filter_properties`.
 */
export type NotionDBQueryParameters = Omit<QueryDatabaseParameters, 'database_id' | 'filter_properties'>
/**
 * Adds the content of a page to the type of the object.
 */
export type TypeWithContent<T, C extends string> = T & Record<C, NotionPageContent>

/**
 * Create a Notion CMS Adapter client.
 *
 * @param options - Options for the client.
 * @returns The client.
 */
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

  async function assertPageInDatabase(db: DBName, pageId: string) {
    await useDatabaseId(db, async (id) => {
      const page = await client.pages.retrieve({
        page_id: pageId
      });
      if (!isFullPage(page)) {
        throw Error('Not a full page');
      }
      if (page.parent.type !== 'database_id' || page.parent.database_id !== id) {
        throw Error('Page not found in database');
      }
    });
  }

  return {

    /**
     * Query a database.
     *
     * @param db The name of the database.
     * @param params The query parameters.
     */
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

    /**
     * Query a database and return the first result only.
     *
     * @param db The name of the database.
     * @param params The query parameters.
     */
    async queryFirst<T extends DBName>(db: T, params: NotionDBQueryParameters = {}): Promise<DBInfer<S[T]> | undefined> {
      const results = await this.query(db, params);
      return results[0];
    },

    /**
     * Query a page by Notion page ID.
     *
     * @param db The name of the database.
     * @param id The ID of the page.
     */
    async queryOneById<T extends DBName>(db: T, id: string): Promise<DBInfer<S[T]>> {
      const response = await client.pages.retrieve({
        page_id: id
      });
      if (!isFullPage(response)) {
        throw Error('Not a full page');
      }
      const dbId = await getDatabaseId((db as string));
      if (response.parent.type !== 'database_id' || response.parent.database_id !== dbId) {
        throw Error('Page not found in database');
      }
      return processRow(response, dbSchemas[db]);
    },

    /**
     * Query content of a page by Notion page ID.
     *
     * @param id The ID of the page.
     */
    async queryPageContentById(id: string): Promise<NotionPageContent> {
      const blockResponse = await client.blocks.children.list({
        block_id: id
      });
      return blockResponse.results;
    },

    /**
     * Query a page and its content by Notion page ID.
     *
     * @param db The name of the database.
     * @param id The unique ID of the page.
     * @param contentProperty The property name to store the content.
     */
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

    /**
     * Query a page by unique ID.
     *
     * @param db The name of the database.
     * @param unique_id The unique ID of the page.
     */
    async queryOneByUniqueId<T extends DBName>(db: T, unique_id: number): Promise<DBInfer<S[T]> | undefined> {
      const uniqueIdProp = Object.entries(dbSchemas[db]).find(([_, type]) => type !== '__id' && type.type === 'unique_id')![0];
      return this.queryFirst(db, {
        filter: {
          property: uniqueIdProp,
          unique_id: {
            equals: unique_id
          }
        }
      });
    },

    /**
     * Query a page and its content by unique ID.
     *
     * @param db The name of the database.
     * @param unique_id The unique ID of the page.
     * @param contentProperty The property name to store the content.
     */
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

    /**
     * Convert the content of a database into a key-value pair using designated key and value fields.
     *
     * @param db The name of the database.
     * @param keyProp The name of the key field.
     * @param valueProp The name of the value field.
     */
    async queryKV<
      T extends DBName,
      DB extends DBInfer<S[T]>,
      F extends KeysWithValueType<DB, string>,
      G extends keyof DB,
      R extends Record<string, DB[G]>
    >(db: T, keyProp: F, valueProp: G): Promise<R> {
      return useDatabaseId(db, async (id) => {
        const response = await client.databases.query({
          database_id: id,
        });
        if (!isAllFullPage(response.results)) {
          throw Error('Not all results are full page');
        }
        const processedResults = processRows(response.results, dbSchemas[db]);
        return processKVResults(processedResults, keyProp as string, valueProp as string) as R;
      });
    },

    /**
     * Query the content of a page by title. If title is not unique, the first page found will be returned.
     *
     * @param db The name of the database.
     * @param title The title of the page.
     */
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

    /**
     * Insert an entry into a database.
     *
     * @param db The name of the database.
     * @param data The data to insert.
     */
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

    /**
     * Update an entry in a database. Will throw an error if the page is not found in the database.
     *
     * @param db The name of the database.
     * @param id The ID of the page.
     * @param data The data to update.
     */
    async updateEntry<T extends DBName>(db: T, id: string, data: DBMutateInfer<S[T]>): Promise<DBInfer<S[T]>> {
      await assertPageInDatabase(db, id);
      const result = await client.pages.update({
        page_id: id,
        properties: createMutateData(data, dbSchemas[db])
      });
      if (!('properties' in result)) {
        throw Error('Not a full page');
      }
      return processRow(result, dbSchemas[db]);
    },

    /**
     * Delete an entry in a database. Will throw an error if the page is not found in the database.
     *
     * @param db The name of the database.
     * @param id The ID of the page.
     */
    async deleteEntry(db: DBName, id: string): Promise<void> {
      await assertPageInDatabase(db, id);
      await client.pages.update({
        page_id: id,
        in_trash: true
      });
    }
  };
}
