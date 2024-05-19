import {expect, expectError, typesAssignable, typesEqual} from "./utils";
import {
  NotionMutablePropertyDefinition,
  NotionMutablePropertyTypeEnum,
  NotionPropertyDefinition,
  NotionPropertyDefinitionEnum, PropertyInfer
} from "../build";
import {MutateInfer} from "../src";

expect<typesAssignable<NotionMutablePropertyTypeEnum, 'number' | 'rich_text' | 'title' | 'files'>>()
expectError<typesAssignable<NotionMutablePropertyTypeEnum, 'rollup'>>()
expectError<typesAssignable<NotionMutablePropertyTypeEnum, 'formula'>>()

expect<typesAssignable<NotionPropertyDefinitionEnum, NotionPropertyDefinition<'number'> | NotionPropertyDefinition<'rich_text'>>>()

expect<typesAssignable<
  NotionMutablePropertyDefinition<'rich_text'>['composer'],
  (value: string) => [{ text: { content: string } }]
>>()
expectError<typesAssignable<
  NotionMutablePropertyDefinition<'rich_text'>['composer'],
  (value: string) => string
>>()

expect<typesEqual<string, PropertyInfer<{
  type: 'title',
  handler: () => string
}>>>()
expect<typesEqual<number, MutateInfer<{
  type: 'title',
  handler: () => string,
  composer: (value: number) => []
}>>>()
expect<typesEqual<never, MutateInfer<{
  type: 'title',
  handler: () => string
}>>>()
