import { ZodObject, ZodRawShape, UnknownKeysParam, ZodTypeAny, objectOutputType, objectInputType, ZodType, ZodObjectDef } from 'zod';

declare module 'zod' {
  interface ZodObject<T extends ZodRawShape, UnknownKeys extends UnknownKeysParam = UnknownKeysParam, Catchall extends ZodTypeAny = ZodTypeAny, Output = objectOutputType<T, Catchall, UnknownKeys>, Input = objectInputType<T, Catchall, UnknownKeys>> extends ZodType<Output, ZodObjectDef<T, UnknownKeys, Catchall>, Input> {
    mergeDeep(): void;
  }
}