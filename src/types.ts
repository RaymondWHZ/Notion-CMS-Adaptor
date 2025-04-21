import type {
  BlockObjectResponse, CreatePageParameters,
  PageObjectResponse,
  PartialBlockObjectResponse,
  UpdatePageParameters
} from "@notionhq/client/build/src/api-endpoints";

/**
 * Infer the type of key that has a specific value type in a record.
 *
 * @typeParam T - The type of record.
 * @typeParam U - The type of value to be found.
 */
export type KeysWithValueType<T extends Record<string, any>, U> = {
  [K in keyof T]: T[K] extends U ? K : never
}[keyof T];

/**
 * Content of a Notion page. Same as Array<PartialBlockObjectResponse | BlockObjectResponse>.
 */
export type NotionPageContent = Array<PartialBlockObjectResponse | BlockObjectResponse>;

/**
 * All possible metadata keys for a Notion page.
 */
export type NotionPageMetadataKeys = Exclude<keyof PageObjectResponse, 'properties' | 'object'>;
/**
 * All mutable metadata keys for create/update a Notion page.
 */
export type NotionMutablePageMetadataKeys = Exclude<keyof UpdatePageParameters, 'page_id' | 'properties' | 'archived'>;
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
 * Metadata key enum for Notion page.
 */
export type NotionPageMetadataKeyEnum = `__${NotionPageMetadataKeys}`;
/**
 * Mutable metadata key enum for Notion page.
 */
export type NotionMutablePageMetadataKeyEnum = `__${NotionMutablePageMetadataKeys}`;
/**
 * Revert the metadata key enum to the original key.
 */
export type RK<T extends NotionPageMetadataKeyEnum> = T extends `__${infer R}` ? R : never;

/**
 * Possible adapter types.
 */
export type AdapterPropertyTypeEnum = NotionPropertyTypeEnum | NotionPageMetadataKeyEnum;
/**
 * Possible mutable adapter types.
 */
export type AdapterMutablePropertyTypeEnum = NotionMutablePropertyTypeEnum | NotionMutablePageMetadataKeyEnum;

/**
 * Infer the underlying value of a Notion property in response.
 *
 * @typeParam T - The type of Notion property.
 */
export type ValueType<T extends AdapterPropertyTypeEnum> =
  T extends NotionPropertyTypeEnum ? (Extract<NotionPropertyValues, { type: T }> extends { [K in T]: infer R } ? R : never)
    : T extends NotionPageMetadataKeyEnum ? PageObjectResponse[RK<T>] : never;
/**
 * Handler for a Notion property type. It takes the value of the property and return the processed value.
 *
 * @typeParam T - The type of Notion property.
 * @typeParam R - The return type of the handler.
 */
export type ValueHandler<T extends AdapterPropertyTypeEnum, R = any> = (value: ValueType<T>, page: PageObjectResponse) => R;
/**
 * Infer the type that can mutate a Notion property.
 *
 * @typeParam T - The type of Notion mutable property.
 */
export type MutateValueType<T extends AdapterMutablePropertyTypeEnum> =
  T extends NotionMutablePropertyTypeEnum ? (Extract<NotionMutationPropertyValues, { type?: T }> extends { [K in T]: infer R } ? R : never)
    : T extends NotionMutablePageMetadataKeyEnum ? UpdatePageParameters[RK<T>] : never;
/**
 * Composer for a Notion mutable property type. It takes the value of the property and return the processed value.
 *
 * @typeParam T - The type of Notion mutable property.
 * @typeParam I - The input type of the composer.
 */
export type ValueComposer<T extends AdapterMutablePropertyTypeEnum, I = any> = (value: I) => MutateValueType<T>

/**
 * Type used to define a immutable Notion property in schema.
 *
 * @typeParam T - The type of Notion property.
 * @typeParam R - The return type of the handler.
 */
export type AdapterPropertyDefinition<T extends AdapterPropertyTypeEnum, R = any> = {
  type: T
  handler: ValueHandler<T, R>
};
/**
 * All possible immutable Notion property definitions.
 */
export type AdapterPropertyDefinitionEnum = {
  [K in AdapterPropertyTypeEnum]: AdapterPropertyDefinition<K>;
}[AdapterPropertyTypeEnum];
/**
 * Type used to define a mutable Notion property in schema.
 *
 * @typeParam T - The type of Notion mutable property.
 * @typeParam R - The return type of the handler.
 * @typeParam I - The input type of the composer.
 */
export type AdapterMutablePropertyDefinition<T extends AdapterMutablePropertyTypeEnum, R = any, I = R> = AdapterPropertyDefinition<T, R> & {
  composer: ValueComposer<T, I>
};
/**
 * All possible mutable Notion property definitions.
 */
export type AdapterMutablePropertyDefinitionEnum = {
  [K in AdapterMutablePropertyTypeEnum]: AdapterMutablePropertyDefinition<K>;
}[AdapterMutablePropertyTypeEnum];

/**
 * All possible values for the definition of a Notion property.
 */
export type DBSchemaValueDefinition = AdapterPropertyDefinitionEnum | AdapterMutablePropertyDefinitionEnum;
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
export type PropertyInfer<T extends DBSchemaValueDefinition> = ReturnType<T['handler']>;
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
export type DBNamesWithPropertyType<T extends DBSchemasType, P extends AdapterPropertyTypeEnum> = {
  [K in keyof T]: KeysWithValueType<T[K], AdapterPropertyDefinition<P>> extends never ? never : K
}[keyof T];

/**
 * Infer the type of value to be accepted by the composer of a mutable Notion property.
 *
 * @typeParam T - The type of Notion mutable property definition.
 */
export type MutateInfer<T extends DBSchemaValueDefinition> =
  T extends AdapterMutablePropertyDefinitionEnum ?
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
