const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const databaseService = require('../services/databaseService');
const emailService = require('../services/emailService');
const comparisonService = require('../services/comparisonService');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// POST /api/monitoring/compare - Process JSON file comparison with progress tracking
router.post('/compare', upload.single('jsonFile'), async (req, res) => {
  let filePath = null;
  let processId = null;
  
  try {
    console.log('🔄 Starting comparison process...');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No JSON file provided in request'
      });
    }

    filePath = req.file.path;
    processId = req.body.processId;
    
    console.log(`📁 Processing file: ${req.file.originalname} (${req.file.size} bytes)`);
    if (processId) {
      console.log(`🆔 Process ID: ${processId}`);
    }
    
    // Read and parse JSON file
    const fileContent = await fs.readFile(filePath, 'utf8');
    let jsonData;
    
    try {
      jsonData = JSON.parse(fileContent);
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: `Invalid JSON file format: ${parseError.message}`
      });
    }

    // Validate JSON structure
    if (!Array.isArray(jsonData) || jsonData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'JSON file must contain an array of monitoring records with at least one record'
      });
    }

    // Extract metadata from request or JSON
    const storeId = req.body.storeId || jsonData[0]?.store;
    const companyId = req.body.companyId || jsonData[0]?.company;
    const monitoringDate = req.body.monitoringDate || jsonData[0]?.date;

    console.log(`📊 Processing data for Store: ${storeId}, Company: ${companyId}, Date: ${monitoringDate}`);

    if (!storeId || !companyId || !monitoringDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required metadata: storeId, companyId, or monitoringDate not found in request or JSON file'
      });
    }

    // Get database activities, monitoring data, and employee punch data
    console.log('📋 Fetching activities, monitoring data, and employee punch data...');

    // Update progress if processId is provided
    if (processId) {
      comparisonService.initializeProgress(processId);
      comparisonService.updateProgress(processId, 0, 'Loading database activities, monitoring data, and employee punch data...');
    }

    console.warn("Starting Employee Punch Data");

    const [activities, monitoringActivities, employeeData] = await Promise.all([
      databaseService.getActivities(),
      databaseService.getMonitoringActivities(storeId, monitoringDate),
      databaseService.getEmployeePunchData(storeId, monitoringDate)  
    ]);

    console.warn(`👥 Loaded ${employeeData.length} employee punch records`); 

    if (activities.length === 0) {
      if (processId) {
        comparisonService.cleanupProgress(processId);
      }
      return res.status(500).json({
        success: false,
        message: 'No activities found in database - please check your database setup'
      });
    }

    console.log(`📊 Database loaded: ${activities.length} activities, ${monitoringActivities.length} monitoring records`);

    // Validate that we have some data to compare
    const jsonActivitiesCount = jsonData.reduce((count, record) => {
      return count + (record.bounds ? record.bounds.length : 0);
    }, 0);

    console.log(`📊 JSON contains ${jsonActivitiesCount} activity bounds across ${jsonData.length} records`);

    // Process comparison with progress tracking
    console.log('⚙️ Processing comparison logic...');
    const comparisonResults = await comparisonService.processComparison(
      jsonData,
      activities,
      monitoringActivities,
      employeeData,  
      processId      
    );

    // Add metadata to results
    comparisonResults.metadata = {
      storeId,
      companyId,
      monitoringDate,
      totalRecordsProcessed: jsonData.length,
      totalJsonBounds: jsonActivitiesCount,
      processingTime: new Date().toISOString()
    };

    // Log results to database
    console.log('📝 Logging results to database...');
    if (processId) {
      comparisonService.updateProgress(processId, 5, 'Saving results and sending email report...');
    }
    
    await databaseService.logComparisonResults(comparisonResults);

    // Send email report
    console.log('📧 Sending email report...');
    try {
      await emailService.sendComparisonReport(comparisonResults);
      console.log('✅ Email report sent successfully');
    } catch (emailError) {
      console.error('⚠️ Email failed but continuing:', emailError.message);
    }

    console.log('🎉 Comparison completed successfully!');
    
    // Log final summary
    console.log(`📊 FINAL RESULTS SUMMARY:
      - Database Activities: ${comparisonResults.totalDbActivities}
      - JSON Activities: ${comparisonResults.totalJsonActivities}
      - Accurate Matches: ${comparisonResults.matchedCount}
      - Unmatched DB: ${comparisonResults.unmatchedDbCount || 0}
      - Unmatched JSON: ${comparisonResults.unmatchedJsonCount || 0}
      - Accuracy: ${comparisonResults.accuracyPercentage}%`);

    // Final progress update
    if (processId) {
      comparisonService.updateProgress(processId, 6, 'Comparison completed successfully!');
      setTimeout(() => comparisonService.cleanupProgress(processId), 5000);
    }

    res.json({
      success: true,
      data: comparisonResults,
      message: 'Comparison completed and report sent successfully'
    });

  } catch (error) {
    console.error('❌ Error processing comparison:', error.message);
    console.error('❌ Stack trace:', error.stack);
    
    if (processId) {
      comparisonService.cleanupProgress(processId);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to process comparison',
      error: process.env.NODE_ENV !== 'production' ? error.message : 'Internal server error',
      details: process.env.NODE_ENV !== 'production' ? {
        stack: error.stack,
        file: filePath ? req.file.originalname : 'No file',
        processId: processId || 'None'
      } : undefined
    });
  } finally {
    // Clean up uploaded file
    if (filePath) {
      try {
        await fs.unlink(filePath);
        console.log('🗑️ Cleaned up uploaded file');
      } catch (cleanupError) {
        console.error('⚠️ Failed to cleanup uploaded file:', cleanupError.message);
      }
    }
  }
});

