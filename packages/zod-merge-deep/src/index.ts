import { ZodObject, ZodRawShape, UnknownKeysParam, ZodTypeAny, objectOutputType, objectInputType, ZodType, ZodObjectDef, AnyZodObject } from 'zod';

// https://github.com/colinhacks/zod/pull/1739
// https://github.com/colinhacks/zod/issues/1508
declare module 'zod' {
  interface ZodObject<T extends ZodRawShape, UnknownKeys extends UnknownKeysParam = UnknownKeysParam, Catchall extends ZodTypeAny = ZodTypeAny, Output = objectOutputType<T, Catchall, UnknownKeys>, Input = objectInputType<T, Catchall, UnknownKeys>> extends ZodType<Output, ZodObjectDef<T, UnknownKeys, Catchall>, Input> {
    mergeDeep<Incoming extends AnyZodObject>(): MergeZodObjectsDeep<this, Incoming>;
  }
}

export type MergeZodObjectsDeep<A, B> = [A, B] extends [
  ZodObject<infer ShapeA>,
  ZodObject<infer ShapeB, infer UnknownKeysB, infer CatchallB>
]
  ? ZodObject<
      {
        [K in keyof ShapeA | keyof ShapeB]: K extends keyof ShapeB
          ? K extends keyof ShapeA
            ? [ShapeA[K], ShapeB[K]] extends [
                ZodObject<infer ShapeC, infer UnknownKeysC, infer CatchallC>,
                ZodObject<infer ShapeD, infer UnknownKeysD, infer CatchallD>
              ]
              ? MergeZodObjectsDeep<
                  ZodObject<ShapeC, UnknownKeysC, CatchallC>,
                  ZodObject<ShapeD, UnknownKeysD, CatchallD>
                >
              : ShapeB[K]
            : ShapeB[K]
          : ShapeA[K & keyof ShapeA];
      },
      UnknownKeysB,
      CatchallB
    >
  : never;



mergeDeep<Incoming extends AnyZodObject>(
  merging: Incoming
): MergeZodObjectsDeep<this, Incoming> {
  const newShape = {} as any;
  for (const key of [
    ...util.objectKeys(merging.shape),
    ...util.objectKeys(this.shape),
  ]) {
    if (
      this.shape[key] instanceof ZodObject &&
      merging.shape[key] instanceof ZodObject
    ) {
      newShape[key] = (this.shape[key] as AnyZodObject).mergeDeep(
        merging.shape[key]
      );
    } else if (merging.shape[key]) {
      newShape[key] = merging.shape[key];
    } else if (this.shape[key]) {
      newShape[key] = this.shape[key];
    }
  }
  return new ZodObject({
    unknownKeys: merging._def.unknownKeys,
    catchall: merging._def.catchall,
    shape: () => newShape,
    typeName: ZodFirstPartyTypeKind.ZodObject,
  }) as MergeZodObjectsDeep<this, Incoming>;
}