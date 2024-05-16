import type {
  DBSchemasType,
  NotionPropertyDefinition,
  NotionMutablePropertyDefinition,
  NotionPropertyTypeEnum,
  ValueHandler,
  ValueType, ValueComposer
} from "./types";
import type {RichTextItemResponse} from "@notionhq/client/build/src/api-endpoints";

export function createDBSchemas<T extends DBSchemasType>(schema: T): typeof schema {
  return schema;
}

function packPlainText(arr: RichTextItemResponse[]): string {
  return arr.reduce((acc, cur) => acc + cur.plain_text, '');
}

function convertNotionImage(pageId: string, preSignedUrl: string) {
  return 'https://www.notion.so/image/' +
    encodeURIComponent(preSignedUrl.split('?')[0]) +
    '?id=' +
    pageId +
    '&table=block';
}

const makeDefaultOptions = <T extends NotionPropertyTypeEnum>(type: T) => {
  const valueToRaw: NotionPropertyDefinition<T, ValueType<T>> = {
    type,
    handler: value => value
  };
  return {
    raw(): NotionPropertyDefinition<T, ValueType<T>> {
      return valueToRaw;
    },
    rawWithDefault(defaultValue: NonNullable<ValueType<T>>): NotionPropertyDefinition<T, NonNullable<ValueType<T>>> {
      return {
        type,
        handler: value => value ?? defaultValue,
      }
    },
    handleUsing<R>(handler: ValueHandler<T, R>): NotionPropertyDefinition<T, R> {
      return {
        type,
        handler
      }
    },
  }
}

const makeMutableDefaultOptions = <T extends NotionPropertyTypeEnum>(type: T) => {
  const valueToRaw: NotionMutablePropertyDefinition<T, ValueType<T>> = {
    type,
    handler: value => value,
    composer: value => value
  }
  return {
    raw(): NotionMutablePropertyDefinition<T, ValueType<T>> {
      return valueToRaw;
    },
    rawWithDefault(defaultValue: NonNullable<ValueType<T>>): NotionMutablePropertyDefinition<T, NonNullable<ValueType<T>>> {
      return {
        type,
        handler: value => value ?? defaultValue,
        composer: value => value
      }
    },
    handleAndComposeUsing<R>({ handler, composer }: { handler: ValueHandler<T, R>, composer: ValueComposer<R> }): NotionMutablePropertyDefinition<T, R> {
      return {
        type,
        handler,
        composer
      }
    }
  }
}

export function __id() {
  return '__id' as const;
}

const checkboxOptions = {
  ...makeMutableDefaultOptions('checkbox'),
  boolean() {
    return this.raw();
  }
}
export function checkbox() {
  return checkboxOptions;
}

const createdByOptions = {
  ...makeDefaultOptions('created_by'),
  name() {
    return this.handleUsing(value => 'name' in value ? value.name ?? '' : '')
  }
}
export function created_by() {
  return createdByOptions;
}

const createdTimeOptions = {
  ...makeDefaultOptions('created_time'),
  timeString() {
    return this.raw();
  }
}
export function created_time() {
  return createdTimeOptions;
}

