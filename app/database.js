const mysql = require('mysql');

class Database {
  constructor(config) {
    this.pool = mysql.createPool(config);
  }

  query(sql, values) {
    return new Promise((resolve, reject) => {
      this.pool.query(sql, values, (error, results) => {
        if (error) return reject(error);
        resolve(results);
      });
    });
  }

  async execute(sql, values) {
    const connection = await this.getConnection();
    try {
      const result = await this.query(sql, values);
      return result;
    } finally {
      connection.release();
    }
  }

  async select(table, where = {}, orderBy = '', limit_num = false, limit_from = 0) {
    const keys = Object.keys(where);
    const values = keys.map(key => where[key]);

    let sql = `SELECT * FROM ${table}`;
    if (keys.length > 0) {
      sql += ' WHERE ' + keys.map(key => `${key} = ?`).join(' AND ');
    }
    if (orderBy) {
      sql += ` ORDER BY ${mysql.escapeId(orderBy)}`;
    }
    if (limit_num) {
      sql += ` LIMIT ${limit_from}, ${limit_num}`;
    }

    const result = await this.execute(sql, values);
    return result;
  }

  async insert(table, values) {
    const keys = Object.keys(values);
    const valuesList = Object.values(values);

    const sql = `INSERT INTO ${table} (${keys.map(key => mysql.escapeId(key)).join(', ')}) VALUES (${valuesList.map(() => '?').join(', ')})`;

    const result = await this.execute(sql, valuesList);
    return result.insertId;
  }

  async update(table, values, where = {}) {
    const set = Object.keys(values).map(key => `${mysql.escapeId(key)} = ?`).join(', ');
    const whereClause = Object.keys(where).map(key => `${mysql.escapeId(key)} = ?`).join(' AND ');
    const valuesList = [...Object.values(values), ...Object.values(where)];

    let sql = `UPDATE ${table} SET ${set}`;
    if (where.keys.length > 0) {
      sql += ` WHERE ${whereClause}`;
    }

    const result = await this.execute(sql, valuesList);
    return result.affectedRows;
  }
  
  async updateWithTimestamp(table, values, where = {}) {
    const set = Object.keys(values).map(key => `${mysql.escapeId(key)} = ?`).join(', ');
    const whereClause = Object.keys(where).map(key => `${mysql.escapeId(key)} = ?`).join(' AND ');
    const valuesList = [...Object.values(values), ...Object.values(where)];

    let sql = `UPDATE ${table} SET ${set}, last_changed = NOW()`;
    if (where.keys.length > 0) {
      sql += ` WHERE ${whereClause}`;
    }

    const result = await this.execute(sql, valuesList);
    return result.affectedRows;
  }

  async increase(table, values, where = {}) {
    const set = Object.keys(values).map(key => `${mysql.escapeId(key)} = ${mysql.escapeId(key)} + ${parseFloat(values[key],10)}`).join(', ');
    const whereClause = Object.keys(where).map(key => `${mysql.escapeId(key)} = ?`).join(' AND ');
    const valuesList = [...Object.values(where)];

    let sql = `UPDATE ${table} SET ${set}`;
    if (where.keys.length > 0) {
      sql += ` WHERE ${whereClause}`;
    }

    const result = await this.execute(sql, valuesList);
    return result.affectedRows;
  }

  async multiply(table, values, where = {}) {
    const set = Object.keys(values).map(key => `${mysql.escapeId(key)} = ${mysql.escapeId(key)} * ${parseFloat(values[key],10)}`).join(', ');
    const whereClause = Object.keys(where).map(key => `${mysql.escapeId(key)} = ?`).join(' AND ');
    const valuesList = [...Object.values(where)];

    let sql = `UPDATE ${table} SET ${set}`;
    if (where.keys.length > 0) {
      sql += ` WHERE ${whereClause}`;
    }

    const result = await this.execute(sql, valuesList);
    return result.affectedRows;
  }

  async delete(table, where = {}) {
    const whereClause = Object.keys(where).map(key => `${mysql.escapeId(key)} = ?`).join(' AND ');
    const values = Object.values(where);

    let sql = `DELETE FROM ${table}`;
    if (where.keys.length > 0) {
      sql += ` WHERE ${whereClause}`;
    }

    const result = await this.execute(sql, values);
    return result.affectedRows;
  }

  async getConnection() {
    return new Promise((resolve, reject) => {
      this.pool.getConnection((error, connection) => {
        if (error) return reject(error);
        resolve(connection);
      });
    });
  }

  async end() {
    return new Promise((resolve, reject) => {
      this.pool.end(error => {
        if (error) return reject(error);
        resolve();
      });
    });
  }
}

module.exports = Database;
