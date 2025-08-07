const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    this.transporter = null;
    this.init();
  }

  init() {
    try {
      // Fix: Use createTransport instead of createTransporter
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
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
    } catch (error) {
      console.error('❌ Email service initialization failed:', error.message);
      // Don't throw error, just log it so the app can continue
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
        from: 'ai-comparision@rebiz.com',
        to: recipients,
        subject: `Activity Monitoring Report - Store ${reportData.metadata?.storeId} - ${new Date().toLocaleDateString()}`,
        html: htmlContent,
        attachments: [{
          filename: `activity-report-${reportData.metadata?.storeId}-${new Date().toISOString().split('T')[0]}.json`,
          content: JSON.stringify(reportData, null, 2),
          contentType: 'application/json'
        }]
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', result.messageId);
      console.log('📧 Sent to:', recipients.join(', '));
      
      return result;
      
    } catch (error) {
      console.error('❌ Error sending email:', error.message);
      console.log('📧 Falling back to console logging...');
      this.logReportToConsole(reportData);
      
      // Don't throw error, just return a fallback result
      return { messageId: 'fallback-logged', error: error.message };
    }
  }

  logReportToConsole(reportData) {
    console.log(`
📊 ============= EMAIL REPORT (Console Fallback) =============
🏪 Store: ${reportData.metadata?.storeId} | Company: ${reportData.metadata?.companyId}
📅 Date: ${reportData.metadata?.monitoringDate}
📈 Overall Accuracy: ${reportData.overallAccuracy}%
✅ Total Matches: ${reportData.totalMatches}
📊 JSON Activities: ${reportData.totalJsonActivities}
💾 Database Activities: ${reportData.totalDbActivities}
⚠️ JSON Missed: ${reportData.jsonMissed?.length || 0}
❌ DB Missed: ${reportData.dbMissed?.length || 0}
🕒 Processing Time: ${reportData.processingTime}
============================================================
    `);
  }

  generateHtmlReport(data) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Activity Monitoring Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
            .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .summary-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .summary-table th, .summary-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            .summary-table th { background-color: #f8f9fa; font-weight: bold; }
            .accuracy-high { color: #28a745; font-weight: bold; }
            .accuracy-medium { color: #ffc107; font-weight: bold; }
            .accuracy-low { color: #dc3545; font-weight: bold; }
            .section { margin: 30px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #eee; color: #666; font-size: 12px; }
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
              <h2>📊 Summary</h2>
              <table class="summary-table">
                <tr><th>Metric</th><th>Value</th></tr>
                <tr><td><strong>Overall Accuracy</strong></td><td class="${data.overallAccuracy > 80 ? 'accuracy-high' : data.overallAccuracy > 60 ? 'accuracy-medium' : 'accuracy-low'}">${data.overallAccuracy}%</td></tr>
                <tr><td><strong>Total Matches</strong></td><td>${data.totalMatches}</td></tr>
                <tr><td><strong>JSON Activities</strong></td><td>${data.totalJsonActivities}</td></tr>
                <tr><td><strong>Database Activities</strong></td><td>${data.totalDbActivities}</td></tr>
                <tr><td><strong>JSON Missed</strong></td><td>${data.jsonMissed?.length || 0}</td></tr>
                <tr><td><strong>Database Missed</strong></td><td>${data.dbMissed?.length || 0}</td></tr>
              </table>
            </div>

            <div class="section">
              <h2>🎯 Individual Activity Accuracy</h2>
              <table class="summary-table">
                <tr><th>Activity</th><th>Accuracy</th></tr>
                ${Object.entries(data.activityAccuracy || {}).map(([activity, accuracy]) => 
                  `<tr><td>${activity}</td><td class="${accuracy > 80 ? 'accuracy-high' : accuracy > 60 ? 'accuracy-medium' : 'accuracy-low'}">${accuracy.toFixed(2)}%</td></tr>`
                ).join('')}
              </table>
            </div>

            <div class="footer">
              <p><em>Complete data is attached as JSON file. This report was generated automatically by the Activity Monitoring System.</em></p>
              <p><strong>Processing Time:</strong> ${data.processingTime}</p>
              <p><strong>Records Processed:</strong> ${data.metadata?.totalRecordsProcessed || 0}</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

module.exports = new EmailService();