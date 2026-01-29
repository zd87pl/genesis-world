import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { config } from '../config.js';

// Create postgres connection
const connectionString = config.databaseUrl || 'postgres://genesis:genesis_dev_password@localhost:5432/genesis_world';

const client = postgres(connectionString);

// Create drizzle instance
export const db = drizzle(client, { schema });

// Export for migrations
export { client };