// GET /api/monitoring/progress/:processId - Get real-time progress for a specific process
router.get('/progress/:processId', (req, res) => {
  try {
    const { processId } = req.params;
    console.log(`📊 Progress requested for process: ${processId}`);
    
    const progress = comparisonService.getProgress(processId);
    
    if (progress) {
      const elapsed = Date.now() - progress.startTime;
      const elapsedSeconds = Math.round(elapsed / 1000);
      
      res.json({ 
        success: true, 
        progress: {
          processId: progress.processId,
          percentage: progress.percentage,
          currentStep: progress.currentStep,
          stepIndex: progress.stepIndex,
          totalSteps: progress.totalSteps,
          elapsedTime: elapsedSeconds,
          steps: progress.steps
        }
      });
      
      console.log(`📈 Progress update sent: ${progress.percentage}% - ${progress.currentStep}`);
    } else {
      res.status(404).json({ 
        success: false, 
        message: 'Process not found or already completed',
        processId: processId
      });
    }
  } catch (error) {
    console.error('❌ Error getting progress:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get progress information',
      error: process.env.NODE_ENV !== 'production' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/monitoring/active-processes - Get all currently active processes
router.get('/active-processes', (req, res) => {
  try {
    const activeProcesses = comparisonService.getActiveProcesses();
    
    res.json({
      success: true,
      data: activeProcesses,
      count: activeProcesses.length
    });
    
    console.log(`📋 Active processes requested: ${activeProcesses.length} found`);
  } catch (error) {
    console.error('❌ Error getting active processes:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get active processes'
    });
  }
});

// GET /api/monitoring/history - Get comparison history
router.get('/history', async (req, res) => {
  try {
    const { storeId, limit = 10, offset = 0 } = req.query;
    
    const history = await databaseService.getComparisonHistory(storeId, limit, offset);
    
    res.json({
      success: true,
      data: history,
      count: history.length
    });

  } catch (error) {
    console.error('❌ Error fetching comparison history:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comparison history'
    });
  }
});

// GET /api/monitoring/health - Health check endpoint to verify all services
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {}
    };

    // Check database connection
    try {
      const dbConnected = await databaseService.testConnection();
      const tablesValid = await databaseService.validateTables();
      
      health.services.database = {
        connected: dbConnected,
        tablesValid: tablesValid,
        status: dbConnected && tablesValid ? 'healthy' : 'degraded'
      };
    } catch (error) {
      health.services.database = {
        connected: false,
        tablesValid: false,
        status: 'unhealthy',
        error: error.message
      };
    }

    // Check comparison service
    health.services.comparison = {
      activeProcesses: comparisonService.getActiveProcesses().length,
      status: 'healthy'
    };

    // Overall status
    const allHealthy = Object.values(health.services).every(service => service.status === 'healthy');
    health.status = allHealthy ? 'healthy' : 'degraded';

    res.json({
      success: true,
      data: health
    });

  } catch (error) {
    console.error('❌ Error in health check:', error.message);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
});

// DELETE /api/monitoring/cleanup-progress - Manual cleanup of old progress tracking
router.delete('/cleanup-progress', (req, res) => {
  try {
    const activeProcesses = comparisonService.getActiveProcesses();
    const cutoffTime = Date.now() - (30 * 60 * 1000); // 30 minutes ago
    
    let cleanedCount = 0;
    activeProcesses.forEach(process => {
      if (process.startTime < cutoffTime) {
        comparisonService.cleanupProgress(process.processId);
        cleanedCount++;
      }
    });
    
    res.json({
      success: true,
      message: `Cleaned up ${cleanedCount} old progress tracking entries`,
      cleanedCount
    });
    
    console.log(`🧹 Manual cleanup completed: ${cleanedCount} processes cleaned`);
  } catch (error) {
    console.error('❌ Error during manual cleanup:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup progress tracking'
    });
  }
});

module.exports = router;