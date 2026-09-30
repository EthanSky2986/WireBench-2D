import { en } from './messages.en';
import { zh } from './messages.zh';

export type MessageLocale = 'zh-CN' | 'en';
export type MessageCode = keyof typeof zh;
export type MessageValue = string | number | readonly string[] | MessageDescriptor;

/** Codes and raw parameters survive a live language change without re-running logic. */
export interface MessageDescriptor {
  code: MessageCode;
  params?: Record<string, MessageValue>;
}

function formatValue(value: MessageValue, locale: MessageLocale): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if ('code' in value) return formatMessage(value, locale);
  return value.join(locale === 'en' ? ', ' : '、');
}

/** This independent catalog formatter is pure and has no React/catalog dependency. */
export function formatMessage(descriptor: MessageDescriptor, locale: MessageLocale): string {
  const template = (locale === 'en' ? en : zh)[descriptor.code];
  return template.replace(/\{([\w]+)\}/g, (placeholder, key: string) => {
    const value = descriptor.params?.[key];
    return value === undefined ? placeholder : formatValue(value, locale);
  });
}

export function messageDetails(descriptor: MessageDescriptor): {
  message: string;
  descriptor: MessageDescriptor;
} {
  return { message: formatMessage(descriptor, 'zh-CN'), descriptor };
}

/** Only app-created structured messages are translated; external error details stay verbatim. */
export function getMessageDescriptor(error: unknown): MessageDescriptor | undefined {
  if (!error || typeof error !== 'object' || !('descriptor' in error)) return undefined;
  const descriptor = error.descriptor;
  if (!descriptor || typeof descriptor !== 'object' || !('code' in descriptor)) return undefined;
  if (
    typeof descriptor.code !== 'string' ||
    !Object.prototype.hasOwnProperty.call(zh, descriptor.code)
  )
    return undefined;
  return descriptor as MessageDescriptor;
}

export interface LocalizableFault {
  message: string;
  descriptor?: MessageDescriptor;
}

export function localizeFault(fault: LocalizableFault, locale: MessageLocale): string {
  return fault.descriptor ? formatMessage(fault.descriptor, locale) : fault.message;
}

export function localizeProjectError(error: unknown, locale: MessageLocale): string {
  const descriptor = getMessageDescriptor(error);
  if (descriptor) return formatMessage(descriptor, locale);
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string' && error) return error;
  return formatMessage({ code: 'message.error.unknown' }, locale);
}

export interface LocalizableStorageResult {
  error: string;
  descriptor?: MessageDescriptor;
}

export function localizeStorageError(
  result: LocalizableStorageResult,
  locale: MessageLocale,
): string {
  return result.descriptor ? formatMessage(result.descriptor, locale) : result.error;
}
