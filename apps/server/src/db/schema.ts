import { pgTable, text, timestamp, jsonb, integer, boolean, uuid } from 'drizzle-orm/pg-core';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  isGuest: boolean('is_guest').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// World sessions table
export const worldSessions = pgTable('world_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerId: uuid('owner_id').references(() => users.id),
  maxPlayers: integer('max_players').default(10),
  isPublic: boolean('is_public').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
});

// World chunks table
export const worldChunks = pgTable('world_chunks', {
  id: text('id').primaryKey(), // "x,z" format
  sessionId: uuid('session_id').references(() => worldSessions.id),
  biome: text('biome').notNull(),
  splatUrl: text('splat_url'),
  pointsOfInterest: jsonb('points_of_interest').default([]),
  npcs: jsonb('npcs').default([]),
  status: text('status').notNull().default('pending'),
  generatedAt: timestamp('generated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// NPCs table
export const npcs = pgTable('npcs', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => worldSessions.id),
  chunkId: text('chunk_id').references(() => worldChunks.id),
  name: text('name').notNull(),
  archetype: text('archetype').notNull(),
  personality: jsonb('personality'),
  position: jsonb('position').notNull(),
  rotation: integer('rotation').default(0),
  currentAction: text('current_action').default('idle'),
  mood: text('mood').default('neutral'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Player progress table
export const playerProgress = pgTable('player_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  sessionId: uuid('session_id').references(() => worldSessions.id).notNull(),
  discoveries: jsonb('discoveries').default([]),
  visitedChunks: jsonb('visited_chunks').default([]),
  npcRelationships: jsonb('npc_relationships').default({}),
  inventory: jsonb('inventory').default([]),
  lastPosition: jsonb('last_position'),
  lastActive: timestamp('last_active').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// World events table
export const worldEvents = pgTable('world_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => worldSessions.id),
  type: text('type').notNull(),
  data: jsonb('data').notNull(),
  playerId: uuid('player_id').references(() => users.id),
  npcId: uuid('npc_id').references(() => npcs.id),
  chunkId: text('chunk_id').references(() => worldChunks.id),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Types for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type WorldSession = typeof worldSessions.$inferSelect;
export type WorldChunk = typeof worldChunks.$inferSelect;
export type NPC = typeof npcs.$inferSelect;
export type PlayerProgress = typeof playerProgress.$inferSelect;
export type WorldEvent = typeof worldEvents.$inferSelect;
