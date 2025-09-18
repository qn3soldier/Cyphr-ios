/**
 * CLEAN dbQuery function - ONLY AWS RDS, NO SUPABASE!
 * For Cyphr Messenger - Enterprise Grade
 */

const { pool } = require('./cyphr-id-rds-endpoints.cjs');

// Database abstraction layer - ONLY AWS RDS PostgreSQL
async function dbQuery(table, operation, data = {}, filters = {}, customSql = null) {
    try {
        if (customSql) {
            // Handle custom SQL queries
            const result = await pool.query(customSql.query, customSql.params || []);
            return { data: result.rows, error: null };
        }
        
        switch (operation) {
            case 'select':
                const whereClause = Object.keys(filters).length > 0 
                    ? 'WHERE ' + Object.keys(filters).map((key, idx) => `${key} = $${idx + 1}`).join(' AND ')
                    : '';
                const selectQuery = `SELECT * FROM ${table} ${whereClause}`;
                const selectParams = Object.values(filters);
                const result = await pool.query(selectQuery, selectParams);
                return { data: result.rows, error: null };
                
            case 'insert':
                const insertFields = Object.keys(data).join(', ');
                const insertValues = Object.keys(data).map((_, idx) => `$${idx + 1}`).join(', ');
                const insertQuery = `INSERT INTO ${table} (${insertFields}) VALUES (${insertValues}) RETURNING *`;
                const insertParams = Object.values(data);
                const insertResult = await pool.query(insertQuery, insertParams);
                return { data: insertResult.rows[0], error: null };
                
            case 'update':
                const updateFields = Object.keys(data).map((key, idx) => `${key} = $${idx + 1}`).join(', ');
                const updateWhere = Object.keys(filters).map((key, idx) => `${key} = $${idx + 1 + Object.keys(data).length}`).join(' AND ');
                const updateQuery = `UPDATE ${table} SET ${updateFields} WHERE ${updateWhere} RETURNING *`;
                const updateParams = [...Object.values(data), ...Object.values(filters)];
                const updateResult = await pool.query(updateQuery, updateParams);
                return { data: updateResult.rows[0], error: null };
                
            case 'delete':
                const deleteWhere = Object.keys(filters).map((key, idx) => `${key} = $${idx + 1}`).join(' AND ');
                const deleteQuery = `DELETE FROM ${table} WHERE ${deleteWhere} RETURNING *`;
                const deleteParams = Object.values(filters);
                const deleteResult = await pool.query(deleteQuery, deleteParams);
                return { data: deleteResult.rows, error: null };
                
            default:
                return { data: null, error: 'Invalid operation' };
        }
    } catch (error) {
        console.error('dbQuery error:', error);
        return { data: null, error: error.message };
    }
}

module.exports = { dbQuery };