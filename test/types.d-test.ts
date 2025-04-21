import {expect, expectError, typesAssignable, typesEqual} from "./utils";
import {
  DBInfer,
  AdapterMutablePropertyDefinition,
  NotionMutablePropertyTypeEnum,
  AdapterPropertyDefinition,
  PropertyInfer, MutateInfer, KeysWithValueType, DBNamesWithPropertyType,
  NotionPageMetadataKeys,
  AdapterPropertyDefinitionEnum
} from "../src";

expect<typesAssignable<NotionPageMetadataKeys, 'id' | 'created_by' | 'parent'>>()

expect<typesAssignable<NotionMutablePropertyTypeEnum, 'number' | 'rich_text' | 'title' | 'files'>>()
expectError<typesAssignable<NotionMutablePropertyTypeEnum, 'rollup'>>()
expectError<typesAssignable<NotionMutablePropertyTypeEnum, 'formula'>>()

expect<typesAssignable<AdapterPropertyDefinitionEnum, AdapterPropertyDefinition<'number'> | AdapterPropertyDefinition<'rich_text'>>>()

expect<typesAssignable<
  AdapterMutablePropertyDefinition<'rich_text'>['composer'],
  (value: string) => [{ text: { content: string } }]
>>()
expectError<typesAssignable<
  AdapterMutablePropertyDefinition<'rich_text'>['composer'],
  (value: string) => string
>>()

expect<typesEqual<string, PropertyInfer<{
  type: 'title',
  handler: () => string
}>>>()

expect<typesEqual<string, PropertyInfer<{
  type: '__id',
  handler: () => string,
}>>>()

expect<typesEqual<string, PropertyInfer<{
  type: '__icon',
  handler: () => string,
}>>>()

type Schema = {
  a: {
    type: 'title',
    handler: () => string,
  },
  b: {
    type: 'number',
    handler: () => number,
  },
  c: {
    type: 'rich_text',
    handler: () => string,
  },
}
type DB = DBInfer<Schema>
type S = KeysWithValueType<DB, string>
expect<typesEqual<'a' | "c", S>>()

expect<typesEqual<number, MutateInfer<{
  type: 'title',
  handler: () => string,
  composer: (value: number) => []
}>>>()
expect<typesEqual<never, MutateInfer<{
  type: 'title',
  handler: () => string
}>>>()

type Schema2 = {
  a: {
    type: 'unique_id',
    handler: () => string,
  },
  b: {
    type: 'number',
    handler: () => number,
  },
  c: {
    type: 'rich_text',
    handler: () => string,
  },
}
type DBSchemas = {
  db1: Schema,
  db2: Schema2,
}
expect<typesEqual<'db1', DBNamesWithPropertyType<DBSchemas, 'title'>>>()
expect<typesEqual<'db2', DBNamesWithPropertyType<DBSchemas, 'unique_id'>>>()
