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
    
    //Committed this code for now and stopped logging in database
    // await databaseService.logComparisonResults(comparisonResults);
    
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

app.get('/api/image', (req, res) => {
  try {
    let imagePath = req.query.path;
    
    console.log('🖼️ Image request received:', { originalPath: imagePath });
    
    // Validate required parameter
    if (!imagePath) {
      return res.status(400).json({ 
        success: false, 
        error: 'Path parameter is required' 
      });
    }
    
    // URL decode the path
    imagePath = decodeURIComponent(imagePath);
    console.log('📂 Decoded path:', imagePath);
    
    // Convert forward slashes to backslashes for Windows UNC paths
    // Handle both formats: //server/share and \\server\share
    if (imagePath.startsWith('//')) {
      imagePath = imagePath.replace(/\//g, '\\');
    }
    
    // Ensure UNC path format (\\server\share)
    if (!imagePath.startsWith('\\\\')) {
      if (imagePath.startsWith('\\')) {
        imagePath = '\\' + imagePath;
      } else {
        imagePath = '\\\\' + imagePath;
      }
    }
    
    console.log('🔧 Processed path:', imagePath);
    
    // Security: Only allow paths to DVR Bot directory
    if (!imagePath.includes('DVR Bot')) {
      console.log('❌ Security: Path rejected - does not contain DVR Bot');
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied - Invalid path' 
      });
    }
    
    // Additional security: prevent directory traversal
    if (imagePath.includes('..') || imagePath.includes('/../')) {
      console.log('❌ Security: Path rejected - directory traversal attempt');
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied - Invalid path' 
      });
    }
    
    // Check if file exists
    console.log('🔍 Checking if file exists:', imagePath);
    
    if (!fs.existsSync(imagePath)) {
      console.log('❌ File not found:', imagePath);
      
      // Try alternative path formats
      const alternatives = [
        imagePath.replace(/\\\\/g, '/'),  // Try forward slashes
        imagePath.replace(/\//g, '\\'),   // Ensure backslashes
        '\\\\' + imagePath.replace(/^\\+/, ''), // Ensure double backslash start
      ];
      
      console.log('🔄 Trying alternative paths:', alternatives);
      
      let foundPath = null;
      for (const altPath of alternatives) {
        if (fs.existsSync(altPath)) {
          foundPath = altPath;
          console.log('✅ Found file at alternative path:', altPath);
          break;
        }
      }
      
      if (!foundPath) {
        return res.status(404).json({ 
          success: false, 
          error: 'Image file not found',
          requestedPath: imagePath,
          alternatives: alternatives.map(p => ({ path: p, exists: fs.existsSync(p) }))
        });
      }
      
      imagePath = foundPath;
    }
    
    // Get file stats
    const stats = fs.statSync(imagePath);
    if (!stats.isFile()) {
      console.log('❌ Path is not a file:', imagePath);
      return res.status(400).json({ 
        success: false, 
        error: 'Path is not a file' 
      });
    }
    
    console.log('✅ File found and valid:', imagePath, 'Size:', stats.size);
    
    // Set appropriate headers
    const ext = path.extname(imagePath).toLowerCase();
    const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 
                       ext === '.png' ? 'image/png' : 
                       ext === '.gif' ? 'image/gif' : 'application/octet-stream';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS if needed
    
    // Stream the file
    const fileStream = fs.createReadStream(imagePath);
    
    fileStream.on('error', (error) => {
      console.error('❌ Error streaming image:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          error: 'Error reading image file',
          details: error.message 
        });
      }
    });
    
    fileStream.on('end', () => {
      console.log('✅ Image streamed successfully:', imagePath);
    });
    
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('❌ Image endpoint error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Optional: Add a test endpoint to check network connectivity
app.get('/api/test-network', (req, res) => {
  try {
    const testPaths = [
      '\\\\10.144.70.130\\e\\DVR Bot',
      '//10.144.70.130/e/DVR Bot',
      '\\\\10.144.70.130\\e\\DVR Bot\\288'
    ];
    
    const results = testPaths.map(testPath => {
      try {
        const exists = fs.existsSync(testPath);
        let listing = null;
        
        if (exists) {
          try {
            listing = fs.readdirSync(testPath).slice(0, 5); // First 5 items
          } catch (e) {
            listing = `Error reading directory: ${e.message}`;
          }
        }
        
        return {
          path: testPath,
          exists: exists,
          listing: listing
        };
      } catch (error) {
        return {
          path: testPath,
          exists: false,
          error: error.message
        };
      }
    });
    
    res.json({
      success: true,
      networkAccess: results,
      serverInfo: {
        platform: process.platform,
        cwd: process.cwd(),
        env: {
          NODE_ENV: process.env.NODE_ENV,
          USER: process.env.USER || process.env.USERNAME
        }
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
