const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3901;

console.log('🚀 Starting Activity Monitoring Server...');

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 }
});

// Import services with try-catch
let databaseService, emailService, comparisonService;

try {
  databaseService = require('./services/databaseService');
  emailService = require('./services/emailService'); 
  comparisonService = require('./services/comparisonService');
  console.log('✅ All services loaded');
} catch (error) {
  console.error('❌ Service loading error:', error.message);
  process.exit(1);
}

// Initialize database
databaseService.connect().catch(err => {
  console.warn('⚠️ Database connection failed:', err.message);
});

// Simple health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString()
  });
});

// Get activities
app.get('/api/activities', async (req, res) => {
  try {
    const activities = await databaseService.getActivities();
    res.json({
      success: true,
      activities: activities,
      count: activities.length
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// File comparison
app.post('/api/monitoring/compare', upload.single('jsonFile'), async (req, res) => {
  let filePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(fileContent);

    if (!Array.isArray(jsonData) || jsonData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON format'
      });
    }

    const storeId = req.body.storeId || jsonData[0]?.store;
    const companyId = req.body.companyId || jsonData[0]?.company;
    const monitoringDate = req.body.monitoringDate || jsonData[0]?.date;

    // Get data
    const activities = await databaseService.getActivities();
    const monitoringActivities = await databaseService.getMonitoringActivities(storeId, monitoringDate);

    // Process comparison
    const comparisonResults = await comparisonService.processComparison(
      jsonData,
      activities,
      monitoringActivities
    );

    // Add metadata
    comparisonResults.metadata = {
      storeId,
      companyId,
      monitoringDate,
      totalRecordsProcessed: jsonData.length,
      processingTime: new Date().toISOString()
    };

    // Log and email
    await databaseService.logComparisonResults(comparisonResults);
    
    try {
      await emailService.sendComparisonReport(comparisonResults);
    } catch (emailError) {
      console.warn('Email failed:', emailError.message);
    }

    res.json({
      success: true,
      data: comparisonResults,
      message: 'Comparison completed successfully'
    });

  } catch (error) {
    console.error('Comparison error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  } finally {
    if (filePath) {
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.warn('Cleanup failed:', cleanupError.message);
      }
    }
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
  console.log(`📋 Activities: http://localhost:${PORT}/api/activities`);
});