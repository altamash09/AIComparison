class ComparisonService {
  constructor() {
    // Activity mapping (JSON labels to database ActivityIDs)
    this.activityMapping = {
      'person-employee': [1, 2, 3, 4], // Sales Desk, Stretching, Cleaning, Making Calls
      'person-customer': [5], // Intake
      'stretching': [2] // Map stretching label to Stretching activity (ID 2)
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

  async processComparison(jsonData, activities, monitoringActivities, processId = null) {
    const startTime = Date.now();
    const trackProgress = !!processId;
    
    try {
      console.log(`🚀 FOCUSED Processing comparison:
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
      
      const jsonActivities = this.extractJsonActivitiesOptimized(jsonData, activities);
      console.log(`⚡ Extracted ${jsonActivities.length} JSON activities in ${Date.now() - startTime}ms`);
      
      // Step 2: FOCUSED comparison - only matches and unmatches
      if (trackProgress) {
        this.updateProgress(processId, 2, `Comparing ${jsonActivities.length} JSON vs ${monitoringActivities.length} DB activities...`);
      }
      
      const comparisonStartTime = Date.now();
      const { matches, unmatches } = this.performFocusedComparison(
        jsonActivities, 
        monitoringActivities
      );
      console.log(`⚡ Focused comparison completed in ${Date.now() - comparisonStartTime}ms`);

      // Step 3: Calculate simple accuracy
      if (trackProgress) {
        this.updateProgress(processId, 3, `Calculating accuracy metrics...`);
      }

      // Update results with deduplication info
      const minuteLevelCount = this.getMinuteLevelActivityCount(jsonActivities);
      
      const totalDbActivities = monitoringActivities.length;
      const matchedActivities = matches.length;
      const missedActivities = unmatches.length;
      const accuracyPercentage = totalDbActivities > 0 ? ((matchedActivities / totalDbActivities) * 100) : 0;

      const totalTime = Date.now() - startTime;
      console.log(`⚡ FOCUSED RESULTS:
        - Database activities: ${totalDbActivities}
        - ✅ Matched (accurate): ${matchedActivities}
        - ❌ Unmatched (missed): ${missedActivities}
        - 🎯 Accuracy: ${accuracyPercentage.toFixed(2)}%
        - ⏱️ Processing time: ${totalTime}ms`);

      const results = {
        // FOCUSED RESULTS - only what you need
        matches,           // Activities found in BOTH JSON and Database (minute-level deduplicated)
        unmatches,         // Activities in Database but NOT in JSON (missed)
        
        // SIMPLE METRICS
        totalDbActivities,
        matchedCount: matchedActivities,
        unmatchedCount: missedActivities,
        accuracyPercentage: parseFloat(accuracyPercentage.toFixed(2)),
        
        // DEDUPLICATION INFO
        originalJsonActivitiesCount: jsonActivities.length,  // All activities including second-level duplicates
        minuteLevelJsonActivitiesCount: minuteLevelCount, // Unique minute-level activities used for comparison
        
        // PERFORMANCE INFO
        processingTime: new Date().toISOString(),
        performanceMetrics: {
          totalProcessingTimeMs: totalTime,
          activitiesProcessedPerSecond: Math.round((totalDbActivities / totalTime) * 1000)
        }
      };

      // Clean up progress tracking
      if (trackProgress) {
        setTimeout(() => this.cleanupProgress(processId), 30000);
      }

      return results;

    } catch (error) {
      console.error('❌ Error in focused comparison:', error);
      if (trackProgress) {
        this.cleanupProgress(processId);
      }
      throw new Error(`Focused comparison failed: ${error.message}`);
    }
  }

  // OPTIMIZED: Extract JSON activities using efficient data structures
  extractJsonActivitiesOptimized(jsonData, activities) {
    const jsonActivities = [];
    
    // Create activity lookup map for O(1) access instead of O(n) find operations
    const activityLookupMap = new Map();
    activities.forEach(activity => {
      activityLookupMap.set(activity.ActivityID, activity);
    });
    
    // Process all records in a single pass
    for (let recordIndex = 0; recordIndex < jsonData.length; recordIndex++) {
      const record = jsonData[recordIndex];
      
      if (record.bounds && Array.isArray(record.bounds) && record.bounds.length > 0) {
        for (let boundIndex = 0; boundIndex < record.bounds.length; boundIndex++) {
          const bound = record.bounds[boundIndex];
          
          if (bound.label) {
            const mappedActivityIds = this.activityMapping[bound.label] || [];
            
            if (mappedActivityIds.length === 0) {
              console.warn(`⚠️ No mapping found for label: ${bound.label}`);
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
                  boundIndex: boundIndex
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

  // FOCUSED: Simple comparison - only matches and unmatches
  performFocusedComparison(jsonActivities, monitoringActivities) {
    const matches = [];
    const unmatches = [];

    console.log('⚡ Starting FOCUSED comparison (matches vs unmatches only)...');
    console.log(`📊 Original JSON activities: ${jsonActivities.length}`);

    // STEP 1: Deduplicate JSON activities by minute-level timestamp for comparison
    const minuteLevelJsonActivities = this.deduplicateByMinute(jsonActivities);
    console.log(`📊 Minute-level deduplicated JSON activities: ${minuteLevelJsonActivities.length}`);

    // Create ultra-fast lookup map for minute-level JSON activities
    // Key format: "timestamp|activityId|camera"
    const jsonActivityMap = new Map();
    minuteLevelJsonActivities.forEach(jsonActivity => {
      const normalizedTimestamp = this.normalizeTimestampToMinute(jsonActivity.timestamp);
      const key = `${normalizedTimestamp}|${jsonActivity.activityId}|${jsonActivity.camera}`;
      jsonActivityMap.set(key, jsonActivity);
    });

    // Check each database activity to see if it exists in minute-level JSON
    monitoringActivities.forEach(dbActivity => {
      const normalizedTimestamp = this.normalizeTimestampToMinute(dbActivity.Timestamp);
      const key = `${normalizedTimestamp}|${dbActivity.ActivityID}|${dbActivity.CameraNo}`;
      
      const jsonMatch = jsonActivityMap.get(key);
      
      if (jsonMatch) {
        // ✅ MATCH: Activity found in BOTH JSON and Database
        matches.push({
          timestamp: dbActivity.Timestamp,
          activityId: dbActivity.ActivityID,
          activityName: dbActivity.ActivityName,
          camera: dbActivity.CameraNo,
          confidence: jsonMatch.confidence,
          zone: jsonMatch.zone,
          dbRecordId: dbActivity.MonitoringActivityID,
          jsonRecordIndex: jsonMatch.recordIndex,
          matchType: 'ACCURATE_DETECTION',
          originalJsonCount: jsonMatch.originalCount // How many JSON entries were in this minute
        });
      } else {
        // ❌ UNMATCH: Activity in Database but NOT in JSON (missed by AI)
        unmatches.push({
          timestamp: dbActivity.Timestamp,
          activityId: dbActivity.ActivityID,
          activityName: dbActivity.ActivityName,
          camera: dbActivity.CameraNo,
          dbRecordId: dbActivity.MonitoringActivityID,
          matchType: 'MISSED_BY_AI'
        });
      }
    });

    console.log(`⚡ FOCUSED Results:
      - Original JSON activities: ${jsonActivities.length}
      - Minute-level JSON activities: ${minuteLevelJsonActivities.length}
      - ✅ Matches (accurate detections): ${matches.length}
      - ❌ Unmatches (missed by AI): ${unmatches.length}
      - 🎯 Detection rate: ${monitoringActivities.length > 0 ? ((matches.length / monitoringActivities.length) * 100).toFixed(2) : 0}%`);

    return { matches, unmatches };
  }

  // NEW: Deduplicate JSON activities by minute-level timestamp
  deduplicateByMinute(jsonActivities) {
    const minuteGroups = new Map();
    
    // Group activities by minute-level timestamp + activityId + camera
    jsonActivities.forEach(activity => {
      const minuteTimestamp = this.normalizeTimestampToMinute(activity.timestamp);
      const groupKey = `${minuteTimestamp}|${activity.activityId}|${activity.camera}`;
      
      if (!minuteGroups.has(groupKey)) {
        // First occurrence in this minute - keep it and track count
        minuteGroups.set(groupKey, {
          ...activity,
          originalCount: 1,
          duplicates: []
        });
      } else {
        // Duplicate in same minute - increment count and store duplicate
        const existing = minuteGroups.get(groupKey);
        existing.originalCount++;
        existing.duplicates.push(activity);
      }
    });

    // Convert back to array and log deduplication info
    const deduplicatedActivities = Array.from(minuteGroups.values());
    
    // Log deduplication statistics
    const duplicateStats = deduplicatedActivities
      .filter(activity => activity.originalCount > 1)
      .map(activity => ({
        timestamp: activity.timestamp,
        activityName: activity.activityName,
        camera: activity.camera,
        originalCount: activity.originalCount
      }));
    
    if (duplicateStats.length > 0) {
      console.log('📊 Minute-level deduplication stats:');
      duplicateStats.forEach(stat => {
        console.log(`  • ${stat.activityName} at ${stat.camera} (${stat.timestamp}): ${stat.originalCount} entries in same minute`);
      });
    }

    return deduplicatedActivities;
  }

  // NEW: Normalize timestamp to minute level (remove seconds)
  normalizeTimestampToMinute(timestamp) {
    try {
      const date = new Date(timestamp);
      // Set seconds and milliseconds to 0 to get minute-level precision
      date.setSeconds(0);
      date.setMilliseconds(0);
      return date.toISOString();
    } catch (error) {
      console.warn(`⚠️ Invalid timestamp: ${timestamp}`);
      return timestamp;
    }
  }

  // NEW: Get minute-level activity count (for metrics)
  getMinuteLevelActivityCount(jsonActivities) {
    const minuteGroups = new Map();
    
    jsonActivities.forEach(activity => {
      const minuteTimestamp = this.normalizeTimestampToMinute(activity.timestamp);
      const groupKey = `${minuteTimestamp}|${activity.activityId}|${activity.camera}`;
      
      if (!minuteGroups.has(groupKey)) {
        minuteGroups.set(groupKey, true);
      }
    });
    
    return minuteGroups.size;
  }

  normalizeTimestamp(timestamp) {
    // Convert timestamp to consistent format for comparison
    try {
      return new Date(timestamp).toISOString();
    } catch (error) {
      console.warn(`⚠️ Invalid timestamp: ${timestamp}`);
      return timestamp;
    }
  }

  calculateOverallAccuracy(matches, jsonActivities, dbMissed) {
    const totalActivities = jsonActivities.length + dbMissed.length;
    const accuracy = totalActivities > 0 ? (matches.length / totalActivities) * 100 : 0;
    
    console.log(`📊 Overall accuracy calculation:
      - Matches: ${matches.length}
      - Total activities: ${totalActivities}
      - Accuracy: ${accuracy.toFixed(2)}%`);
    
    return accuracy;
  }

  // OPTIMIZED: Activity accuracy calculation using efficient grouping
  calculateActivityAccuracyOptimized(matches, jsonActivities, dbMissed, activities) {
    const activityAccuracy = {};
    
    // Group matches by activity ID for efficient counting
    const matchesByActivity = new Map();
    matches.forEach(match => {
      matchesByActivity.set(match.activityId, (matchesByActivity.get(match.activityId) || 0) + 1);
    });
    
    // Group all activities by activity ID for efficient counting
    const allActivitiesByActivity = new Map();
    [...jsonActivities, ...dbMissed].forEach(activity => {
      allActivitiesByActivity.set(activity.activityId, (allActivitiesByActivity.get(activity.activityId) || 0) + 1);
    });
    
    // Calculate accuracy for each activity type
    activities.forEach(activity => {
      const activityMatches = matchesByActivity.get(activity.ActivityID) || 0;
      const activityTotal = allActivitiesByActivity.get(activity.ActivityID) || 0;
      
      const accuracy = activityTotal > 0 ? (activityMatches / activityTotal) * 100 : 0;
      activityAccuracy[activity.ActivityName] = accuracy;
      
      console.log(`📈 ${activity.ActivityName}: ${activityMatches}/${activityTotal} = ${accuracy.toFixed(2)}%`);
    });

    return activityAccuracy;
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