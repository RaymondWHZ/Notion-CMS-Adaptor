import type {
  BlockObjectResponse, CreatePageParameters,
  PageObjectResponse,
  PartialBlockObjectResponse
} from "@notionhq/client/build/src/api-endpoints";

/**
 * Content of a Notion page. Same as Array<PartialBlockObjectResponse | BlockObjectResponse>.
 */
export type NotionPageContent = Array<PartialBlockObjectResponse | BlockObjectResponse>;

/**
 * Type of properties of a Notion page. Same as PageObjectResponse['properties'].
 */
export type NotionProperties = PageObjectResponse['properties'];
/**
 * Type of property value of a Notion page. Same as PageObjectResponse['properties'][string].
 */
export type NotionPropertyValues = NotionProperties[string];
/**
 * All possible types of Notion property.
 */
export type NotionPropertyTypeEnum = NotionPropertyValues['type'];
/**
 * Type of mutable property for create/update Notion page.
 */
export type NotionMutationProperties = CreatePageParameters['properties'];  // applicable for both create and update
/**
 * Type of mutable property value for create/update Notion page.
 */
export type NotionMutationPropertyValues = NotionMutationProperties[string];
/**
 * All mutable types of Notion property.
 */
export type NotionMutablePropertyTypeEnum =
  NonNullable<Extract<NotionMutationPropertyValues, { type?: NotionPropertyTypeEnum }>['type']>;

/**
 * Infer the underlying value of a Notion property in response.
 *
 * @typeParam T - The type of Notion property.
 */
export type ValueType<T extends NotionPropertyTypeEnum> =
  Extract<NotionPropertyValues, { type: T }> extends { [K in T]: infer R } ? R : never;
/**
 * Handler for a Notion property type. It takes the value of the property and return the processed value.
 *
 * @typeParam T - The type of Notion property.
 * @typeParam R - The return type of the handler.
 */
export type ValueHandler<T extends NotionPropertyTypeEnum, R = any> = (value: ValueType<T>, option: string, pageId: string) => R;
/**
 * Infer the type that can mutate a Notion property.
 *
 * @typeParam T - The type of Notion mutable property.
 */
export type MutateValueType<T extends NotionMutablePropertyTypeEnum> =
  Extract<NotionMutationPropertyValues, { type?: T }> extends { [K in T]: infer R } ? R : never;
/**
 * Composer for a Notion mutable property type. It takes the value of the property and return the processed value.
 *
 * @typeParam T - The type of Notion mutable property.
 * @typeParam I - The input type of the composer.
 */
export type ValueComposer<T extends NotionMutablePropertyTypeEnum, I = any> = (value: I) => MutateValueType<T>

/**
 * Type used to define a immutable Notion property in schema.
 *
 * @typeParam T - The type of Notion property.
 * @typeParam R - The return type of the handler.
 */
export type NotionPropertyDefinition<T extends NotionPropertyTypeEnum, R = any> = {
  type: T
  handler: ValueHandler<T, R>
};
/**
 * All possible immutable Notion property definitions.
 */
export type NotionPropertyDefinitionEnum = {
  [K in NotionPropertyTypeEnum]: NotionPropertyDefinition<K>;
}[NotionPropertyTypeEnum];
/**
 * Type used to define a mutable Notion property in schema.
 *
 * @typeParam T - The type of Notion mutable property.
 * @typeParam R - The return type of the handler.
 * @typeParam I - The input type of the composer.
 */
export type NotionMutablePropertyDefinition<T extends NotionMutablePropertyTypeEnum, R = any, I = R> = NotionPropertyDefinition<T, R> & {
  composer: ValueComposer<T, I>
};
/**
 * All possible mutable Notion property definitions.
 */
export type NotionMutablePropertyDefinitionEnum = {
  [K in NotionMutablePropertyTypeEnum]: NotionMutablePropertyDefinition<K>;
}[NotionMutablePropertyTypeEnum];

/**
 * All possible values for the definition of a Notion property.
 */
export type DBSchemaValueDefinition = NotionPropertyDefinitionEnum | NotionMutablePropertyDefinitionEnum | '__id';
/**
 * Type of schema for one Notion database.
 */
export type DBSchemaType = Record<string, DBSchemaValueDefinition>;
/**
 * Type of schemas for multiple Notion databases.
 */
export type DBSchemasType = Record<string, DBSchemaType>;

/**
 * Infer the type of value after conversion by the handler of a Notion property.
 *
 * @typeParam T - The type of Notion property definition.
 */
export type PropertyInfer<T extends DBSchemaValueDefinition> =
  T extends NotionPropertyDefinitionEnum ? ReturnType<T['handler']> : string;
/**
 * Infer the type of object after converting all properties in one Notion database.
 *
 * @typeParam T - The type of schema for one Notion database.
 */
export type DBInfer<T extends DBSchemaType> = {
  [K in keyof T]: PropertyInfer<T[K]>
}
/**
 * Infer a collection of all converted objects based on the schema.
 *
 * @typeParam DBS - The type of schemas for multiple Notion databases.
 */
export type DBObjectTypesInfer<DBS extends DBSchemasType> = {
  [K in keyof DBS]: DBInfer<DBS[K]>
}

/**
 * Infer the type of value to be accepted by the composer of a mutable Notion property.
 *
 * @typeParam T - The type of Notion mutable property definition.
 */
export type MutateInfer<T extends DBSchemaValueDefinition> =
  T extends NotionMutablePropertyDefinitionEnum ?
    (T['composer'] extends ValueComposer<T['type'], infer I> ? I : never) : never
/**
 * Infer the type of object that can be used to mutate entries in one Notion database.
 *
 * @typeParam T - The type of schema for one Notion database.
 */
export type DBMutateInfer<T extends DBSchemaType> = Partial<{
  [K in keyof T]: MutateInfer<T[K]>
}>;
/**
 * Infer a collection of all objects that can be used to mutate entries in each database based on the schema.
 *
 * @typeParam DBS - The type of schemas for multiple Notion databases.
 */
export type DBMutateObjectTypesInfer<DBS extends DBSchemasType> = {
  [K in keyof DBS]: DBMutateInfer<DBS[K]>
}
