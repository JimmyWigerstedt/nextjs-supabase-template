import { z } from "zod";
import { createTRPCRouter, authorizedProcedure } from "~/server/api/trpc";
import { internalDb } from "~/server/internal-db";
import { eventBus } from "~/server/events";

export const internalRouter = createTRPCRouter({
  getUserData: authorizedProcedure.query(async ({ ctx }) => {
    const uid = ctx.supabaseUser!.id;
    const { rows } = await internalDb.query(
      'SELECT "UID", "test1", "test2" FROM "userData" WHERE "UID" = $1',
      [uid],
    );
    return rows[0] ?? null;
  }),

  updateUserData: authorizedProcedure
    .input(
      z.object({
        test1: z.string().optional(),
        test2: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const uid = ctx.supabaseUser!.id;
      await internalDb.query(
        `INSERT INTO "userData" ("UID", "test1", "test2")
         VALUES ($1, $2, $3)
         ON CONFLICT ("UID") DO UPDATE
         SET "test1" = COALESCE($2, "userData"."test1"),
             "test2" = COALESCE($3, "userData"."test2")`,
        [uid, input.test1 ?? null, input.test2 ?? null],
      );
      const { rows } = await internalDb.query(
        'SELECT "UID", "test1", "test2" FROM "userData" WHERE "UID" = $1',
        [uid],
      );
      const record = rows[0];
      eventBus.emit("internal-update", {
        userId: uid,
        fields: Object.keys(input).filter(
          (k) => (input as Record<string, unknown>)[k] !== undefined,
        ),
      });
      return record;
    }),

  initializeUserData: authorizedProcedure.mutation(async ({ ctx }) => {
    const uid = ctx.supabaseUser!.id;
    await internalDb.query(
      `INSERT INTO "userData" ("UID", "test1", "test2")
       VALUES ($1, '', '')
       ON CONFLICT ("UID") DO NOTHING`,
      [uid],
    );
    const { rows } = await internalDb.query(
      'SELECT "UID", "test1", "test2" FROM "userData" WHERE "UID" = $1',
      [uid],
    );
    const record = rows[0];
    eventBus.emit("internal-update", { userId: uid, fields: ["test1", "test2"] });
    return record;
  }),
});
