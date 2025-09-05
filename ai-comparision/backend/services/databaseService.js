const sql = require('mssql');
require('dotenv').config();

class DatabaseService {
  constructor() {
    this.pool = null;
  }

  async connect() {
    try {
      const config = {
        user: process.env.DB_USER || 'sa',
        password: process.env.DB_PASSWORD || '',
        server: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'activity_monitoring',
        port: parseInt(process.env.DB_PORT) || 1433,
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000
        },
        options: {
          encrypt: false,
          trustServerCertificate: true,
          appName: 'CMS Software'
        }
      };

      this.pool = await sql.connect(config);
      console.log('✅ Database connected successfully');

    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      console.log('⚠️ App will continue without database connection');
    }
  }

  async getActivities() {
    try {
      if (!this.pool) {
        console.warn('⚠️ Database not connected, returning mock activities');
        return [
          { ActivityID: 1, ActivityName: "Sales Desk" },
          { ActivityID: 2, ActivityName: "Stretching" },
          { ActivityID: 3, ActivityName: "Cleaning" },
          { ActivityID: 4, ActivityName: "Making Calls" },
          { ActivityID: 5, ActivityName: "Intake" }
        ];
      }

      const result = await this.pool.request()
        .query('SELECT ActivityID, ActivityName FROM Activities ORDER BY ActivityID');

      console.log(`📋 Loaded ${result.recordset.length} activities from database`);
      return result.recordset;

    } catch (error) {
      console.error('❌ Error fetching activities:', error.message);
      return [
        { ActivityID: 1, ActivityName: "Sales Desk" },
        { ActivityID: 2, ActivityName: "Stretching" },
        { ActivityID: 3, ActivityName: "Cleaning" },
        { ActivityID: 4, ActivityName: "Making Calls" },
        { ActivityID: 5, ActivityName: "Intake" }
      ];
    }
  }

  async getActivityById(activityId) {
    try {
      if (!this.pool) throw new Error('Database not connected');

      const result = await this.pool.request()
        .input('activityId', sql.Int, activityId)
        .query('SELECT ActivityID, ActivityName FROM Activities WHERE ActivityID = @activityId');

      return result.recordset[0] || null;

    } catch (error) {
      console.error('❌ Error fetching activity by ID:', error.message);
      throw error;
    }
  }

  async getMonitoringActivities(storeId, date) {
    try {
      if (!this.pool) {
        console.warn('⚠️ Database not connected, returning empty monitoring activities');
        return [];
      }

      // Enhanced query with better error handling and logging
      const result = await this.pool.request()
        .input('storeId', sql.Int, parseInt(storeId))
        .input('date', sql.VarChar, date)
        .query(`
          SELECT 
            ma.MonitoringActivityID, 
            ma.StoreMonitoringID, 
            ma.ActivityID, 
            CASE WHEN ma.ActivityActionID = 2 THEN DATEADD(MINUTE, -1, ma.Timestamp) ELSE ma.Timestamp END [Timestamp], 
            ma.CameraNo, 
            ma.ImageURL,
            a.ActivityName
          FROM MonitoringActivities ma
          JOIN Activities a ON ma.ActivityID = a.ActivityID
          JOIN StoreMonitoring sm ON ma.StoreMonitoringID = sm.storeMonitoringID
          WHERE sm.storeID = @storeId 
            AND CAST(ma.Timestamp AS DATE) = CAST(@date AS DATE)
          ORDER BY ma.Timestamp
        `);

      console.log(`📊 Loaded ${result.recordset.length} monitoring activities for store ${storeId} on ${date}`);
      
      // Log sample data for debugging (first 3 records)
      if (result.recordset.length > 0) {
        console.log('📋 Sample monitoring activities:');
        result.recordset.slice(0, 3).forEach((record, index) => {
          console.log(`  ${index + 1}. ${record.ActivityName} (ID: ${record.ActivityID}) at ${record.Timestamp} on ${record.CameraNo}`);
        });
      }
      
      return result.recordset;

    } catch (error) {
      console.error('❌ Error fetching monitoring activities:', error.message);
      console.error('❌ Query parameters:', { storeId, date });
      
      // Return empty array instead of throwing to allow the comparison to continue
      // This way the frontend can still show the JSON activities even if DB is empty
      return [];
    }
  }

  async logComparisonResults(data) {
    try {
      if (!this.pool) {
        console.warn('⚠️ Database not connected, logging to console instead');
        console.log('📝 Comparison Results (Console Log):', {
          storeId: data.metadata?.storeId,
          companyId: data.metadata?.companyId,
          accuracyPercentage: data.accuracyPercentage,
          matchedCount: data.matchedCount,
          totalDbActivities: data.totalDbActivities,
          totalJsonActivities: data.totalJsonActivities
        });
        return { insertId: 'console-logged' };
      }

      const result = await this.pool.request()
        .input('StoreID', sql.Int, data.metadata?.storeId || 0)
        .input('CompanyID', sql.Int, data.metadata?.companyId || 0)
        .input('AnalysisDate', sql.DateTime, new Date())
        .input('OverallAccuracy', sql.Float, data.accuracyPercentage || 0)
        .input('TotalMatches', sql.Int, data.matchedCount || 0)
        .input('TotalJsonActivities', sql.Int, data.totalJsonActivities || 0)
        .input('TotalDbActivities', sql.Int, data.totalDbActivities || 0)
        .input('ProcessingTime', sql.DateTime, new Date())
        .input('ResultsJson', sql.NVarChar(sql.MAX), JSON.stringify(data))
        .query(`
          INSERT INTO ComparisonLogs 
          (StoreID, CompanyID, AnalysisDate, OverallAccuracy, TotalMatches, 
           TotalJsonActivities, TotalDbActivities, ProcessingTime, ResultsJson)
          OUTPUT INSERTED.LogID
          VALUES (@StoreID, @CompanyID, @AnalysisDate, @OverallAccuracy, @TotalMatches, 
                  @TotalJsonActivities, @TotalDbActivities, @ProcessingTime, @ResultsJson)
        `);

      console.log(`📝 Comparison results logged with ID: ${result.recordset[0].LogID}`);
      return result.recordset[0];

    } catch (error) {
      console.error('❌ Error logging comparison results:', error.message);
      return { insertId: 'fallback-logged' };
    }
  }

  async getComparisonHistory(storeId, limit = 10, offset = 0) {
    try {
      if (!this.pool) throw new Error('Database not connected');

      let query = `
        SELECT LogID, StoreID, CompanyID, AnalysisDate, OverallAccuracy, 
               TotalMatches, TotalJsonActivities, TotalDbActivities, 
               ProcessingTime, CreatedAt
        FROM ComparisonLogs
      `;
      let request = this.pool.request();

      if (storeId) {
        query += ' WHERE StoreID = @storeId';
        request.input('storeId', sql.Int, storeId);
      }

      query += ' ORDER BY CreatedAt DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY';
      request.input('limit', sql.Int, parseInt(limit));
      request.input('offset', sql.Int, parseInt(offset));

      const result = await request.query(query);
      return result.recordset;

    } catch (error) {
      console.error('❌ Error fetching comparison history:', error.message);
      throw error;
    }
  }

  // Helper method to test database connectivity
  async testConnection() {
    try {
      if (!this.pool) {
        throw new Error('Database pool not initialized');
      }

      const result = await this.pool.request().query('SELECT 1 as test');
      console.log('✅ Database connection test successful');
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error.message);
      return false;
    }
  }

  // Helper method to check if required tables exist
  async validateTables() {
    try {
      if (!this.pool) {
        console.warn('⚠️ Cannot validate tables - database not connected');
        return false;
      }

      const requiredTables = ['Activities', 'MonitoringActivities', 'StoreMonitoring'];
      
      for (const tableName of requiredTables) {
        const result = await this.pool.request()
          .input('tableName', sql.NVarChar, tableName)
          .query(`
            SELECT COUNT(*) as tableExists 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = @tableName
          `);
        
        if (result.recordset[0].tableExists === 0) {
          console.warn(`⚠️ Required table '${tableName}' not found`);
          return false;
        }
      }

      console.log('✅ All required database tables found');
      return true;
    } catch (error) {
      console.error('❌ Error validating database tables:', error.message);
      return false;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.close();
      console.log('🔒 Database connection closed');
    }
  }
}

module.exports = new DatabaseService();