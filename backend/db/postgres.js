const { Pool } = require('pg');

class PostgresService {
  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || 'postgres',
      port: process.env.POSTGRES_PORT || 5432,
      database: process.env.POSTGRES_DB || 'meeting_intelligence',
      user: process.env.POSTGRES_USER || 'meeting_user',
      password: process.env.POSTGRES_PASSWORD || 'meeting_pass_2024',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error('[PostgreSQL] Unexpected error on idle client', err);
    });

    this.pool.on('connect', () => {
      console.log('[PostgreSQL] New client connected to database');
    });
  }

  async testConnection() {
    try {
      const result = await this.pool.query('SELECT NOW()');
      console.log('[PostgreSQL] Connected successfully at', result.rows[0].now);
      return true;
    } catch (error) {
      console.error('[PostgreSQL] Connection failed:', error.message);
      return false;
    }
  }

  async query(text, params) {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      if (duration > 100) {
        console.log('[PostgreSQL] Slow query', { text, duration, rows: res.rowCount });
      }
      return res;
    } catch (error) {
      console.error('[PostgreSQL] Query error:', error.message);
      throw error;
    }
  }

  async getClient() {
    const client = await this.pool.connect();
    const query = client.query.bind(client);
    const release = client.release.bind(client);

    // Set a timeout of 5 seconds, after which we will log this client's last query
    const timeout = setTimeout(() => {
      console.error('[PostgreSQL] A client has been checked out for more than 5 seconds!');
    }, 5000);

    client.query = (...args) => {
      clearTimeout(timeout);
      return query(...args);
    };

    client.release = () => {
      clearTimeout(timeout);
      client.query = query;
      client.release = release;
      return release();
    };

    return client;
  }

  async transaction(callback) {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async end() {
    await this.pool.end();
    console.log('[PostgreSQL] Connection pool closed');
  }
}

module.exports = PostgresService;