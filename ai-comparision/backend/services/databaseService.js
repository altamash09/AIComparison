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
          encrypt: false, // Set to true only if required (Azure/SSL)
          trustServerCertificate: true,
          appName: 'CMS Software' // 👈 Spoof the app name
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

      const result = await this.pool.request()
        .input('storeId', sql.Int, storeId)
        .input('date', sql.VarChar, date)
        .query(`
          SELECT 
            ma.MonitoringActivityID, 
            ma.StoreMonitoringID, 
            ma.ActivityID, 
            ma.Timestamp, 
            ma.CameraNo, 
            ma.ImageURL,
            a.ActivityName
          FROM MonitoringActivities ma
          JOIN Activities a ON ma.ActivityID = a.ActivityID
          JOIN StoreMonitoring sm ON ma.StoreMonitoringID = sm.storeMonitoringID
          WHERE sm.storeID = @storeId AND CAST(ma.Timestamp AS DATE) = @date
          ORDER BY ma.Timestamp
        `);

      console.log(`📊 Loaded ${result.recordset.length} monitoring activities`);
      return result.recordset;

    } catch (error) {
      console.error('❌ Error fetching monitoring activities:', error.message);
      return [];
    }
  }

  async logComparisonResults(data) {
    try {
      if (!this.pool) {
        console.warn('⚠️ Database not connected, logging to console instead');
        console.log('📝 Comparison Results (Console Log):', data);
        return { insertId: 'console-logged' };
      }

      const result = await this.pool.request()
        .input('StoreID', sql.Int, data.metadata?.storeId || 0)
        .input('CompanyID', sql.Int, data.metadata?.companyId || 0)
        .input('AnalysisDate', sql.DateTime, new Date())
        .input('OverallAccuracy', sql.Float, data.overallAccuracy || 0)
        .input('TotalMatches', sql.Int, data.totalMatches || 0)
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

  async close() {
    if (this.pool) {
      await this.pool.close();
      console.log('🔒 Database connection closed');
    }
  }
}

module.exports = new DatabaseService();
