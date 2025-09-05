const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    this.transporter = null;
    this.init();
  }

  init() {
    try {
      // Check if required environment variables are present
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('⚠️ SMTP credentials not found in environment variables');
        console.warn('📧 Required: SMTP_USER and SMTP_PASS');
        console.warn('🔧 Optional: SMTP_HOST, SMTP_PORT, EMAIL_RECIPIENTS');
        this.transporter = null;
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      console.log('📧 Email service initialized successfully');
      console.log(`📡 SMTP Host: ${process.env.SMTP_HOST || 'smtp.gmail.com'}`);
      console.log(`🔌 SMTP Port: ${process.env.SMTP_PORT || 587}`);
      console.log(`👤 SMTP User: ${process.env.SMTP_USER}`);
      
      // Test the connection
      this.verifyConnection();
      
    } catch (error) {
      console.error('❌ Email service initialization failed:', error.message);
      this.transporter = null;
    }
  }

  async verifyConnection() {
    if (!this.transporter) return;
    
    try {
      await this.transporter.verify();
      console.log('✅ SMTP connection verified successfully');
    } catch (error) {
      console.error('❌ SMTP connection verification failed:', error.message);
      console.log('💡 Common issues:');
      console.log('   - Incorrect SMTP credentials');
      console.log('   - Gmail: Use App Passwords instead of regular password');
      console.log('   - Check if 2FA is enabled and create app-specific password');
      console.log('   - Verify SMTP settings for your email provider');
      this.transporter = null;
    }
  }

  async sendComparisonReport(reportData) {
    try {
      if (!this.transporter) {
        console.warn('⚠️ Email transporter not available, logging report instead');
        this.logReportToConsole(reportData);
        return { messageId: 'console-logged' };
      }

      // Get recipients from environment or use defaults
      const recipients = process.env.EMAIL_RECIPIENTS 
        ? process.env.EMAIL_RECIPIENTS.split(',').map(email => email.trim())
        : ['manager@company.com', 'analyst@company.com'];

      const htmlContent = this.generateHtmlReport(reportData);
      
      const mailOptions = {
        from: 'ai-comparison@rebiz.com',
        to: recipients,
        subject: `Stretch Zone AI Comparison Report - Store ${reportData.metadata?.storeId} - ${new Date().toLocaleDateString()}`,
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', result.messageId);
      console.log('📧 Sent to:', recipients.join(', '));
      
      return result;
      
    } catch (error) {
      console.error('❌ Error sending email:', error.message);
      console.log('📧 Falling back to console logging...');
      this.logReportToConsole(reportData);
      
      return { messageId: 'fallback-logged', error: error.message };
    }
  }

  logReportToConsole(reportData) {
    console.log(`
📊 ============= EMAIL REPORT (Console Fallback) =============
🏪 Store: ${reportData.metadata?.storeId} | Company: ${reportData.metadata?.companyId}
📅 Date: ${reportData.metadata?.monitoringDate}
📈 Overall Accuracy: ${reportData.accuracyPercentage}%
✅ Accurate Matches: ${reportData.matchedCount}
📊 JSON Activities: ${reportData.totalJsonActivities}
💾 Database Activities: ${reportData.totalDbActivities}
❌ Unmatched DB: ${reportData.unmatchedDbCount || 0}
❌ Unmatched JSON: ${reportData.unmatchedJsonCount || 0}
🕒 Processing Time: ${reportData.processingTime}
============================================================
    `);
  }

  // Helper function to calculate activity-wise accuracy based on timestamp matching
  calculateActivityWiseAccuracy(data) {
    console.log('🔍 ===========================================');
    console.log('🔍 DEBUGGING ACTIVITY-WISE ACCURACY CALCULATION');
    console.log('🔍 ===========================================');
    
    console.log('📊 Overall Data Summary:');
    console.log(`  - Overall Accuracy: ${data.accuracyPercentage}%`);
    console.log(`  - Total Matched: ${data.matchedCount}`);
    console.log(`  - Total DB Activities: ${data.totalDbActivities}`);
    console.log(`  - Total JSON Activities: ${data.totalJsonActivities}`);
    console.log(`  - Unmatched DB Count: ${data.unmatchedDbCount}`);
    console.log(`  - Unmatched JSON Count: ${data.unmatchedJsonCount}`);
    
    console.log('\n📊 Raw Data Arrays:');
    console.log(`  - data.matches length: ${data.matches?.length || 0}`);
    console.log(`  - data.unmatchedDb length: ${data.unmatchedDb?.length || 0}`);
    console.log(`  - data.unmatchedJson length: ${data.unmatchedJson?.length || 0}`);
    
    // Show sample data structures
    if (data.matches && data.matches.length > 0) {
      console.log('\n🔍 Sample Match Data:');
      console.log(JSON.stringify(data.matches[0], null, 2));
    }
    
    if (data.unmatchedDb && data.unmatchedDb.length > 0) {
      console.log('\n🔍 Sample Unmatched DB Activity:');
      console.log(JSON.stringify(data.unmatchedDb[0], null, 2));
    }
    
    if (data.unmatchedJson && data.unmatchedJson.length > 0) {
      console.log('\n🔍 Sample Unmatched JSON Activity:');
      console.log(JSON.stringify(data.unmatchedJson[0], null, 2));
    }

    if (!data.matches && !data.unmatchedDb) {
      console.log('⚠️ No activity data found for breakdown');
      return {};
    }

    const activityStats = {};

    // Helper function to safely get activity name from different possible structures
    const getActivityName = (item) => {
      if (!item) return 'Unknown Activity';
      
      // Try multiple possible property names
      const name = item.activityName || 
                   item.activity_name || 
                   item.activity || 
                   item.name ||
                   item.dbActivity?.activityName ||
                   item.dbActivity?.activity_name ||
                   item.dbActivity?.activity ||
                   item.jsonActivity?.activityName ||
                   item.jsonActivity?.activity_name ||
                   item.jsonActivity?.activity ||
                   'Unknown Activity';
      
      return name;
    };

    // Helper function to initialize activity stats
    const initActivityStats = (activityName) => {
      if (!activityStats[activityName]) {
        activityStats[activityName] = {
          matched: 0,           // Found in both DB and JSON at same timestamp
          unmatchedDb: 0,       // Found in DB but not in JSON (AI missed it)
          unmatchedJson: 0,     // Found in JSON but not in DB (AI false positive)
          total: 0,             // Total DB activities (matched + unmatchedDb)
          accuracy: 0,          // matched / total * 100
          jsonDetections: 0,    // Total JSON detections (matched + unmatchedJson)
          confidence: []
        };
      }
    };

    console.log('\n📊 PROCESSING MATCHED ACTIVITIES...');
    // Process MATCHED activities (found in both DB and JSON at same timestamp)
    if (data.matches && Array.isArray(data.matches)) {
      data.matches.forEach((match, index) => {
        const activityName = getActivityName(match);
        
        if (index < 5) { // Debug first 5 matches
          console.log(`  Match ${index + 1}: "${activityName}"`);
        }
        
        initActivityStats(activityName);
        activityStats[activityName].matched++;
        activityStats[activityName].jsonDetections++;
        
        // Try to extract confidence
        const confidence = match.confidence || 
                          match.score || 
                          match.similarity ||
                          match.jsonActivity?.confidence ||
                          0;
        
        if (confidence > 0) {
          activityStats[activityName].confidence.push(confidence);
        }
      });
    }

    console.log('\n📊 PROCESSING UNMATCHED DB ACTIVITIES (AI MISSED THESE)...');
    // Process UNMATCHED DB activities (DB has it, JSON doesn't - AI missed these)
    if (data.unmatchedDb && Array.isArray(data.unmatchedDb)) {
      data.unmatchedDb.forEach((dbActivity, index) => {
        const activityName = getActivityName(dbActivity);
        
        if (index < 5) { // Debug first 5
          console.log(`  Unmatched DB ${index + 1}: "${activityName}"`);
          if (index === 0) {
            console.log(`    Full object:`, JSON.stringify(dbActivity, null, 2));
          }
        }
        
        initActivityStats(activityName);
        activityStats[activityName].unmatchedDb++;
      });
    }

    console.log('\n📊 PROCESSING UNMATCHED JSON ACTIVITIES (AI FALSE POSITIVES)...');
    // Process UNMATCHED JSON activities (JSON has it, DB doesn't - AI false positives)
    if (data.unmatchedJson && Array.isArray(data.unmatchedJson)) {
      data.unmatchedJson.forEach((jsonActivity, index) => {
        const activityName = getActivityName(jsonActivity);
        
        if (index < 5) { // Debug first 5
          console.log(`  Unmatched JSON ${index + 1}: "${activityName}"`);
        }
        
        initActivityStats(activityName);
        activityStats[activityName].unmatchedJson++;
        activityStats[activityName].jsonDetections++;
      });
    }

    console.log('\n📊 CALCULATING FINAL ACCURACY...');
    // Calculate accuracy for each activity type
    Object.keys(activityStats).forEach(activityName => {
      const stats = activityStats[activityName];
      
      // Total DB activities = matched + unmatched DB (what should have been detected)
      stats.total = stats.matched + stats.unmatchedDb;
      
      // Accuracy = how many DB activities were correctly detected by AI
      stats.accuracy = stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0;
      
      // Calculate average confidence for matched activities
      if (stats.confidence.length > 0) {
        stats.avgConfidence = stats.confidence.reduce((sum, conf) => sum + conf, 0) / stats.confidence.length;
      } else {
        stats.avgConfidence = 0;
      }
      
      console.log(`  ${activityName}:`);
      console.log(`    - Matched: ${stats.matched}`);
      console.log(`    - Unmatched DB: ${stats.unmatchedDb}`);
      console.log(`    - Total DB: ${stats.total}`);
      console.log(`    - Accuracy: ${stats.accuracy}%`);
      console.log(`    - JSON Detections: ${stats.jsonDetections}`);
    });

    // Verify our calculations match the overall stats
    const totalMatched = Object.values(activityStats).reduce((sum, stats) => sum + stats.matched, 0);
    const totalDbActivities = Object.values(activityStats).reduce((sum, stats) => sum + stats.total, 0);
    const calculatedOverallAccuracy = totalDbActivities > 0 ? Math.round((totalMatched / totalDbActivities) * 100) : 0;
    
    console.log('\n📊 VERIFICATION:');
    console.log(`  - Sum of individual matched: ${totalMatched}`);
    console.log(`  - Sum of individual total DB: ${totalDbActivities}`);
    console.log(`  - Calculated overall accuracy: ${calculatedOverallAccuracy}%`);
    console.log(`  - Reported overall accuracy: ${data.accuracyPercentage}%`);
    console.log(`  - Match: ${calculatedOverallAccuracy === data.accuracyPercentage ? '✅' : '❌'}`);

    console.log('🔍 ===========================================');
    console.log('🔍 END DEBUGGING');
    console.log('🔍 ===========================================\n');

    return activityStats;
  }

  generateHtmlReport(data) {
    const activityStats = this.calculateActivityWiseAccuracy(data);

    // Helper function to get activity summary with accuracy
    const getActivitySummaryWithAccuracy = () => {
      if (Object.keys(activityStats).length === 0) {
        return '<tr><td colspan="5">No activity data available</td></tr>';
      }
      
      return Object.entries(activityStats)
        .sort(([,a], [,b]) => b.accuracy - a.accuracy) // Sort by accuracy descending
        .map(([name, stats]) => {
          const accuracyClass = stats.accuracy >= 80 ? 'accuracy-high' : 
                               stats.accuracy >= 60 ? 'accuracy-medium' : 'accuracy-low';
          const avgConfidence = stats.avgConfidence ? (stats.avgConfidence * 100).toFixed(1) : 'N/A';
          
          return `
            <tr>
              <td><strong>${name}</strong></td>
              <td class="${accuracyClass}">${stats.accuracy}%</td>
              <td>${stats.matched}</td>
              <td>${stats.total}</td>
              <td>${avgConfidence}%</td>
            </tr>
          `;
        }).join('');
    };

    // Helper function to format confidence levels
    const getConfidenceSummary = () => {
      if (!data.matches || data.matches.length === 0) {
        return 'No confidence data available';
      }
      
      const confidenceLevels = { high: 0, medium: 0, low: 0 };
      data.matches.forEach(match => {
        const confidence = match.confidence || 0;
        if (confidence > 0.8) confidenceLevels.high++;
        else if (confidence > 0.5) confidenceLevels.medium++;
        else confidenceLevels.low++;
      });
      
      return `High (>80%): ${confidenceLevels.high}, Medium (50-80%): ${confidenceLevels.medium}, Low (<50%): ${confidenceLevels.low}`;
    };

    // Get worst performing activities for insights
    const getWorstPerformingActivities = () => {
      const sortedActivities = Object.entries(activityStats)
        .filter(([, stats]) => stats.total > 0)
        .sort(([,a], [,b]) => a.accuracy - b.accuracy)
        .slice(0, 3);

      if (sortedActivities.length === 0) return '';

      return sortedActivities.map(([name, stats]) => 
        `<li><strong>${name}</strong>: ${stats.accuracy}% accuracy (${stats.matched}/${stats.total} detected)</li>`
      ).join('');
    };

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Activity Monitoring Comparison Report</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              background-color: #f5f5f5; 
              line-height: 1.6;
            }
            .container { 
              background: white; 
              padding: 30px; 
              border-radius: 8px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white; 
              padding: 20px; 
              border-radius: 8px; 
              margin-bottom: 20px; 
            }
            .summary-table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 20px 0; 
            }
            .summary-table th, .summary-table td { 
              padding: 12px; 
              text-align: left; 
              border-bottom: 1px solid #ddd; 
            }
            .summary-table th { 
              background-color: #f8f9fa; 
              font-weight: bold; 
            }
            .activity-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
              font-size: 14px;
            }
            .activity-table th {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 12px 8px;
              text-align: center;
              font-weight: bold;
            }
            .activity-table td {
              padding: 10px 8px;
              text-align: center;
              border-bottom: 1px solid #eee;
            }
            .activity-table tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .activity-table tr:hover {
              background-color: #f5f5f5;
            }
            .accuracy-high { color: #28a745; font-weight: bold; }
            .accuracy-medium { color: #ffc107; font-weight: bold; }
            .accuracy-low { color: #dc3545; font-weight: bold; }
            .section { 
              margin: 30px 0; 
            }
            .footer { 
              margin-top: 30px; 
              padding-top: 20px; 
              border-top: 2px solid #eee; 
              color: #666; 
              font-size: 12px; 
            }
            .metrics-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 15px;
              margin: 20px 0;
            }
            .metric-card {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
              text-align: center;
            }
            .metric-number {
              font-size: 2em;
              font-weight: bold;
              color: #333;
            }
            .metric-label {
              color: #666;
              font-size: 0.9em;
            }
            .insight-box {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
              margin: 15px 0;
            }
            .alert-warning {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 15px 0;
            }
            .alert-success {
              background: #d4edda;
              border-left: 4px solid #28a745;
              padding: 15px;
              margin: 15px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔍 Activity Monitoring Comparison Report</h1>
              <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>Store:</strong> ${data.metadata?.storeId || 'N/A'} | <strong>Company:</strong> ${data.metadata?.companyId || 'N/A'}</p>
              <p><strong>Date:</strong> ${data.metadata?.monitoringDate || 'N/A'}</p>
            </div>
            
            <div class="section">
              <h2>📊 Executive Summary</h2>
              <div class="metrics-grid">
                <div class="metric-card">
                  <div class="metric-number ${data.accuracyPercentage > 80 ? 'accuracy-high' : data.accuracyPercentage > 60 ? 'accuracy-medium' : 'accuracy-low'}">${data.accuracyPercentage || 0}%</div>
                  <div class="metric-label">Overall Accuracy</div>
                </div>
                <div class="metric-card">
                  <div class="metric-number">${data.matchedCount || 0}</div>
                  <div class="metric-label">Accurate Matches</div>
                </div>
                <div class="metric-card">
                  <div class="metric-number">${data.totalDbActivities || 0}</div>
                  <div class="metric-label">Monitored Activities</div>
                </div>
                <!--
                <div class="metric-card">
                  <div class="metric-number">${data.totalJsonActivities || 0}</div>
                  <div class="metric-label">JSON Activities</div>
                </div>
                -->
                <div class="metric-card">
                  <div class="metric-number">${Object.keys(activityStats).length}</div>
                  <div class="metric-label">Activity Types</div>
                </div>
              </div>
            </div>

            <div class="section">
              <h2>🎯 Activity-wise Performance Analysis</h2>
              <p>Detailed accuracy breakdown by individual activity type:</p>
              <table class="activity-table">
                <thead>
                  <tr>
                    <th>Activity Name</th>
                    <th>Accuracy %</th>
                    <th>Matched</th>
                    <th>Total in DB</th>
                    <th>Avg Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  ${getActivitySummaryWithAccuracy()}
                </tbody>
              </table>
            </div>

            <div class="section">
              <h2>📈 Overall System Analysis</h2>
              <table class="summary-table">
                <tr><th>Metric</th><th>Value</th><th>Description</th></tr>
                <tr>
                  <td><strong>Overall Accuracy</strong></td>
                  <td class="${data.accuracyPercentage > 80 ? 'accuracy-high' : data.accuracyPercentage > 60 ? 'accuracy-medium' : 'accuracy-low'}">${data.accuracyPercentage || 0}%</td>
                  <td>Percentage of database activities that were correctly detected by AI</td>
                </tr>
                <tr>
                  <td><strong>Accurate Matches</strong></td>
                  <td>${data.matchedCount || 0}</td>
                  <td>Activities found in both JSON and database</td>
                </tr>
                <tr>
                  <td><strong>Database Activities</strong></td>
                  <td>${data.totalDbActivities || 0}</td>
                  <td>Total activities recorded in database</td>
                </tr>
                <!--
                <tr>
                  <td><strong>JSON Activities</strong></td>
                  <td>${data.totalJsonActivities || 0}</td>
                  <td>Total activities detected by AI system</td>
                </tr>
                -->
                <tr>
                  <td><strong>Missed by AI</strong></td>
                  <td>${data.unmatchedDbCount || 0}</td>
                  <td>Database activities not detected by AI</td>
                </tr>
              </table>
            </div>

            <div class="section">
              <h2>🔍 Performance Insights</h2>
              
              <div class="insight-box">
                ${data.accuracyPercentage >= 90 
                  ? '<div class="alert-success"><strong>✅ Excellent Performance:</strong> Overall AI detection accuracy is excellent (≥90%). The system is performing very well across most activities.</div>'
                  : data.accuracyPercentage >= 75
                  ? '<div class="alert-success"><strong>👍 Good Performance:</strong> Overall AI detection accuracy is good (75-89%). Consider minor optimizations for specific activities.</div>'
                  : data.accuracyPercentage >= 60
                  ? '<div class="alert-warning"><strong>⚠️ Moderate Performance:</strong> Overall AI detection accuracy is moderate (60-74%). Review system parameters and activity-specific performance.</div>'
                  : '<div class="alert-warning"><strong>❌ Poor Performance:</strong> Overall AI detection accuracy is low (<60%). Immediate attention required for multiple activities.</div>'
                }
              </div>

              ${getWorstPerformingActivities() ? `
                <div class="insight-box">
                  <h4>🎯 Activities Needing Attention:</h4>
                  <ul>${getWorstPerformingActivities()}</ul>
                </div>
              ` : ''}

              <div class="insight-box">
                <h4>📊 AI Confidence Distribution:</h4>
                <p>${getConfidenceSummary()}</p>
              </div>

              ${(data.unmatchedJsonCount || 0) > (data.matchedCount || 0) 
                ? '<div class="alert-warning"><strong>🔎 Detection Sensitivity:</strong> AI is detecting significantly more activities than the database contains. Consider reviewing detection sensitivity or investigating if the database is missing activities.</div>'
                : ''
              }
              
              ${(data.unmatchedDbCount || 0) > (data.matchedCount || 0) 
                ? '<div class="alert-warning"><strong>📊 Detection Coverage:</strong> Many database activities are not being detected by AI. Focus on improving detection algorithms for missed activity types.</div>'
                : ''
              }
            </div>

            <div class="footer">
              <p><em>Complete detailed data is attached as JSON file. This report was generated automatically by the Activity Monitoring Comparison System.</em></p>
              <p><strong>Processing Time:</strong> ${data.processingTime}</p>
              <p><strong>Records Processed:</strong> ${data.metadata?.totalRecordsProcessed || 0} JSON records, ${data.metadata?.totalJsonBounds || 0} activity bounds</p>
              <p><strong>System Performance:</strong> ${data.performanceMetrics?.totalProcessingTimeMs || 0}ms total, ${data.performanceMetrics?.activitiesProcessedPerSecond || 0} activities/sec</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

module.exports = new EmailService();