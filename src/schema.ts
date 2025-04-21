import type {
  AdapterMutablePropertyDefinition,
  AdapterMutablePropertyTypeEnum,
  AdapterPropertyDefinition,
  AdapterPropertyTypeEnum,
  DBSchemasType,
  MutateValueType,
  NotionMutablePageMetadataKeys,
  NotionPageMetadataKeys,
  NotionPropertyDefinition,
  PropertyInfer,
  ValueComposer,
  ValueHandler,
  ValueType
} from "./types";
import type { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";

/**
 * A type safe way to define database schemas. Directly return the schema object.
 * @param schema The schema object
 */
export function createDBSchemas<T extends DBSchemasType>(schema: T): typeof schema {
  return schema;
}

/**
 * Convert a list of rich text items to a plain text string.
 * @param arr The list of rich text items
 */
export function packPlainText(arr: RichTextItemResponse[]): string {
  return arr.reduce((acc, cur) => acc + cur.plain_text, '');
}

/**
 * Rewrite the preSignedUrl to use Notion's image optimization service, assuming the preSignedUrl is a Notion image.
 *
 * This is not an official API and may break at any time. Use at your own risk.
 *
 * @param pageId The id of the page containing the image
 * @param preSignedUrl The preSignedUrl of the image
 */
export function convertNotionImage(pageId: string, preSignedUrl: string) {
  return 'https://www.notion.so/image/' +
    encodeURIComponent(preSignedUrl.split('?')[0]) +
    '?id=' +
    pageId +
    '&table=block';
}

const makeDefaultOptions = <T extends AdapterPropertyTypeEnum>(type: T) => {
  const valueToRaw: AdapterPropertyDefinition<T, ValueType<T>> = {
    type,
    handler: value => value
  };
  return {
    /**
     * Expand the default options, so that the object itself can be used as a definition.
     */
    ...valueToRaw,
    /**
     * Directly return the raw value. Does not support mutation.
     * 
     * It is now the same as simply omitting this raw() method call.
     */
    raw(): AdapterPropertyDefinition<T, ValueType<T>> {
      return valueToRaw;
    },
    /**
     * Directly return the raw value with a default value if the value is null or undefined. Does not support mutation.
     * @param defaultValue The default value
     */
    rawWithDefault(defaultValue: NonNullable<ValueType<T>>): AdapterPropertyDefinition<T, NonNullable<ValueType<T>>> {
      return {
        type,
        handler: value => value ?? defaultValue,
      }
    },
    /**
     * Handle the value using a custom handler. Does not support mutation.
     * @param handler The custom handler
     */
    handleUsing<R>(handler: ValueHandler<T, R>): AdapterPropertyDefinition<T, R> {
      return {
        type,
        handler
      }
    },
  }
}

const makeMutableDefaultOptions = <T extends AdapterMutablePropertyTypeEnum>(type: T) => {
  const valueToRaw: AdapterMutablePropertyDefinition<T, ValueType<T>, MutateValueType<T>> = {
    type,
    handler: value => value,
    composer: value => value
  }
  return {
    /**
     * Expand the default options, so that the object itself can be used as a definition.
     */
    ...valueToRaw,
    /**
     * Directly return the raw value. Supports mutation.
     * 
     * It is now the same as simply omitting this raw() method call.
     */
    raw(): AdapterMutablePropertyDefinition<T, ValueType<T>, MutateValueType<T>> {
      return valueToRaw;
    },
    /**
     * Directly return the raw value with a default value if the value is null or undefined. Supports mutation.
     * @param defaultValue The default value
     */
    rawWithDefault(defaultValue: NonNullable<ValueType<T>>): AdapterMutablePropertyDefinition<T, NonNullable<ValueType<T>>, MutateValueType<T>> {
      return {
        type,
        handler: value => value ?? defaultValue,
        composer: value => value
      }
    },
    /**
     * Handle the value using a custom handler. Supports mutation using the raw underlying value.
     * @param handler The custom handler
     */
    handleUsing<R>(handler: ValueHandler<T, R>): AdapterMutablePropertyDefinition<T, R, MutateValueType<T>> {
      return {
        type,
        handler,
        composer: value => value
      }
    },
    /**
     * Handle the value using a custom handler. Supports mutation via a custom composer.
     * @param handler The custom handler
     * @param composer The custom composer
     */
    handleAndComposeUsing<R, I = R>({ handler, composer }: { handler: ValueHandler<T, R>, composer: ValueComposer<T, I> }): AdapterMutablePropertyDefinition<T, R, I> {
      return {
        type,
        handler,
        composer
      }
    },
  }
}

/**
 * Reference a metadata key.
 */
export function metadata<T extends NotionPageMetadataKeys>(key: T) {
  return makeDefaultOptions(`__${key}`);
}

/**
 * Reference a mutable metadata key.
 */
export function mutableMetadata<T extends NotionMutablePageMetadataKeys>(key: T) {
  return makeMutableDefaultOptions(`__${key}`);
}

const __idOptions = metadata('id');

/**
 * Reference the id metadata. Same as using 'metadata("id")'.
 */
export function __id() {
  return __idOptions;
}

const checkboxOptions = {
  ...makeMutableDefaultOptions('checkbox'),
  /**
   * Convert the value to a boolean. Supports mutation.
   */
  boolean() {
    return this.raw();
  }
}

/**
 * Define a checkbox property.
 */
export function checkbox() {
  return checkboxOptions;
}

const createdByOptions = {
  ...makeDefaultOptions('created_by'),
  /**
   * Get the name of the creator. Does not support mutation.
   */
  name() {
    return this.handleUsing(value => 'name' in value ? value.name ?? '' : '')
  }
}
/**
 * Define a created_by property.
 */
export function created_by() {
  return createdByOptions;
}

const createdTimeOptions = {
  ...makeDefaultOptions('created_time'),
  /**
   * Get the time string of the creation time. Does not support mutation.
   */
  timeString() {
    return this.raw();
  }
}
/**
 * Define a created_time property.
 */
export function created_time() {
  return createdTimeOptions;
}

export type DateRange = {
  start: string
  end: string
}
const dateOptions = {
  ...makeMutableDefaultOptions('date'),
  /**
   * Get the start date of the date range, defaults to empty string. Supports mutation.
   */
  startDate() {
    return this.handleAndComposeUsing({
      handler: value => value?.start ?? '',
      composer: value => ({ start: value })
    })
  },
  /**
   * Get the date range. Supports mutation.
   */
  dateRange() {
    return this.handleAndComposeUsing<DateRange>({
      handler: (value) => {
        return {
          start: value?.start ?? '',
          end: value?.end ?? ''
        }
      },
      composer: (value) => value
    })
  }
}

/**
 * Define a date property.
 */
export function date() {
  return dateOptions;
}

const emailOptions = {
  ...makeMutableDefaultOptions('email'),
  /**
   * Get the email string. Supports mutation.
   */
  string() {
    return this.rawWithDefault('');
  }
}
/**
 * Define an email property.
 */
export function email() {
  return emailOptions;
}

const filesOptions = {
  ...makeMutableDefaultOptions('files'),
  /**
   * Get the urls of the files. Supports mutation using the raw underlying value.
   */
  urls() {
    return this.handleUsing((value) => value.reduce((acc, file) => {
      let result: string | undefined = undefined;
      if ('file' in file) {
        result = file.file.url;
      } else if ('external' in file) {
        result = file.external.url;
      }
      if (result === undefined) {
        return acc;
      }
      return acc.concat(result);
    }, [] as string[]))
  },
  /**
   * Get the url of the first file. Supports mutation using the raw underlying value.
   */
  singleUrl() {
    return this.handleUsing((value) => {
      const file = value[0];
      if (!file) {
        return '';
      }
      if ('file' in file) {
        return file.file.url;
      } else if ('external' in file) {
        return file.external.url;
      }
      return '';
    })
  },
  /**
   * Rewrite the preSignedUrl to use Notion's image optimization service, assuming the preSignedUrl is a Notion image.
   *
   * This is not an official API and may break at any time. Use at your own risk.
   */
  notionImageUrls() {
    return this.handleUsing((value, { page: { id } }) => value.reduce((acc, file) => {
      let result: string | undefined = undefined;
      if ('file' in file) {
        result = convertNotionImage(id, file.file.url);
      }
      if (result === undefined) {
        return acc;
      }
      return acc.concat(result);
    }, [] as string[]))
  },
  /**
   * Rewrite the preSignedUrl of the first image to use Notion's image optimization service, assuming the preSignedUrl is a Notion image.
   *
   * This is not an official API and may break at any time. Use at your own risk.
   */
  singleNotionImageUrl() {
    return this.handleUsing((value, { page: { id } }) => {
      const file = value[0];
      if (!file) {
        return '';
      }
      if ('file' in file) {
        return convertNotionImage(id, file.file.url);
      }
      return '';
    })
  }
}
/**
 * Define a files property.
 */
export function files() {
  return filesOptions;
}

const formulaOptions = {
  ...makeDefaultOptions('formula'),
  /**
   * Convert the value to string. Does not support mutation.
   */
  string() {
    return this.handleUsing(value => {
      if (value.type === 'string') {
        return value.string ?? '';
      } else if (value.type === 'number') {
        return value.number?.toString() ?? '';
      } else if (value.type === 'boolean') {
        return value.boolean ? 'true' : 'false';
      } else if (value.type === 'date') {
        return value.date?.start ?? '';
      }
      return '';
    })
  },
  /**
   * If the value is boolean and is true, return true; otherwise return false. Does not support mutation.
   */
  booleanDefaultFalse() {
    return this.handleUsing(value => value.type === 'boolean' ? value.boolean ?? false : false)
  },
  /**
   * If the value is number, return the number; otherwise return 0. Does not support mutation.
   */
  numberDefaultZero() {
    return this.handleUsing(value => value.type === 'number' ? value.number ?? 0 : 0)
  },
  /**
   * If the value is date, return the date range; otherwise return a data range with empty start and end. Does not support mutation.
   */
  dateRange() {
    return this.handleUsing(value => {
      if (value.type === 'date') {
        return {
          start: value.date?.start ?? '',
          end: value.date?.end ?? ''
        }
      }
      return {
        start: '',
        end: ''
      }
    })
  }
}
/**
 * Define a formula property.
 */
export function formula() {
  return formulaOptions;
}

const lastEditedByOptions = {
  ...makeDefaultOptions('last_edited_by'),
  /**
   * Get the name of the last editor. Does not support mutation.
   */
  name() {
    return this.handleUsing(value => 'name' in value ? value.name ?? '' : '')
  }
}
/**
 * Define a last_edited_by property.
 */
export function last_edited_by() {
  return lastEditedByOptions;
}

const lastEditedTimeOptions = {
  ...makeDefaultOptions('last_edited_time'),
  /**
   * Get the time string of the last edit time. Does not support mutation.
   */
  timeString() {
    return this.raw();
  }
}
/**
 * Define a last_edited_time property.
 */
export function last_edited_time() {
  return lastEditedTimeOptions;
}

const multiSelectOptions = {
  ...makeMutableDefaultOptions('multi_select'),
  /**
   * Get the names of the options. Supports mutation.
   */
  strings() {
    return this.handleAndComposeUsing({
      handler: (value) => value.map(option => option.name),
      composer: (value) => value.map(name => ({ name }))
    })
  },
  /**
   * Get the names of the options, validating that they are in the provided list of values. Supports mutation.
   */
  stringEnums<T extends string>(...values: T[]) {
    return this.handleAndComposeUsing({
      handler: value => {
        const names = value.map(option => option.name);
        if (!names.every(name => values.includes(name as T))) {
          throw Error('Invalid status');
        }
        return names as T[];
      },
      composer: value => {
        if (!value.every(name => values.includes(name))) {
          throw Error('Invalid status');
        }
        return value.map(name => ({ name }));
      }
    });
  }
}
/**
 * Define a multi_select property.
 */
export function multi_select() {
  return multiSelectOptions;
}

const numberOptions = {
  ...makeMutableDefaultOptions('number'),
  /**
   * If the value is number, return the number; otherwise return 0. Supports mutation.
   */
  numberDefaultZero() {
    return this.rawWithDefault(0);
  }
}
/**
 * Define a number property.
 */
export function number() {
  return numberOptions;
}

const peopleOptions = {
  ...makeMutableDefaultOptions('people'),
  /**
   * Get the names of the people. Supports mutation using the raw underlying value.
   */
  names() {
    return this.handleUsing(value => value.reduce((acc, person) => {
      if ('name' in person) {
        return acc.concat(person.name ?? '');
      }
      return acc;
    }, [] as string[]))
  }
}
/**
 * Define a people property.
 */
export function people() {
  return peopleOptions;
}

const phoneNumberOptions = {
  ...makeMutableDefaultOptions('phone_number'),
  /**
   * Get the phone number string, default to empty string. Supports mutation.
   */
  string() {
    return this.rawWithDefault('');
  }
}
/**
 * Define a phone_number property.
 */
export function phone_number() {
  return phoneNumberOptions;
}

interface RollupMappingItem {
  rollupField: string
  def: NotionPropertyDefinition
}
interface RollupMapping {
  [key: string]: RollupMappingItem | AdapterPropertyDefinition<'__id'>
}
type InferObject<T extends RollupMapping> = {
  [K in keyof T]:
    T[K] extends RollupMappingItem ? PropertyInfer<T[K]['def']> :
    T[K] extends AdapterPropertyDefinition<'__id'> ? PropertyInfer<T[K]> : never
}
const relationOptions = {
  ...makeMutableDefaultOptions('relation'),
  /**
   * Get the ids of the relations. Supports mutation.
   */
  ids() {
    return this.handleAndComposeUsing({
      handler: value => value.map(relation => relation.id),
      composer: (value) => value.map(id => ({ id }))
    });
  },
  /**
   * Get the first id of the relations. Supports mutation.
   */
  singleId() {
    return this.handleAndComposeUsing({
      handler: value => value[0].id,
      composer: (value) => [{ id: value }]
    });
  },
  /**
   * Construct a list of objects from the relations using related rollup fields. Supports mutation using a list of ids.
   *
   * @param mapping
   */
  objects<M extends RollupMapping>(mapping: M) {
    return this.handleAndComposeUsing({
      handler: (value, { page }) => {
        const { properties } = page;
        return value.map(({ id }, index) => {
          const mappedObject = {} as InferObject<M>;
          Object.entries(mapping).forEach(([key, item]) => {
            if ('rollupField' in item) {
              const { rollupField, def } = item;
              const rollupProperty = properties[rollupField];
              if (!rollupProperty || rollupProperty.type !== 'rollup' || rollupProperty.rollup.type !== 'array') {
                throw Error('Invalid rollup field: ' + rollupField);
              }
              const property = rollupProperty.rollup.array[index];
              if (property.type !== def.type) {
                throw Error(`Property ${rollupField} type mismatch: ${property.type} !== ${def.type}`);
              }
              // @ts-expect-error
              const value = property[def.type] as ValueType<typeof def.type>;
              const handler = def.handler as ValueHandler<typeof def.type>;
              // @ts-expect-error
              mappedObject[key] = handler(value, {});
            } else {
              if (item.type !== '__id') {
                throw Error('Invalid relation mapping: ' + key);
              }
              // @ts-expect-error
              mappedObject[key] = item.handler(id, {});
            }
          })
          return mappedObject;
        });
      },
      composer: (value: string[]) => value.map(id => ({ id }))
    })
  }
}

/**
 * Define a relation property.
 */
export function relation() {
  return relationOptions;
}

const richTextOptions = {
  ...makeMutableDefaultOptions('rich_text'),
  /**
   * Get the plain text version of the field. Supports mutation.
   */
  plainText() {
    return this.handleAndComposeUsing({
      handler: value => packPlainText(value),
      composer: (value) => [{ text: { content: value } }]
    })
  }
}
/**
 * Define a rich_text property.
 */
export function rich_text() {
  return richTextOptions;
}

export type RollupArrayType = Extract<ValueType<'rollup'>, { type: 'array' }>['array']
export type RollupArrayItemType = RollupArrayType[number]
const rollupOptions = {
  ...makeDefaultOptions('rollup'),
  /**
   * If the value is date, return the date range; otherwise return a data range with empty start and end. Does not support mutation.
   */
  dateRange() {
    return this.handleUsing(value => {
      if (value.type === 'date') {
        return {
          start: value.date?.start ?? '',
          end: value.date?.end ?? ''
        }
      }
      return {
        start: '',
        end: ''
      }
    });
  },
  /**
   * If the value is number, return the number; otherwise return 0. Does not support mutation.
   */
  numberDefaultZero() {
    return this.handleUsing(value => {
      if (value.type === 'number') {
        return value.number ?? 0;
      }
      return 0;
    });
  },
  /**
   * If the value is an array, handle the first item using a custom handler, ignoring the rest; otherwise throw an error. Does not support mutation.
   *
   * @param handler The custom handler
   */
  handleSingleUsing<R>(handler: (value: RollupArrayItemType | undefined) => R) {
    return this.handleUsing(value => {
      if (value.type === 'array') {
        return handler(value.array[0]);
      }
      throw Error('Invalid rollup type');
    });
  },
  /**
   * If the value is an array, handle the array using a custom handler; otherwise throw an error. Does not support mutation.
   *
   * @param handler The custom handler
   */
  handleArrayUsing<R>(handler: (value: RollupArrayType) => R) {
    return this.handleUsing(value => {
      if (value.type === 'array') {
        return handler(value.array);
      }
      throw Error('Invalid rollup type');
    });
  }
}
/**
 * Define a rollup property.
 */
export function rollup() {
  return rollupOptions;
}

const selectOptions = {
  ...makeMutableDefaultOptions('select'),
  /**
   * Get the name of the option. Supports mutation.
   */
  optionalString() {
    return this.handleAndComposeUsing({
      handler: value => value?.name,
      composer: (value) => value ? ({ name: value }) : null
    })
  },
  /**
   * Get the name of the option, validating that it is in the provided list of values. Supports mutation.
   */
  stringEnum<T extends string | undefined>(...values: T[]) {
    return this.handleAndComposeUsing({
      handler: value => {
        const name = value?.name;
        if (!values.includes(name as T)) {
          throw Error('Invalid status: ' + name);
        }
        return name as T;
      },
      composer: value => {
        if (!values.includes(value)) {
          throw Error('Invalid status: ' + value);
        }
        return value ? ({ name: value }) : null;
      }
    });
  },
}
/**
 * Define a select property.
 */
export function select() {
  return selectOptions;
}

const statusOptions = {
  ...makeMutableDefaultOptions('status'),
  /**
   * Get the name of the status. Supports mutation.
   */
  string() {
    return this.handleAndComposeUsing({
      handler: value => value?.name ?? '',
      composer: (value) => ({ name: value })
    })
  },
  /**
   * Get the name of the status, validating that it is in the provided list of values. Supports mutation.
   */
  stringEnum<T extends string>(...values: T[]) {
    return this.handleAndComposeUsing({
      handler: value => {
        const name = value?.name;
        if (!name || !values.includes(name as T)) {
          throw Error('Invalid status: ' + name);
        }
        return name as T;
      },
      composer: (value: T) => {
        if (!value || !values.includes(value)) {
          throw Error('Invalid status: ' + value);
        }
        return { name: value };
      }
    });
  },
}
/**
 * Define a status property.
 */
export function status() {
  return statusOptions;
}

const titleOptions = {
  ...makeMutableDefaultOptions('title'),
  /**
   * Get the plain text version of the title. Supports mutation.
   */
  plainText() {
    return this.handleAndComposeUsing({
      handler: value => packPlainText(value),
      composer: (value) => [{ text: { content: value } }]
    })
  }
}
/**
 * Define a title property.
 */
export function title() {
  return titleOptions;
}

const urlOptions = {
  ...makeMutableDefaultOptions('url'),
  /**
   * Get the url string, default to empty string. Supports mutation.
   */
  string() {
    return this.rawWithDefault('');
  }
}
/**
 * Define an url property.
 */
export function url() {
  return urlOptions;
}

const uniqueIdOptions = {
  ...makeDefaultOptions('unique_id'),
  /**
   * Get the number of the unique id. Does not support mutation.
   */
  number() {
    return this.handleUsing(value => value.number!);
  },
  /**
   * Get the string of the unique id with a prefix, same as how it is displayed in Notion. Does not support mutation.
   */
  stringWithPrefix() {
    return this.handleUsing(value => {
      if (value.prefix) {
        return value.prefix + '-' + value.number!.toString();
      }
      return value.number!.toString();
    });
  }
}
/**
 * Define a unique_id property.
 */
export function unique_id() {
  return uniqueIdOptions;
}

const verificationOptions = {
  ...makeDefaultOptions('verification')
}
/**
 * Define a verification property.
 */
export function verification() {
  return verificationOptions;
}
