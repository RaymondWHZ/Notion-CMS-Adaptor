import type {
  BlockObjectResponse, CreatePageParameters,
  PageObjectResponse,
  PartialBlockObjectResponse
} from "@notionhq/client/build/src/api-endpoints";

export type NotionPageContent = Array<PartialBlockObjectResponse | BlockObjectResponse>;

export type NotionProperties = PageObjectResponse['properties'];
export type NotionPropertyValues = NotionProperties[string];
export type NotionPropertyTypeEnum = NotionPropertyValues['type'];
export type NotionMutationProperties = CreatePageParameters['properties'];  // applicable for both create and update
export type NotionMutationPropertyValues = NotionMutationProperties[string];
export type NotionMutablePropertyTypeEnum =
  NonNullable<Extract<NotionMutationPropertyValues, { type?: NotionPropertyTypeEnum }>['type']>;

export type ValueType<T extends NotionPropertyTypeEnum> =
  Extract<NotionPropertyValues, { type: T }> extends { [K in T]: infer R } ? R : never;
export type ValueHandler<T extends NotionPropertyTypeEnum, R = any> = (value: ValueType<T>, option: string, pageId: string) => R;
export type MutateValueType<T extends NotionMutablePropertyTypeEnum> =
  Extract<NotionMutationPropertyValues, { type?: T }> extends { [K in T]: infer R } ? R : never;
export type ValueComposer<T extends NotionMutablePropertyTypeEnum, I = any> = (value: I) => MutateValueType<T>

export type NotionPropertyDefinition<T extends NotionPropertyTypeEnum, R = any> = {
  type: T
  handler: ValueHandler<T, R>
};
export type NotionPropertyDefinitionEnum = {
  [K in NotionPropertyTypeEnum]: NotionPropertyDefinition<K>;
}[NotionPropertyTypeEnum];
export type NotionMutablePropertyDefinition<T extends NotionMutablePropertyTypeEnum, R = any, I = R> = NotionPropertyDefinition<T, R> & {
  composer: ValueComposer<T, I>
};
export type NotionMutablePropertyDefinitionEnum = {
  [K in NotionMutablePropertyTypeEnum]: NotionMutablePropertyDefinition<K>;
}[NotionMutablePropertyTypeEnum];

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

export type MutateInfer<T extends DBSchemaValueDefinition> =
  T extends NotionMutablePropertyDefinitionEnum ?
    (T['composer'] extends ValueComposer<T['type'], infer I> ? I : never) : never
export type DBMutateInfer<T extends DBSchemaType> = Partial<{
  [K in keyof T]: MutateInfer<T[K]>
}>;
export type DBMutateObjectTypesInfer<DBS extends DBSchemasType> = {
  [K in keyof DBS]: DBMutateInfer<DBS[K]>
}