export type DateRange = {
  start: string
  end: string
}
const dateOptions = {
  ...makeMutableDefaultOptions('date'),
  dateRange() {
    return this.handleAndComposeUsing({
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
export function date() {
  return dateOptions;
}

const emailOptions = {
  ...makeMutableDefaultOptions('email'),
  string() {
    return this.rawWithDefault('');
  }
}
export function email() {
  return emailOptions;
}

const filesOptions = {
  ...makeDefaultOptions('files'),
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
  notionImageUrls() {
    return this.handleUsing((value, option, pageId) => value.reduce((acc, file) => {
      let result: string | undefined = undefined;
      if ('file' in file) {
        result = convertNotionImage(pageId, file.file.url);
      }
      if (result === undefined) {
        return acc;
      }
      return acc.concat(result);
    }, [] as string[]))
  },
  singleNotionImageUrl() {
    return this.handleUsing((value, option, pageId) => {
      const file = value[0];
      if (!file) {
        return '';
      }
      if ('file' in file) {
        return convertNotionImage(pageId, file.file.url);
      }
      return '';
    })
  }
}
export function files() {
  return filesOptions;
}

const formulaOptions = {
  ...makeDefaultOptions('formula'),
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
  booleanDefaultFalse() {
    return this.handleUsing(value => value.type === 'boolean' ? value.boolean ?? false : false)
  },
  numberDefaultZero() {
    return this.handleUsing(value => value.type === 'number' ? value.number ?? 0 : 0)
  },
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
export function formula() {
  return formulaOptions;
}

const lastEditedByOptions = {
  ...makeDefaultOptions('last_edited_by'),
  name() {
    return this.handleUsing(value => 'name' in value ? value.name ?? '' : '')
  }
}
export function last_edited_by() {
  return lastEditedByOptions;
}

const lastEditedTimeOptions = {
  ...makeDefaultOptions('last_edited_time'),
  timeString() {
    return this.raw();
  }
}
export function last_edited_time() {
  return lastEditedTimeOptions;
}

const multiSelectOptions = {
  ...makeMutableDefaultOptions('multi_select'),
  strings() {
    return this.handleAndComposeUsing({
      handler: (value) => value.map(option => option.name),
      composer: (value) => value.map(name => ({ name }))
    })
  },
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
export function multi_select() {
  return multiSelectOptions;
}

const numberOptions = {
  ...makeMutableDefaultOptions('number'),
  numberDefaultZero() {
    return this.rawWithDefault(0);
  }
}
export function number() {
  return numberOptions;
}

const peopleOptions = {
  ...makeDefaultOptions('people'),
  names() {
    return this.handleUsing(value => value.reduce((acc, person) => {
      if ('name' in person) {
        return acc.concat(person.name ?? '');
      }
      return acc;
    }, [] as string[]))
  }
}
export function people() {
  return peopleOptions;
}

const phoneNumberOptions = {
  ...makeMutableDefaultOptions('phone_number'),
  string() {
    return this.rawWithDefault('');
  }
}
export function phone_number() {
  return phoneNumberOptions;
}

const relationOptions = {
  ...makeMutableDefaultOptions('relation'),
  ids() {
    return this.handleAndComposeUsing({
      handler: value => value.map(relation => relation.id),
      composer: (value) => value.map(id => ({ id }))
    });
  },
  singleId() {
    return this.handleAndComposeUsing({
      handler: value => value[0].id,
      composer: (value) => [{ id: value }]
    });
  }
}
export function relation() {
  return relationOptions;
}

const richTextOptions = {
  ...makeMutableDefaultOptions('rich_text'),
  plainText() {
    return this.handleAndComposeUsing({
      handler: value => packPlainText(value),
      composer: (value) => [{ text: { content: value } }]
    })
  }
}
export function rich_text() {
  return richTextOptions;
}

export type RollupArrayType = Extract<ValueType<'rollup'>, { type: 'array' }>['array']
const rollupOptions = {
  ...makeDefaultOptions('rollup'),
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
  numberDefaultZero() {
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
  handleArrayUsing<R>(handler: (value: RollupArrayType) => R) {
    return this.handleUsing(value => {
      if (value.type === 'array') {
        return handler(value.array);
      }
      throw Error('Invalid rollup type');
    });
  }
}
export function rollup() {
  return rollupOptions;
}

const selectOptions = {
  ...makeMutableDefaultOptions('select'),
  string() {
    return this.handleAndComposeUsing({
      handler: value => value?.name ?? '',
      composer: (value) => ({ name: value })
    })
  },
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
        return { name: value };
      }
    });
  },
}
export function select() {
  return selectOptions;
}

const statusOptions = {
  ...makeMutableDefaultOptions('status'),
  string() {
    return this.handleAndComposeUsing({
      handler: value => value?.name ?? '',
      composer: (value) => ({ name: value })
    })
  },
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
export function status() {
  return statusOptions;
}

const titleOptions = {
  ...makeMutableDefaultOptions('title'),
  plainText() {
    return this.handleAndComposeUsing({
      handler: value => packPlainText(value),
      composer: (value) => [{ text: { content: value } }]
    })
  }
}
export function title() {
  return titleOptions;
}

const urlOptions = {
  ...makeMutableDefaultOptions('url'),
  string() {
    return this.rawWithDefault('');
  }
}
export function url() {
  return urlOptions;
}

const uniqueIdOptions = {
  ...makeDefaultOptions('unique_id'),
  number() {
    return this.handleUsing(value => value.number!);
  },
  stringWithPrefix() {
    return this.handleUsing(value => {
      if (value.prefix) {
        return value.prefix + '-' + value.number!.toString();
      }
      return value.number!.toString();
    });
  }
}
export function unique_id() {
  return uniqueIdOptions;
}

const verificationOptions = {
  ...makeDefaultOptions('verification')
}
export function verification() {
  return verificationOptions;
}
