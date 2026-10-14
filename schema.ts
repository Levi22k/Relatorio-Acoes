import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const actions = sqliteTable('actions', {
 id: text('id').primaryKey(), owner: text('owner').notNull(), title: text('title').notNull(),
 date: text('date').notNull(), category: text('category').notNull().default('other'), result: text('result').notNull(), participants: text('participants').notNull(),
 imageKey: text('image_key').notNull(), created: text('created').notNull(),
});
export const members = sqliteTable('members', {
 id:text('id').primaryKey(), owner:text('owner').notNull(), name:text('name').notNull(),
 nameKey:text('name_key').notNull(), aliases:text('aliases').notNull(), created:text('created').notNull(),
},table=>[uniqueIndex('members_owner_name').on(table.owner,table.nameKey)]);
export const treasuryPayments=sqliteTable('treasury_payments',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),name:text('name').notNull(),
 amount:integer('amount').notNull(),created:text('created').notNull(),
});
export const treasuryAdjustments=sqliteTable('treasury_adjustments',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),name:text('name').notNull(),
 amount:integer('amount').notNull(),reason:text('reason').notNull(),created:text('created').notNull(),
});
export const treasuryAdjustmentEvents=sqliteTable('treasury_adjustment_events',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),adjustmentId:text('adjustment_id').notNull(),
 name:text('name').notNull(),amount:integer('amount').notNull(),reason:text('reason').notNull(),
 event:text('event').notNull(),created:text('created').notNull(),
});
