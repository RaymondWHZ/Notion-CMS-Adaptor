import type {
  BlockObjectResponse,
  PageObjectResponse,
  PartialBlockObjectResponse
} from "@notionhq/client/build/src/api-endpoints";

export type NotionPropertyTypeEnum = PageObjectResponse['properties'][string]['type'];
export type NotionPageContent = Array<PartialBlockObjectResponse | BlockObjectResponse>;

export type ValueType<T extends NotionPropertyTypeEnum> =
  Extract<PageObjectResponse['properties'][string], { type: T }> extends { [K in T]: infer R } ? R : never;
export type ValueHandler<T extends NotionPropertyTypeEnum, R = any> = (value: ValueType<T>, option: string, pageId: string) => R;
export type ValueComposer<R = any> = (value: R) => any;

export type NotionPropertyDefinition<T extends NotionPropertyTypeEnum, R = any> = {
  type: T
  handler: ValueHandler<T, R>
};
export type NotionPropertyDefinitionEnum = {
  [K in NotionPropertyTypeEnum]: NotionPropertyDefinition<K>;
}[NotionPropertyTypeEnum];
export type NotionMutablePropertyDefinition<T extends NotionPropertyTypeEnum, R = any> = NotionPropertyDefinition<T, R> & {
  composer: ValueComposer<R>
};
export type NotionMutablePropertyDefinitionEnum = {
  [K in NotionPropertyTypeEnum]: NotionMutablePropertyDefinition<K>;
}[NotionPropertyTypeEnum];
export type DBSchemaValueDefinition = NotionPropertyDefinitionEnum | NotionMutablePropertyDefinitionEnum | '__id';
export type DBSchemaType = Record<string, DBSchemaValueDefinition>;
export type DBSchemasType = Record<string, DBSchemaType>;

export type PropertyInfer<T extends DBSchemaValueDefinition> =
  T extends NotionPropertyDefinitionEnum ? ReturnType<T['handler']> : string;

export type DBInfer<T extends DBSchemaType> = {
  [K in keyof T]: PropertyInfer<T[K]>
}

export type DBObjectTypesInfer<DBS extends DBSchemasType> = {
  [K in keyof DBS]: DBInfer<DBS[K]>
}

export type DBMutateInfer<T extends DBSchemaType> = Partial<{
  [K in keyof T]: T[K] extends NotionMutablePropertyDefinitionEnum ?
    (T[K]['composer'] extends ValueComposer<infer R> ? R : never) : never
}>;
