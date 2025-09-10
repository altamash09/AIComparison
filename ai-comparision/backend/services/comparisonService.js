class ComparisonService {
  constructor() {
    // Activity mapping (JSON labels to database ActivityIDs)
    this.activityMapping = {
      'person-employee': [1, 2, 3, 4], // Sales Desk, Stretching, Cleaning, Making Calls
      'person-customer': [5], // Intake
      'stretching': [2], // Map stretching label to Stretching activity (ID 2)
      'cleaning': [3], // Map cleaning label to Cleaning activity (ID 3)
      'sales': [1], // Map sales label to Sales Desk activity (ID 1)
      'calls': [4], // Map calls label to Making Calls activity (ID 4),
      'calling': [4] // Map calls label to Making Calls activity (ID 4)
    };
    
    // Progress tracking storage
    this.progressTracking = new Map();
    
    console.log('🔧 Comparison service initialized with activity mappings:', this.activityMapping);
  }

  // Initialize progress tracking for a process
  initializeProgress(processId) {
    const progress = {
      processId,
      percentage: 0,
      currentStep: 'Initializing...',
      stepIndex: 0,
      totalSteps: 4,
      startTime: Date.now(),
      steps: [
        'Preparing data structures...',
        'Extracting and indexing activities...',
        'Performing high-speed comparison...',
        'Generating results...'
      ]
    };
    
    this.progressTracking.set(processId, progress);
    return progress;
  }

  // Update progress for a specific process
  updateProgress(processId, stepIndex, customMessage = null) {
    const progress = this.progressTracking.get(processId);
    if (!progress) return;

    progress.stepIndex = stepIndex;
    progress.percentage = Math.round((stepIndex / progress.totalSteps) * 100);
    progress.currentStep = customMessage || progress.steps[stepIndex] || progress.currentStep;
    
    console.log(`📊 Progress Update [${processId}]: ${progress.percentage}% - ${progress.currentStep}`);
    
    this.progressTracking.set(processId, progress);
  }

  // Get current progress for a process
  getProgress(processId) {
    return this.progressTracking.get(processId) || null;
  }

  // Clean up completed processes
  cleanupProgress(processId) {
    this.progressTracking.delete(processId);
  }

  async processComparison(jsonData, activities, monitoringActivities, employeeData = null, processId = null) {
    const startTime = Date.now();
    const trackProgress = !!processId;
    
    try {
      console.log(`🚀 Processing comparison:
        - JSON records: ${jsonData.length}
        - Available activities: ${activities.length}
        - Database monitoring activities: ${monitoringActivities.length}
        - Process ID: ${processId || 'none'}`);

      // Initialize progress tracking if processId provided
      if (trackProgress) {
        this.initializeProgress(processId);
        this.updateProgress(processId, 0);
      }

      // Step 1: Extract JSON activities
      if (trackProgress) {
        this.updateProgress(processId, 1, `Extracting activities from ${jsonData.length} JSON records...`);
      }
      
      const allJsonActivities = this.extractJsonActivitiesOptimized(jsonData, activities);
      console.log(`⚡ Extracted ${allJsonActivities.length} JSON activities in ${Date.now() - startTime}ms`);
      
      // Step 2: Perform comparison
      if (trackProgress) {
        this.updateProgress(processId, 2, `Comparing ${allJsonActivities.length} JSON vs ${monitoringActivities.length} DB activities...`);
      }
      
      const comparisonStartTime = Date.now();
      const { matches, unmatchedDb, unmatchedJson } = this.performDetailedComparison(
        allJsonActivities, 
        monitoringActivities
      );
      console.log(`⚡ Comparison completed in ${Date.now() - comparisonStartTime}ms`);

      // Step 3: Calculate metrics
      if (trackProgress) {
        this.updateProgress(processId, 3, `Calculating accuracy metrics...`);
      }

      const totalDbActivities = monitoringActivities.length;
      const totalJsonActivities = allJsonActivities.length;
      const matchedActivities = matches.length;
      const accuracyPercentage = totalDbActivities > 0 ? ((matchedActivities / totalDbActivities) * 100) : 0;

      const totalTime = Date.now() - startTime;
      console.log(`⚡ RESULTS:
        - Database activities: ${totalDbActivities}
        - JSON activities: ${totalJsonActivities}
        - ✅ Matched (accurate): ${matchedActivities}
        - ❌ Unmatched DB: ${unmatchedDb.length}
        - ❌ Unmatched JSON: ${unmatchedJson.length}
        - 🎯 Accuracy: ${accuracyPercentage.toFixed(2)}%
        - ⏱️ Processing time: ${totalTime}ms`);

      const results = {
        // Main comparison results
        matches,                    // Activities found in BOTH JSON and Database
        unmatchedDb,               // Activities in Database but NOT in JSON
        unmatchedJson,             // Activities in JSON but NOT in Database
        
        // All activities for display
        allDbActivities: monitoringActivities,
        allJsonActivities: allJsonActivities,
        
        // Metrics
        totalDbActivities,
        totalJsonActivities,
        matchedCount: matchedActivities,
        unmatchedDbCount: unmatchedDb.length,
        unmatchedJsonCount: unmatchedJson.length,
        accuracyPercentage: parseFloat(accuracyPercentage.toFixed(2)),
        
        // Performance info
        processingTime: new Date().toISOString(),
        performanceMetrics: {
          totalProcessingTimeMs: totalTime,
          activitiesProcessedPerSecond: Math.round((totalDbActivities / totalTime) * 1000)
        },
        employeeData: employeeData || []
      };

      // Clean up progress tracking
      if (trackProgress) {
        setTimeout(() => this.cleanupProgress(processId), 30000);
      }

      return results;

    } catch (error) {
      console.error('❌ Error in comparison:', error);
      if (trackProgress) {
        this.cleanupProgress(processId);
      }
      throw new Error(`Comparison failed: ${error.message}`);
    }
  }

  // Extract JSON activities with proper activity mapping
  extractJsonActivitiesOptimized(jsonData, activities) {
    const jsonActivities = [];
    
    // Create activity lookup map for O(1) access
    const activityLookupMap = new Map();
    activities.forEach(activity => {
      activityLookupMap.set(activity.ActivityID, activity);
    });
    
    // Process all records
    for (let recordIndex = 0; recordIndex < jsonData.length; recordIndex++) {
      const record = jsonData[recordIndex];
      
      if (record.bounds && Array.isArray(record.bounds) && record.bounds.length > 0) {
        for (let boundIndex = 0; boundIndex < record.bounds.length; boundIndex++) {
          const bound = record.bounds[boundIndex];
          
          if (bound.label) {
            const mappedActivityIds = this.activityMapping[bound.label] || [];
            
            if (mappedActivityIds.length === 0) {
              //console.warn(`⚠️ No mapping found for label: ${bound.label}`);
              // Still add it to the list for display purposes
              jsonActivities.push({
                timestamp: record.timestamp,
                activityId: null,
                activityName: `Unmapped: ${bound.label}`,
                label: bound.label,
                camera: record.camera,
                zone: bound.zone,
                confidence: bound.confidence || 0,
                image: record.image,
                recordIndex: recordIndex,
                boundIndex: boundIndex,
                isMapped: false
              });
              continue;
            }
            
            // Process all mapped activity IDs
            for (const activityId of mappedActivityIds) {
              const activity = activityLookupMap.get(activityId);
              if (activity) {
                jsonActivities.push({
                  timestamp: record.timestamp,
                  activityId: activityId,
                  activityName: activity.ActivityName,
                  label: bound.label,
                  camera: record.camera,
                  zone: bound.zone,
                  confidence: bound.confidence || 0,
                  image: record.image,
                  recordIndex: recordIndex,
                  boundIndex: boundIndex,
                  isMapped: true
                });
              } else {
                console.warn(`⚠️ Activity not found in database: ID ${activityId}`);
              }
            }
          }
        }
      }
    }

    // Log label distribution
    const labelCounts = {};
    jsonActivities.forEach(activity => {
      labelCounts[activity.label] = (labelCounts[activity.label] || 0) + 1;
    });
    console.log('📈 JSON label distribution:', labelCounts);

    return jsonActivities;
  }

  // Detailed comparison that tracks all three categories
  performDetailedComparison(jsonActivities, monitoringActivities) {
    const matches = [];
    const unmatchedDb = [];
    const unmatchedJson = [];

    console.log('⚡ Starting detailed comparison...');

    // Create lookup map for JSON activities
    const jsonActivityMap = new Map();
    jsonActivities.forEach((jsonActivity, index) => {
      if (jsonActivity.activityId) { // Only mapped activities
        const key = `${this.normalizeTimestamp(jsonActivity.timestamp)}|${jsonActivity.activityId}`;
        if (!jsonActivityMap.has(key)) {
          jsonActivityMap.set(key, []);
        }
        jsonActivityMap.get(key).push({ ...jsonActivity, originalIndex: index });
      }
    });

    // Track which JSON activities were matched
    const matchedJsonIndices = new Set();

    // Check each database activity
    monitoringActivities.forEach(dbActivity => {
      const key = `${this.normalizeTimestamp(dbActivity.Timestamp)}|${dbActivity.ActivityID}`;
      const jsonMatches = jsonActivityMap.get(key);
      
      if (jsonMatches && jsonMatches.length > 0) {
        // Match found - take the first one
        const jsonMatch = jsonMatches[0];
        matchedJsonIndices.add(jsonMatch.originalIndex);
        
        matches.push({
          timestamp: dbActivity.Timestamp,
          activityId: dbActivity.ActivityID,
          activityName: dbActivity.ActivityName,
          camera: jsonMatch.camera,
          confidence: jsonMatch.confidence,
          zone: jsonMatch.zone,
          label: jsonMatch.label,
          dbRecordId: dbActivity.MonitoringActivityID,
          jsonRecordIndex: jsonMatch.recordIndex,
          matchType: 'ACCURATE_DETECTION'
        });
      } else {
        // No match found in JSON
        unmatchedDb.push({
          timestamp: dbActivity.Timestamp,
          activityId: dbActivity.ActivityID,
          activityName: dbActivity.ActivityName,
          camera: dbActivity.CameraNo,
          dbRecordId: dbActivity.MonitoringActivityID,
          matchType: 'MISSED_BY_JSON'
        });
      }
    });

    // Find unmatched JSON activities
    jsonActivities.forEach((jsonActivity, index) => {
      if (!matchedJsonIndices.has(index)) {
        unmatchedJson.push({
          timestamp: jsonActivity.timestamp,
          activityId: jsonActivity.activityId,
          activityName: jsonActivity.activityName,
          camera: jsonActivity.camera,
          confidence: jsonActivity.confidence,
          zone: jsonActivity.zone,
          label: jsonActivity.label,
          recordIndex: jsonActivity.recordIndex,
          matchType: jsonActivity.isMapped ? 'JSON_ONLY_DETECTION' : 'UNMAPPED_LABEL'
        });
      }
    });

    console.log(`⚡ Detailed Results:
      - ✅ Matches (in both): ${matches.length}
      - ❌ Unmatched DB (missed by JSON): ${unmatchedDb.length}
      - ❌ Unmatched JSON (not in DB): ${unmatchedJson.length}`);

    return { matches, unmatchedDb, unmatchedJson };
  }

  normalizeTimestamp(timestamp) {
    try {
      return new Date(timestamp).toISOString();
    } catch (error) {
      console.warn(`⚠️ Invalid timestamp: ${timestamp}`);
      return timestamp;
    }
  }

  // Update activity mapping if needed
  updateActivityMapping(newMapping) {
    this.activityMapping = { ...this.activityMapping, ...newMapping };
    console.log('🔧 Activity mapping updated:', this.activityMapping);
  }

  // Get all active processes (for monitoring)
  getActiveProcesses() {
    return Array.from(this.progressTracking.entries()).map(([processId, progress]) => ({
      processId,
      ...progress
    }));
  }
}

module.exports = new ComparisonService();